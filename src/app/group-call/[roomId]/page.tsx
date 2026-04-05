// "use client";

// import { useContext, useEffect, useRef, useState, useCallback } from "react";
// import { useParams, useRouter } from "next/navigation";
// import { useSocket } from "@/hooks/useSocket";
// import { AuthContext } from "@/context/AuthContext";
// import {
//     Mic, MicOff, Video, VideoOff, PhoneOff,
//     Users, Check, X, Crown,
//     MessageSquare,
//     Send,
// } from "lucide-react";

// // ─── Types ────────────────────────────────────────────────────────────────────
// interface Participant {
//     socketId: string;
//     userName: string;
//     stream?: MediaStream;
//     isMuted?: boolean;
//     isCamOff?: boolean;
// }
// interface WaitingUser {
//     socketId: string;
//     userName: string;
// }

// interface GroupChatMessage {
//     id: string
//     message: string
//     userName: string
//     timeStamp: number
//     isSelf: boolean
// }

// // ─── Colors ───────────────────────────────────────────────────────────────────
// const COLORS = [
//     "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981",
//     "#3b82f6", "#ef4444", "#14b8a6", "#f97316", "#a855f7",
// ];
// const getColor = (i: number) => COLORS[i % COLORS.length];

// // ─── Grid helpers ─────────────────────────────────────────────────────────────
// function getGridConfig(total: number, mobile: boolean) {
//     if (mobile) {
//         if (total === 1) return { cols: 1, rows: 1 };
//         if (total <= 2) return { cols: 1, rows: 2 };
//         if (total <= 4) return { cols: 2, rows: 2 };
//         if (total <= 6) return { cols: 2, rows: 3 };
//         return { cols: 2, rows: Math.ceil(total / 2) };
//     }
//     if (total === 1) return { cols: 1, rows: 1 };
//     if (total === 2) return { cols: 2, rows: 1 };
//     if (total === 3) return { cols: 3, rows: 1 };
//     if (total === 4) return { cols: 2, rows: 2 };
//     if (total <= 6) return { cols: 3, rows: 2 };
//     if (total <= 8) return { cols: 4, rows: 2 };
//     if (total === 9) return { cols: 3, rows: 3 };
//     return { cols: 5, rows: 2 };
// }

// function getOrphanStyle(idx: number, total: number, cols: number): React.CSSProperties {
//     const rows = Math.ceil(total / cols);
//     const lastRowCount = total - (rows - 1) * cols;
//     if (lastRowCount === cols) return {};
//     const firstIdx = (rows - 1) * cols;
//     if (idx < firstIdx) return {};
//     const colOffset = Math.floor((cols - lastRowCount) / 2);
//     return { gridColumnStart: colOffset + 1 + (idx - firstIdx) };
// }

// // ─── VideoTile ────────────────────────────────────────────────────────────────
// // ✅ FIX: <video> is ALWAYS mounted — never unmounted.
// // We use CSS display:none/block to hide/show it.
// // This means srcObject stays set permanently and camera re-enable works.
// function VideoTile({
//     name, color, isLocal, isAdmin, isMuted, isCamOff,
//     isActive, compact, stream, videoRef,
// }: {
//     name: string;
//     color: string;
//     isLocal: boolean;
//     isAdmin: boolean;
//     isMuted: boolean;
//     isCamOff: boolean;
//     isActive: boolean;
//     compact: boolean;
//     stream?: MediaStream;
//     videoRef?: React.RefObject<HTMLVideoElement>;
// }) {
//     const internalRef = useRef<HTMLVideoElement>(null);
//     const ref = (videoRef ?? internalRef) as React.RefObject<HTMLVideoElement>;

//     // Set srcObject when stream first arrives (or changes)
//     useEffect(() => {
//         if (ref.current && stream && ref.current.srcObject !== stream) {
//             ref.current.srcObject = stream;
//         }
//     }, [stream]); // eslint-disable-line react-hooks/exhaustive-deps

//     const bars = [0.35, 0.65, 1, 0.7, 0.45];
//     const avatarSize = compact ? 38 : 54;
//     const fs = compact ? 10 : 12;
//     const showVideo = !isCamOff && (!!stream || isLocal);

//     return (
//         <div
//             style={{
//                 position: "relative",
//                 overflow: "hidden",
//                 width: "100%",
//                 height: "100%",
//                 borderRadius: compact ? 10 : 14,
//                 background: "#16171a",
//                 border: isActive
//                     ? `2px solid ${color}99`
//                     : "1px solid rgba(255,255,255,0.06)",
//                 boxShadow: isActive
//                     ? `0 0 0 1px ${color}33, 0 0 18px ${color}1a`
//                     : "none",
//                 transition: "border 0.2s, box-shadow 0.2s",
//             }}
//         >
//             {/* ── Video element — ALWAYS in DOM ────────────────────────────────
//                 display:none when cam off. Keeps srcObject alive so toggling
//                 camera back on shows video immediately without re-setting srcObject. */}
//             <video
//                 ref={ref}
//                 autoPlay
//                 playsInline
//                 muted={isLocal}
//                 style={{
//                     position: "absolute",
//                     inset: 0,
//                     width: "100%",
//                     height: "100%",
//                     objectFit: "cover",
//                     transform: isLocal ? "scaleX(-1)" : "none",
//                     display: showVideo ? "block" : "none",  // ✅ CSS hide, not unmount
//                 }}
//             />

//             {/* ── Gradient placeholder (connecting…) ── */}
//             {!isCamOff && !stream && !isLocal && (
//                 <div style={{ position: "absolute", inset: 0 }}>
//                     <div style={{
//                         position: "absolute", inset: 0,
//                         background: `radial-gradient(ellipse at 35% 35%, ${color}18 0%, transparent 55%),
//                                      radial-gradient(ellipse at 65% 65%, ${color}0c 0%, transparent 50%)`,
//                     }} />
//                     <div style={{
//                         position: "absolute", inset: 0,
//                         backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,0.016) 2px,rgba(255,255,255,0.016) 3px)",
//                     }} />
//                     <div style={{
//                         position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
//                         width: "54%", height: "76%",
//                         background: `radial-gradient(ellipse at 50% 30%, ${color}38 0%, ${color}14 40%, transparent 75%)`,
//                         borderRadius: "50% 50% 0 0 / 60% 60% 0 0",
//                     }} />
//                     <div style={{
//                         position: "absolute", inset: 0,
//                         background: `radial-gradient(ellipse at 50% 50%, ${color}08 0%, transparent 60%)`,
//                         animation: "breathe 3s ease-in-out infinite",
//                     }} />
//                 </div>
//             )}

//             {/* ── Avatar (camera off) ── */}
//             {isCamOff && (
//                 <div style={{
//                     position: "absolute", inset: 0,
//                     display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
//                     background: `radial-gradient(ellipse at 50% 50%, ${color}0d 0%, transparent 70%)`,
//                 }}>
//                     <div style={{
//                         width: avatarSize, height: avatarSize, borderRadius: "50%",
//                         background: `${color}1e`, border: `2px solid ${color}44`,
//                         display: "flex", alignItems: "center", justifyContent: "center",
//                     }}>
//                         <span style={{ fontSize: avatarSize * 0.38, fontWeight: 700, color }}>
//                             {name.charAt(0).toUpperCase()}
//                         </span>
//                     </div>
//                     {!compact && (
//                         <span style={{ fontSize: 10, color: "#6b7280", display: "flex", alignItems: "center", gap: 3 }}>
//                             <VideoOff style={{ width: 9, height: 9 }} /> Camera off
//                         </span>
//                     )}
//                 </div>
//             )}

//             {/* ── Speaking ring ── */}
//             {isActive && (
//                 <div style={{
//                     position: "absolute", inset: 0, pointerEvents: "none",
//                     borderRadius: "inherit",
//                     border: `2px solid ${color}bb`,
//                     animation: "speakPulse 1.4s ease-in-out infinite",
//                 }} />
//             )}

//             {/* ── Name bar ── */}
//             <div style={{
//                 position: "absolute", bottom: 0, left: 0, right: 0,
//                 display: "flex", alignItems: "center", gap: 6, padding: "6px 8px",
//                 background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.25) 60%, transparent 100%)",
//             }}>
//                 {isAdmin && <Crown style={{ width: fs, height: fs, color: "#facc15", flexShrink: 0 }} />}
//                 <span style={{
//                     fontSize: fs, fontWeight: 500, color: "white",
//                     flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
//                 }}>
//                     {isLocal ? `You (${name})` : name}
//                 </span>
//                 {!isMuted ? (
//                     <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 11, flexShrink: 0 }}>
//                         {bars.map((h, i) => (
//                             <div key={i} style={{
//                                 width: 2, height: `${h * 100}%`,
//                                 background: isActive ? color : "#4ade80",
//                                 borderRadius: 1,
//                                 animation: `audioBar 0.7s ease-in-out ${i * 0.08}s infinite alternate`,
//                                 transformOrigin: "bottom",
//                             }} />
//                         ))}
//                     </div>
//                 ) : (
//                     <div style={{
//                         width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
//                         background: "rgba(239,68,68,0.85)",
//                         display: "flex", alignItems: "center", justifyContent: "center",
//                     }}>
//                         <MicOff style={{ width: 8, height: 8, color: "white" }} />
//                     </div>
//                 )}
//             </div>

//             {/* ── YOU pill ── */}
//             {isLocal && (
//                 <div style={{
//                     position: "absolute", top: 8, left: 8,
//                     fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 5,
//                     background: `${color}2a`, color, border: `1px solid ${color}40`,
//                 }}>YOU</div>
//             )}
//         </div>
//     );
// }

