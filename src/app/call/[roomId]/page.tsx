// "use client";

// import { useContext, useEffect, useRef, useState } from "react";
// import { useParams, useRouter } from "next/navigation";
// import { useSocket } from "@/hooks/useSocket"; // ← Import your new hook
// import { Copy, X, Mic, MicOff, Video, VideoOff, PhoneOff, Info } from "lucide-react";
// import { AuthContext } from "@/context/AuthContext";

// export default function CallRoom() {
//     const { roomId } = useParams<{ roomId: string }>();
//     const router = useRouter();
//     const socket = useSocket();
//     const auth = useContext(AuthContext);
//     const { user, loading } = auth || {}

//     // Wait for auth to finish loading before determining userName
//     // Only default to "Guest" if loading is complete and user is still null
//     const userName = auth?.loading ? "Loading..." : (auth?.user?.name || "Guest");

//     // Middleware handles authentication check server-side (faster)
//     // No need for client-side redirect logic
//     useEffect(() => {
//         if (!loading && !user) {
//             router.replace("/login");
//         }
//     }, [user, loading, router]);

//     // Debug: Log auth state in production
//     useEffect(() => {
//         if (process.env.NODE_ENV === 'production') {
//             console.log("Call Room Auth State:", {
//                 user: user,
//                 loading: loading,
//                 userName: userName,
//                 apiBase: process.env.NEXT_PUBLIC_API_URL
//             });
//         }
//     }, [user, loading, userName]);

//     // Show loading state while checking auth
//     if (loading) {
//         return (
//             <div className="min-h-screen bg-[#101115] flex items-center justify-center">
//                 <div className="text-xl font-medium text-white animate-pulse">Loading...</div>
//             </div>
//         );
//     }

//     // Don't render if not authenticated (will redirect)
//     if (!user) {
//         return null;
//     }

//     const localVideoRef = useRef<HTMLVideoElement>(null);
//     const remoteVideoRef = useRef<HTMLVideoElement>(null);
//     const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
//     const localStreamRef = useRef<MediaStream | null>(null);

//     const [isMuted, setIsMuted] = useState(false);
//     const [isCameraOff, setIsCameraOff] = useState(false);
//     const [callStatus, setCallStatus] = useState("Initializing media...");

//     // New states for the UI
//     const [hasJoined, setHasJoined] = useState(false);
//     const [showInvitePopup, setShowInvitePopup] = useState(true);
//     const [remoteConnected, setRemoteConnected] = useState(false);
//     const [mediaStreamReady, setMediaStreamReady] = useState(false);
//     const [remoteUserName, setRemoteUserName] = useState("Waiting...");

//     const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
//     const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
//     const [selectedVideoId, setSelectedVideoId] = useState<string>("");
//     const [selectedAudioId, setSelectedAudioId] = useState<string>("");
//     const [showDevicePicker, setShowDevicePicker] = useState(false);
//     const [showControls, setShowControls] = useState(true);
//     const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

//     // Auto-hide controls after 30 seconds of inactivity
//     useEffect(() => {
//         const handleMouseMove = () => {
//             setShowControls(true);
//             if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
//             controlsTimeoutRef.current = setTimeout(() => {
//                 // Only hide if pickers/popups are not open
//                 if (!showDevicePicker && !showInvitePopup) {
//                     setShowControls(false);
//                 }
//             }, 30000); // 30 seconds as requested
//         };

//         if (hasJoined) {
//             window.addEventListener("mousemove", handleMouseMove);
//             handleMouseMove(); // Initialize timer
//         }

//         return () => {
//             window.removeEventListener("mousemove", handleMouseMove);
//             if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
//         };
//     }, [hasJoined, showDevicePicker, showInvitePopup]);

//     // 1. Initialize local media immediately (for the preview screen)
//     useEffect(() => {
//         const initMedia = async () => {
//             try {
//                 const stream = await navigator.mediaDevices.getUserMedia({
//                     video: { facingMode: "user" },
//                     audio: true,
//                 });
//                 localStreamRef.current = stream;

//                 // If localVideoRef is already mounted, set it
//                 if (localVideoRef.current) {
//                     localVideoRef.current.srcObject = stream;
//                 }

//                 setMediaStreamReady(true);
//                 setCallStatus("Ready to join");

//                 // Load available devices
//                 const devices = await navigator.mediaDevices.enumerateDevices();
//                 const cameras = devices.filter(d => d.kind === "videoinput");
//                 const mics = devices.filter(d => d.kind === "audioinput");
//                 setVideoDevices(cameras);
//                 setAudioDevices(mics);
//                 setSelectedVideoId(cameras[0]?.deviceId || "");
//                 setSelectedAudioId(mics[0]?.deviceId || "");
//             } catch (err: any) {
//                 console.error("Camera error:", err);
//                 setCallStatus(`Camera error: ${err.message}`);
//             }
//         };

//         initMedia();

//         return () => {
//             if (localStreamRef.current) {
//                 localStreamRef.current.getTracks().forEach(track => track.stop());
//             }
//         };
//     }, []);

//     // 2. Re-assign local stream when `hasJoined` changes because the preview video 
//     // ref unmounts and mounts a new one in the main call screen
//     useEffect(() => {
//         if (localVideoRef.current && localStreamRef.current) {
//             localVideoRef.current.srcObject = localStreamRef.current;
//         }
//     }, [hasJoined]);

//     // 3. Socket signaling logic ONLY AFTER hasJoined is true
//     useEffect(() => {
//         if (!hasJoined || !socket || !mediaStreamReady) return;

//         setCallStatus("Connecting to room...");

//         // ✅ Setup RTCPeerConnection FIRST — always
//         peerConnectionRef.current = new RTCPeerConnection({
//             iceServers: [
//                 { urls: "stun:stun.l.google.com:19302" },
//                 { urls: "stun:stun1.l.google.com:19302" },
//                 {
//                     urls: "turn:openrelay.metered.ca:80",
//                     username: "openrelayproject",
//                     credential: "openrelayproject",
//                 },
//                 {
//                     urls: "turn:openrelay.metered.ca:443",
//                     username: "openrelayproject",
//                     credential: "openrelayproject",
//                 },
//                 {
//                     urls: "turn:openrelay.metered.ca:443?transport=tcp",
//                     username: "openrelayproject",
//                     credential: "openrelayproject",
//                 },
//             ],
//         });

