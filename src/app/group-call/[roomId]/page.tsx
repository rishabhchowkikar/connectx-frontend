"use client";

import { useContext, useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSocket } from "@/hooks/useSocket";
import { AuthContext } from "@/context/AuthContext";
import {
    Mic, MicOff, Video, VideoOff, PhoneOff,
    Users, Check, X, Crown,
} from "lucide-react";

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

// ─── Colors ───────────────────────────────────────────────────────────────────
const COLORS = [
    "#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981",
    "#3b82f6","#ef4444","#14b8a6","#f97316","#a855f7",
];
const getColor = (i: number) => COLORS[i % COLORS.length];

// ─── Grid helpers ─────────────────────────────────────────────────────────────
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

function getOrphanStyle(idx: number, total: number, cols: number): React.CSSProperties {
    const rows = Math.ceil(total / cols);
    const lastRowCount = total - (rows - 1) * cols;
    if (lastRowCount === cols) return {};
    const firstIdx = (rows - 1) * cols;
    if (idx < firstIdx) return {};
    const colOffset = Math.floor((cols - lastRowCount) / 2);
    return { gridColumnStart: colOffset + 1 + (idx - firstIdx) };
}

// ─── VideoTile ────────────────────────────────────────────────────────────────
// ✅ FIX: <video> is ALWAYS mounted — never unmounted.
// We use CSS display:none/block to hide/show it.
// This means srcObject stays set permanently and camera re-enable works.
function VideoTile({
    name, color, isLocal, isAdmin, isMuted, isCamOff,
    isActive, compact, stream, videoRef,
}: {
    name: string;
    color: string;
    isLocal: boolean;
    isAdmin: boolean;
    isMuted: boolean;
    isCamOff: boolean;
    isActive: boolean;
    compact: boolean;
    stream?: MediaStream;
    videoRef?: React.RefObject<HTMLVideoElement>;
}) {
    const internalRef = useRef<HTMLVideoElement>(null);
    const ref = (videoRef ?? internalRef) as React.RefObject<HTMLVideoElement>;

    // Set srcObject when stream first arrives (or changes)
    useEffect(() => {
        if (ref.current && stream && ref.current.srcObject !== stream) {
            ref.current.srcObject = stream;
        }
    }, [stream]); // eslint-disable-line react-hooks/exhaustive-deps

    const bars       = [0.35, 0.65, 1, 0.7, 0.45];
    const avatarSize = compact ? 38 : 54;
    const fs         = compact ? 10 : 12;
    const showVideo  = !isCamOff && (!!stream || isLocal);

    return (
        <div
            style={{
                position: "relative",
                overflow: "hidden",
                width: "100%",
                height: "100%",
                borderRadius: compact ? 10 : 14,
                background: "#16171a",
                border: isActive
                    ? `2px solid ${color}99`
                    : "1px solid rgba(255,255,255,0.06)",
                boxShadow: isActive
                    ? `0 0 0 1px ${color}33, 0 0 18px ${color}1a`
                    : "none",
                transition: "border 0.2s, box-shadow 0.2s",
            }}
        >
            {/* ── Video element — ALWAYS in DOM ────────────────────────────────
                display:none when cam off. Keeps srcObject alive so toggling
                camera back on shows video immediately without re-setting srcObject. */}
            <video
                ref={ref}
                autoPlay
                playsInline
                muted={isLocal}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: isLocal ? "scaleX(-1)" : "none",
                    display: showVideo ? "block" : "none",  // ✅ CSS hide, not unmount
                }}
            />

            {/* ── Gradient placeholder (connecting…) ── */}
            {!isCamOff && !stream && !isLocal && (
                <div style={{ position: "absolute", inset: 0 }}>
                    <div style={{
                        position: "absolute", inset: 0,
                        background: `radial-gradient(ellipse at 35% 35%, ${color}18 0%, transparent 55%),
                                     radial-gradient(ellipse at 65% 65%, ${color}0c 0%, transparent 50%)`,
                    }} />
                    <div style={{
                        position: "absolute", inset: 0,
                        backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,0.016) 2px,rgba(255,255,255,0.016) 3px)",
                    }} />
                    <div style={{
                        position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
                        width: "54%", height: "76%",
                        background: `radial-gradient(ellipse at 50% 30%, ${color}38 0%, ${color}14 40%, transparent 75%)`,
                        borderRadius: "50% 50% 0 0 / 60% 60% 0 0",
                    }} />
                    <div style={{
                        position: "absolute", inset: 0,
                        background: `radial-gradient(ellipse at 50% 50%, ${color}08 0%, transparent 60%)`,
                        animation: "breathe 3s ease-in-out infinite",
                    }} />
                </div>
            )}

            {/* ── Avatar (camera off) ── */}
            {isCamOff && (
                <div style={{
                    position: "absolute", inset: 0,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
                    background: `radial-gradient(ellipse at 50% 50%, ${color}0d 0%, transparent 70%)`,
                }}>
                    <div style={{
                        width: avatarSize, height: avatarSize, borderRadius: "50%",
                        background: `${color}1e`, border: `2px solid ${color}44`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                        <span style={{ fontSize: avatarSize * 0.38, fontWeight: 700, color }}>
                            {name.charAt(0).toUpperCase()}
                        </span>
                    </div>
                    {!compact && (
                        <span style={{ fontSize: 10, color: "#6b7280", display: "flex", alignItems: "center", gap: 3 }}>
                            <VideoOff style={{ width: 9, height: 9 }} /> Camera off
                        </span>
                    )}
                </div>
            )}

            {/* ── Speaking ring ── */}
            {isActive && (
                <div style={{
                    position: "absolute", inset: 0, pointerEvents: "none",
                    borderRadius: "inherit",
                    border: `2px solid ${color}bb`,
                    animation: "speakPulse 1.4s ease-in-out infinite",
                }} />
            )}

            {/* ── Name bar ── */}
            <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                display: "flex", alignItems: "center", gap: 6, padding: "6px 8px",
                background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.25) 60%, transparent 100%)",
            }}>
                {isAdmin && <Crown style={{ width: fs, height: fs, color: "#facc15", flexShrink: 0 }} />}
                <span style={{
                    fontSize: fs, fontWeight: 500, color: "white",
                    flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                    {isLocal ? `You (${name})` : name}
                </span>
                {!isMuted ? (
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 11, flexShrink: 0 }}>
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
                    <div style={{
                        width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                        background: "rgba(239,68,68,0.85)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                        <MicOff style={{ width: 8, height: 8, color: "white" }} />
                    </div>
                )}
            </div>

            {/* ── YOU pill ── */}
            {isLocal && (
                <div style={{
                    position: "absolute", top: 8, left: 8,
                    fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 5,
                    background: `${color}2a`, color, border: `1px solid ${color}40`,
                }}>YOU</div>
            )}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GroupCallRoom() {
    const { roomId }  = useParams<{ roomId: string }>();
    const router      = useRouter();
    const socket      = useSocket();
    const auth        = useContext(AuthContext);
    const { user, loading } = auth || {};
    const userName    = (!auth?.loading && auth?.user?.name) ? auth.user.name : "Guest";

    // ── Refs ──────────────────────────────────────────────────────────────────
    const localVideoRef      = useRef<HTMLVideoElement>(null);
    const localStreamRef     = useRef<MediaStream | null>(null);
    const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

    // ── State ─────────────────────────────────────────────────────────────────
    const [isMuted,          setIsMuted]          = useState(false);
    const [isCameraOff,      setIsCameraOff]      = useState(false);
    const [mediaStreamReady, setMediaStreamReady] = useState(false);
    // ✅ hasJoined triggers socket effect once. roomState only controls which screen to render.
    const [hasJoined,        setHasJoined]        = useState(false);
    const [roomState,        setRoomState]        = useState<"preview" | "waiting" | "in-call">("preview");
    const [isAdmin,          setIsAdmin]          = useState(false);
    const [adminName,        setAdminName]        = useState("");
    const [participants,     setParticipants]     = useState<Participant[]>([]);
    const [waitingUsers,     setWaitingUsers]     = useState<WaitingUser[]>([]);
    const [callStatus,       setCallStatus]       = useState("Connecting...");
    const [showWaitingPanel, setShowWaitingPanel] = useState(true);
    const [speakIdx,         setSpeakIdx]         = useState(0);
    const [isMobile,         setIsMobile]         = useState(false);

    // ── Detect mobile ─────────────────────────────────────────────────────────
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);

    // ── Speaker cycling (cosmetic — replace with real VAD if desired) ─────────
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
            } catch (err) {
                console.error("Camera/mic error:", err);
            }
        };
        init();
        return () => { localStreamRef.current?.getTracks().forEach(t => t.stop()); };
    }, []);

    // ✅ Re-attach local stream whenever screen changes (video element may remount)
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
                {
                    urls: "turn:openrelay.metered.ca:80",
                    username: "openrelayproject", credential: "openrelayproject",
                },
                {
                    urls: "turn:openrelay.metered.ca:443",
                    username: "openrelayproject", credential: "openrelayproject",
                },
                {
                    urls: "turn:openrelay.metered.ca:443?transport=tcp",
                    username: "openrelayproject", credential: "openrelayproject",
                },
            ],
        });

        // Add local tracks to the peer connection
        localStreamRef.current?.getTracks().forEach(track => {
            pc.addTrack(track, localStreamRef.current!);
        });

        pc.onicecandidate = (event) => {
            if (event.candidate && socket) {
                socket.emit("group-ice-candidate", {
                    candidate: event.candidate, targetId, roomId,
                });
            }
        };

        pc.ontrack = (event) => {
            const stream = event.streams[0];
            setParticipants(prev =>
                prev.map(p => p.socketId === targetId ? { ...p, stream } : p)
            );
        };

        pc.oniceconnectionstatechange = () => {
            console.log(`🧊 ICE [${targetId.slice(0,8)}]:`, pc.iceConnectionState);
        };

        peerConnectionsRef.current.set(targetId, pc);
        return pc;
    }, [socket, roomId]);

    // ── Socket signaling ──────────────────────────────────────────────────────
    // ✅ KEY: depends on `hasJoined` NOT `roomState`.
    //    Runs ONCE when user clicks Join Now.
    //    Listeners survive the preview→waiting→in-call transitions.
    useEffect(() => {
        if (!socket || !hasJoined || !mediaStreamReady) return;

        console.log("🔌 join-group-room:", roomId);
        socket.emit("join-group-room", { roomId, userName });

        // Admin: created room, enter call immediately
        socket.on("group-joined", ({ isAdmin: admin }: { isAdmin: boolean }) => {
            setIsAdmin(admin);
            setRoomState("in-call");
            setCallStatus(admin ? "Waiting for participants…" : "Connected");
        });

        // Non-admin: put in waiting room UI (socket stays alive)
        socket.on("waiting-for-admission", ({ adminName: name }: { adminName: string }) => {
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

        // ✅ Non-admin admitted — listener alive because roomState not in deps
        socket.on("group-admitted", ({
            participants: peers,
        }: { participants: { socketId: string; userName: string }[]; roomId: string }) => {
            console.log("✅ Admitted, peers:", peers.length);
            setParticipants(peers.map(p => ({ ...p, stream: undefined })));
            setRoomState("in-call");
            setCallStatus("Connected");
        });

        // Admin: someone knocked
        socket.on("user-waiting", ({ socketId, userName: wName }: WaitingUser) => {
            setWaitingUsers(prev => [...prev, { socketId, userName: wName }]);
            setShowWaitingPanel(true);
        });

        // Existing peer: new participant joined → send offer to them
        socket.on("group-new-peer", async ({
            socketId: newId, userName: newName,
        }: { socketId: string; userName: string }) => {
            setParticipants(prev => [...prev, { socketId: newId, userName: newName }]);
            const pc    = createPeerConnection(newId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("group-offer", { offer, targetId: newId, roomId });
        });

        // Receive offer from an existing peer
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
                catch (e) { console.error("ICE add error:", e); }
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
    // ✅ roomState intentionally NOT here — effect must not re-run on screen changes
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
        if (!track) return;
        track.enabled = !track.enabled;
        setIsMuted(!track.enabled);
    };

    // ✅ FIX: toggle track.enabled only. Video element stays mounted so srcObject
    //    is preserved — camera comes back on immediately without re-setting srcObject.
    const toggleCamera = () => {
        const track = localStreamRef.current?.getVideoTracks()[0];
        if (!track) return;
        track.enabled = !track.enabled;
        setIsCameraOff(!track.enabled);
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
            <div style={{ minHeight: "100vh", background: "#101115", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "white", fontSize: 16, opacity: 0.6 }}>Loading…</div>
            </div>
        );
    }
    if (!user) return null;

    // =========================================================================
    // PREVIEW SCREEN
    // =========================================================================
    if (roomState === "preview") {
        return (
            <div style={{ minHeight: "100vh", background: "#101115", color: "white", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui,sans-serif" }}>
                <style>{`@keyframes breathe{0%,100%{opacity:.5}50%{opacity:1}}`}</style>
                <div style={{ maxWidth: 900, width: "100%", display: "flex", flexWrap: "wrap", gap: 32, alignItems: "center", justifyContent: "center" }}>

                    {/* Camera preview */}
                    <div style={{ flex: "1 1 340px", maxWidth: 560 }}>
                        <div style={{ position: "relative", aspectRatio: "16/9", background: "#1e1f22", borderRadius: 18, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 24px 48px rgba(0,0,0,0.5)" }}>
                            {/* ✅ Always rendered — just hidden when cam off */}
                            <video
                                ref={localVideoRef}
                                autoPlay playsInline muted
                                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", display: isCameraOff ? "none" : "block" }}
                            />
                            {isCameraOff && (
                                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#1e1f22" }}>
                                    <div style={{ width: 88, height: 88, borderRadius: "50%", background: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <span style={{ fontSize: 36, fontWeight: 700 }}>{userName.charAt(0).toUpperCase()}</span>
                                    </div>
                                </div>
                            )}
                            <div style={{ position: "absolute", bottom: 12, left: 12, background: "rgba(0,0,0,0.6)", padding: "4px 10px", borderRadius: 7, fontSize: 13, backdropFilter: "blur(8px)" }}>
                                You ({userName})
                            </div>
                            <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 12 }}>
                                <button onClick={toggleMute} style={{ width: 44, height: 44, borderRadius: "50%", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: isMuted ? "#ef4444" : "rgba(30,31,34,0.85)", color: "white", backdropFilter: "blur(8px)" }}>
                                    {isMuted ? <MicOff style={{ width: 18, height: 18 }} /> : <Mic style={{ width: 18, height: 18 }} />}
                                </button>
                                <button onClick={toggleCamera} style={{ width: 44, height: 44, borderRadius: "50%", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: isCameraOff ? "#ef4444" : "rgba(30,31,34,0.85)", color: "white", backdropFilter: "blur(8px)" }}>
                                    {isCameraOff ? <VideoOff style={{ width: 18, height: 18 }} /> : <Video style={{ width: 18, height: 18 }} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Join panel */}
                    <div style={{ flex: "1 1 260px", maxWidth: 340, display: "flex", flexDirection: "column", gap: 18 }}>
                        <div>
                            <h1 style={{ fontSize: 30, fontWeight: 800, margin: 0, marginBottom: 6 }}>Ready to join?</h1>
                            <p style={{ color: "#9ca3af", margin: 0 }}>
                                Joining as <span style={{ color: "white", fontWeight: 600 }}>{userName}</span>
                            </p>
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "12px 14px", border: "1px solid rgba(255,255,255,0.08)" }}>
                            <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, margin: "0 0 4px 0", textTransform: "uppercase", letterSpacing: 1 }}>Room ID</p>
                            <p style={{ fontFamily: "monospace", fontSize: 11, color: "#9ca3af", margin: 0, wordBreak: "break-all" }}>{roomId}</p>
                        </div>

                        {mediaStreamReady ? (
                            <button
                                onClick={() => { setRoomState("in-call"); setHasJoined(true); }}
                                style={{ padding: "14px 0", background: "#4f46e5", color: "white", border: "none", borderRadius: 50, fontWeight: 700, fontSize: 16, cursor: "pointer", boxShadow: "0 8px 24px rgba(79,70,229,0.35)", transition: "background 0.15s" }}
                                onMouseEnter={e => (e.currentTarget.style.background = "#4338ca")}
                                onMouseLeave={e => (e.currentTarget.style.background = "#4f46e5")}
                            >
                                Join Now
                            </button>
                        ) : (
                            <div style={{ padding: "14px 0", background: "#1f2937", color: "#6b7280", borderRadius: 50, textAlign: "center", fontWeight: 600, fontSize: 15 }}>
                                Starting camera…
                            </div>
                        )}

                        <button
                            onClick={() => router.push("/dashboard/group-calling")}
                            style={{ padding: "13px 0", background: "transparent", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 50, fontWeight: 600, fontSize: 15, cursor: "pointer" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
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
            <div style={{ minHeight: "100vh", background: "#101115", color: "white", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui,sans-serif" }}>
                <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
                    <div style={{ width: 72, height: 72, borderRadius: "50%", border: "2px solid #6366f1", background: "rgba(99,102,241,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 22px", animation: "breathe 2s ease-in-out infinite" }}>
                        <Users style={{ width: 30, height: 30, color: "#818cf8" }} />
                    </div>
                    <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px" }}>Waiting to be admitted</h1>
                    <p style={{ color: "#9ca3af", margin: "0 0 4px" }}>{adminName} will let you in soon.</p>
                    <p style={{ color: "#4b5563", fontSize: 13, margin: "0 0 28px" }}>Please wait for the host to admit you.</p>

                    {/* ✅ Always-rendered video — just CSS hidden when cam off */}
                    <div style={{ position: "relative", aspectRatio: "16/9", background: "#1e1f22", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 22 }}>
                        <video
                            ref={localVideoRef}
                            autoPlay playsInline muted
                            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", display: isCameraOff ? "none" : "block" }}
                        />
                        {isCameraOff && (
                            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <span style={{ fontSize: 26, fontWeight: 700 }}>{userName.charAt(0).toUpperCase()}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ display: "flex", justifyContent: "center", gap: 14 }}>
                        {[
                            { Icon: isMuted ? MicOff : Mic, active: isMuted, fn: toggleMute },
                            { Icon: isCameraOff ? VideoOff : Video, active: isCameraOff, fn: toggleCamera },
                        ].map(({ Icon, active, fn }, i) => (
                            <button key={i} onClick={fn} style={{ width: 46, height: 46, borderRadius: "50%", border: active ? "none" : "1px solid rgba(255,255,255,0.12)", background: active ? "#ef4444" : "rgba(255,255,255,0.07)", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Icon style={{ width: 18, height: 18 }} />
                            </button>
                        ))}
                        <button onClick={handleEndCall} style={{ width: 46, height: 46, borderRadius: "50%", border: "none", background: "#dc2626", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <PhoneOff style={{ width: 18, height: 18 }} />
                        </button>
                    </div>
                </div>
                <style>{`@keyframes breathe{0%,100%{opacity:.5}50%{opacity:1}}`}</style>
            </div>
        );
    }

    // =========================================================================
    // IN-CALL SCREEN
    // =========================================================================
    const totalTiles  = participants.length + 1;
    const { cols, rows } = getGridConfig(totalTiles, isMobile);
    const compact     = totalTiles >= 7;
    const allowScroll = isMobile && totalTiles > 6;

    return (
        <div style={{ height: "100vh", background: "#101115", color: "white", display: "flex", flexDirection: "column", fontFamily: "system-ui,sans-serif" }}>
            <style>{`
                *{box-sizing:border-box}
                @keyframes audioBar{from{transform:scaleY(.45)}to{transform:scaleY(1)}}
                @keyframes speakPulse{0%,100%{opacity:.65}50%{opacity:1}}
                @keyframes breathe{0%,100%{opacity:.5}50%{opacity:1}}
                ::-webkit-scrollbar{width:3px}
                ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:2px}
            `}</style>

            {/* ── Top bar ─────────────────────────────────────────────────────── */}
            <div style={{ flexShrink: 0, height: 48, background: "#18191c", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: 7, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                        {callStatus}
                    </span>
                    <span style={{ color: "#9ca3af", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                        <Users style={{ width: 13, height: 13 }} />{totalTiles} / 10
                    </span>
                    {isAdmin && (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, color: "#facc15", background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.2)", display: "flex", alignItems: "center", gap: 4 }}>
                            <Crown style={{ width: 11, height: 11 }} />Host
                        </span>
                    )}
                </div>
                {isAdmin && waitingUsers.length > 0 && (
                    <button
                        onClick={() => setShowWaitingPanel(v => !v)}
                        style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.4)", color: "#a5b4fc", padding: "6px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer", animation: "breathe 2s ease-in-out infinite" }}
                    >
                        <Users style={{ width: 13, height: 13 }} />
                        {waitingUsers.length} waiting
                    </button>
                )}
            </div>

            {/* ── Main area ───────────────────────────────────────────────────── */}
            <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>

                {/* Video grid */}
                <div style={{ flex: 1, minHeight: 0, overflow: allowScroll ? "auto" : "hidden", display: "flex", justifyContent: isMobile ? "center" : "stretch", padding: compact ? 6 : 8 }}>
                    <div style={{ width: isMobile ? 375 : "100%", height: allowScroll ? "auto" : "100%", display: "grid", gridTemplateColumns: `repeat(${cols},1fr)`, gridTemplateRows: allowScroll ? undefined : `repeat(${rows},1fr)`, gap: compact ? 5 : 8 }}>

                        {/* Local tile */}
                        <div style={{ minWidth: 0, minHeight: 0, ...(allowScroll ? { aspectRatio: "16/9" } : {}), ...getOrphanStyle(0, totalTiles, cols) }}>
                            <VideoTile
                                name={userName}
                                color={getColor(0)}
                                isLocal={true}
                                isAdmin={isAdmin}
                                isMuted={isMuted}
                                isCamOff={isCameraOff}
                                isActive={speakIdx === 0}
                                compact={compact}
                                stream={localStreamRef.current ?? undefined}
                                videoRef={localVideoRef as React.RefObject<HTMLVideoElement>}
                            />
                        </div>

                        {/* Remote tiles */}
                        {participants.map((p, idx) => (
                            <div key={p.socketId} style={{ minWidth: 0, minHeight: 0, ...(allowScroll ? { aspectRatio: "16/9" } : {}), ...getOrphanStyle(idx + 1, totalTiles, cols) }}>
                                <VideoTile
                                    name={p.userName}
                                    color={getColor(idx + 1)}
                                    isLocal={false}
                                    isAdmin={false}
                                    isMuted={p.isMuted ?? false}
                                    isCamOff={p.isCamOff ?? false}
                                    isActive={speakIdx === idx + 1}
                                    compact={compact}
                                    stream={p.stream}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Admin: waiting panel */}
                {isAdmin && waitingUsers.length > 0 && showWaitingPanel && (
                    <div style={{ width: 272, background: "#18191c", borderLeft: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
                        <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ color: "white", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                                <Users style={{ width: 14, height: 14, color: "#818cf8" }} />
                                Waiting ({waitingUsers.length})
                            </span>
                            <button onClick={() => setShowWaitingPanel(false)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", display: "flex" }}>
                                <X style={{ width: 15, height: 15 }} />
                            </button>
                        </div>
                        <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                            {waitingUsers.map(u => (
                                <div key={u.socketId} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                        <span style={{ fontSize: 14, fontWeight: 700, color: "white" }}>{u.userName.charAt(0).toUpperCase()}</span>
                                    </div>
                                    <span style={{ color: "white", fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.userName}</span>
                                    <button onClick={() => admitUser(u.socketId)} style={{ width: 30, height: 30, borderRadius: "50%", background: "#16a34a", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <Check style={{ width: 14, height: 14, color: "white" }} />
                                    </button>
                                    <button onClick={() => rejectUser(u.socketId)} style={{ width: 30, height: 30, borderRadius: "50%", background: "#b91c1c", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <X style={{ width: 14, height: 14, color: "white" }} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        {waitingUsers.length > 1 && (
                            <div style={{ padding: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                                <button onClick={() => waitingUsers.forEach(u => admitUser(u.socketId))} style={{ width: "100%", padding: "8px 0", background: "#4f46e5", color: "white", border: "none", borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                                    Admit All ({waitingUsers.length})
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Controls ─────────────────────────────────────────────────────── */}
            <div style={{ flexShrink: 0, height: 68, background: "#18191c", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                {[
                    { Icon: isMuted ? MicOff : Mic,         active: isMuted,    fn: toggleMute },
                    { Icon: isCameraOff ? VideoOff : Video, active: isCameraOff, fn: toggleCamera },
                ].map(({ Icon, active, fn }, i) => (
                    <button key={i} onClick={fn} style={{ width: 46, height: 46, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: active ? "#ef4444" : "rgba(255,255,255,0.07)", border: active ? "none" : "1px solid rgba(255,255,255,0.12)", color: "white", cursor: "pointer", transition: "all 0.15s" }}>
                        <Icon style={{ width: 18, height: 18 }} />
                    </button>
                ))}
                <button onClick={handleEndCall} style={{ height: 46, padding: "0 20px", borderRadius: 23, display: "flex", alignItems: "center", gap: 8, background: "#ef4444", color: "white", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
                    <PhoneOff style={{ width: 16, height: 16 }} />Leave
                </button>
            </div>
        </div>
    );
}