// // ─── Main Component ───────────────────────────────────────────────────────────
// export default function GroupCallRoom() {
//     const { roomId } = useParams<{ roomId: string }>();
//     const router = useRouter();
//     const socket = useSocket();
//     const auth = useContext(AuthContext);
//     const { user, loading } = auth || {};
//     const userName = (!auth?.loading && auth?.user?.name) ? auth.user.name : "Guest";

//     // ── Refs ──────────────────────────────────────────────────────────────────
//     const localVideoRef = useRef<HTMLVideoElement>(null);
//     const localStreamRef = useRef<MediaStream | null>(null);
//     const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

//     // Chat related refs
//     const chatEndRef = useRef<HTMLDivElement>(null)
//     const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

//     // ── State ─────────────────────────────────────────────────────────────────
//     const [isMuted, setIsMuted] = useState(false);
//     const [isCameraOff, setIsCameraOff] = useState(false);
//     const [mediaStreamReady, setMediaStreamReady] = useState(false);
//     // ✅ hasJoined triggers socket effect once. roomState only controls which screen to render.
//     const [hasJoined, setHasJoined] = useState(false);
//     const [roomState, setRoomState] = useState<"preview" | "waiting" | "in-call">("preview");
//     const [isAdmin, setIsAdmin] = useState(false);
//     const [adminName, setAdminName] = useState("");
//     const [participants, setParticipants] = useState<Participant[]>([]);
//     const [waitingUsers, setWaitingUsers] = useState<WaitingUser[]>([]);
//     const [callStatus, setCallStatus] = useState("Connecting...");
//     const [showWaitingPanel, setShowWaitingPanel] = useState(true);
//     const [speakIdx, setSpeakIdx] = useState(0);
//     const [isMobile, setIsMobile] = useState(false);

//     // ── Group chat state ──────────────────────────────────────────────────
//     const [showChat, setShowChat] = useState(false);
//     const [chatMessage, setChatMessage] = useState<GroupChatMessage[]>([]);
//     const [chatInput, setChatInput] = useState("")
//     const [unreadCount, setUnreadCount] = useState(0);
//     const [peerTyping, setPeerTyping] = useState<string | null>(null);

//     // ── Detect mobile ─────────────────────────────────────────────────────────
//     useEffect(() => {
//         const check = () => setIsMobile(window.innerWidth < 768);
//         check();
//         window.addEventListener("resize", check);
//         return () => window.removeEventListener("resize", check);
//     }, []);

//     // ── Speaker cycling (cosmetic — replace with real VAD if desired) ─────────
//     useEffect(() => {
//         if (roomState !== "in-call") return;
//         const total = participants.length + 1;
//         const id = setInterval(() => setSpeakIdx(i => (i + 1) % total), 2800);
//         return () => clearInterval(id);
//     }, [roomState, participants.length]);

//     // ── Auth guard ────────────────────────────────────────────────────────────
//     useEffect(() => {
//         if (!loading && !user) router.replace("/login");
//     }, [user, loading, router]);

//     // ── Init local media ──────────────────────────────────────────────────────
//     useEffect(() => {
//         const init = async () => {
//             try {
//                 const stream = await navigator.mediaDevices.getUserMedia({
//                     video: { facingMode: "user" },
//                     audio: true,
//                 });
//                 localStreamRef.current = stream;
//                 if (localVideoRef.current) localVideoRef.current.srcObject = stream;
//                 setMediaStreamReady(true);
//             } catch (err) {
//                 console.error("Camera/mic error:", err);
//             }
//         };
//         init();
//         return () => { localStreamRef.current?.getTracks().forEach(t => t.stop()); };
//     }, []);

//     // ✅ Re-attach local stream whenever screen changes (video element may remount)
//     useEffect(() => {
//         if (localVideoRef.current && localStreamRef.current) {
//             localVideoRef.current.srcObject = localStreamRef.current;
//         }
//     }, [roomState]);



//     // ── Create RTCPeerConnection ───────────────────────────────────────────────
//     const createPeerConnection = useCallback((targetId: string): RTCPeerConnection => {
//         const pc = new RTCPeerConnection({
//             iceServers: [
//                 { urls: "stun:stun.l.google.com:19302" },
//                 { urls: "stun:stun1.l.google.com:19302" },
//                 {
//                     urls: "turn:openrelay.metered.ca:80",
//                     username: "openrelayproject", credential: "openrelayproject",
//                 },
//                 {
//                     urls: "turn:openrelay.metered.ca:443",
//                     username: "openrelayproject", credential: "openrelayproject",
//                 },
//                 {
//                     urls: "turn:openrelay.metered.ca:443?transport=tcp",
//                     username: "openrelayproject", credential: "openrelayproject",
//                 },
//             ],
//         });

//         // Add local tracks to the peer connection
//         localStreamRef.current?.getTracks().forEach(track => {
//             pc.addTrack(track, localStreamRef.current!);
//         });

//         pc.onicecandidate = (event) => {
//             if (event.candidate && socket) {
//                 socket.emit("group-ice-candidate", {
//                     candidate: event.candidate, targetId, roomId,
//                 });
//             }
//         };

//         pc.ontrack = (event) => {
//             const stream = event.streams[0];
//             setParticipants(prev =>
//                 prev.map(p => p.socketId === targetId ? { ...p, stream } : p)
//             );
//         };

//         pc.oniceconnectionstatechange = () => {
//             console.log(`🧊 ICE [${targetId.slice(0, 8)}]:`, pc.iceConnectionState);
//         };

//         peerConnectionsRef.current.set(targetId, pc);
//         return pc;
//     }, [socket, roomId]);

//     // ── Socket signaling ──────────────────────────────────────────────────────
//     // ✅ KEY: depends on `hasJoined` NOT `roomState`.
//     //    Runs ONCE when user clicks Join Now.
//     //    Listeners survive the preview→waiting→in-call transitions.
//     useEffect(() => {
//         if (!socket || !hasJoined || !mediaStreamReady) return;

//         console.log("🔌 join-group-room:", roomId);
//         socket.emit("join-group-room", { roomId, userName });

//         // Admin: created room, enter call immediately
//         socket.on("group-joined", ({ isAdmin: admin }: { isAdmin: boolean }) => {
//             setIsAdmin(admin);
//             setRoomState("in-call");
//             setCallStatus(admin ? "Waiting for participants…" : "Connected");
//         });

//         // Non-admin: put in waiting room UI (socket stays alive)
//         socket.on("waiting-for-admission", ({ adminName: name }: { adminName: string }) => {
//             setAdminName(name);
//             setRoomState("waiting");
//         });

//         socket.on("group-rejected", () => {
//             alert("Your request to join was rejected by the host.");
//             router.push("/dashboard/group-calling");
//         });

//         socket.on("group-room-full", () => {
//             alert("This room is full (max 10 participants).");
//             router.push("/dashboard/group-calling");
//         });

//         // ✅ Non-admin admitted — listener alive because roomState not in deps
//         socket.on("group-admitted", ({
//             participants: peers,
//         }: { participants: { socketId: string; userName: string }[]; roomId: string }) => {
//             console.log("✅ Admitted, peers:", peers.length);
//             setParticipants(peers.map(p => ({ ...p, stream: undefined })));
//             setRoomState("in-call");
//             setCallStatus("Connected");
//         });

//         // Admin: someone knocked
//         socket.on("user-waiting", ({ socketId, userName: wName }: WaitingUser) => {
//             setWaitingUsers(prev => [...prev, { socketId, userName: wName }]);
//             setShowWaitingPanel(true);
//         });

//         // Existing peer: new participant joined → send offer to them
//         socket.on("group-new-peer", async ({
//             socketId: newId, userName: newName,
//         }: { socketId: string; userName: string }) => {
//             setParticipants(prev => [...prev, { socketId: newId, userName: newName }]);
//             const pc = createPeerConnection(newId);
//             const offer = await pc.createOffer();
//             await pc.setLocalDescription(offer);
//             socket.emit("group-offer", { offer, targetId: newId, roomId });
//         });

//         // Receive offer from an existing peer
//         socket.on("group-offer", async ({
//             offer, fromId,
//         }: { offer: RTCSessionDescriptionInit; fromId: string; roomId: string }) => {
//             let pc = peerConnectionsRef.current.get(fromId);
//             if (!pc) pc = createPeerConnection(fromId);
//             await pc.setRemoteDescription(offer);
//             const answer = await pc.createAnswer();
//             await pc.setLocalDescription(answer);
//             socket.emit("group-answer", { answer, targetId: fromId, roomId });
//         });

//         socket.on("group-answer", async ({
//             answer, fromId,
//         }: { answer: RTCSessionDescriptionInit; fromId: string }) => {
//             const pc = peerConnectionsRef.current.get(fromId);
//             if (pc) await pc.setRemoteDescription(answer);
//         });

//         socket.on("group-ice-candidate", async ({
//             candidate, fromId,
//         }: { candidate: RTCIceCandidateInit; fromId: string }) => {
//             const pc = peerConnectionsRef.current.get(fromId);
//             if (pc) {
//                 try { await pc.addIceCandidate(candidate); }
//                 catch (e) { console.error("ICE add error:", e); }
//             }
//         });

//         socket.on("group-peer-left", ({ socketId }: { socketId: string }) => {
//             const pc = peerConnectionsRef.current.get(socketId);
//             if (pc) { pc.close(); peerConnectionsRef.current.delete(socketId); }
//             setParticipants(prev => prev.filter(p => p.socketId !== socketId));
//         });

//         socket.on("group-you-are-admin", () => {
//             setIsAdmin(true);
//             setCallStatus("You are now the host");
//         });

//         socket.on("group-chat-message", ({ message, userName: fromName, timeStamp }: {
//             message: string; userName: string; timeStamp: number
//         }) => {
//             const ts = timeStamp ?? Date.now();
//             setChatMessage(prev => [...prev, {
//                 id: `${ts}-${Math.random()}`,
//                 message, userName: fromName, timeStamp: ts, isSelf: false
//             }])
//             setShowChat(current => {
//                 if (!current) setUnreadCount(c => c + 1);
//                 return current
//             })
//         })

