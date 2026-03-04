"use client";

import { useContext, useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSocket } from "@/hooks/useSocket";
import { AuthContext } from "@/context/AuthContext";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users, Check, X, Crown } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Participant {
    socketId: string;
    userName: string;
    stream?: MediaStream;
}

interface WaitingUser {
    socketId: string;
    userName: string;
}

// ─── Remote Video Tile ────────────────────────────────────────────────────────
function RemoteVideoTile({ participant }: { participant: Participant }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && participant.stream) {
            videoRef.current.srcObject = participant.stream;
        }
    }, [participant.stream]);

    return (
        <div className="relative bg-[#1e1f22] rounded-2xl overflow-hidden flex items-center justify-center border border-white/5 aspect-video">
            {participant.stream ? (
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            ) : (
                <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center animate-pulse">
                        <span className="text-2xl text-white font-bold">
                            {participant.userName.charAt(0).toUpperCase()}
                        </span>
                    </div>
                    <p className="text-gray-500 text-xs">Connecting...</p>
                </div>
            )}
            <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md backdrop-blur-md">
                {participant.userName}
            </div>
        </div>
    );
}

// ─── Grid layout ──────────────────────────────────────────────────────────────
function getGridClass(total: number) {
    if (total === 1) return "grid-cols-1 max-w-3xl mx-auto";
    if (total <= 4) return "grid-cols-2";
    if (total <= 9) return "grid-cols-3";
    return "grid-cols-4";
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GroupCallRoom() {
    const { roomId } = useParams<{ roomId: string }>();
    const router = useRouter();
    const socket = useSocket();
    const auth = useContext(AuthContext);
    const { user, loading } = auth || {};
    const userName = auth?.loading ? "Loading..." : (auth?.user?.name || "Guest");

    // ── Refs ──────────────────────────────────────────────────────────────────
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

    // ── State ─────────────────────────────────────────────────────────────────
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [mediaStreamReady, setMediaStreamReady] = useState(false);

    // ✅ FIX: hasJoined is the socket trigger — roomState only controls which screen to show
    const [hasJoined, setHasJoined] = useState(false);
    const [roomState, setRoomState] = useState<"preview" | "waiting" | "in-call">("preview");

    const [isAdmin, setIsAdmin] = useState(false);
    const [adminName, setAdminName] = useState("");
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [waitingUsers, setWaitingUsers] = useState<WaitingUser[]>([]);
    const [callStatus, setCallStatus] = useState("Connecting...");
    const [showWaitingPanel, setShowWaitingPanel] = useState(true);

    // ── Auth guard ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!loading && !user) router.replace("/login");
    }, [user, loading, router]);

    // ── Init local media ──────────────────────────────────────────────────────
    useEffect(() => {
        const init = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "user" },
                    audio: true,
                });
                localStreamRef.current = stream;
                if (localVideoRef.current) localVideoRef.current.srcObject = stream;
                setMediaStreamReady(true);
            } catch (err: any) {
                console.error("Camera error:", err);
            }
        };
        init();
        return () => { localStreamRef.current?.getTracks().forEach(t => t.stop()); };
    }, []);

    // Re-attach stream when screen changes
    useEffect(() => {
        if (localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
        }
    }, [roomState]);

    // ── Create RTCPeerConnection ───────────────────────────────────────────────
    const createPeerConnection = useCallback((targetId: string): RTCPeerConnection => {
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" },
                { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
                { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
                { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
            ],
        });

        localStreamRef.current?.getTracks().forEach(track => {
            pc.addTrack(track, localStreamRef.current!);
        });

        pc.onicecandidate = (event) => {
            if (event.candidate && socket) {
                socket.emit("group-ice-candidate", { candidate: event.candidate, targetId, roomId });
            }
        };

        pc.ontrack = (event) => {
            const stream = event.streams[0];
            setParticipants(prev => prev.map(p =>
                p.socketId === targetId ? { ...p, stream } : p
            ));
        };

        pc.oniceconnectionstatechange = () => {
            console.log(`🧊 ICE [${targetId}]:`, pc.iceConnectionState);
        };

        peerConnectionsRef.current.set(targetId, pc);
        return pc;
    }, [socket, roomId]);

    // ── Socket signaling ──────────────────────────────────────────────────────
    // ✅ KEY FIX: depends on hasJoined NOT roomState
    // This effect runs ONCE when user clicks "Join Now" and NEVER re-runs due to roomState changes
    // So listeners stay alive through preview → waiting → in-call transitions
    useEffect(() => {
        if (!socket || !hasJoined || !mediaStreamReady) return;

        console.log("🔌 Joining group room:", roomId);
        socket.emit("join-group-room", { roomId, userName });

        // Admin: created room and joined instantly
        socket.on("group-joined", ({ isAdmin: admin }: { isAdmin: boolean }) => {
            console.log("✅ group-joined, isAdmin:", admin);
            setIsAdmin(admin);
            setRoomState("in-call");
            setCallStatus(admin ? "Waiting for participants..." : "Connected");
        });

        // Non-admin: put in waiting room
        // ✅ roomState switches to "waiting" but listeners stay alive
        socket.on("waiting-for-admission", ({ adminName: name }: { adminName: string }) => {
            console.log("⏳ Waiting for admission from:", name);
            setAdminName(name);
            setRoomState("waiting"); // just changes the UI — socket stays connected
        });

        // Non-admin: rejected
        socket.on("group-rejected", () => {
            alert("Your request to join was rejected by the host.");
            router.push("/dashboard/group-calling");
        });

        // Room full
        socket.on("group-room-full", () => {
            alert("This room is full (max 10 participants).");
            router.push("/dashboard/group-calling");
        });

        // ✅ Non-admin: admitted — this fires correctly because listener was never removed
        socket.on("group-admitted", async ({
            participants: existingPeers,
        }: { participants: { socketId: string; userName: string }[]; roomId: string }) => {
            console.log("✅ Admitted! Existing peers:", existingPeers.length);
            setRoomState("in-call"); // switch waiting screen back to call
            setCallStatus("Connected");
            setParticipants(existingPeers.map(p => ({ ...p, stream: undefined })));
        });

        // Admin: someone is waiting
        socket.on("user-waiting", ({ socketId, userName: waitingName }: WaitingUser) => {
            console.log("👋 User waiting:", waitingName);
            setWaitingUsers(prev => [...prev, { socketId, userName: waitingName }]);
            setShowWaitingPanel(true);
        });

        // Existing peer: new peer joined, create offer to them
        socket.on("group-new-peer", async ({
            socketId: newPeerId,
            userName: newPeerName,
        }: { socketId: string; userName: string }) => {
            console.log("📞 New peer:", newPeerName, newPeerId);
            setParticipants(prev => [...prev, { socketId: newPeerId, userName: newPeerName }]);
            const pc = createPeerConnection(newPeerId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("group-offer", { offer, targetId: newPeerId, roomId });
        });

        // Receive offer from existing peer
        socket.on("group-offer", async ({
            offer, fromId,
        }: { offer: RTCSessionDescriptionInit; fromId: string; roomId: string }) => {
            console.log("📨 Offer from:", fromId);
            let pc = peerConnectionsRef.current.get(fromId);
            if (!pc) pc = createPeerConnection(fromId);
            await pc.setRemoteDescription(offer);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit("group-answer", { answer, targetId: fromId, roomId });
        });

        // Receive answer
        socket.on("group-answer", async ({
            answer, fromId,
        }: { answer: RTCSessionDescriptionInit; fromId: string }) => {
            console.log("📨 Answer from:", fromId);
            const pc = peerConnectionsRef.current.get(fromId);
            if (pc) await pc.setRemoteDescription(answer);
        });

        // Receive ICE candidate
        socket.on("group-ice-candidate", async ({
            candidate, fromId,
        }: { candidate: RTCIceCandidateInit; fromId: string }) => {
            const pc = peerConnectionsRef.current.get(fromId);
            if (pc) {
                try { await pc.addIceCandidate(candidate); }
                catch (e) { console.error("ICE error:", e); }
            }
        });

        // Peer left
        socket.on("group-peer-left", ({ socketId }: { socketId: string }) => {
            console.log("👋 Peer left:", socketId);
            const pc = peerConnectionsRef.current.get(socketId);
            if (pc) { pc.close(); peerConnectionsRef.current.delete(socketId); }
            setParticipants(prev => prev.filter(p => p.socketId !== socketId));
        });

        // Admin role transferred
        socket.on("group-you-are-admin", () => {
            setIsAdmin(true);
            setCallStatus("You are now the host");
        });

        return () => {
            socket.off("group-joined");
            socket.off("waiting-for-admission");
            socket.off("group-rejected");
            socket.off("group-room-full");
            socket.off("group-admitted");
            socket.off("user-waiting");
            socket.off("group-new-peer");
            socket.off("group-offer");
            socket.off("group-answer");
            socket.off("group-ice-candidate");
            socket.off("group-peer-left");
            socket.off("group-you-are-admin");
            peerConnectionsRef.current.forEach(pc => pc.close());
            peerConnectionsRef.current.clear();
        };
        // ✅ roomState is NOT in this array — so this never re-runs when screen changes
    }, [socket, hasJoined, mediaStreamReady, roomId, userName, createPeerConnection, router]);

    // ── Admin actions ─────────────────────────────────────────────────────────
    const admitUser = (socketId: string) => {
        socket?.emit("admit-user", { roomId, socketId });
        setWaitingUsers(prev => prev.filter(u => u.socketId !== socketId));
    };

    const rejectUser = (socketId: string) => {
        socket?.emit("reject-user", { roomId, socketId });
        setWaitingUsers(prev => prev.filter(u => u.socketId !== socketId));
    };

    // ── Media controls ────────────────────────────────────────────────────────
    const toggleMute = () => {
        const track = localStreamRef.current?.getAudioTracks()[0];
        if (track) { track.enabled = !track.enabled; setIsMuted(!track.enabled); }
    };

    const toggleCamera = () => {
        const track = localStreamRef.current?.getVideoTracks()[0];
        if (track) { track.enabled = !track.enabled; setIsCameraOff(!track.enabled); }
    };

    const handleEndCall = () => {
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        peerConnectionsRef.current.forEach(pc => pc.close());
        socket?.disconnect();
        router.push("/dashboard/group-calling");
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Auth loading
    // ─────────────────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-[#101115] flex items-center justify-center">
                <div className="text-white animate-pulse text-lg">Loading...</div>
            </div>
        );
    }
    if (!user) return null;

    // ─────────────────────────────────────────────────────────────────────────
    // PREVIEW SCREEN
    // ─────────────────────────────────────────────────────────────────────────
    if (roomState === "preview") {
        return (
            <div className="min-h-screen bg-[#101115] flex flex-col items-center justify-center text-white p-6">
                <div className="max-w-5xl w-full flex flex-col md:flex-row gap-8 items-center justify-center">
                    {/* Video preview */}
                    <div className="w-full md:w-[60%]">
                        <div className="relative aspect-video bg-[#1e1f22] rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                            <video
                                ref={localVideoRef}
                                autoPlay playsInline muted
                                className={`w-full h-full object-cover scale-x-[-1] ${isCameraOff ? "hidden" : "block"}`}
                            />
                            {isCameraOff && (
                                <div className="absolute inset-0 flex items-center justify-center bg-[#1e1f22]">
                                    <div className="w-24 h-24 rounded-full bg-indigo-600 flex items-center justify-center">
                                        <span className="text-4xl font-bold">{userName.charAt(0).toUpperCase()}</span>
                                    </div>
                                </div>
                            )}
                            <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1.5 rounded-md text-sm backdrop-blur-md">
                                You ({userName})
                            </div>
                            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                                <button
                                    onClick={toggleMute}
                                    className={`p-3 rounded-full border transition-all ${isMuted ? "bg-red-500 border-transparent" : "bg-gray-800/80 border-white/10 backdrop-blur-sm"}`}
                                >
                                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                                </button>
                                <button
                                    onClick={toggleCamera}
                                    className={`p-3 rounded-full border transition-all ${isCameraOff ? "bg-red-500 border-transparent" : "bg-gray-800/80 border-white/10 backdrop-blur-sm"}`}
                                >
                                    {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Join panel */}
                    <div className="w-full md:w-[40%] flex flex-col gap-5">
                        <div>
                            <h1 className="text-3xl font-bold mb-1">Ready to join?</h1>
                            <p className="text-gray-400">Joining as <span className="text-white font-semibold">{userName}</span></p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                            <p className="text-gray-400 text-xs font-medium mb-1">Room ID</p>
                            <p className="font-mono text-xs text-gray-500 break-all">{roomId}</p>
                        </div>
                        {mediaStreamReady ? (
                            <button
                                onClick={() => {
                                    setRoomState("in-call");
                                    setHasJoined(true); // ✅ triggers socket useEffect ONCE
                                }}
                                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 font-semibold rounded-full transition-all text-lg shadow-lg shadow-indigo-900/40"
                            >
                                Join Now
                            </button>
                        ) : (
                            <div className="w-full py-3.5 bg-gray-800 text-gray-400 rounded-full animate-pulse text-center font-medium">
                                Starting camera...
                            </div>
                        )}
                        <button
                            onClick={() => router.push("/dashboard/group-calling")}
                            className="w-full py-3.5 border border-gray-700 text-gray-300 rounded-full hover:bg-gray-800 transition-all text-center font-medium"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // WAITING ROOM SCREEN
    // ─────────────────────────────────────────────────────────────────────────
    if (roomState === "waiting") {
        return (
            <div className="min-h-screen bg-[#101115] flex items-center justify-center text-white p-6">
                <div className="max-w-md w-full text-center">
                    <div className="w-20 h-20 rounded-full bg-indigo-600/20 border-2 border-indigo-500 flex items-center justify-center mx-auto mb-6 animate-pulse">
                        <Users className="w-8 h-8 text-indigo-400" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2">Waiting to be admitted</h1>
                    <p className="text-gray-400 mb-1">{adminName} will let you in soon.</p>
                    <p className="text-gray-600 text-sm mb-8">Please wait for the host to admit you.</p>

                    <div className="relative aspect-video bg-[#1e1f22] rounded-2xl overflow-hidden border border-white/10 mb-6">
                        <video
                            ref={localVideoRef}
                            autoPlay playsInline muted
                            className={`w-full h-full object-cover scale-x-[-1] ${isCameraOff ? "hidden" : "block"}`}
                        />
                        {isCameraOff && (
                            <div className="absolute inset-0 flex items-center justify-center bg-[#1e1f22]">
                                <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center">
                                    <span className="text-2xl font-bold">{userName.charAt(0).toUpperCase()}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-center gap-4">
                        <button onClick={toggleMute} className={`p-3 rounded-full border ${isMuted ? "bg-red-500 border-transparent" : "bg-gray-800 border-gray-700"}`}>
                            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        </button>
                        <button onClick={toggleCamera} className={`p-3 rounded-full border ${isCameraOff ? "bg-red-500 border-transparent" : "bg-gray-800 border-gray-700"}`}>
                            {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                        </button>
                        <button onClick={handleEndCall} className="p-3 rounded-full bg-red-600 border-transparent">
                            <PhoneOff className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // IN CALL SCREEN
    // ─────────────────────────────────────────────────────────────────────────
    const totalTiles = participants.length + 1;
    const gridClass = getGridClass(totalTiles);

    return (
        <div className="h-screen bg-[#111214] flex flex-col overflow-hidden">

            {/* Top bar */}
            <div className="h-14 flex items-center justify-between px-5 bg-[#18191c] border-b border-white/5 shrink-0">
                <div className="flex items-center gap-3">
                    <span className="text-white text-sm font-medium bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
                        {callStatus}
                    </span>
                    <span className="text-gray-400 text-sm flex items-center gap-1.5">
                        <Users className="w-4 h-4" /> {totalTiles} / 10
                    </span>
                    {isAdmin && (
                        <span className="flex items-center gap-1.5 text-yellow-400 text-xs font-semibold bg-yellow-400/10 px-2 py-1 rounded-md border border-yellow-400/20">
                            <Crown className="w-3.5 h-3.5" /> Host
                        </span>
                    )}
                </div>

                {/* Waiting badge for admin */}
                {isAdmin && waitingUsers.length > 0 && (
                    <button
                        onClick={() => setShowWaitingPanel(!showWaitingPanel)}
                        className="flex items-center gap-2 bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 px-3 py-1.5 rounded-lg text-sm hover:bg-indigo-600/30 transition-all animate-pulse"
                    >
                        <Users className="w-4 h-4" />
                        {waitingUsers.length} waiting
                    </button>
                )}
            </div>

            {/* Main area */}
            <div className="flex flex-1 overflow-hidden">

                {/* Video grid */}
                <div className="flex-1 p-3 overflow-y-auto">
                    <div className={`grid ${gridClass} gap-3 w-full h-full`}>

                        {/* Local tile */}
                        <div className="relative bg-[#1e1f22] rounded-2xl overflow-hidden aspect-video border border-white/5 flex items-center justify-center">
                            <video
                                ref={localVideoRef}
                                autoPlay playsInline muted
                                className={`w-full h-full object-cover scale-x-[-1] ${isCameraOff ? "hidden" : "block"}`}
                            />
                            {isCameraOff && (
                                <div className="absolute inset-0 flex items-center justify-center bg-[#1e1f22]">
                                    <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center">
                                        <span className="text-2xl font-bold text-white">{userName.charAt(0).toUpperCase()}</span>
                                    </div>
                                </div>
                            )}
                            <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 text-white text-xs px-2 py-1 rounded-md backdrop-blur-md">
                                {isAdmin && <Crown className="w-3 h-3 text-yellow-400" />}
                                You ({userName})
                            </div>
                            {isMuted && (
                                <div className="absolute top-2 right-2 bg-red-500/80 rounded-full p-1">
                                    <MicOff className="w-3 h-3 text-white" />
                                </div>
                            )}
                        </div>

                        {/* Remote tiles */}
                        {participants.map(p => (
                            <RemoteVideoTile key={p.socketId} participant={p} />
                        ))}
                    </div>
                </div>

                {/* Admin waiting room panel */}
                {isAdmin && waitingUsers.length > 0 && showWaitingPanel && (
                    <div className="w-72 bg-[#18191c] border-l border-white/5 flex flex-col shrink-0">
                        <div className="p-4 border-b border-white/5 flex items-center justify-between">
                            <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                                <Users className="w-4 h-4 text-indigo-400" />
                                Waiting ({waitingUsers.length})
                            </h3>
                            <button onClick={() => setShowWaitingPanel(false)} className="text-gray-500 hover:text-gray-300">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {waitingUsers.map(u => (
                                <div key={u.socketId} className="bg-white/5 rounded-xl p-3 flex items-center gap-2 border border-white/5">
                                    <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                                        <span className="text-sm font-bold text-white">{u.userName.charAt(0).toUpperCase()}</span>
                                    </div>
                                    <span className="text-white text-sm flex-1 truncate">{u.userName}</span>
                                    <button
                                        onClick={() => admitUser(u.socketId)}
                                        className="w-8 h-8 rounded-full bg-green-600 hover:bg-green-500 flex items-center justify-center transition-colors"
                                        title="Admit"
                                    >
                                        <Check className="w-4 h-4 text-white" />
                                    </button>
                                    <button
                                        onClick={() => rejectUser(u.socketId)}
                                        className="w-8 h-8 rounded-full bg-red-700 hover:bg-red-600 flex items-center justify-center transition-colors"
                                        title="Reject"
                                    >
                                        <X className="w-4 h-4 text-white" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        {waitingUsers.length > 1 && (
                            <div className="p-3 border-t border-white/5">
                                <button
                                    onClick={() => waitingUsers.forEach(u => admitUser(u.socketId))}
                                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all"
                                >
                                    Admit All ({waitingUsers.length})
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom controls */}
            <div className="h-20 bg-[#18191c] flex items-center justify-center gap-4 border-t border-white/5 shrink-0">
                <button
                    onClick={toggleMute}
                    className={`p-4 rounded-full border transition-all ${isMuted ? "bg-red-500 border-transparent text-white" : "bg-white/5 border-white/10 hover:bg-white/10 text-white"}`}
                >
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                <button
                    onClick={toggleCamera}
                    className={`p-4 rounded-full border transition-all ${isCameraOff ? "bg-red-500 border-transparent text-white" : "bg-white/5 border-white/10 hover:bg-white/10 text-white"}`}
                >
                    {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                </button>
                <button
                    onClick={handleEndCall}
                    className="px-6 py-4 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-full flex items-center gap-2 transition-all"
                >
                    <PhoneOff className="w-5 h-5" />
                    <span>Leave</span>
                </button>
            </div>
        </div>
    );
}