//         // ← ADD THESE 3 BLOCKS RIGHT AFTER:
//         peerConnectionRef.current.oniceconnectionstatechange = () => {
//             console.log("🧊 ICE state:", peerConnectionRef.current?.iceConnectionState);
//         };

//         peerConnectionRef.current.onicegatheringstatechange = () => {
//             console.log("🧊 ICE gathering:", peerConnectionRef.current?.iceGatheringState);
//         };

//         // Also update your existing onicecandidate:
//         peerConnectionRef.current.onicecandidate = (event) => {
//             if (event.candidate) {
//                 console.log("🧊 Sending ICE candidate");
//                 socket.emit("ice-candidate", event.candidate, roomId);
//             } else {
//                 console.log("🧊 ICE gathering complete");
//             }
//         };

//         // Add local tracks to peer connection
//         if (localStreamRef.current) {
//             localStreamRef.current.getTracks().forEach((track) => {
//                 peerConnectionRef.current?.addTrack(track, localStreamRef.current!);
//             });
//         }

//         // When remote stream arrives
//         peerConnectionRef.current.ontrack = (event) => {
//             if (remoteVideoRef.current) {
//                 remoteVideoRef.current.srcObject = event.streams[0];
//                 setCallStatus("Connected");
//                 setRemoteConnected(true);
//                 setShowInvitePopup(false);
//             }
//         };

//         // Send ICE candidates to other peer
//         peerConnectionRef.current.onicecandidate = (event) => {
//             if (event.candidate) {
//                 socket.emit("ice-candidate", event.candidate, roomId);
//             }
//         };

//         // ── Socket Handlers ──────────────────────────────────────

//         const handleReady = async () => {
//             console.log("✅ READY received — creating offer");
//             console.log("PeerConnection state:", peerConnectionRef.current?.signalingState)
//             try {
//                 const offer = await peerConnectionRef.current?.createOffer();
//                 console.log("✅ Offer created:", offer);
//                 await peerConnectionRef.current?.setLocalDescription(offer);
//                 console.log("✅ Local description set");
//                 socket.emit("offer", offer, roomId);
//                 console.log("✅ Offer emitted");
//             } catch (err) {
//                 console.error("Offer creation failed:", err);
//             }
//         };

//         const handleOffer = async (offer: any) => {
//             console.log("📨 Offer received on this peer");
//             try {
//                 await peerConnectionRef.current?.setRemoteDescription(offer);
//                 console.log("✅ Remote description set")
//                 const answer = await peerConnectionRef.current?.createAnswer();
//                 console.log("✅ Answer created")
//                 await peerConnectionRef.current?.setLocalDescription(answer);
//                 socket.emit("answer", answer, roomId);
//                 console.log("✅ Answer emitted");
//             } catch (err) {
//                 console.error("Answer failed:", err);
//             }
//         };

//         const handleAnswer = async (answer: any) => {
//             console.log("📨 Answer received on this peer");
//             try {
//                 await peerConnectionRef.current?.setRemoteDescription(answer);
//                 console.log("✅ Remote answer set")
//             } catch (err) {
//                 console.error("Set remote answer failed:", err);
//             }
//         };

//         const handleIceCandidate = async (candidate: any) => {
//             try {
//                 await peerConnectionRef.current?.addIceCandidate(candidate);
//             } catch (err) {
//                 console.error("Add ICE candidate failed:", err);
//             }
//         };

//         const handleUserJoined = (joiningUserName: string) => {
//             setRemoteUserName(joiningUserName);
//             setCallStatus(`${joiningUserName} joined. Negotiating...`);
//         };

//         const handleRoomFull = () => {
//             alert("Room is full (max 2 users)");
//             router.push("/dashboard");
//         };

//         const handleUserDisconnected = () => {
//             setCallStatus("Other user disconnected");
//             setRemoteConnected(false);
//             if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
//         };

//         // ── Register ALL listeners BEFORE joining the room ───────
//         socket.on("ready", handleReady);
//         socket.on("offer", handleOffer);
//         socket.on("answer", handleAnswer);
//         socket.on("ice-candidate", handleIceCandidate);
//         socket.on("user-joined", handleUserJoined);
//         socket.on("existing-user", (name: string) => setRemoteUserName(name));
//         socket.on("room-full", handleRoomFull);
//         socket.on("user-disconnected", handleUserDisconnected);

//         // ── Join room LAST — after everything is ready ────────────
//         socket.emit("join-room", { roomId, userName });

//         return () => {
//             if (peerConnectionRef.current) {
//                 peerConnectionRef.current.close();
//                 peerConnectionRef.current = null;
//             }
//             socket.off("ready", handleReady);
//             socket.off("offer", handleOffer);
//             socket.off("answer", handleAnswer);
//             socket.off("ice-candidate", handleIceCandidate);
//             socket.off("user-joined", handleUserJoined);
//             socket.off("room-full", handleRoomFull);
//             socket.off("user-disconnected", handleUserDisconnected);
//         };
//     }, [socket, roomId, router, hasJoined, mediaStreamReady]);

//     const toggleMute = () => {
//         if (localStreamRef.current) {
//             const audioTrack = localStreamRef.current.getAudioTracks()[0];
//             if (audioTrack) {
//                 audioTrack.enabled = !audioTrack.enabled;
//                 setIsMuted(!audioTrack.enabled);
//             }
//         }
//     };

//     const toggleCamera = () => {
//         if (localStreamRef.current) {
//             const videoTrack = localStreamRef.current.getVideoTracks()[0];
//             if (videoTrack) {
//                 videoTrack.enabled = !videoTrack.enabled;
//                 setIsCameraOff(!videoTrack.enabled);
//             }
//         }
//     };

//     const handleEndCall = () => {
//         if (localStreamRef.current) {
//             localStreamRef.current.getTracks().forEach((track) => track.stop());
//         }
//         if (peerConnectionRef.current) {
//             peerConnectionRef.current.close();
//         }
//         if (socket) {
//             socket.disconnect();
//         }
//         router.push("/dashboard");
//     };