//         socket.on("group-chat-typing", ({ userName: typingName, isTyping }: {
//             userName: string, isTyping: boolean
//         }) => {
//             setPeerTyping(isTyping ? typingName : null);
//         })

//         return () => {
//             socket.off("group-joined");
//             socket.off("waiting-for-admission");
//             socket.off("group-rejected");
//             socket.off("group-room-full");
//             socket.off("group-admitted");
//             socket.off("user-waiting");
//             socket.off("group-new-peer");
//             socket.off("group-offer");
//             socket.off("group-answer");
//             socket.off("group-ice-candidate");
//             socket.off("group-peer-left");
//             socket.off("group-you-are-admin");
//             socket.off("group-chat-message");
//             socket.off("group-chat-typing");
//             peerConnectionsRef.current.forEach(pc => pc.close());
//             peerConnectionsRef.current.clear();
//         };
//         // ✅ roomState intentionally NOT here — effect must not re-run on screen changes
//     }, [socket, hasJoined, mediaStreamReady, roomId, userName, createPeerConnection, router]);

//     useEffect(() => {
//         chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
//     }, [chatMessage])

//     useEffect(() => {
//         if (showChat) setUnreadCount(0)
//     }, [showChat])

//     // ── Admin actions ─────────────────────────────────────────────────────────
//     const admitUser = (socketId: string) => {
//         socket?.emit("admit-user", { roomId, socketId });
//         setWaitingUsers(prev => prev.filter(u => u.socketId !== socketId));
//     };
//     const rejectUser = (socketId: string) => {
//         socket?.emit("reject-user", { roomId, socketId });
//         setWaitingUsers(prev => prev.filter(u => u.socketId !== socketId));
//     };

//     // ── Media controls ────────────────────────────────────────────────────────
//     const toggleMute = () => {
//         const track = localStreamRef.current?.getAudioTracks()[0];
//         if (!track) return;
//         track.enabled = !track.enabled;
//         setIsMuted(!track.enabled);
//     };

//     // ✅ FIX: toggle track.enabled only. Video element stays mounted so srcObject
//     //    is preserved — camera comes back on immediately without re-setting srcObject.
//     const toggleCamera = () => {
//         const track = localStreamRef.current?.getVideoTracks()[0];
//         if (!track) return;
//         track.enabled = !track.enabled;
//         setIsCameraOff(!track.enabled);
//     };

//     const handleEndCall = () => {
//         localStreamRef.current?.getTracks().forEach(t => t.stop());
//         peerConnectionsRef.current.forEach(pc => pc.close());
//         socket?.disconnect();
//         router.push("/dashboard/group-calling");
//     };

//     // ── Group chat helpers ────────────────────────────────────────────────
//     const sendGroupMessage = () => {
//         const msg = chatInput.trim();
//         if (!msg || !socket) return;
//         const timeStamp = Date.now();
//         socket.emit("group-chat-message", { roomId, message: msg, userName, timeStamp });
//         setChatMessage(prev => [...prev, {
//             id: `${timeStamp}-self`, message: msg, userName, timeStamp, isSelf: true
//         }])
//         setChatInput("");
//         socket.emit("group-chat-typing", { roomId, userName, isTyping: false });
//         if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
//     }

//     const handleGroupChatInput = (e: React.ChangeEvent<HTMLInputElement>) => {
//         setChatInput(e.target.value);
//         if (!socket) return;
//         socket.emit('group-chat-typing', { roomId, userName, isTyping: true });
//         if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
//         typingTimerRef.current = setTimeout(() => {
//             socket.emit("group-chat-typing", { roomId, userName, isTyping: false })
//         }, 1500);
//     }

//     const formatGroupTime = (ts: number) =>
//         new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

//     // ── Auth loading ──────────────────────────────────────────────────────────
//     if (loading) {
//         return (
//             <div style={{ minHeight: "100vh", background: "#101115", display: "flex", alignItems: "center", justifyContent: "center" }}>
//                 <div style={{ color: "white", fontSize: 16, opacity: 0.6 }}>Loading…</div>
//             </div>
//         );
//     }
//     if (!user) return null;

//     // =========================================================================
//     // PREVIEW SCREEN
//     // =========================================================================
//     if (roomState === "preview") {
//         return (
//             <div style={{ minHeight: "100vh", background: "#101115", color: "white", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui,sans-serif" }}>
//                 <style>{`@keyframes breathe{0%,100%{opacity:.5}50%{opacity:1}}`}</style>
//                 <div style={{ maxWidth: 900, width: "100%", display: "flex", flexWrap: "wrap", gap: 32, alignItems: "center", justifyContent: "center" }}>

//                     {/* Camera preview */}
//                     <div style={{ flex: "1 1 340px", maxWidth: 560 }}>
//                         <div style={{ position: "relative", aspectRatio: "16/9", background: "#1e1f22", borderRadius: 18, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 24px 48px rgba(0,0,0,0.5)" }}>
//                             {/* ✅ Always rendered — just hidden when cam off */}
//                             <video
//                                 ref={localVideoRef}
//                                 autoPlay playsInline muted
//                                 style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", display: isCameraOff ? "none" : "block" }}
//                             />
//                             {isCameraOff && (
//                                 <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#1e1f22" }}>
//                                     <div style={{ width: 88, height: 88, borderRadius: "50%", background: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center" }}>
//                                         <span style={{ fontSize: 36, fontWeight: 700 }}>{userName.charAt(0).toUpperCase()}</span>
//                                     </div>
//                                 </div>
//                             )}
//                             <div style={{ position: "absolute", bottom: 12, left: 12, background: "rgba(0,0,0,0.6)", padding: "4px 10px", borderRadius: 7, fontSize: 13, backdropFilter: "blur(8px)" }}>
//                                 You ({userName})
//                             </div>
//                             <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 12 }}>
//                                 <button onClick={toggleMute} style={{ width: 44, height: 44, borderRadius: "50%", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: isMuted ? "#ef4444" : "rgba(30,31,34,0.85)", color: "white", backdropFilter: "blur(8px)" }}>
//                                     {isMuted ? <MicOff style={{ width: 18, height: 18 }} /> : <Mic style={{ width: 18, height: 18 }} />}
//                                 </button>
//                                 <button onClick={toggleCamera} style={{ width: 44, height: 44, borderRadius: "50%", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: isCameraOff ? "#ef4444" : "rgba(30,31,34,0.85)", color: "white", backdropFilter: "blur(8px)" }}>
//                                     {isCameraOff ? <VideoOff style={{ width: 18, height: 18 }} /> : <Video style={{ width: 18, height: 18 }} />}
//                                 </button>
//                             </div>
//                         </div>
//                     </div>

//                     {/* Join panel */}
//                     <div style={{ flex: "1 1 260px", maxWidth: 340, display: "flex", flexDirection: "column", gap: 18 }}>
//                         <div>
//                             <h1 style={{ fontSize: 30, fontWeight: 800, margin: 0, marginBottom: 6 }}>Ready to join?</h1>
//                             <p style={{ color: "#9ca3af", margin: 0 }}>
//                                 Joining as <span style={{ color: "white", fontWeight: 600 }}>{userName}</span>
//                             </p>
//                         </div>
//                         <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "12px 14px", border: "1px solid rgba(255,255,255,0.08)" }}>
//                             <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, margin: "0 0 4px 0", textTransform: "uppercase", letterSpacing: 1 }}>Room ID</p>
//                             <p style={{ fontFamily: "monospace", fontSize: 11, color: "#9ca3af", margin: 0, wordBreak: "break-all" }}>{roomId}</p>
//                         </div>

//                         {mediaStreamReady ? (
//                             <button
//                                 onClick={() => { setRoomState("in-call"); setHasJoined(true); }}
//                                 style={{ padding: "14px 0", background: "#4f46e5", color: "white", border: "none", borderRadius: 50, fontWeight: 700, fontSize: 16, cursor: "pointer", boxShadow: "0 8px 24px rgba(79,70,229,0.35)", transition: "background 0.15s" }}
//                                 onMouseEnter={e => (e.currentTarget.style.background = "#4338ca")}
//                                 onMouseLeave={e => (e.currentTarget.style.background = "#4f46e5")}
//                             >
//                                 Join Now
//                             </button>
//                         ) : (
//                             <div style={{ padding: "14px 0", background: "#1f2937", color: "#6b7280", borderRadius: 50, textAlign: "center", fontWeight: 600, fontSize: 15 }}>
//                                 Starting camera…
//                             </div>
//                         )}

//                         <button
//                             onClick={() => router.push("/dashboard/group-calling")}
//                             style={{ padding: "13px 0", background: "transparent", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 50, fontWeight: 600, fontSize: 15, cursor: "pointer" }}
//                             onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
//                             onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
//                         >
//                             Cancel
//                         </button>
//                     </div>
//                 </div>
//             </div>
//         );
//     }

//     // =========================================================================
//     // WAITING ROOM SCREEN
//     // =========================================================================
//     if (roomState === "waiting") {
//         return (
//             <div style={{ minHeight: "100vh", background: "#101115", color: "white", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui,sans-serif" }}>
//                 <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
//                     <div style={{ width: 72, height: 72, borderRadius: "50%", border: "2px solid #6366f1", background: "rgba(99,102,241,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 22px", animation: "breathe 2s ease-in-out infinite" }}>
//                         <Users style={{ width: 30, height: 30, color: "#818cf8" }} />
//                     </div>
//                     <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px" }}>Waiting to be admitted</h1>
//                     <p style={{ color: "#9ca3af", margin: "0 0 4px" }}>{adminName} will let you in soon.</p>
//                     <p style={{ color: "#4b5563", fontSize: 13, margin: "0 0 28px" }}>Please wait for the host to admit you.</p>

