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
    isMuted?: boolean;
    isCamOff?: boolean;
}

interface WaitingUser {
    socketId: string;
    userName: string;
}

// ─── Per-user color ───────────────────────────────────────────────────────────
const COLORS = [
    "#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981",
    "#3b82f6","#ef4444","#14b8a6","#f97316","#a855f7",
];
function getColor(idx: number) { return COLORS[idx % COLORS.length]; }

// ─── Grid config (mirrors VideoGridDemo exactly) ──────────────────────────────
function getGridConfig(total: number, mobile: boolean) {
    if (mobile) {
        if (total === 1) return { cols: 1, rows: 1 };
        if (total <= 2)  return { cols: 1, rows: 2 };
        if (total <= 4)  return { cols: 2, rows: 2 };
        if (total <= 6)  return { cols: 2, rows: 3 };
        return           { cols: 2, rows: Math.ceil(total / 2) };
    }
    if (total === 1)  return { cols: 1, rows: 1 };
    if (total === 2)  return { cols: 2, rows: 1 };
    if (total === 3)  return { cols: 3, rows: 1 };
    if (total === 4)  return { cols: 2, rows: 2 };
    if (total <= 6)   return { cols: 3, rows: 2 };
    if (total <= 8)   return { cols: 4, rows: 2 };
    if (total === 9)  return { cols: 3, rows: 3 };
    return            { cols: 5, rows: 2 };
}

function getOrphanStyle(idx: number, total: number, cols: number) {
    const rows = Math.ceil(total / cols);
    const lastRowCount = total - (rows - 1) * cols;
    if (lastRowCount === cols) return {};
    const firstIdxInLastRow = (rows - 1) * cols;
    if (idx < firstIdxInLastRow) return {};
    const colOffset = Math.floor((cols - lastRowCount) / 2);
    const posInLastRow = idx - firstIdxInLastRow;
    return { gridColumnStart: colOffset + 1 + posInLastRow };
}