//     const copyInviteLink = () => {
//         const url = `${window.location.origin}/call/${roomId}`;
//         navigator.clipboard.writeText(url);
//         alert("Link copied to clipboard!");
//     };

//     const switchDevice = async (deviceId: string, kind: "video" | "audio") => {
//         try {
//             // ✅ Only request the ONE track type being switched
//             const newStream = await navigator.mediaDevices.getUserMedia(
//                 kind === "video"
//                     ? { video: { deviceId: { exact: deviceId } } }
//                     : { audio: { deviceId: { exact: deviceId } } }
//             );

//             const newTrack = kind === "video"
//                 ? newStream.getVideoTracks()[0]
//                 : newStream.getAudioTracks()[0];

//             if (!newTrack) {
//                 console.error("No track found in new stream");
//                 return;
//             }

//             // ✅ Replace track in peer connection FIRST
//             if (peerConnectionRef.current) {
//                 const sender = peerConnectionRef.current
//                     .getSenders()
//                     .find(s => s.track?.kind === kind);

//                 if (sender) {
//                     await sender.replaceTrack(newTrack);
//                     console.log(`✅ ${kind} track replaced in peer connection`);
//                 } else {
//                     console.warn(`No ${kind} sender found in peer connection`);
//                 }
//             }

//             // ✅ Stop old track and update localStreamRef
//             if (localStreamRef.current) {
//                 const oldTracks = kind === "video"
//                     ? localStreamRef.current.getVideoTracks()
//                     : localStreamRef.current.getAudioTracks();

//                 oldTracks.forEach(track => {
//                     track.stop(); // stop camera/mic hardware
//                     localStreamRef.current!.removeTrack(track);
//                 });

//                 localStreamRef.current.addTrack(newTrack);
//             }

//             // ✅ Force video element to re-render on mobile
//             if (kind === "video" && localVideoRef.current) {
//                 localVideoRef.current.srcObject = null; // ← force reset
//                 localVideoRef.current.srcObject = localStreamRef.current;
//                 await localVideoRef.current.play().catch(e => console.warn("Play failed:", e));
//             }

//             // ✅ Update selected device state
//             if (kind === "video") setSelectedVideoId(deviceId);
//             if (kind === "audio") setSelectedAudioId(deviceId);

//             setShowDevicePicker(false);
//             console.log(`✅ Switched ${kind} to device: ${deviceId}`);

//         } catch (err: any) {
//             console.error(`❌ Failed to switch ${kind}:`, err.name, err.message);
//             alert(`Could not switch ${kind}: ${err.message}`);
//         }
//     };


//     // ======================================
//     // UI STREAM: PREVIEW (BEFORE JOINING)
//     // ======================================
//     if (!hasJoined) {
//         return (
//             <div className="min-h-screen bg-[#101115] flex flex-col items-center justify-center font-sans text-white p-6">
//                 <div className="max-w-5xl w-full flex flex-col md:flex-row gap-8 items-center justify-center">
//                     {/* Left: Video Preview */}
//                     <div className="w-full md:w-[65%] flex flex-col items-center">
//                         <div className="relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-800">
//                             <video
//                                 ref={localVideoRef}
//                                 autoPlay
//                                 playsInline
//                                 muted
//                                 className={`w-full h-full object-cover transform scale-x-[-1] ${isCameraOff ? "hidden" : "block"}`}
//                             />
//                             {/* {isCameraOff && (
//                                 <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
//                                     <div className="w-24 h-24 rounded-full bg-gray-800 flex items-center justify-center">
//                                         <VideoOff className="w-10 h-10 text-gray-400" />
//                                     </div>
//                                 </div>
//                             )} */}
//                             {/* // ✅ Change to this (Shows first letter of username): */}
//                             {isCameraOff && (
//                                 <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
//                                     <div className="w-24 h-24 rounded-full bg-blue-500 shadow-lg flex items-center justify-center">
//                                         <span className="text-4xl text-white font-medium">{userName.charAt(0).toUpperCase()}</span>
//                                     </div>
//                                 </div>
//                             )}

//                             {/* Toolbar below preview */}
//                             <div className="absolute bottom-4 left-4 bg-black/60 text-white text-sm px-3 py-1.5 rounded-md backdrop-blur-md">
//                                 You ({userName})
//                             </div>
//                             <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
//                                 <button
//                                     onClick={toggleMute}
//                                     className={`p-4 rounded-full transition-all border ${isMuted ? "bg-red-500 hover:bg-red-600 border-transparent text-white" : "bg-gray-800/80 hover:bg-gray-700 border-white/10 backdrop-blur-sm"} `}
//                                 >
//                                     {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
//                                 </button>
//                                 <button
//                                     onClick={toggleCamera}
//                                     className={`p-4 rounded-full transition-all border ${isCameraOff ? "bg-red-500 hover:bg-red-600 border-transparent text-white" : "bg-gray-800/80 hover:bg-gray-700 border-white/10 backdrop-blur-sm"} `}
//                                 >
//                                     {isCameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
//                                 </button>
//                             </div>
//                         </div>
//                     </div>

//                     {/* Right: Join Info */}
//                     <div className="w-full md:w-[35%] flex flex-col items-center md:items-start text-center md:text-left">
//                         <h1 className="text-3xl font-medium mb-2 leading-tight">Ready to join?</h1>
//                         <p className="text-gray-400 mb-8">Joining as <span className="text-white font-medium">{userName}</span></p>

//                         <div className="flex flex-col sm:flex-row md:flex-col gap-4 w-full max-w-[240px]">
//                             {mediaStreamReady ? (
//                                 <button
//                                     onClick={() => setHasJoined(true)}
//                                     className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-full transition-all shadow-lg text-lg w-full"
//                                 >
//                                     Join now
//                                 </button>
//                             ) : (
//                                 <div className="px-8 py-3 bg-gray-800 text-gray-400 font-medium rounded-full shadow-lg text-lg animate-pulse w-full text-center">
//                                     Starting camera...
//                                 </div>
//                             )}