//                     {/* ✅ Always-rendered video — just CSS hidden when cam off */}
//                     <div style={{ position: "relative", aspectRatio: "16/9", background: "#1e1f22", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 22 }}>
//                         <video
//                             ref={localVideoRef}
//                             autoPlay playsInline muted
//                             style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", display: isCameraOff ? "none" : "block" }}
//                         />
//                         {isCameraOff && (
//                             <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
//                                 <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center" }}>
//                                     <span style={{ fontSize: 26, fontWeight: 700 }}>{userName.charAt(0).toUpperCase()}</span>
//                                 </div>
//                             </div>
//                         )}
//                     </div>

//                     <div style={{ display: "flex", justifyContent: "center", gap: 14 }}>
//                         {[
//                             { Icon: isMuted ? MicOff : Mic, active: isMuted, fn: toggleMute },
//                             { Icon: isCameraOff ? VideoOff : Video, active: isCameraOff, fn: toggleCamera },
//                         ].map(({ Icon, active, fn }, i) => (
//                             <button key={i} onClick={fn} style={{ width: 46, height: 46, borderRadius: "50%", border: active ? "none" : "1px solid rgba(255,255,255,0.12)", background: active ? "#ef4444" : "rgba(255,255,255,0.07)", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
//                                 <Icon style={{ width: 18, height: 18 }} />
//                             </button>
//                         ))}
//                         <button onClick={handleEndCall} style={{ width: 46, height: 46, borderRadius: "50%", border: "none", background: "#dc2626", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
//                             <PhoneOff style={{ width: 18, height: 18 }} />
//                         </button>
//                     </div>
//                 </div>
//                 <style>{`@keyframes breathe{0%,100%{opacity:.5}50%{opacity:1}}`}</style>
//             </div>
//         );
//     }

//     // =========================================================================
//     // IN-CALL SCREEN
//     // =========================================================================
//     const totalTiles = participants.length + 1;
//     const { cols, rows } = getGridConfig(totalTiles, isMobile);
//     const compact = totalTiles >= 7;
//     const allowScroll = isMobile && totalTiles > 6;

//     return (
//         <div style={{ height: "100vh", background: "#101115", color: "white", display: "flex", flexDirection: "column", fontFamily: "system-ui,sans-serif" }}>
//             <style>{`
//             *{box-sizing:border-box}
//             @keyframes audioBar{from{transform:scaleY(.45)}to{transform:scaleY(1)}}
//             @keyframes speakPulse{0%,100%{opacity:.65}50%{opacity:1}}
//             @keyframes breathe{0%,100%{opacity:.5}50%{opacity:1}}
//             @keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}}
//             ::-webkit-scrollbar{width:3px}
//             ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:2px}
//         `}</style>

//             {/* ── Top bar ─────────────────────────────────────────────────────── */}
//             <div style={{ flexShrink: 0, height: 48, background: "#18191c", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
//                 <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
//                     <span style={{ fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: 7, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
//                         {callStatus}
//                     </span>
//                     <span style={{ color: "#9ca3af", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
//                         <Users style={{ width: 13, height: 13 }} />{totalTiles} / 10
//                     </span>
//                     {isAdmin && (
//                         <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, color: "#facc15", background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.2)", display: "flex", alignItems: "center", gap: 4 }}>
//                             <Crown style={{ width: 11, height: 11 }} />Host
//                         </span>
//                     )}
//                 </div>
//                 {isAdmin && waitingUsers.length > 0 && (
//                     <button
//                         onClick={() => setShowWaitingPanel(v => !v)}
//                         style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.4)", color: "#a5b4fc", padding: "6px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer", animation: "breathe 2s ease-in-out infinite" }}
//                     >
//                         <Users style={{ width: 13, height: 13 }} />
//                         {waitingUsers.length} waiting
//                     </button>
//                 )}
//             </div>

//             {/* ── Main area ───────────────────────────────────────────────────── */}
//             <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>

//                 {/* Video grid */}
//                 <div style={{ flex: 1, minHeight: 0, overflow: allowScroll ? "auto" : "hidden", display: "flex", justifyContent: isMobile ? "center" : "stretch", padding: compact ? 6 : 8 }}>
//                     <div style={{ width: isMobile ? 375 : "100%", height: allowScroll ? "auto" : "100%", display: "grid", gridTemplateColumns: `repeat(${cols},1fr)`, gridTemplateRows: allowScroll ? undefined : `repeat(${rows},1fr)`, gap: compact ? 5 : 8 }}>

//                         {/* Local tile */}
//                         <div style={{ minWidth: 0, minHeight: 0, ...(allowScroll ? { aspectRatio: "16/9" } : {}), ...getOrphanStyle(0, totalTiles, cols) }}>
//                             <VideoTile
//                                 name={userName}
//                                 color={getColor(0)}
//                                 isLocal={true}
//                                 isAdmin={isAdmin}
//                                 isMuted={isMuted}
//                                 isCamOff={isCameraOff}
//                                 isActive={speakIdx === 0}
//                                 compact={compact}
//                                 stream={localStreamRef.current ?? undefined}
//                                 videoRef={localVideoRef as React.RefObject<HTMLVideoElement>}
//                             />
//                         </div>

//                         {/* Remote tiles */}
//                         {participants.map((p, idx) => (
//                             <div key={p.socketId} style={{ minWidth: 0, minHeight: 0, ...(allowScroll ? { aspectRatio: "16/9" } : {}), ...getOrphanStyle(idx + 1, totalTiles, cols) }}>
//                                 <VideoTile
//                                     name={p.userName}
//                                     color={getColor(idx + 1)}
//                                     isLocal={false}
//                                     isAdmin={false}
//                                     isMuted={p.isMuted ?? false}
//                                     isCamOff={p.isCamOff ?? false}
//                                     isActive={speakIdx === idx + 1}
//                                     compact={compact}
//                                     stream={p.stream}
//                                 />
//                             </div>
//                         ))}
//                     </div>
//                 </div>

//                 {/* Admin: waiting panel */}
//                 {isAdmin && waitingUsers.length > 0 && showWaitingPanel && (
//                     <div style={{ width: 272, background: "#18191c", borderLeft: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
//                         <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
//                             <span style={{ color: "white", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
//                                 <Users style={{ width: 14, height: 14, color: "#818cf8" }} />
//                                 Waiting ({waitingUsers.length})
//                             </span>
//                             <button onClick={() => setShowWaitingPanel(false)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", display: "flex" }}>
//                                 <X style={{ width: 15, height: 15 }} />
//                             </button>
//                         </div>
//                         <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
//                             {waitingUsers.map(u => (
//                                 <div key={u.socketId} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
//                                     <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
//                                         <span style={{ fontSize: 14, fontWeight: 700, color: "white" }}>{u.userName.charAt(0).toUpperCase()}</span>
//                                     </div>
//                                     <span style={{ color: "white", fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.userName}</span>
//                                     <button onClick={() => admitUser(u.socketId)} style={{ width: 30, height: 30, borderRadius: "50%", background: "#16a34a", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
//                                         <Check style={{ width: 14, height: 14, color: "white" }} />
//                                     </button>
//                                     <button onClick={() => rejectUser(u.socketId)} style={{ width: 30, height: 30, borderRadius: "50%", background: "#b91c1c", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
//                                         <X style={{ width: 14, height: 14, color: "white" }} />
//                                     </button>
//                                 </div>
//                             ))}
//                         </div>
//                         {waitingUsers.length > 1 && (
//                             <div style={{ padding: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
//                                 <button onClick={() => waitingUsers.forEach(u => admitUser(u.socketId))} style={{ width: "100%", padding: "8px 0", background: "#4f46e5", color: "white", border: "none", borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
//                                     Admit All ({waitingUsers.length})
//                                 </button>
//                             </div>
//                         )}
//                     </div>
//                 )}
//                 {showChat && (
//                     <div className="w-[272px] bg-[#18191c] border-l border-white/[0.06] flex flex-col shrink-0 min-h-0">
//                         {/* Header */}
//                         <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between shrink-0">
//                             <span className="text-white font-semibold text-[13px] flex items-center gap-1.5">
//                                 <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
//                                 Group Chat
//                             </span>
//                             <button onClick={() => setShowChat(false)} className="bg-transparent border-none text-gray-500 hover:text-gray-300 cursor-pointer flex">
//                                 <X className="w-4 h-4" />
//                             </button>
//                         </div>

//                         {/* Messages */}
//                         <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2" style={{ scrollbarWidth: "thin" }}>
//                             {chatMessage.length === 0 && (
//                                 <div className="text-center text-gray-600 text-[13px] mt-10">
//                                     No messages yet. Say hello! 👋
//                                 </div>
//                             )}
//                             {chatMessage.map(msg => (
//                                 <div key={msg.id} className={`flex flex-col ${msg.isSelf ? "items-end" : "items-start"}`}>
//                                     <span className="text-[10px] text-gray-600 mb-1 px-1">
//                                         {msg.isSelf ? "You" : msg.userName} · {formatGroupTime(msg.timeStamp)}
//                                     </span>
//                                     <div className={`max-w-[85%] px-3 py-2 text-[13px] text-white leading-snug break-words ${msg.isSelf
//                                         ? "bg-indigo-600 rounded-2xl rounded-br-sm"
//                                         : "bg-white/10 rounded-2xl rounded-bl-sm"
//                                         }`}>
//                                         {msg.message}
//                                     </div>
//                                 </div>
//                             ))}