// ─── Video Tile (real stream or avatar) ───────────────────────────────────────
function VideoTile({
    name, color, isLocal, isAdmin, isMuted, isCamOff, isActive, compact, stream, videoRef,
}: {
    name: string; color: string; isLocal: boolean; isAdmin: boolean;
    isMuted: boolean; isCamOff: boolean; isActive: boolean; compact: boolean;
    stream?: MediaStream; videoRef?: React.RefObject<HTMLVideoElement>;
}) {
    const internalRef = useRef<HTMLVideoElement>(null);
    const ref = videoRef || internalRef;

    useEffect(() => {
        if (ref.current && stream) {
            ref.current.srcObject = stream;
        }
    }, [stream, ref]);

    const bars = [0.35, 0.65, 1, 0.7, 0.45];
    const avatarSize = compact ? 38 : 54;
    const fs = compact ? 10 : 12;

    return (
        <div
            className="relative overflow-hidden w-full h-full transition-all duration-200"
            style={{
                borderRadius: compact ? 10 : 14,
                background: "#16171a",
                border: isActive ? `2px solid ${color}99` : "1px solid rgba(255,255,255,0.06)",
                boxShadow: isActive ? `0 0 0 1px ${color}33, 0 0 18px ${color}1a` : "none",
            }}
        >
            {/* Video or avatar */}
            {!isCamOff && stream ? (
                <video
                    ref={ref}
                    autoPlay
                    playsInline
                    muted={isLocal}
                    className={`absolute inset-0 w-full h-full object-cover ${isLocal ? "scale-x-[-1]" : ""}`}
                />
            ) : !isCamOff && !stream ? (
                // Stream not yet arrived — show animated gradient placeholder
                <div className="absolute inset-0">
                    <div className="absolute inset-0" style={{
                        background: `radial-gradient(ellipse at 35% 35%, ${color}18 0%, transparent 55%),
                                     radial-gradient(ellipse at 65% 65%, ${color}0c 0%, transparent 50%)`,
                    }} />
                    <div className="absolute inset-0" style={{
                        backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,0.016) 2px,rgba(255,255,255,0.016) 3px)",
                    }} />
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2" style={{
                        width: "54%", height: "76%",
                        background: `radial-gradient(ellipse at 50% 30%, ${color}38 0%, ${color}14 40%, transparent 75%)`,
                        borderRadius: "50% 50% 0 0 / 60% 60% 0 0",
                    }} />
                    <div className="absolute inset-0" style={{
                        background: `radial-gradient(ellipse at 50% 50%, ${color}08 0%, transparent 60%)`,
                        animation: "breathe 3s ease-in-out infinite",
                    }} />
                </div>
            ) : (
                // Camera off — avatar
                <div
                    className="absolute inset-0 flex flex-col items-center justify-center gap-1.5"
                    style={{ background: `radial-gradient(ellipse at 50% 50%, ${color}0d 0%, transparent 70%)` }}
                >
                    <div
                        className="rounded-full flex items-center justify-center"
                        style={{ width: avatarSize, height: avatarSize, background: `${color}1e`, border: `2px solid ${color}44` }}
                    >
                        <span className="font-bold" style={{ fontSize: avatarSize * 0.38, color }}>
                            {name.charAt(0).toUpperCase()}
                        </span>
                    </div>
                    {!compact && (
                        <span className="flex items-center gap-1" style={{ fontSize: 10, color: "#6b7280" }}>
                            <VideoOff style={{ width: 9, height: 9 }} /> Camera off
                        </span>
                    )}
                </div>
            )}

            {/* Speaking ring */}
            {isActive && (
                <div className="absolute inset-0 pointer-events-none" style={{
                    borderRadius: "inherit",
                    border: `2px solid ${color}bb`,
                    animation: "speakPulse 1.4s ease-in-out infinite",
                }} />
            )}

            {/* Bottom name bar */}
            <div
                className="absolute bottom-0 left-0 right-0 flex items-center gap-1.5 px-2 py-1.5"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.25) 60%, transparent 100%)" }}
            >
                {isAdmin && <Crown style={{ width: fs, height: fs, color: "#facc15", flexShrink: 0 }} />}
                <span className="font-medium truncate flex-1 text-white" style={{ fontSize: fs }}>
                    {isLocal ? `You (${name})` : name}
                </span>
                {!isMuted ? (
                    <div className="flex items-end gap-[2px] shrink-0" style={{ height: 11 }}>
                        {bars.map((h, i) => (
                            <div key={i} style={{
                                width: 2, height: `${h * 100}%`,
                                background: isActive ? color : "#4ade80",
                                borderRadius: 1,
                                animation: `audioBar 0.7s ease-in-out ${i * 0.08}s infinite alternate`,
                                transformOrigin: "bottom",
                            }} />
                        ))}
                    </div>
                ) : (
                    <div className="shrink-0 rounded-full flex items-center justify-center"
                        style={{ width: 14, height: 14, background: "rgba(239,68,68,0.8)" }}>
                        <MicOff style={{ width: 8, height: 8, color: "white" }} />
                    </div>
                )}
            </div>

            {/* YOU pill */}
            {isLocal && (
                <div className="absolute top-2 left-2 font-bold" style={{
                    fontSize: 9, padding: "2px 6px", borderRadius: 5,
                    background: `${color}2a`, color, border: `1px solid ${color}40`,
                }}>YOU</div>
            )}
        </div>
    );
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
    const [isMuted, setIsMuted]           = useState(false);
    const [isCameraOff, setIsCameraOff]   = useState(false);
    const [mediaStreamReady, setMediaStreamReady] = useState(false);

    // ✅ hasJoined triggers socket effect — roomState only controls which screen to show
    const [hasJoined, setHasJoined]       = useState(false);
    const [roomState, setRoomState]       = useState<"preview" | "waiting" | "in-call">("preview");

    const [isAdmin, setIsAdmin]           = useState(false);
    const [adminName, setAdminName]       = useState("");
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [waitingUsers, setWaitingUsers] = useState<WaitingUser[]>([]);
    const [callStatus, setCallStatus]     = useState("Connecting...");
    const [showWaitingPanel, setShowWaitingPanel] = useState(true);
    const [speakIdx, setSpeakIdx]         = useState(0);
    const [isMobile, setIsMobile]         = useState(false);

    // ── Detect mobile ─────────────────────────────────────────────────────────
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);

    // ── Simulate active speaker cycling (replace with real VAD later) ─────────
    useEffect(() => {
        if (roomState !== "in-call") return;
        const total = participants.length + 1;
        const id = setInterval(() => setSpeakIdx(i => (i + 1) % total), 2800);
        return () => clearInterval(id);
    }, [roomState, participants.length]);

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

    // Re-attach stream when screen changes (video element remounts)
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
                { urls: "turn:openrelay.metered.ca:80",              username: "openrelayproject", credential: "openrelayproject" },
                { urls: "turn:openrelay.metered.ca:443",             username: "openrelayproject", credential: "openrelayproject" },
                { urls: "turn:openrelay.metered.ca:443?transport=tcp",username: "openrelayproject", credential: "openrelayproject" },
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
    // Runs ONCE on join — listeners survive waiting→in-call transition
    useEffect(() => {
        if (!socket || !hasJoined || !mediaStreamReady) return;

        console.log("🔌 Joining group room:", roomId);
        socket.emit("join-group-room", { roomId, userName });

        socket.on("group-joined", ({ isAdmin: admin }: { isAdmin: boolean }) => {
            console.log("✅ group-joined, isAdmin:", admin);
            setIsAdmin(admin);
            setRoomState("in-call");
            setCallStatus(admin ? "Waiting for participants..." : "Connected");
        });

        // ✅ Switches UI to waiting — but socket stays alive
        socket.on("waiting-for-admission", ({ adminName: name }: { adminName: string }) => {
            console.log("⏳ Waiting for admission from:", name);
            setAdminName(name);
            setRoomState("waiting");
        });

        socket.on("group-rejected", () => {
            alert("Your request to join was rejected by the host.");
            router.push("/dashboard/group-calling");
        });

        socket.on("group-room-full", () => {
            alert("This room is full (max 10 participants).");
            router.push("/dashboard/group-calling");
        });

        // ✅ Admitted — listener alive because roomState not in deps
        socket.on("group-admitted", async ({
            participants: existingPeers,
        }: { participants: { socketId: string; userName: string }[]; roomId: string }) => {
            console.log("✅ Admitted! Peers:", existingPeers.length);
            setRoomState("in-call");
            setCallStatus("Connected");
            setParticipants(existingPeers.map(p => ({ ...p, stream: undefined })));
        });

        socket.on("user-waiting", ({ socketId, userName: waitingName }: WaitingUser) => {
            console.log("👋 User waiting:", waitingName);
            setWaitingUsers(prev => [...prev, { socketId, userName: waitingName }]);
            setShowWaitingPanel(true);
        });

        socket.on("group-new-peer", async ({
            socketId: newPeerId,
            userName: newPeerName,
        }: { socketId: string; userName: string }) => {
            console.log("📞 New peer:", newPeerName);
            setParticipants(prev => [...prev, { socketId: newPeerId, userName: newPeerName }]);
            const pc = createPeerConnection(newPeerId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("group-offer", { offer, targetId: newPeerId, roomId });
        });

        socket.on("group-offer", async ({
            offer, fromId,
        }: { offer: RTCSessionDescriptionInit; fromId: string; roomId: string }) => {
            let pc = peerConnectionsRef.current.get(fromId);
            if (!pc) pc = createPeerConnection(fromId);
            await pc.setRemoteDescription(offer);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit("group-answer", { answer, targetId: fromId, roomId });
        });

        socket.on("group-answer", async ({
            answer, fromId,
        }: { answer: RTCSessionDescriptionInit; fromId: string }) => {
            const pc = peerConnectionsRef.current.get(fromId);
            if (pc) await pc.setRemoteDescription(answer);
        });

        socket.on("group-ice-candidate", async ({
            candidate, fromId,
        }: { candidate: RTCIceCandidateInit; fromId: string }) => {
            const pc = peerConnectionsRef.current.get(fromId);
            if (pc) {
                try { await pc.addIceCandidate(candidate); }
                catch (e) { console.error("ICE error:", e); }
            }
        });

        socket.on("group-peer-left", ({ socketId }: { socketId: string }) => {
            const pc = peerConnectionsRef.current.get(socketId);
            if (pc) { pc.close(); peerConnectionsRef.current.delete(socketId); }
            setParticipants(prev => prev.filter(p => p.socketId !== socketId));
        });

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
    // ✅ roomState NOT in deps — effect never re-runs on screen change
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

    // ── Auth loading ──────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-[#101115] flex items-center justify-center">
                <div className="text-white animate-pulse text-lg">Loading...</div>
            </div>
        );
    }
    if (!user) return null;

    // =========================================================================
    // PREVIEW SCREEN
    // =========================================================================
    if (roomState === "preview") {
        return (
            <div className="min-h-screen bg-[#101115] flex flex-col items-center justify-center text-white p-6">
                <style>{`
                    @keyframes breathe { 0%,100%{opacity:0.5} 50%{opacity:1} }
                `}</style>
                <div className="max-w-5xl w-full flex flex-col md:flex-row gap-8 items-center justify-center">
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
                                <button onClick={toggleMute} className={`p-3 rounded-full border transition-all ${isMuted ? "bg-red-500 border-transparent" : "bg-gray-800/80 border-white/10 backdrop-blur-sm"}`}>
                                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                                </button>
                                <button onClick={toggleCamera} className={`p-3 rounded-full border transition-all ${isCameraOff ? "bg-red-500 border-transparent" : "bg-gray-800/80 border-white/10 backdrop-blur-sm"}`}>
                                    {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                    </div>
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
                                    setHasJoined(true); // ✅ triggers socket effect ONCE
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

    // =========================================================================
    // WAITING ROOM SCREEN
    // =========================================================================
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

    // =========================================================================
    // IN CALL SCREEN — VideoGridDemo tile system with real streams
    // =========================================================================
    const totalTiles = participants.length + 1;
    const { cols, rows } = getGridConfig(totalTiles, isMobile);
    const compact = totalTiles >= 7;
    const allowScroll = isMobile && totalTiles > 6;

    return (
        <div style={{ height: "100vh", background: "#101115", color: "white", display: "flex", flexDirection: "column", fontFamily: "system-ui,sans-serif" }}>
            <style>{`
                * { box-sizing: border-box; }
                @keyframes audioBar   { from { transform: scaleY(0.45); } to { transform: scaleY(1); } }
                @keyframes speakPulse { 0%,100% { opacity: 0.65; } 50% { opacity: 1; } }
                @keyframes breathe    { 0%,100% { opacity: 0.5; }  50% { opacity: 1; } }
                ::-webkit-scrollbar       { width: 3px; }
                ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
            `}</style>

            {/* ── Top bar ── */}
            <div style={{
                flexShrink: 0, height: 48, background: "#18191c",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: 7,
                        background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                        {callStatus}
                    </span>
                    <span style={{ color: "#9ca3af", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                        <Users style={{ width: 13, height: 13 }} />{totalTiles} / 10
                    </span>
                    {isAdmin && (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
                            color: "#facc15", background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.2)",
                            display: "flex", alignItems: "center", gap: 4 }}>
                            <Crown style={{ width: 11, height: 11 }} />Host
                        </span>
                    )}
                </div>

                {/* Waiting badge */}
                {isAdmin && waitingUsers.length > 0 && (
                    <button
                        onClick={() => setShowWaitingPanel(v => !v)}
                        style={{ display: "flex", alignItems: "center", gap: 6,
                            background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.4)",
                            color: "#a5b4fc", padding: "6px 12px", borderRadius: 8, fontSize: 12,
                            cursor: "pointer", animation: "breathe 2s ease-in-out infinite" }}
                    >
                        <Users style={{ width: 13, height: 13 }} />
                        {waitingUsers.length} waiting
                    </button>
                )}
            </div>

            {/* ── Main area ── */}
            <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>

                {/* Grid */}
                <div style={{
                    flex: 1, minHeight: 0,
                    overflow: allowScroll ? "auto" : "hidden",
                    display: "flex",
                    justifyContent: isMobile ? "center" : "stretch",
                    padding: compact ? 6 : 8,
                }}>
                    <div style={{
                        width: isMobile ? 375 : "100%",
                        height: allowScroll ? "auto" : "100%",
                        display: "grid",
                        gridTemplateColumns: `repeat(${cols}, 1fr)`,
                        gridTemplateRows: allowScroll ? undefined : `repeat(${rows}, 1fr)`,
                        gap: compact ? 5 : 8,
                    }}>
                        {/* Local tile */}
                        <div style={{
                            minWidth: 0, minHeight: 0,
                            ...(allowScroll ? { aspectRatio: "16/9" } : {}),
                            ...getOrphanStyle(0, totalTiles, cols),
                        }}>
                            <VideoTile
                                name={userName}
                                color={getColor(0)}
                                isLocal={true}
                                isAdmin={isAdmin}
                                isMuted={isMuted}
                                isCamOff={isCameraOff}
                                isActive={speakIdx === 0}
                                compact={compact}
                                stream={localStreamRef.current || undefined}
                                videoRef={localVideoRef as React.RefObject<HTMLVideoElement>}
                            />
                        </div>

                        {/* Remote tiles */}
                        {participants.map((p, idx) => (
                            <div key={p.socketId} style={{
                                minWidth: 0, minHeight: 0,
                                ...(allowScroll ? { aspectRatio: "16/9" } : {}),
                                ...getOrphanStyle(idx + 1, totalTiles, cols),
                            }}>
                                <VideoTile
                                    name={p.userName}
                                    color={getColor(idx + 1)}
                                    isLocal={false}
                                    isAdmin={false}
                                    isMuted={p.isMuted || false}
                                    isCamOff={p.isCamOff || false}
                                    isActive={speakIdx === idx + 1}
                                    compact={compact}
                                    stream={p.stream}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Admin waiting panel */}
                {isAdmin && waitingUsers.length > 0 && showWaitingPanel && (
                    <div style={{ width: 272, background: "#18191c", borderLeft: "1px solid rgba(255,255,255,0.06)",
                        display: "flex", flexDirection: "column", flexShrink: 0 }}>
                        <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)",
                            display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ color: "white", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                                <Users style={{ width: 14, height: 14, color: "#818cf8" }} />
                                Waiting ({waitingUsers.length})
                            </span>
                            <button onClick={() => setShowWaitingPanel(false)}
                                style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer" }}>
                                <X style={{ width: 15, height: 15 }} />
                            </button>
                        </div>
                        <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                            {waitingUsers.map(u => (
                                <div key={u.socketId} style={{ background: "rgba(255,255,255,0.04)",
                                    borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8,
                                    border: "1px solid rgba(255,255,255,0.06)" }}>
                                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#4f46e5",
                                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                        <span style={{ fontSize: 14, fontWeight: 700, color: "white" }}>
                                            {u.userName.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <span style={{ color: "white", fontSize: 13, flex: 1, overflow: "hidden",
                                        textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.userName}</span>
                                    <button onClick={() => admitUser(u.socketId)}
                                        style={{ width: 30, height: 30, borderRadius: "50%", background: "#16a34a",
                                            border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <Check style={{ width: 14, height: 14, color: "white" }} />
                                    </button>
                                    <button onClick={() => rejectUser(u.socketId)}
                                        style={{ width: 30, height: 30, borderRadius: "50%", background: "#b91c1c",
                                            border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <X style={{ width: 14, height: 14, color: "white" }} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        {waitingUsers.length > 1 && (
                            <div style={{ padding: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                                <button
                                    onClick={() => waitingUsers.forEach(u => admitUser(u.socketId))}
                                    style={{ width: "100%", padding: "8px 0", background: "#4f46e5", color: "white",
                                        border: "none", borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                                    Admit All ({waitingUsers.length})
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Controls ── */}
            <div style={{ flexShrink: 0, height: 68, background: "#18191c",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                {[
                    { Icon: isMuted ? MicOff : Mic,           active: isMuted,    fn: toggleMute },
                    { Icon: isCameraOff ? VideoOff : Video,   active: isCameraOff, fn: toggleCamera },
                ].map(({ Icon, active, fn }, i) => (
                    <button key={i} onClick={fn} style={{
                        width: 46, height: 46, borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: active ? "#ef4444" : "rgba(255,255,255,0.07)",
                        border: active ? "none" : "1px solid rgba(255,255,255,0.12)",
                        color: "white", cursor: "pointer", transition: "all 0.15s",
                    }}>
                        <Icon style={{ width: 18, height: 18 }} />
                    </button>
                ))}
                <button onClick={handleEndCall} style={{
                    height: 46, padding: "0 20px", borderRadius: 23,
                    display: "flex", alignItems: "center", gap: 8,
                    background: "#ef4444", color: "white", border: "none",
                    cursor: "pointer", fontSize: 14, fontWeight: 600,
                }}>
                    <PhoneOff style={{ width: 16, height: 16 }} />Leave
                </button>
            </div>
        </div>
    );
}
// 'use client';

// import { useState, useEffect } from "react";
// import { Mic, MicOff, Video, VideoOff, PhoneOff, Users, Crown } from "lucide-react";

// // ─── Constants ────────────────────────────────────────────────────────────────
// const COLORS = [
//   "#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981",
//   "#3b82f6","#ef4444","#14b8a6","#f97316","#a855f7",
// ];
// const NAMES = [
//   "You","Jordan Lee","Sam Patel","Riley Chen","Morgan Wu",
//   "Casey Liu","Drew Park","Avery Zhou","Taylor Ng","Quinn Tan",
// ];

// // ─── Grid helpers ─────────────────────────────────────────────────────────────
// function getGridConfig(total: number, mobile: boolean) {
//   if (mobile) {
//     if (total === 1) return { cols: 1, rows: 1,                      label: "Single" };
//     if (total <= 2)  return { cols: 1, rows: 2,                      label: "Stacked" };
//     if (total <= 4)  return { cols: 2, rows: 2,                      label: "2×2" };
//     if (total <= 6)  return { cols: 2, rows: 3,                      label: "2×3" };
//     return           { cols: 2, rows: Math.ceil(total / 2),          label: "Scroll" };
//   }
//   // Desktop — grid fills 100% height, zero scroll
//   if (total === 1)  return { cols: 1, rows: 1, label: "Focus" };
//   if (total === 2)  return { cols: 2, rows: 1, label: "Side by Side" };
//   if (total === 3)  return { cols: 3, rows: 1, label: "3-up Row" };
//   if (total === 4)  return { cols: 2, rows: 2, label: "2×2 Grid" };
//   if (total <= 6)   return { cols: 3, rows: 2, label: "3×2 Grid" };
//   if (total <= 8)   return { cols: 4, rows: 2, label: "4×2 Grid" };
//   if (total === 9)  return { cols: 3, rows: 3, label: "3×3 Grid" };
//   return            { cols: 5, rows: 2,        label: "5×2 Grid" };
// }

// // Center orphan tiles in the last row
// function getOrphanStyle(idx: number, total: number, cols: number) {
//   const rows = Math.ceil(total / cols);
//   const lastRowCount = total - (rows - 1) * cols;
//   if (lastRowCount === cols) return {};
//   const firstIdxInLastRow = (rows - 1) * cols;
//   if (idx < firstIdxInLastRow) return {};
//   const colOffset = Math.floor((cols - lastRowCount) / 2);
//   const posInLastRow = idx - firstIdxInLastRow;
//   return { gridColumnStart: colOffset + 1 + posInLastRow };
// }

// // ─── Video Tile ───────────────────────────────────────────────────────────────
// function VideoTile({ name, color, isLocal, isAdmin, isMuted, isCamOff, isActive, compact }: { name: string, color: string, isLocal: boolean, isAdmin: boolean, isMuted: boolean, isCamOff: boolean, isActive: boolean, compact: boolean }) {
//   const bars = [0.35, 0.65, 1, 0.7, 0.45];
//   const avatarSize = compact ? 38 : 54;
//   const fs = compact ? 10 : 12;

//   return (
//     <div className="relative overflow-hidden w-full h-full transition-all duration-200"
//       style={{
//         borderRadius: compact ? 10 : 14,
//         background: "#16171a",
//         border: isActive ? `2px solid ${color}99` : "1px solid rgba(255,255,255,0.06)",
//         boxShadow: isActive ? `0 0 0 1px ${color}33, 0 0 18px ${color}1a` : "none",
//       }}>

//       {/* fake video / cam-off */}
//       {!isCamOff ? (
//         <div className="absolute inset-0">
//           <div className="absolute inset-0" style={{
//             background: `radial-gradient(ellipse at 35% 35%, ${color}18 0%, transparent 55%),
//                          radial-gradient(ellipse at 65% 65%, ${color}0c 0%, transparent 50%)`,
//           }} />
//           <div className="absolute inset-0 pointer-events-none" style={{
//             backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,0.016) 2px,rgba(255,255,255,0.016) 3px)",
//           }} />
//           <div className="absolute bottom-0 left-1/2 -translate-x-1/2" style={{
//             width: "54%", height: "76%",
//             background: `radial-gradient(ellipse at 50% 30%, ${color}38 0%, ${color}14 40%, transparent 75%)`,
//             borderRadius: "50% 50% 0 0 / 60% 60% 0 0",
//           }} />
//           <div className="absolute inset-0" style={{
//             background: `radial-gradient(ellipse at 50% 50%, ${color}08 0%, transparent 60%)`,
//             animation: "breathe 3s ease-in-out infinite",
//           }} />
//         </div>
//       ) : (
//         <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5"
//           style={{ background: `radial-gradient(ellipse at 50% 50%, ${color}0d 0%, transparent 70%)` }}>
//           <div className="rounded-full flex items-center justify-center"
//             style={{ width: avatarSize, height: avatarSize, background: `${color}1e`, border: `2px solid ${color}44` }}>
//             <span className="font-bold" style={{ fontSize: avatarSize * 0.38, color }}>
//               {name.charAt(0).toUpperCase()}
//             </span>
//           </div>
//           {!compact && (
//             <span className="flex items-center gap-1" style={{ fontSize: 10, color: "#6b7280" }}>
//               <VideoOff style={{ width: 9, height: 9 }} /> Camera off
//             </span>
//           )}
//         </div>
//       )}

//       {/* speaking ring */}
//       {isActive && (
//         <div className="absolute inset-0 pointer-events-none" style={{
//           borderRadius: "inherit",
//           border: `2px solid ${color}bb`,
//           animation: "speakPulse 1.4s ease-in-out infinite",
//         }} />
//       )}

//       {/* name / audio bar */}
//       <div className="absolute bottom-0 left-0 right-0 flex items-center gap-1.5 px-2 py-1.5"
//         style={{
//           background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.25) 60%, transparent 100%)",
//         }}>
//         {isAdmin && <Crown style={{ width: fs, height: fs, color: "#facc15", flexShrink: 0 }} />}
//         <span className="font-medium truncate flex-1 text-white" style={{ fontSize: fs }}>
//           {isLocal ? `You (${name})` : name}
//         </span>
//         {!isMuted ? (
//           <div className="flex items-end gap-[2px] shrink-0" style={{ height: 11 }}>
//             {bars.map((h, i) => (
//               <div key={i} style={{
//                 width: 2, height: `${h * 100}%`,
//                 background: isActive ? color : "#4ade80",
//                 borderRadius: 1,
//                 animation: `audioBar 0.7s ease-in-out ${i * 0.08}s infinite alternate`,
//                 transformOrigin: "bottom",
//               }} />
//             ))}
//           </div>
//         ) : (
//           <div className="shrink-0 rounded-full flex items-center justify-center"
//             style={{ width: 14, height: 14, background: "rgba(239,68,68,0.8)" }}>
//             <MicOff style={{ width: 8, height: 8, color: "white" }} />
//           </div>
//         )}
//       </div>

//       {/* YOU pill */}
//       {isLocal && (
//         <div className="absolute top-2 left-2 font-bold"
//           style={{
//             fontSize: 9, padding: "2px 6px", borderRadius: 5,
//             background: `${color}2a`, color, border: `1px solid ${color}40`,
//           }}>
//           YOU
//         </div>
//       )}
//     </div>
//   );
// }

// // ─── Main ─────────────────────────────────────────────────────────────────────
// export default function VideoGridDemo() {
//   const [count, setCount]       = useState(2);
//   const [mobile, setMobile]     = useState(false);
//   const [isMuted, setIsMuted]   = useState(false);
//   const [isCamOff, setIsCamOff] = useState(false);
//   const [speakIdx, setSpeakIdx] = useState(0);

//   const mutedTiles  = new Set([2, 5, 8]);
//   const camOffTiles = new Set([3, 7]);

//   useEffect(() => {
//     const id = setInterval(() => setSpeakIdx(i => (i + 1) % count), 2100);
//     return () => clearInterval(id);
//   }, [count]);

//   const { cols, rows, label } = getGridConfig(count, mobile);
//   const compact      = count >= 7;
//   const allowScroll  = mobile && count > 6;

//   const tiles = Array.from({ length: count }, (_, i) => ({
//     id:      i,
//     name:    NAMES[i % NAMES.length],
//     color:   COLORS[i % COLORS.length],
//     isLocal: i === 0,
//     isAdmin: i === 0,
//     isMuted: i === 0 ? isMuted  : mutedTiles.has(i),
//     isCamOff:i === 0 ? isCamOff : camOffTiles.has(i),
//     isActive:i === speakIdx,
//   }));

//   return (
//     <div style={{ height: "100vh", background: "#101115", color: "white", display: "flex", flexDirection: "column", fontFamily: "system-ui,sans-serif" }}>
//       <style>{`
//         * { box-sizing: border-box; }
//         @keyframes audioBar   { from { transform: scaleY(0.45); } to { transform: scaleY(1); } }
//         @keyframes speakPulse { 0%,100% { opacity: 0.65; } 50% { opacity: 1; } }
//         @keyframes breathe    { 0%,100% { opacity: 0.5; }  50% { opacity: 1; } }
//         ::-webkit-scrollbar       { width: 3px; }
//         ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
//       `}</style>

//       {/* ── Demo toolbar ── */}
//       <div style={{ flexShrink: 0, background: "#18191c", borderBottom: "1px solid rgba(255,255,255,0.06)",
//         display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "8px 12px" }}>
//         <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 500 }}>Participants:</span>
//         <div style={{ display: "flex", gap: 4 }}>
//           {[1,2,3,4,5,6,7,8,9,10].map(n => (
//             <button key={n} onClick={() => setCount(n)} style={{
//               width: 30, height: 30, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
//               background: count === n ? "#6366f1" : "rgba(255,255,255,0.05)",
//               color:      count === n ? "#fff"     : "#9ca3af",
//               border:     count === n ? "none"     : "1px solid rgba(255,255,255,0.1)",
//               transition: "all 0.15s",
//             }}>{n}</button>
//           ))}
//         </div>
//         <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
//           <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "rgba(255,255,255,0.05)",
//             color: "#6b7280", border: "1px solid rgba(255,255,255,0.08)" }}>{label}</span>
//           <button onClick={() => setMobile(v => !v)} style={{
//             fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: 6, cursor: "pointer",
//             background: mobile ? "#6366f1" : "rgba(255,255,255,0.05)",
//             color:      mobile ? "#fff"    : "#d1d5db",
//             border:     mobile ? "none"    : "1px solid rgba(255,255,255,0.1)",
//           }}>{mobile ? "📱 Mobile" : "🖥 Desktop"}</button>
//         </div>
//       </div>

//       {/* ── Call header ── */}
//       <div style={{ flexShrink: 0, height: 48, background: "#18191c", borderBottom: "1px solid rgba(255,255,255,0.06)",
//         display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
//         <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
//           <span style={{ fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: 7,
//             background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>Connected</span>
//           <span style={{ color: "#9ca3af", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
//             <Users style={{ width: 13, height: 13 }} />{count} / 10
//           </span>
//           <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
//             color: "#facc15", background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.2)",
//             display: "flex", alignItems: "center", gap: 4 }}>
//             <Crown style={{ width: 11, height: 11 }} />Host
//           </span>
//         </div>
//         <span style={{ fontSize: 11, fontFamily: "monospace", color: "#4b5563" }}>room-abc-xyz</span>
//       </div>

//       {/* ── Grid area ─────────────────────────────────────────────────────────── */}
//       {/* flex-1 + minHeight:0 is the key — allows the child to shrink to fit */}
//       <div style={{
//         flex: 1, minHeight: 0,
//         overflow: allowScroll ? "auto" : "hidden",
//         display: "flex",
//         justifyContent: mobile ? "center" : "stretch",
//         padding: compact ? 6 : 8,
//       }}>
//         <div style={{
//           width:   mobile ? 375 : "100%",
//           height:  allowScroll ? "auto" : "100%",
//           display: "grid",
//           gridTemplateColumns: `repeat(${cols}, 1fr)`,
//           // when we allow scroll rows are natural height (aspect-ratio set on tiles)
//           // otherwise rows fill the available container height equally
//           gridTemplateRows: allowScroll ? undefined : `repeat(${rows}, 1fr)`,
//           gap: compact ? 5 : 8,
//         }}>
//           {tiles.map((tile, idx) => (
//             <div key={tile.id} style={{
//               minWidth: 0, minHeight: 0,
//               // only use aspect-ratio on scrollable mobile; desktop tiles fill grid rows
//               ...(allowScroll ? { aspectRatio: "16/9" } : {}),
//               ...getOrphanStyle(idx, count, cols),
//             }}>
//               <VideoTile {...tile} compact={compact} />
//             </div>
//           ))}
//         </div>
//       </div>

//       {/* ── Controls ── */}
//       <div style={{ flexShrink: 0, height: 68, background: "#18191c", borderTop: "1px solid rgba(255,255,255,0.06)",
//         display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
//         {[
//           { Icon: isMuted  ? MicOff   : Mic,      active: isMuted,  fn: () => setIsMuted(v  => !v)  },
//           { Icon: isCamOff ? VideoOff : Video,    active: isCamOff, fn: () => setIsCamOff(v => !v) },
//         ].map(({ Icon, active, fn }, i) => (
//           <button key={i} onClick={fn} style={{
//             width: 46, height: 46, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
//             background: active ? "#ef4444" : "rgba(255,255,255,0.07)",
//             border: active ? "none" : "1px solid rgba(255,255,255,0.12)",
//             color: "white", cursor: "pointer", transition: "all 0.15s",
//           }}>
//             <Icon style={{ width: 18, height: 18 }} />
//           </button>
//         ))}
//         <button style={{
//           height: 46, padding: "0 20px", borderRadius: 23, display: "flex", alignItems: "center", gap: 8,
//           background: "#ef4444", color: "white", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600,
//         }}>
//           <PhoneOff style={{ width: 16, height: 16 }} />Leave
//         </button>
//       </div>
//     </div>
//   );
// }