//                             <button
//                                 onClick={handleEndCall}
//                                 className="px-8 py-3 bg-transparent border border-gray-600 hover:bg-gray-800 hover:text-white text-gray-300 font-medium rounded-full transition-all text-lg w-full"
//                             >
//                                 Cancel
//                             </button>
//                         </div>
//                     </div>
//                 </div>
//             </div>
//         );
//     }

//     // ======================================
//     // UI STREAM: IN CALL
//     // ======================================
//     return (
//         <div className="relative h-screen bg-[#1a1b1e] overflow-hidden flex flex-col p-2 sm:p-4">
//             {/* Top Left Status */}
//             <div className={`absolute top-6 left-8 flex items-center gap-4 z-20 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
//                 <div className="bg-black/60 text-white px-5 py-2 rounded-lg text-sm font-medium backdrop-blur-md border border-white/10 shadow-sm">
//                     {callStatus}
//                 </div>
//             </div>

//             {/* Video Container - Responsive padding and rounded corners */}
//             <div className="flex-1 w-full relative bg-[#101115] rounded-3xl overflow-hidden shadow-2xl border border-gray-800">

//                 {/* ✅ ALWAYS rendered — hidden/shown via CSS not conditional render */}
//                 <video
//                     ref={remoteVideoRef}
//                     autoPlay
//                     playsInline
//                     className={`absolute inset-0 w-full h-full object-cover ${remoteConnected ? "block" : "hidden"}`}
//                 />

//                 {/* Waiting state */}
//                 {!remoteConnected && (
//                     <div className="absolute inset-0 flex items-center justify-center">
//                         <div className="flex flex-col items-center">
//                             <div className="w-32 h-32 rounded-full border border-gray-700 flex items-center justify-center animate-pulse bg-gray-800/30 mb-6">
//                                 <div className="text-gray-400 font-medium text-lg">Waiting</div>
//                             </div>
//                         </div>
//                     </div>
//                 )}

//                 {remoteConnected && remoteUserName !== "Waiting..." && (
//                     <div className="absolute bottom-6 left-6 bg-black/60 text-white text-sm px-3 py-1.5 rounded-md backdrop-blur-md z-10 sm:block hidden">
//                         {remoteUserName}
//                     </div>
//                 )}

//                 {/* Local PIP Video - Optimized for mobile/desktop */}
//                 <div className="absolute top-4 right-4 z-20 transition-all duration-300">
//                     <div className="relative w-32 sm:w-64 aspect-[3/4] sm:aspect-video rounded-xl border-2 border-gray-600 shadow-2xl overflow-hidden bg-gray-900 group">
//                         <video
//                             ref={localVideoRef}
//                             autoPlay
//                             playsInline
//                             muted
//                             className={`w-full h-full object-cover transform scale-x-[-1] ${isCameraOff ? "hidden" : "block"}`}
//                         />
//                         {isCameraOff && (
//                             <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-0">
//                                 <div className="w-14 h-14 rounded-full bg-blue-500 shadow-lg flex items-center justify-center">
//                                     <span className="text-2xl text-white font-medium">{userName.charAt(0).toUpperCase()}</span>
//                                 </div>
//                             </div>
//                         )}
//                         <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md backdrop-blur-md z-10">
//                             You
//                         </div>
//                     </div>
//                 </div>
//             </div>

//             {/* Invite Popup Floating over UI - Responsive size */}
//             {showInvitePopup && (
//                 <div className="absolute bottom-28 left-6 right-6 sm:right-auto bg-white rounded-xl shadow-2xl p-5 sm:w-[360px] z-30 animate-in slide-in-from-bottom-4 duration-300 border border-gray-200">
//                     <div className="flex justify-between items-start mb-3">
//                         <h2 className="text-gray-900 font-bold text-base sm:text-lg">Your meeting's ready</h2>
//                         <button onClick={() => setShowInvitePopup(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
//                             <X className="w-5 h-5" />
//                         </button>
//                     </div>
//                     <p className="text-gray-600 text-xs sm:text-sm mb-4">
//                         Share this meeting link with others you want in the meeting.
//                     </p>
//                     <div className="bg-gray-100 rounded-lg p-3 flex items-center justify-between mb-2 border border-gray-200">
//                         <span className="text-xs sm:text-sm font-medium text-gray-700 truncate mr-3">
//                             {typeof window !== 'undefined' ? `${window.location.origin}/call/${roomId}` : ''}
//                         </span>
//                         <button onClick={copyInviteLink} className="text-blue-600 hover:text-blue-700 transition-colors bg-white border border-gray-200 p-2 shrink-0 rounded-md shadow-sm">
//                             <Copy className="w-4 h-4 sm:w-5 h-5" />
//                         </button>
//                     </div>
//                 </div>
//             )}

//             {/* Bottom Controls Bar - Auto-hide logic applied */}
//             <div className={`h-24 bg-transparent flex items-center justify-center gap-3 sm:gap-5 z-20 shrink-0 relative transition-all duration-500 ${showControls ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"}`}>

//                 {/* Device Picker Popup - Responsive */}
//                 {showDevicePicker && (
//                     <div className="absolute bottom-24 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 bg-[#2d2d30] border border-gray-700 rounded-2xl shadow-2xl p-4 sm:w-80 z-50">
//                         <div className="flex justify-between items-center mb-4">
//                             <h3 className="text-white font-semibold text-sm">Media Settings</h3>
//                             <button onClick={() => setShowDevicePicker(false)} className="sm:hidden text-gray-400"><X className="w-4 h-4" /></button>
//                         </div>

//                         <h3 className="text-gray-400 font-medium text-[10px] uppercase tracking-wider mb-2">Camera</h3>
//                         <div className="flex flex-col gap-1.5 mb-5 max-h-32 overflow-y-auto custom-scrollbar">
//                             {videoDevices.map(device => (
//                                 <button
//                                     key={device.deviceId}
//                                     onClick={() => switchDevice(device.deviceId, "video")}
//                                     className={`text-left px-3 py-2 rounded-lg text-xs sm:text-sm transition-all ${selectedVideoId === device.deviceId
//                                         ? "bg-blue-600 text-white shadow-lg"
//                                         : "text-gray-300 hover:bg-gray-700"
//                                         }`}
//                                 >
//                                     📷 {device.label || `Camera ${videoDevices.indexOf(device) + 1}`}
//                                 </button>
//                             ))}
//                         </div>