//                             {/* Typing indicator */}
//                             {peerTyping && (
//                                 <div className="flex flex-col items-start">
//                                     <span className="text-[10px] text-gray-600 mb-1 px-1">{peerTyping} is typing…</span>
//                                     <div className="bg-white/10 rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-1">
//                                         {[0, 1, 2].map(i => (
//                                             <span
//                                                 key={i}
//                                                 className="w-1.5 h-1.5 rounded-full bg-gray-500 inline-block"
//                                                 style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
//                                             />
//                                         ))}
//                                     </div>
//                                 </div>
//                             )}
//                             <div ref={chatEndRef} />
//                         </div>

//                         {/* Input */}
//                         <div className="px-3 py-3 border-t border-white/[0.06] flex gap-2 shrink-0">
//                             <input
//                                 type="text"
//                                 value={chatInput}
//                                 onChange={handleGroupChatInput}
//                                 onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendGroupMessage()}
//                                 placeholder="Type a message…"
//                                 className="flex-1 bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2 text-white text-[13px] outline-none placeholder-gray-600 focus:border-indigo-500 transition-colors"
//                             />
//                             <button
//                                 onClick={sendGroupMessage}
//                                 disabled={!chatInput.trim()}
//                                 className={`w-9 h-9 rounded-xl border-none flex items-center justify-center shrink-0 transition-colors ${chatInput.trim() ? "bg-indigo-600 hover:bg-indigo-700 cursor-pointer" : "bg-white/[0.05] cursor-not-allowed"}`}
//                             >
//                                 <Send className="w-3.5 h-3.5 text-white" />
//                             </button>
//                         </div>
//                     </div>
//                 )}
//             </div>



//             {/* ── Controls ─────────────────────────────────────────────────────── */}
//             <div style={{ flexShrink: 0, height: 68, background: "#18191c", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
//                 {[
//                     { Icon: isMuted ? MicOff : Mic, active: isMuted, fn: toggleMute },
//                     { Icon: isCameraOff ? VideoOff : Video, active: isCameraOff, fn: toggleCamera },
//                 ].map(({ Icon, active, fn }, i) => (
//                     <button key={i} onClick={fn} style={{ width: 46, height: 46, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: active ? "#ef4444" : "rgba(255,255,255,0.07)", border: active ? "none" : "1px solid rgba(255,255,255,0.12)", color: "white", cursor: "pointer", transition: "all 0.15s" }}>
//                         <Icon style={{ width: 18, height: 18 }} />
//                     </button>
//                 ))}

//                 <button
//                     onClick={() => setShowChat(v => !v)}
//                     className={`w-11 h-11 rounded-full flex items-center justify-center text-white cursor-pointer transition-all relative ${showChat ? "bg-indigo-600 border-none" : "bg-white/[0.07] border border-white/[0.12]"}`}
//                 >
//                     <MessageSquare className="w-4 h-4" />
//                     {unreadCount > 0 && !showChat && (
//                         <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-[#18191c]">
//                             {unreadCount > 9 ? "9+" : unreadCount}
//                         </span>
//                     )}
//                 </button>
//                 <button onClick={handleEndCall} style={{ height: 46, padding: "0 20px", borderRadius: 23, display: "flex", alignItems: "center", gap: 8, background: "#ef4444", color: "white", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
//                     <PhoneOff style={{ width: 16, height: 16 }} />Leave
//                 </button>
//             </div>
//         </div>
//     );
// }

"use client";

import { useContext, useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSocket } from "@/hooks/useSocket";
import { AuthContext } from "@/context/AuthContext";
import {
    Mic, MicOff, Video, VideoOff, PhoneOff,
    Users, Check, X, Crown, MessageSquare, Send, Hand,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Participant {
    socketId: string;
    userName: string;
    stream?: MediaStream;
    isMuted?: boolean;
    isCamOff?: boolean;
    handRaised?: boolean;
}
interface WaitingUser {
    socketId: string;
    userName: string;
}
interface GroupChatMessage {
    id: string;
    message: string;
    userName: string;
    timeStamp: number;
    isSelf: boolean;
}
interface FloatingReaction {
    id: string;
    emoji: string;
    userName: string;
    tileIndex: number; // which tile it floats above
}

// ─── Colors ───────────────────────────────────────────────────────────────────
const COLORS = [
    "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981",
    "#3b82f6", "#ef4444", "#14b8a6", "#f97316", "#a855f7",
];
const getColor = (i: number) => COLORS[i % COLORS.length];

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "👏", "🔥"];