//                         <h3 className="text-gray-400 font-medium text-[10px] uppercase tracking-wider mb-2">Microphone</h3>
//                         <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto custom-scrollbar">
//                             {audioDevices.map(device => (
//                                 <button
//                                     key={device.deviceId}
//                                     onClick={() => switchDevice(device.deviceId, "audio")}
//                                     className={`text-left px-3 py-2 rounded-lg text-xs sm:text-sm transition-all ${selectedAudioId === device.deviceId
//                                         ? "bg-blue-600 text-white shadow-lg"
//                                         : "text-gray-300 hover:bg-gray-700"
//                                         }`}
//                                 >
//                                     🎤 {device.label || `Mic ${audioDevices.indexOf(device) + 1}`}
//                                 </button>
//                             ))}
//                         </div>
//                     </div>
//                 )}

//                 <button
//                     onClick={toggleMute}
//                     className={`p-3 sm:p-4 rounded-full transition-all border ${isMuted ? "bg-[#ea4335] border-transparent hover:bg-red-600 text-white" : "bg-[#3c4043]/90 backdrop-blur-md border-white/10 hover:bg-[#4d5155] text-white shadow-xl"}`}
//                 >
//                     {isMuted ? <MicOff className="w-5 h-5 sm:w-6 h-6" /> : <Mic className="w-5 h-5 sm:w-6 h-6" />}
//                 </button>

//                 <button
//                     onClick={toggleCamera}
//                     className={`p-3 sm:p-4 rounded-full transition-all border ${isCameraOff ? "bg-[#ea4335] border-transparent hover:bg-red-600 text-white" : "bg-[#3c4043]/90 backdrop-blur-md border-white/10 hover:bg-[#4d5155] text-white shadow-xl"}`}
//                 >
//                     {isCameraOff ? <VideoOff className="w-5 h-5 sm:w-6 h-6" /> : <Video className="w-5 h-5 sm:w-6 h-6" />}
//                 </button>

//                 {/* Device switcher button */}
//                 <button
//                     onClick={() => setShowDevicePicker(!showDevicePicker)}
//                     className={`p-3 sm:p-4 rounded-full transition-all border ${showDevicePicker ? "bg-blue-600 border-transparent text-white shadow-blue-500/20" : "bg-[#3c4043]/90 backdrop-blur-md border-white/10 hover:bg-[#4d5155] text-white shadow-xl"}`}
//                     title="Switch camera / microphone"
//                 >
//                     <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 sm:w-6 h-6">
//                         <circle cx="12" cy="12" r="3" />
//                         <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
//                     </svg>
//                 </button>

//                 {/* Info / Share toggle button */}
//                 <button
//                     onClick={() => setShowInvitePopup(!showInvitePopup)}
//                     className={`p-3 sm:p-4 rounded-full transition-all border ${showInvitePopup ? "bg-blue-600 border-transparent text-white" : "bg-[#3c4043]/90 backdrop-blur-md border-white/10 hover:bg-[#4d5155] text-white shadow-xl"}`}
//                     title="Meeting details"
//                 >
//                     <Info className="w-5 h-5 sm:w-6 h-6" />
//                 </button>

//                 <button
//                     onClick={handleEndCall}
//                     className="p-3 sm:p-4 sm:px-6 bg-[#ea4335] hover:bg-red-600 text-white font-medium rounded-full transition-all shadow-xl sm:ml-3 border border-transparent flex items-center gap-2"
//                 >
//                     <PhoneOff className="w-5 h-5 sm:w-6 h-6" />
//                     <span className="hidden sm:inline">End</span>
//                 </button>
//             </div>
//         </div>
//     );
// }

"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSocket } from "@/hooks/useSocket";
import { Copy, X, Mic, MicOff, Video, VideoOff, PhoneOff, Info } from "lucide-react";
import { AuthContext } from "@/context/AuthContext";