// ─── Grid helpers ─────────────────────────────────────────────────────────────
function getGridConfig(total: number, mobile: boolean) {
    if (mobile) {
        if (total === 1) return { cols: 1, rows: 1 };
        if (total <= 2) return { cols: 1, rows: 2 };
        if (total <= 4) return { cols: 2, rows: 2 };
        if (total <= 6) return { cols: 2, rows: 3 };
        return { cols: 2, rows: Math.ceil(total / 2) };
    }
    if (total === 1) return { cols: 1, rows: 1 };
    if (total === 2) return { cols: 2, rows: 1 };
    if (total === 3) return { cols: 3, rows: 1 };
    if (total === 4) return { cols: 2, rows: 2 };
    if (total <= 6) return { cols: 3, rows: 2 };
    if (total <= 8) return { cols: 4, rows: 2 };
    if (total === 9) return { cols: 3, rows: 3 };
    return { cols: 5, rows: 2 };
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
function VideoTile({
    name, color, isLocal, isAdmin, isMuted, isCamOff,
    isActive, compact, stream, videoRef, handRaised, reactions,
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
    handRaised?: boolean;
    reactions?: FloatingReaction[];
}) {
    const internalRef = useRef<HTMLVideoElement>(null);
    const ref = (videoRef ?? internalRef) as React.RefObject<HTMLVideoElement>;

    useEffect(() => {
        if (ref.current && stream && ref.current.srcObject !== stream) {
            ref.current.srcObject = stream;
        }
    }, [stream]); // eslint-disable-line react-hooks/exhaustive-deps

    const bars = [0.35, 0.65, 1, 0.7, 0.45];
    const showVideo = !isCamOff && (!!stream || isLocal);
    const avatarSize = compact ? 38 : 54;

    return (
        <div
            className="relative overflow-hidden w-full h-full"
            style={{
                borderRadius: compact ? 10 : 14,
                background: "#16171a",
                border: isActive ? `2px solid ${color}99` : "1px solid rgba(255,255,255,0.06)",
                boxShadow: isActive ? `0 0 0 1px ${color}33, 0 0 18px ${color}1a` : "none",
                transition: "border 0.2s, box-shadow 0.2s",
            }}
        >
            {/* Video */}
            <video
                ref={ref}
                autoPlay playsInline muted={isLocal}
                className="absolute inset-0 w-full h-full object-cover"
                style={{ transform: isLocal ? "scaleX(-1)" : "none", display: showVideo ? "block" : "none" }}
            />

            {/* Connecting placeholder */}
            {!isCamOff && !stream && !isLocal && (
                <div className="absolute inset-0" style={{
                    background: `radial-gradient(ellipse at 50% 50%, ${color}08 0%, transparent 60%)`,
                    animation: "breathe 3s ease-in-out infinite",
                }} />
            )}

            {/* Avatar when cam off */}
            {isCamOff && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5"
                    style={{ background: `radial-gradient(ellipse at 50% 50%, ${color}0d 0%, transparent 70%)` }}>
                    <div className="flex items-center justify-center rounded-full"
                        style={{ width: avatarSize, height: avatarSize, background: `${color}1e`, border: `2px solid ${color}44` }}>
                        <span style={{ fontSize: avatarSize * 0.38, fontWeight: 700, color }}>
                            {name.charAt(0).toUpperCase()}
                        </span>
                    </div>
                    {!compact && <span className="flex items-center gap-1 text-gray-500" style={{ fontSize: 10 }}>
                        <VideoOff className="w-2 h-2" /> Camera off
                    </span>}
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

            {/* Floating reactions on this tile */}
            {reactions && reactions.map(r => (
                <div key={r.id} className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none select-none text-3xl"
                    style={{ animation: "tileReactionFloat 2.5s ease-out forwards", zIndex: 20 }}>
                    {r.emoji}
                </div>
            ))}

            {/* Raise hand indicator */}
            {handRaised && (
                <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-yellow-400 flex items-center justify-center shadow-lg"
                    style={{ animation: "handPulse 1s ease-in-out infinite" }}>
                    <span className="text-sm">🖐️</span>
                </div>
            )}

            {/* Name bar */}
            <div className="absolute bottom-0 left-0 right-0 flex items-center gap-1.5 px-2 py-1.5"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.25) 60%, transparent 100%)" }}>
                {isAdmin && <Crown className="w-3 h-3 text-yellow-400 shrink-0" />}
                <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-white font-medium"
                    style={{ fontSize: compact ? 10 : 12 }}>
                    {isLocal ? `You (${name})` : name}
                </span>
                {!isMuted ? (
                    <div className="flex items-end gap-0.5 shrink-0" style={{ height: 11 }}>
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
                    <div className="w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center bg-red-500/85">
                        <MicOff className="w-2 h-2 text-white" />
                    </div>
                )}
            </div>

            {/* YOU pill */}
            {isLocal && (
                <div className="absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: `${color}2a`, color, border: `1px solid ${color}40` }}>
                    YOU
                </div>
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
    const userName = (!auth?.loading && auth?.user?.name) ? auth.user.name : "Guest";

    // ── Refs ──────────────────────────────────────────────────────────────────
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const chatEndRef = useRef<HTMLDivElement>(null);
    const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const participantsRef = useRef<Participant[]>([]);

    // ── State ─────────────────────────────────────────────────────────────────
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [mediaStreamReady, setMediaStreamReady] = useState(false);
    const [hasJoined, setHasJoined] = useState(false);
    const [roomState, setRoomState] = useState<"preview" | "waiting" | "in-call">("preview");
    const [isAdmin, setIsAdmin] = useState(false);
    const [adminName, setAdminName] = useState("");
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [waitingUsers, setWaitingUsers] = useState<WaitingUser[]>([]);
    const [callStatus, setCallStatus] = useState("Connecting...");
    const [showWaitingPanel, setShowWaitingPanel] = useState(true);
    const [speakIdx, setSpeakIdx] = useState(0);
    const [isMobile, setIsMobile] = useState(false);

    // ── Chat state ────────────────────────────────────────────────────────────
    const [showChat, setShowChat] = useState(false);
    const [chatMessages, setChatMessages] = useState<GroupChatMessage[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [unreadCount, setUnreadCount] = useState(0);
    const [peerTyping, setPeerTyping] = useState<string | null>(null);

    // ── Reactions state ───────────────────────────────────────────────────────
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);

    // ── Raise hand state ──────────────────────────────────────────────────────
    const [myHandRaised, setMyHandRaised] = useState(false);
    const [raisedHands, setRaisedHands] = useState<{ socketId: string; userName: string }[]>([]);

    // ── Detect mobile ─────────────────────────────────────────────────────────
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);

    // ── Speaker cycling ───────────────────────────────────────────────────────
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

    useEffect(() => {
        if (localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
        }
    }, [roomState]);

    // ── Chat effects ──────────────────────────────────────────────────────────
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages]);

    useEffect(() => {
        if (showChat) setUnreadCount(0);
    }, [showChat]);

    useEffect(() => {
        participantsRef.current = participants;
    }, [participants]);

    // ── Create RTCPeerConnection ───────────────────────────────────────────────
    const createPeerConnection = useCallback((targetId: string): RTCPeerConnection => {
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" },
                {
                    urls: [
                        "turn:global.relay.metered.ca:80",
                        "turn:global.relay.metered.ca:80?transport=tcp",
                        "turn:global.relay.metered.ca:443",
                        "turns:global.relay.metered.ca:443",
                    ],
                    username: process.env.NEXT_PUBLIC_TURN_USERNAME,
                    credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
                },
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
            setParticipants(prev => prev.map(p => p.socketId === targetId ? { ...p, stream } : p));
        };

        pc.oniceconnectionstatechange = () => {
            console.log(`🧊 ICE [${targetId.slice(0, 8)}]:`, pc.iceConnectionState);
        };

        peerConnectionsRef.current.set(targetId, pc);
        return pc;
    }, [socket, roomId]);

    // ── Socket signaling ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!socket || !hasJoined || !mediaStreamReady) return;

        socket.emit("join-group-room", { roomId, userName });

        socket.on("group-joined", ({ isAdmin: admin }: { isAdmin: boolean }) => {
            setIsAdmin(admin);
            setRoomState("in-call");
            setCallStatus(admin ? "Waiting for participants…" : "Connected");
        });

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

        socket.on("group-admitted", ({
            participants: peers,
        }: { participants: { socketId: string; userName: string }[]; roomId: string }) => {
            setParticipants(peers.map(p => ({ ...p, stream: undefined })));
            setRoomState("in-call");
            setCallStatus("Connected");
        });

        socket.on("user-waiting", ({ socketId, userName: wName }: WaitingUser) => {
            setWaitingUsers(prev => [...prev, { socketId, userName: wName }]);
            setShowWaitingPanel(true);
        });

        socket.on("group-new-peer", async ({
            socketId: newId, userName: newName,
        }: { socketId: string; userName: string }) => {
            setParticipants(prev => [...prev, { socketId: newId, userName: newName }]);
            const pc = createPeerConnection(newId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("group-offer", { offer, targetId: newId, roomId });
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
                catch (e) { console.error("ICE add error:", e); }
            }
        });

        socket.on("group-peer-left", ({ socketId }: { socketId: string }) => {
            const pc = peerConnectionsRef.current.get(socketId);
            if (pc) { pc.close(); peerConnectionsRef.current.delete(socketId); }
            setParticipants(prev => prev.filter(p => p.socketId !== socketId));
            setRaisedHands(prev => prev.filter(h => h.socketId !== socketId));
        });

        socket.on("group-you-are-admin", () => {
            setIsAdmin(true);
            setCallStatus("You are now the host");
        });

        // ── Chat ──────────────────────────────────────────────────────────────
        socket.on("group-chat-message", ({
            message, userName: fromName, timeStamp,
        }: { message: string; userName: string; timeStamp: number }) => {
            const ts = timeStamp ?? Date.now();
            setChatMessages(prev => [...prev, {
                id: `${ts}-${Math.random()}`,
                message, userName: fromName, timeStamp: ts, isSelf: false,
            }]);
            setShowChat(current => {
                if (!current) setUnreadCount(c => c + 1);
                return current;
            });
        });

        socket.on("group-chat-typing", ({
            userName: typingName, isTyping,
        }: { userName: string; isTyping: boolean }) => {
            setPeerTyping(isTyping ? typingName : null);
        });

        // ── Reactions ─────────────────────────────────────────────────────────
        socket.on("group-reaction", ({
            emoji, userName: fromName, socketId: fromId,
        }: { emoji: string; userName: string; socketId: string }) => {
            const tileIndex = participantsRef.current.findIndex(p => p.socketId === fromId);
            addFloatingReaction(emoji, fromName, tileIndex === -1 ? 0 : tileIndex + 1);
        });

        // ── Raise hand ────────────────────────────────────────────────────────
        socket.on("group-hand-raised", ({
            socketId: fromId, userName: fromName, isRaised,
        }: { socketId: string; userName: string; isRaised: boolean }) => {
            setParticipants(prev => prev.map(p =>
                p.socketId === fromId ? { ...p, handRaised: isRaised } : p
            ));
            if (isRaised) {
                setRaisedHands(prev => [...prev.filter(h => h.socketId !== fromId), { socketId: fromId, userName: fromName }]);
            } else {
                setRaisedHands(prev => prev.filter(h => h.socketId !== fromId));
            }
        });

        // ── Mute all (admin command) ───────────────────────────────────────────
        socket.on("group-mute-all", () => {
            const track = localStreamRef.current?.getAudioTracks()[0];
            if (track) {
                track.enabled = false;
                setIsMuted(true);
            }
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
            socket.off("group-chat-message");
            socket.off("group-chat-typing");
            socket.off("group-reaction");
            socket.off("group-hand-raised");
            socket.off("group-mute-all");
            peerConnectionsRef.current.forEach(pc => pc.close());
            peerConnectionsRef.current.clear();
        };
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

    const muteAll = () => {
        if (!isAdmin || !socket) return;
        socket.emit("group-mute-all", { roomId });
        // Also mute self
        const track = localStreamRef.current?.getAudioTracks()[0];
        if (track) { track.enabled = false; setIsMuted(true); }
    };

    // ── Media controls ────────────────────────────────────────────────────────
    const toggleMute = () => {
        const track = localStreamRef.current?.getAudioTracks()[0];
        if (!track) return;
        track.enabled = !track.enabled;
        setIsMuted(!track.enabled);
    };

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

    // ── Raise hand ────────────────────────────────────────────────────────────
    const toggleHand = () => {
        const newState = !myHandRaised;
        setMyHandRaised(newState);
        socket?.emit("group-raise-hand", { roomId, userName, isRaised: newState });
    };

    // ── Reactions ─────────────────────────────────────────────────────────────
    const addFloatingReaction = (emoji: string, fromName: string, tileIndex: number) => {
        const id = `${Date.now()}-${Math.random()}`;
        setFloatingReactions(prev => [...prev, { id, emoji, userName: fromName, tileIndex }]);
        setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== id)), 2500);
    };

    const sendReaction = (emoji: string) => {
        if (!socket) return;
        socket.emit("group-reaction", { roomId, emoji, userName });
        addFloatingReaction(emoji, "You", 0); // local tile is index 0
        setShowReactionPicker(false);
    };

    // ── Chat helpers ──────────────────────────────────────────────────────────
    const sendGroupMessage = () => {
        const msg = chatInput.trim();
        if (!msg || !socket) return;
        const timeStamp = Date.now();
        socket.emit("group-chat-message", { roomId, message: msg, userName, timeStamp });
        setChatMessages(prev => [...prev, {
            id: `${timeStamp}-self`, message: msg, userName, timeStamp, isSelf: true,
        }]);
        setChatInput("");
        socket.emit("group-chat-typing", { roomId, userName, isTyping: false });
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };

    const handleGroupChatInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        setChatInput(e.target.value);
        if (!socket) return;
        socket.emit("group-chat-typing", { roomId, userName, isTyping: true });
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
            socket.emit("group-chat-typing", { roomId, userName, isTyping: false });
        }, 1500);
    };

    const formatGroupTime = (ts: number) =>
        new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // ── Auth loading ──────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-[#101115] flex items-center justify-center">
                <div className="text-white text-base opacity-60">Loading…</div>
            </div>
        );
    }
    if (!user) return null;

    // =========================================================================
    // PREVIEW SCREEN
    // =========================================================================
    if (roomState === "preview") {
        return (
            <div className="min-h-screen bg-[#101115] text-white flex items-center justify-center p-6 font-sans">
                <style>{`@keyframes breathe{0%,100%{opacity:.5}50%{opacity:1}}`}</style>
                <div className="max-w-5xl w-full flex flex-wrap gap-8 items-center justify-center">
                    <div className="flex-1 min-w-[340px] max-w-[560px]">
                        <div className="relative aspect-video bg-[#1e1f22] rounded-[18px] overflow-hidden border border-white/10 shadow-[0_24px_48px_rgba(0,0,0,0.5)]">
                            <video ref={localVideoRef} autoPlay playsInline muted
                                className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] ${isCameraOff ? "hidden" : "block"}`} />
                            {isCameraOff && (
                                <div className="absolute inset-0 flex items-center justify-center bg-[#1e1f22]">
                                    <div className="w-[88px] h-[88px] rounded-full bg-indigo-600 flex items-center justify-center">
                                        <span className="text-4xl font-bold">{userName.charAt(0).toUpperCase()}</span>
                                    </div>
                                </div>
                            )}
                            <div className="absolute bottom-3 left-3 bg-black/60 px-2.5 py-1 rounded-lg text-[13px] backdrop-blur-md">You ({userName})</div>
                            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
                                <button onClick={toggleMute} className={`w-11 h-11 rounded-full flex items-center justify-center text-white border-none cursor-pointer backdrop-blur-md ${isMuted ? "bg-red-500" : "bg-[#1e1f22]/85"}`}>
                                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                                </button>
                                <button onClick={toggleCamera} className={`w-11 h-11 rounded-full flex items-center justify-center text-white border-none cursor-pointer backdrop-blur-md ${isCameraOff ? "bg-red-500" : "bg-[#1e1f22]/85"}`}>
                                    {isCameraOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 min-w-[260px] max-w-[340px] flex flex-col gap-4">
                        <div>
                            <h1 className="text-3xl font-extrabold mb-1.5">Ready to join?</h1>
                            <p className="text-gray-400">Joining as <span className="text-white font-semibold">{userName}</span></p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-3.5 border border-white/[0.08]">
                            <p className="text-gray-500 text-[11px] font-semibold uppercase tracking-wider mb-1">Room ID</p>
                            <p className="font-mono text-[11px] text-gray-400 break-all">{roomId}</p>
                        </div>
                        {mediaStreamReady ? (
                            <button onClick={() => { setRoomState("in-call"); setHasJoined(true); }}
                                className="py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base rounded-full cursor-pointer transition-colors shadow-[0_8px_24px_rgba(79,70,229,0.35)]">
                                Join Now
                            </button>
                        ) : (
                            <div className="py-3.5 bg-gray-800 text-gray-500 rounded-full text-center font-semibold text-[15px]">Starting camera…</div>
                        )}
                        <button onClick={() => router.push("/dashboard/group-calling")}
                            className="py-3 bg-transparent text-gray-400 hover:bg-white/5 border border-white/[0.12] rounded-full font-semibold text-[15px] cursor-pointer transition-colors">
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
            <div className="min-h-screen bg-[#101115] text-white flex items-center justify-center p-6 font-sans">
                <style>{`@keyframes breathe{0%,100%{opacity:.5}50%{opacity:1}}`}</style>
                <div className="max-w-[420px] w-full text-center">
                    <div className="w-[72px] h-[72px] rounded-full border-2 border-indigo-500 bg-indigo-500/12 flex items-center justify-center mx-auto mb-6"
                        style={{ animation: "breathe 2s ease-in-out infinite" }}>
                        <Users className="w-8 h-8 text-indigo-400" />
                    </div>
                    <h1 className="text-2xl font-extrabold mb-2">Waiting to be admitted</h1>
                    <p className="text-gray-400 mb-1">{adminName} will let you in soon.</p>
                    <p className="text-gray-600 text-[13px] mb-7">Please wait for the host to admit you.</p>
                    <div className="relative aspect-video bg-[#1e1f22] rounded-2xl overflow-hidden border border-white/[0.08] mb-6">
                        <video ref={localVideoRef} autoPlay playsInline muted
                            className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] ${isCameraOff ? "hidden" : "block"}`} />
                        {isCameraOff && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center">
                                    <span className="text-2xl font-bold">{userName.charAt(0).toUpperCase()}</span>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex justify-center gap-3.5">
                        {[
                            { Icon: isMuted ? MicOff : Mic, active: isMuted, fn: toggleMute },
                            { Icon: isCameraOff ? VideoOff : Video, active: isCameraOff, fn: toggleCamera },
                        ].map(({ Icon, active, fn }, i) => (
                            <button key={i} onClick={fn} className={`w-11 h-11 rounded-full flex items-center justify-center text-white cursor-pointer ${active ? "bg-red-500 border-none" : "bg-white/[0.07] border border-white/[0.12]"}`}>
                                <Icon className="w-4 h-4" />
                            </button>
                        ))}
                        <button onClick={handleEndCall} className="w-11 h-11 rounded-full bg-red-600 flex items-center justify-center text-white cursor-pointer border-none">
                            <PhoneOff className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // =========================================================================
    // IN-CALL SCREEN
    // =========================================================================
    const totalTiles = participants.length + 1;
    const { cols, rows } = getGridConfig(totalTiles, isMobile);
    const compact = totalTiles >= 7;
    const allowScroll = isMobile && totalTiles > 6;

    return (
        <div className="h-screen bg-[#101115] text-white flex flex-col font-sans">
            <style>{`
                *{box-sizing:border-box}
                @keyframes audioBar{from{transform:scaleY(.45)}to{transform:scaleY(1)}}
                @keyframes speakPulse{0%,100%{opacity:.65}50%{opacity:1}}
                @keyframes breathe{0%,100%{opacity:.5}50%{opacity:1}}
                @keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}}
                @keyframes handPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}
                @keyframes tileReactionFloat{
                    0%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}
                    60%{opacity:1;transform:translateX(-50%) translateY(-40px) scale(1.3)}
                    100%{opacity:0;transform:translateX(-50%) translateY(-70px) scale(0.8)}
                }
                @keyframes slideUpMobile{from{transform:translateY(100%)}to{transform:translateY(0)}}
                .chat-slide-up{animation:slideUpMobile 0.28s cubic-bezier(0.32,0.72,0,1)}
                ::-webkit-scrollbar{width:3px}
                ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:2px}
            `}</style>

            {/* ── Top bar ── */}
            <div className="shrink-0 h-12 bg-[#18191c] border-b border-white/[0.06] flex items-center justify-between px-4">
                <div className="flex items-center gap-2.5">
                    <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/10">{callStatus}</span>
                    <span className="text-gray-400 text-xs flex items-center gap-1"><Users className="w-3 h-3" />{totalTiles} / 10</span>
                    {isAdmin && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 flex items-center gap-1">
                            <Crown className="w-3 h-3" />Host
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {/* Raised hands indicator for admin */}
                    {isAdmin && raisedHands.length > 0 && (
                        <div className="flex items-center gap-1.5 bg-yellow-400/15 border border-yellow-400/30 text-yellow-300 px-3 py-1.5 rounded-lg text-xs">
                            🖐️ {raisedHands.map(h => h.userName).join(", ")}
                        </div>
                    )}
                    {isAdmin && waitingUsers.length > 0 && (
                        <button onClick={() => setShowWaitingPanel(v => !v)}
                            className="flex items-center gap-1.5 bg-indigo-500/15 border border-indigo-500/40 text-indigo-300 px-3 py-1.5 rounded-lg text-xs cursor-pointer"
                            style={{ animation: "breathe 2s ease-in-out infinite" }}>
                            <Users className="w-3 h-3" />{waitingUsers.length} waiting
                        </button>
                    )}
                </div>
            </div>

            {/* ── Main area ── */}
            <div className="flex-1 min-h-0 flex overflow-hidden">

                {/* Video grid */}
                <div className={`flex-1 min-h-0 ${isMobile ? "flex justify-center" : ""} ${allowScroll ? "overflow-auto" : "overflow-hidden"} ${compact ? "p-1.5" : "p-2"}`}>
                    <div style={{
                        width: isMobile ? 375 : "100%",
                        height: allowScroll ? "auto" : "100%",
                        display: "grid",
                        gridTemplateColumns: `repeat(${cols},1fr)`,
                        gridTemplateRows: allowScroll ? undefined : `repeat(${rows},1fr)`,
                        gap: compact ? 5 : 8,
                    }}>
                        {/* Local tile */}
                        <div className="min-w-0 min-h-0 relative" style={{ ...(allowScroll ? { aspectRatio: "16/9" } : {}), ...getOrphanStyle(0, totalTiles, cols) }}>
                            <VideoTile
                                name={userName} color={getColor(0)} isLocal={true} isAdmin={isAdmin}
                                isMuted={isMuted} isCamOff={isCameraOff} isActive={speakIdx === 0}
                                compact={compact} stream={localStreamRef.current ?? undefined}
                                videoRef={localVideoRef as React.RefObject<HTMLVideoElement>}
                                handRaised={myHandRaised}
                                reactions={floatingReactions.filter(r => r.tileIndex === 0)}
                            />
                        </div>

                        {/* Remote tiles */}
                        {participants.map((p, idx) => (
                            <div key={p.socketId} className="min-w-0 min-h-0 relative"
                                style={{ ...(allowScroll ? { aspectRatio: "16/9" } : {}), ...getOrphanStyle(idx + 1, totalTiles, cols) }}>
                                <VideoTile
                                    name={p.userName} color={getColor(idx + 1)} isLocal={false} isAdmin={false}
                                    isMuted={p.isMuted ?? false} isCamOff={p.isCamOff ?? false}
                                    isActive={speakIdx === idx + 1} compact={compact} stream={p.stream}
                                    handRaised={p.handRaised}
                                    reactions={floatingReactions.filter(r => r.tileIndex === idx + 1)}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Waiting panel — desktop only */}
                {isAdmin && waitingUsers.length > 0 && showWaitingPanel && !isMobile && (
                    <div className="w-[272px] bg-[#18191c] border-l border-white/[0.06] flex flex-col shrink-0">
                        <div className="p-3.5 border-b border-white/[0.06] flex items-center justify-between">
                            <span className="text-white font-semibold text-[13px] flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-indigo-400" />Waiting ({waitingUsers.length})
                            </span>
                            <button onClick={() => setShowWaitingPanel(false)} className="bg-transparent border-none text-gray-500 cursor-pointer flex"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2">
                            {waitingUsers.map(u => (
                                <div key={u.socketId} className="bg-white/[0.04] rounded-xl p-2.5 flex items-center gap-2 border border-white/[0.06]">
                                    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                                        <span className="text-sm font-bold text-white">{u.userName.charAt(0).toUpperCase()}</span>
                                    </div>
                                    <span className="text-white text-[13px] flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{u.userName}</span>
                                    <button onClick={() => admitUser(u.socketId)} className="w-7 h-7 rounded-full bg-green-700 border-none cursor-pointer flex items-center justify-center">
                                        <Check className="w-3.5 h-3.5 text-white" />
                                    </button>
                                    <button onClick={() => rejectUser(u.socketId)} className="w-7 h-7 rounded-full bg-red-800 border-none cursor-pointer flex items-center justify-center">
                                        <X className="w-3.5 h-3.5 text-white" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        {waitingUsers.length > 1 && (
                            <div className="p-2.5 border-t border-white/[0.06]">
                                <button onClick={() => waitingUsers.forEach(u => admitUser(u.socketId))}
                                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white border-none rounded-xl font-semibold text-[13px] cursor-pointer transition-colors">
                                    Admit All ({waitingUsers.length})
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Chat panel — desktop side panel only */}
                {showChat && !isMobile && (
                    <div className="w-[272px] bg-[#18191c] border-l border-white/[0.06] flex flex-col shrink-0 min-h-0">
                        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between shrink-0">
                            <span className="text-white font-semibold text-[13px] flex items-center gap-1.5">
                                <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />Group Chat
                            </span>
                            <button onClick={() => setShowChat(false)} className="bg-transparent border-none text-gray-500 hover:text-gray-300 cursor-pointer flex"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2" style={{ scrollbarWidth: "thin" }}>
                            {chatMessages.length === 0 && <div className="text-center text-gray-600 text-[13px] mt-10">No messages yet. Say hello! 👋</div>}
                            {chatMessages.map(msg => (
                                <div key={msg.id} className={`flex flex-col ${msg.isSelf ? "items-end" : "items-start"}`}>
                                    <span className="text-[10px] text-gray-600 mb-1 px-1">{msg.isSelf ? "You" : msg.userName} · {formatGroupTime(msg.timeStamp)}</span>
                                    <div className={`max-w-[85%] px-3 py-2 text-[13px] text-white leading-snug break-words ${msg.isSelf ? "bg-indigo-600 rounded-2xl rounded-br-sm" : "bg-white/10 rounded-2xl rounded-bl-sm"}`}>
                                        {msg.message}
                                    </div>
                                </div>
                            ))}
                            {peerTyping && (
                                <div className="flex flex-col items-start">
                                    <span className="text-[10px] text-gray-600 mb-1 px-1">{peerTyping} is typing…</span>
                                    <div className="bg-white/10 rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-1">
                                        {[0, 1, 2].map(i => (
                                            <span key={i} className="w-1.5 h-1.5 rounded-full bg-gray-500 inline-block"
                                                style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="px-3 py-3 border-t border-white/[0.06] flex gap-2 shrink-0">
                            <input type="text" value={chatInput} onChange={handleGroupChatInput}
                                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendGroupMessage()}
                                placeholder="Type a message…"
                                className="flex-1 bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2 text-white text-[13px] outline-none placeholder-gray-600 focus:border-indigo-500 transition-colors" />
                            <button onClick={sendGroupMessage} disabled={!chatInput.trim()}
                                className={`w-9 h-9 rounded-xl border-none flex items-center justify-center shrink-0 transition-colors ${chatInput.trim() ? "bg-indigo-600 hover:bg-indigo-700 cursor-pointer" : "bg-white/[0.05] cursor-not-allowed"}`}>
                                <Send className="w-3.5 h-3.5 text-white" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Mobile chat bottom sheet ── */}
            {showChat && isMobile && (
                <>
                    <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setShowChat(false)} />
                    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#18191c] rounded-t-2xl border-t border-white/10 flex flex-col chat-slide-up"
                        style={{ height: "70vh" }}>
                        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between shrink-0">
                            <span className="text-white font-semibold text-[13px] flex items-center gap-1.5">
                                <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />Group Chat
                            </span>
                            <button onClick={() => setShowChat(false)} className="bg-transparent border-none text-gray-500 cursor-pointer flex"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2" style={{ scrollbarWidth: "thin" }}>
                            {chatMessages.length === 0 && <div className="text-center text-gray-600 text-[13px] mt-10">No messages yet. Say hello! 👋</div>}
                            {chatMessages.map(msg => (
                                <div key={msg.id} className={`flex flex-col ${msg.isSelf ? "items-end" : "items-start"}`}>
                                    <span className="text-[10px] text-gray-600 mb-1 px-1">{msg.isSelf ? "You" : msg.userName} · {formatGroupTime(msg.timeStamp)}</span>
                                    <div className={`max-w-[85%] px-3 py-2 text-[13px] text-white leading-snug break-words ${msg.isSelf ? "bg-indigo-600 rounded-2xl rounded-br-sm" : "bg-white/10 rounded-2xl rounded-bl-sm"}`}>
                                        {msg.message}
                                    </div>
                                </div>
                            ))}
                            {peerTyping && (
                                <div className="flex flex-col items-start">
                                    <span className="text-[10px] text-gray-600 mb-1 px-1">{peerTyping} is typing…</span>
                                    <div className="bg-white/10 rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-1">
                                        {[0, 1, 2].map(i => (
                                            <span key={i} className="w-1.5 h-1.5 rounded-full bg-gray-500 inline-block"
                                                style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="px-3 py-3 border-t border-white/[0.06] flex gap-2 shrink-0">
                            <input type="text" value={chatInput} onChange={handleGroupChatInput}
                                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendGroupMessage()}
                                placeholder="Type a message…"
                                className="flex-1 bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2 text-white text-[13px] outline-none placeholder-gray-600 focus:border-indigo-500 transition-colors" />
                            <button onClick={sendGroupMessage} disabled={!chatInput.trim()}
                                className={`w-9 h-9 rounded-xl border-none flex items-center justify-center shrink-0 transition-colors ${chatInput.trim() ? "bg-indigo-600 hover:bg-indigo-700 cursor-pointer" : "bg-white/[0.05] cursor-not-allowed"}`}>
                                <Send className="w-3.5 h-3.5 text-white" />
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* ── Reaction picker ── */}
            {showReactionPicker && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowReactionPicker(false)} />
                    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex gap-2 bg-[#2d2d30]/95 backdrop-blur-md border border-gray-700 rounded-2xl px-3 py-2.5 shadow-2xl">
                        {REACTION_EMOJIS.map(emoji => (
                            <button key={emoji} onClick={(e) => { e.stopPropagation(); sendReaction(emoji); }}
                                className="text-2xl hover:scale-125 transition-transform duration-150 active:scale-95 bg-transparent border-none cursor-pointer">
                                {emoji}
                            </button>
                        ))}
                    </div>
                </>
            )}

            {/* ── Controls ── */}
            <div className="shrink-0 h-[68px] bg-[#18191c] border-t border-white/[0.06] flex items-center justify-center gap-2 sm:gap-3 px-3">
                {/* Mic */}
                <button onClick={toggleMute}
                    className={`w-11 h-11 rounded-full flex items-center justify-center text-white cursor-pointer transition-all ${isMuted ? "bg-red-500 border-none" : "bg-white/[0.07] border border-white/[0.12]"}`}>
                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                {/* Camera */}
                <button onClick={toggleCamera}
                    className={`w-11 h-11 rounded-full flex items-center justify-center text-white cursor-pointer transition-all ${isCameraOff ? "bg-red-500 border-none" : "bg-white/[0.07] border border-white/[0.12]"}`}>
                    {isCameraOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                </button>

                {/* Raise hand */}
                <button onClick={toggleHand}
                    className={`w-11 h-11 rounded-full flex items-center justify-center cursor-pointer transition-all text-lg border-none ${myHandRaised ? "bg-yellow-400" : "bg-white/[0.07] border border-white/[0.12]"}`}
                    title={myHandRaised ? "Lower hand" : "Raise hand"}>
                    🖐️
                </button>

                {/* Reactions */}
                <button onClick={() => setShowReactionPicker(v => !v)}
                    className={`w-11 h-11 rounded-full flex items-center justify-center cursor-pointer transition-all text-lg border-none ${showReactionPicker ? "bg-indigo-600" : "bg-white/[0.07] border border-white/[0.12]"}`}
                    title="Send reaction">
                    😊
                </button>

                {/* Chat toggle */}
                <button onClick={() => setShowChat(v => !v)}
                    className={`w-11 h-11 rounded-full flex items-center justify-center text-white cursor-pointer transition-all relative ${showChat ? "bg-indigo-600 border-none" : "bg-white/[0.07] border border-white/[0.12]"}`}>
                    <MessageSquare className="w-4 h-4" />
                    {unreadCount > 0 && !showChat && (
                        <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-[#18191c]">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                </button>

                {/* Mute All — admin only */}
                {isAdmin && (
                    <button onClick={muteAll}
                        className="w-11 h-11 rounded-full flex items-center justify-center text-white cursor-pointer transition-all bg-white/[0.07] border border-white/[0.12] relative"
                        title="Mute everyone">
                        <MicOff className="w-4 h-4" />
                        <span className="absolute -top-1 -right-1 text-[8px] bg-yellow-400 text-black font-bold rounded px-0.5">ALL</span>
                    </button>
                )}

                {/* Leave */}
                <button onClick={handleEndCall}
                    className="h-11 px-4 sm:px-5 rounded-full flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white border-none cursor-pointer text-sm font-semibold transition-colors">
                    <PhoneOff className="w-4 h-4" /><span className="hidden sm:inline">Leave</span>
                </button>
            </div>
        </div>
    );
}