export default function CallRoom() {
    const { roomId } = useParams<{ roomId: string }>();
    const router = useRouter();
    const socket = useSocket();
    const auth = useContext(AuthContext);
    const { user, loading } = auth || {};
    const userName = auth?.loading ? "Loading..." : (auth?.user?.name || "Guest");

    // ✅ FIX 1: ALL refs before any returns
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // ✅ FIX 1: ALL state before any returns
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [callStatus, setCallStatus] = useState("Initializing media...");
    const [hasJoined, setHasJoined] = useState(false);
    const [showInvitePopup, setShowInvitePopup] = useState(true);
    const [remoteConnected, setRemoteConnected] = useState(false);
    const [mediaStreamReady, setMediaStreamReady] = useState(false);
    const [remoteUserName, setRemoteUserName] = useState("Waiting...");
    const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
    const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedVideoId, setSelectedVideoId] = useState<string>("");
    const [selectedAudioId, setSelectedAudioId] = useState<string>("");
    const [showDevicePicker, setShowDevicePicker] = useState(false);
    const [showControls, setShowControls] = useState(true);

    // ✅ FIX 1: ALL useEffects before any returns
    useEffect(() => {
        if (!loading && !user) {
            router.replace("/login");
        }
    }, [user, loading, router]);

    useEffect(() => {
        if (process.env.NODE_ENV === 'production') {
            console.log("Call Room Auth State:", {
                user: user,
                loading: loading,
                userName: userName,
                apiBase: process.env.NEXT_PUBLIC_API_URL
            });
        }
    }, [user, loading, userName]);

    useEffect(() => {
        const handleMouseMove = () => {
            setShowControls(true);
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
            controlsTimeoutRef.current = setTimeout(() => {
                if (!showDevicePicker && !showInvitePopup) {
                    setShowControls(false);
                }
            }, 30000);
        };

        if (hasJoined) {
            window.addEventListener("mousemove", handleMouseMove);
            handleMouseMove();
        }

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        };
    }, [hasJoined, showDevicePicker, showInvitePopup]);

    // 1. Initialize local media
    useEffect(() => {
        const initMedia = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "user" },
                    audio: true,
                });
                localStreamRef.current = stream;

                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }

                setMediaStreamReady(true);
                setCallStatus("Ready to join");

                const devices = await navigator.mediaDevices.enumerateDevices();
                const cameras = devices.filter(d => d.kind === "videoinput");
                const mics = devices.filter(d => d.kind === "audioinput");
                setVideoDevices(cameras);
                setAudioDevices(mics);
                setSelectedVideoId(cameras[0]?.deviceId || "");
                setSelectedAudioId(mics[0]?.deviceId || "");
            } catch (err: any) {
                console.error("Camera error:", err);
                setCallStatus(`Camera error: ${err.message}`);
            }
        };

        initMedia();

        return () => {
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // 2. Re-assign local stream when hasJoined changes
    useEffect(() => {
        if (localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
        }
    }, [hasJoined]);

    // 3. Socket signaling logic
    useEffect(() => {
        if (!hasJoined || !socket || !mediaStreamReady) return;

        setCallStatus("Connecting to room...");

        peerConnectionRef.current = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" },
                {
                    urls: "turn:openrelay.metered.ca:80",
                    username: "openrelayproject",
                    credential: "openrelayproject",
                },
                {
                    urls: "turn:openrelay.metered.ca:443",
                    username: "openrelayproject",
                    credential: "openrelayproject",
                },
                {
                    urls: "turn:openrelay.metered.ca:443?transport=tcp",
                    username: "openrelayproject",
                    credential: "openrelayproject",
                },
            ],
        });

        peerConnectionRef.current.oniceconnectionstatechange = () => {
            console.log("🧊 ICE state:", peerConnectionRef.current?.iceConnectionState);
        };

        peerConnectionRef.current.onicegatheringstatechange = () => {
            console.log("🧊 ICE gathering:", peerConnectionRef.current?.iceGatheringState);
        };

        peerConnectionRef.current.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("🧊 Sending ICE candidate");
                socket.emit("ice-candidate", event.candidate, roomId);
            } else {
                console.log("🧊 ICE gathering complete");
            }
        };

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => {
                peerConnectionRef.current?.addTrack(track, localStreamRef.current!);
            });
        }

        peerConnectionRef.current.ontrack = (event) => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = event.streams[0];
                setCallStatus("Connected");
                setRemoteConnected(true);
                setShowInvitePopup(false);
            }
        };

        const handleReady = async () => {
            console.log("✅ READY received — creating offer");
            console.log("PeerConnection state:", peerConnectionRef.current?.signalingState);
            try {
                const offer = await peerConnectionRef.current?.createOffer();
                console.log("✅ Offer created:", offer);
                await peerConnectionRef.current?.setLocalDescription(offer);
                console.log("✅ Local description set");
                socket.emit("offer", offer, roomId);
                console.log("✅ Offer emitted");
            } catch (err) {
                console.error("Offer creation failed:", err);
            }
        };

        const handleOffer = async (offer: any) => {
            console.log("📨 Offer received on this peer");
            try {
                await peerConnectionRef.current?.setRemoteDescription(offer);
                console.log("✅ Remote description set");
                const answer = await peerConnectionRef.current?.createAnswer();
                console.log("✅ Answer created");
                await peerConnectionRef.current?.setLocalDescription(answer);
                socket.emit("answer", answer, roomId);
                console.log("✅ Answer emitted");
            } catch (err) {
                console.error("Answer failed:", err);
            }
        };

        const handleAnswer = async (answer: any) => {
            console.log("📨 Answer received on this peer");
            try {
                await peerConnectionRef.current?.setRemoteDescription(answer);
                console.log("✅ Remote answer set");
            } catch (err) {
                console.error("Set remote answer failed:", err);
            }
        };

        const handleIceCandidate = async (candidate: any) => {
            try {
                await peerConnectionRef.current?.addIceCandidate(candidate);
            } catch (err) {
                console.error("Add ICE candidate failed:", err);
            }
        };

        const handleUserJoined = (joiningUserName: string) => {
            setRemoteUserName(joiningUserName);
            setCallStatus(`${joiningUserName} joined. Negotiating...`);
        };

        const handleRoomFull = () => {
            alert("Room is full (max 2 users)");
            router.push("/dashboard");
        };

        const handleUserDisconnected = () => {
            setCallStatus("Other user disconnected");
            setRemoteConnected(false);
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        };

        socket.on("ready", handleReady);
        socket.on("offer", handleOffer);
        socket.on("answer", handleAnswer);
        socket.on("ice-candidate", handleIceCandidate);
        socket.on("user-joined", handleUserJoined);
        socket.on("existing-user", (name: string) => setRemoteUserName(name));
        socket.on("room-full", handleRoomFull);
        socket.on("user-disconnected", handleUserDisconnected);

        socket.emit("join-room", { roomId, userName });

        return () => {
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
                peerConnectionRef.current = null;
            }
            socket.off("ready", handleReady);
            socket.off("offer", handleOffer);
            socket.off("answer", handleAnswer);
            socket.off("ice-candidate", handleIceCandidate);
            socket.off("user-joined", handleUserJoined);
            socket.off("room-full", handleRoomFull);
            socket.off("user-disconnected", handleUserDisconnected);
        };
    }, [socket, roomId, router, hasJoined, mediaStreamReady]);

    // ✅ ALL functions after hooks
    const toggleMute = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    };

    const toggleCamera = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsCameraOff(!videoTrack.enabled);
            }
        }
    };

    const handleEndCall = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => track.stop());
        }
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
        }
        if (socket) {
            socket.disconnect();
        }
        router.push("/dashboard");
    };

    const copyInviteLink = () => {
        const url = `${window.location.origin}/call/${roomId}`;
        navigator.clipboard.writeText(url);
        alert("Link copied to clipboard!");
    };

    // ✅ FIX 2: Correct order — get new track FIRST, stop old AFTER
    const switchDevice = async (deviceId: string, kind: "video" | "audio") => {
        try {
            // Step 1: Get new stream FIRST — before stopping anything
            const newStream = await navigator.mediaDevices.getUserMedia(
                kind === "video"
                    ? { video: { deviceId: { exact: deviceId } } }
                    : { audio: { deviceId: { exact: deviceId } } }
            );

            const newTrack = kind === "video"
                ? newStream.getVideoTracks()[0]
                : newStream.getAudioTracks()[0];

            if (!newTrack) {
                console.error("No track found in new stream");
                return;
            }

            // Step 2: Replace in peer connection while old track still active
            if (peerConnectionRef.current) {
                const sender = peerConnectionRef.current
                    .getSenders()
                    .find(s => s.track?.kind === kind);
                if (sender) {
                    await sender.replaceTrack(newTrack);
                    console.log(`✅ ${kind} track replaced in peer connection`);
                }
            }

            // Step 3: NOW stop old track AFTER new one is active
            if (localStreamRef.current) {
                const oldTracks = kind === "video"
                    ? localStreamRef.current.getVideoTracks()
                    : localStreamRef.current.getAudioTracks();

                oldTracks.forEach(track => {
                    track.stop();
                    localStreamRef.current!.removeTrack(track);
                });

                localStreamRef.current.addTrack(newTrack);
            }

            // Step 4: Force video element update with delay for mobile hardware
            if (kind === "video" && localVideoRef.current) {
                localVideoRef.current.srcObject = null;
                await new Promise(resolve => setTimeout(resolve, 50)); // mobile needs this
                localVideoRef.current.srcObject = localStreamRef.current;
                try {
                    await localVideoRef.current.play();
                } catch (e) {
                    console.warn("Play failed:", e);
                }
            }

            if (kind === "video") setSelectedVideoId(deviceId);
            if (kind === "audio") setSelectedAudioId(deviceId);

            setShowDevicePicker(false);
            console.log(`✅ Switched ${kind} to: ${deviceId}`);

        } catch (err: any) {
            console.error(`❌ Failed to switch ${kind}:`, err.name, err.message);
            alert(`Could not switch ${kind}: ${err.message}`);
        }
    };

    // ✅ FIX 1: Early returns AFTER all hooks and functions
    if (loading) {
        return (
            <div className="min-h-screen bg-[#101115] flex items-center justify-center">
                <div className="text-xl font-medium text-white animate-pulse">Loading...</div>
            </div>
        );
    }

    if (!user) return null;

    // ======================================
    // UI STREAM: PREVIEW (BEFORE JOINING)
    // ======================================
    if (!hasJoined) {
        return (
            <div className="min-h-screen bg-[#101115] flex flex-col items-center justify-center font-sans text-white p-6">
                <div className="max-w-5xl w-full flex flex-col md:flex-row gap-8 items-center justify-center">
                    <div className="w-full md:w-[65%] flex flex-col items-center">
                        <div className="relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-800">
                            <video
                                ref={localVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className={`w-full h-full object-cover transform scale-x-[-1] ${isCameraOff ? "hidden" : "block"}`}
                            />
                            {isCameraOff && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                                    <div className="w-24 h-24 rounded-full bg-blue-500 shadow-lg flex items-center justify-center">
                                        <span className="text-4xl text-white font-medium">{userName.charAt(0).toUpperCase()}</span>
                                    </div>
                                </div>
                            )}
                            <div className="absolute bottom-4 left-4 bg-black/60 text-white text-sm px-3 py-1.5 rounded-md backdrop-blur-md">
                                You ({userName})
                            </div>
                            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                                <button
                                    onClick={toggleMute}
                                    className={`p-4 rounded-full transition-all border ${isMuted ? "bg-red-500 hover:bg-red-600 border-transparent text-white" : "bg-gray-800/80 hover:bg-gray-700 border-white/10 backdrop-blur-sm"}`}
                                >
                                    {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                                </button>
                                <button
                                    onClick={toggleCamera}
                                    className={`p-4 rounded-full transition-all border ${isCameraOff ? "bg-red-500 hover:bg-red-600 border-transparent text-white" : "bg-gray-800/80 hover:bg-gray-700 border-white/10 backdrop-blur-sm"}`}
                                >
                                    {isCameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="w-full md:w-[35%] flex flex-col items-center md:items-start text-center md:text-left">
                        <h1 className="text-3xl font-medium mb-2 leading-tight">Ready to join?</h1>
                        <p className="text-gray-400 mb-8">Joining as <span className="text-white font-medium">{userName}</span></p>

                        <div className="flex flex-col sm:flex-row md:flex-col gap-4 w-full max-w-[240px]">
                            {mediaStreamReady ? (
                                <button
                                    onClick={() => setHasJoined(true)}
                                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-full transition-all shadow-lg text-lg w-full"
                                >
                                    Join now
                                </button>
                            ) : (
                                <div className="px-8 py-3 bg-gray-800 text-gray-400 font-medium rounded-full shadow-lg text-lg animate-pulse w-full text-center">
                                    Starting camera...
                                </div>
                            )}
                            <button
                                onClick={handleEndCall}
                                className="px-8 py-3 bg-transparent border border-gray-600 hover:bg-gray-800 hover:text-white text-gray-300 font-medium rounded-full transition-all text-lg w-full"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ======================================
    // UI STREAM: IN CALL
    // ======================================
    return (
        <div className="relative h-screen bg-[#1a1b1e] overflow-hidden flex flex-col p-2 sm:p-4">
            <div className={`absolute top-6 left-8 flex items-center gap-4 z-20 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                <div className="bg-black/60 text-white px-5 py-2 rounded-lg text-sm font-medium backdrop-blur-md border border-white/10 shadow-sm">
                    {callStatus}
                </div>
            </div>

            <div className="flex-1 w-full relative bg-[#101115] rounded-3xl overflow-hidden shadow-2xl border border-gray-800">
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className={`absolute inset-0 w-full h-full object-cover ${remoteConnected ? "block" : "hidden"}`}
                />

                {!remoteConnected && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex flex-col items-center">
                            <div className="w-32 h-32 rounded-full border border-gray-700 flex items-center justify-center animate-pulse bg-gray-800/30 mb-6">
                                <div className="text-gray-400 font-medium text-lg">Waiting</div>
                            </div>
                        </div>
                    </div>
                )}

                {remoteConnected && remoteUserName !== "Waiting..." && (
                    <div className="absolute bottom-6 left-6 bg-black/60 text-white text-sm px-3 py-1.5 rounded-md backdrop-blur-md z-10 sm:block hidden">
                        {remoteUserName}
                    </div>
                )}

                <div className="absolute top-4 right-4 z-20 transition-all duration-300">
                    <div className="relative w-32 sm:w-64 aspect-[3/4] sm:aspect-video rounded-xl border-2 border-gray-600 shadow-2xl overflow-hidden bg-gray-900 group">
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className={`w-full h-full object-cover transform scale-x-[-1] ${isCameraOff ? "hidden" : "block"}`}
                        />
                        {isCameraOff && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-0">
                                <div className="w-14 h-14 rounded-full bg-blue-500 shadow-lg flex items-center justify-center">
                                    <span className="text-2xl text-white font-medium">{userName.charAt(0).toUpperCase()}</span>
                                </div>
                            </div>
                        )}
                        <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md backdrop-blur-md z-10">
                            You
                        </div>
                    </div>
                </div>
            </div>

            {showInvitePopup && (
                <div className="absolute bottom-28 left-6 right-6 sm:right-auto bg-white rounded-xl shadow-2xl p-5 sm:w-[360px] z-30 animate-in slide-in-from-bottom-4 duration-300 border border-gray-200">
                    <div className="flex justify-between items-start mb-3">
                        <h2 className="text-gray-900 font-bold text-base sm:text-lg">Your meeting's ready</h2>
                        <button onClick={() => setShowInvitePopup(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <p className="text-gray-600 text-xs sm:text-sm mb-4">
                        Share this meeting link with others you want in the meeting.
                    </p>
                    <div className="bg-gray-100 rounded-lg p-3 flex items-center justify-between mb-2 border border-gray-200">
                        <span className="text-xs sm:text-sm font-medium text-gray-700 truncate mr-3">
                            {typeof window !== 'undefined' ? `${window.location.origin}/call/${roomId}` : ''}
                        </span>
                        <button onClick={copyInviteLink} className="text-blue-600 hover:text-blue-700 transition-colors bg-white border border-gray-200 p-2 shrink-0 rounded-md shadow-sm">
                            <Copy className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                    </div>
                </div>
            )}

            <div className={`h-24 bg-transparent flex items-center justify-center gap-3 sm:gap-5 z-20 shrink-0 relative transition-all duration-500 ${showControls ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"}`}>

                {showDevicePicker && (
                    <div className="absolute bottom-24 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 bg-[#2d2d30] border border-gray-700 rounded-2xl shadow-2xl p-4 sm:w-80 z-50">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-white font-semibold text-sm">Media Settings</h3>
                            <button onClick={() => setShowDevicePicker(false)} className="sm:hidden text-gray-400"><X className="w-4 h-4" /></button>
                        </div>

                        <h3 className="text-gray-400 font-medium text-[10px] uppercase tracking-wider mb-2">Camera</h3>
                        <div className="flex flex-col gap-1.5 mb-5 max-h-32 overflow-y-auto">
                            {videoDevices.map(device => (
                                <button
                                    key={device.deviceId}
                                    onClick={() => switchDevice(device.deviceId, "video")}
                                    className={`text-left px-3 py-2 rounded-lg text-xs sm:text-sm transition-all ${selectedVideoId === device.deviceId
                                        ? "bg-blue-600 text-white shadow-lg"
                                        : "text-gray-300 hover:bg-gray-700"
                                        }`}
                                >
                                    📷 {device.label || `Camera ${videoDevices.indexOf(device) + 1}`}
                                </button>
                            ))}
                        </div>

                        <h3 className="text-gray-400 font-medium text-[10px] uppercase tracking-wider mb-2">Microphone</h3>
                        <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto">
                            {audioDevices.map(device => (
                                <button
                                    key={device.deviceId}
                                    onClick={() => switchDevice(device.deviceId, "audio")}
                                    className={`text-left px-3 py-2 rounded-lg text-xs sm:text-sm transition-all ${selectedAudioId === device.deviceId
                                        ? "bg-blue-600 text-white shadow-lg"
                                        : "text-gray-300 hover:bg-gray-700"
                                        }`}
                                >
                                    🎤 {device.label || `Mic ${audioDevices.indexOf(device) + 1}`}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <button
                    onClick={toggleMute}
                    className={`p-3 sm:p-4 rounded-full transition-all border ${isMuted ? "bg-[#ea4335] border-transparent hover:bg-red-600 text-white" : "bg-[#3c4043]/90 backdrop-blur-md border-white/10 hover:bg-[#4d5155] text-white shadow-xl"}`}
                >
                    {isMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
                </button>

                <button
                    onClick={toggleCamera}
                    className={`p-3 sm:p-4 rounded-full transition-all border ${isCameraOff ? "bg-[#ea4335] border-transparent hover:bg-red-600 text-white" : "bg-[#3c4043]/90 backdrop-blur-md border-white/10 hover:bg-[#4d5155] text-white shadow-xl"}`}
                >
                    {isCameraOff ? <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Video className="w-5 h-5 sm:w-6 sm:h-6" />}
                </button>

                <button
                    onClick={() => setShowDevicePicker(!showDevicePicker)}
                    className={`p-3 sm:p-4 rounded-full transition-all border ${showDevicePicker ? "bg-blue-600 border-transparent text-white" : "bg-[#3c4043]/90 backdrop-blur-md border-white/10 hover:bg-[#4d5155] text-white shadow-xl"}`}
                    title="Switch camera / microphone"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 sm:w-6 sm:h-6">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                    </svg>
                </button>

                <button
                    onClick={() => setShowInvitePopup(!showInvitePopup)}
                    className={`p-3 sm:p-4 rounded-full transition-all border ${showInvitePopup ? "bg-blue-600 border-transparent text-white" : "bg-[#3c4043]/90 backdrop-blur-md border-white/10 hover:bg-[#4d5155] text-white shadow-xl"}`}
                    title="Meeting details"
                >
                    <Info className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>

                <button
                    onClick={handleEndCall}
                    className="p-3 sm:p-4 sm:px-6 bg-[#ea4335] hover:bg-red-600 text-white font-medium rounded-full transition-all shadow-xl sm:ml-3 border border-transparent flex items-center gap-2"
                >
                    <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6" />
                    <span className="hidden sm:inline">End</span>
                </button>
            </div>
        </div>
    );
}