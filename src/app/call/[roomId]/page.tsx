"use client";

import React, { useContext, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSocket } from "@/hooks/useSocket";
import { Copy, X, Mic, MicOff, Video, VideoOff, PhoneOff, Info, MessageSquare, Send, Monitor, MonitorOff, Check, Link2 } from "lucide-react";
import { AuthContext } from "@/context/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChatMessage {
    id: string;
    message: string;
    userName: string;
    timeStamp: number;
    isSelf: boolean;
}

export default function CallRoom() {
    const { roomId } = useParams<{ roomId: string }>();
    const router = useRouter();
    const socket = useSocket();
    const auth = useContext(AuthContext);
    const { user, loading } = auth || {};
    const userName = auth?.loading ? "Loading..." : (auth?.user?.name || "Guest");

    // ── Refs ──────────────────────────────────────────────────────────────────
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);
    const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    // FIX 2: track whether we're already initializing media to avoid double-init
    const mediaInitRef = useRef(false);

    // ── State ─────────────────────────────────────────────────────────────────
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
    const [showChat, setShowChat] = useState(false);
    const [chatMessage, setChatMessage] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [unreadCount, setUnreadCount] = useState(0);
    const [peerTyping, setPeerTyping] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const [toast, setToast] = useState<string | null>(null);
    // FIX 2: track media error for retry UI
    const [mediaError, setMediaError] = useState<string | null>(null);
    // FIX 1: copied state for invite link button
    const [linkCopied, setLinkCopied] = useState(false);
    // ── Reactions ─────────────────────────────────────────────────────────
    const [reactions, setReactions] = useState<{ id: string; emoji: string; fromSelf: boolean }[]>([]);
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "👏", "🔥"];

    // ── ICE config ────────────────────────────────────────────────────────────
    const ICE_SERVERS: RTCConfiguration = {
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
            { urls: "stun:stun3.l.google.com:19302" },
            {
                urls: [
                    "turn:openrelay.metered.ca:80",
                    "turn:openrelay.metered.ca:443",
                    "turn:openrelay.metered.ca:443?transport=tcp",
                    "turns:openrelay.metered.ca:443",
                ],
                username: "openrelayproject",
                credential: "openrelayproject",
            },
        ],
        iceCandidatePoolSize: 10,
        iceTransportPolicy: "all",
        bundlePolicy: "max-bundle",
        rtcpMuxPolicy: "require",
    };

    // ── useEffect: auth guard ─────────────────────────────────────────────────
    useEffect(() => {
        if (!loading && !user) router.replace("/login");
    }, [user, loading, router]);

    useEffect(() => {
        if (process.env.NODE_ENV === "production") {
            console.log("Call Room Auth State:", { user, loading, userName, apiBase: process.env.NEXT_PUBLIC_API_URL });
        }
    }, [user, loading, userName]);

    // ── useEffect: controls auto-hide (mouse + touch) ─────────────────────────
    // Desktop: mouse move shows controls, hides after 4s idle
    // Mobile:  tap anywhere shows controls, hides after 4s
    useEffect(() => {
        const revealControls = () => {
            setShowControls(true);
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
            controlsTimeoutRef.current = setTimeout(() => {
                if (!showDevicePicker && !showInvitePopup && !showChat) setShowControls(false);
            }, 4000);
        };
        if (hasJoined) {
            window.addEventListener("mousemove", revealControls);
            window.addEventListener("touchstart", revealControls, { passive: true });
            revealControls();
        }
        return () => {
            window.removeEventListener("mousemove", revealControls);
            window.removeEventListener("touchstart", revealControls);
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        };
    }, [hasJoined, showDevicePicker, showInvitePopup, showChat]);

    // ── FIX 2: initMedia extracted as a callable function ─────────────────────
    // On mobile browsers opened via Slack/WhatsApp in-app browser, getUserMedia
    // can fail or return a stream whose video track doesn't start playing.
    // Strategy:
    //   1. Use `facingMode: "user"` without exact constraint first (most compatible)
    //   2. On failure, fall back to audio-only so user can still join
    //   3. After stream is acquired, re-assign to video element and explicitly call play()
    //   4. Guard with mediaInitRef to prevent double-initialization
    const initMedia = async () => {
        if (mediaInitRef.current) return;
        mediaInitRef.current = true;
        setMediaError(null);
        setCallStatus("Initializing media...");

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user" },
                audio: {
                    noiseSuppression: true,
                    echoCancellation: true,
                    autoGainControl: true,
                },
            });
            localStreamRef.current = stream;

            // Explicitly assign + play — fixes silent failure on in-app browsers
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
                // play() must be called after srcObject is set
                await localVideoRef.current.play().catch(() => {
                    // Autoplay blocked — user gesture (Join button click) will trigger play
                });
            }

            setMediaStreamReady(true);
            setCallStatus("Ready to join");

            const devices = await navigator.mediaDevices.enumerateDevices();
            const cameras = devices.filter(d => d.kind === "videoinput");
            const mics = devices.filter(d => d.kind === "audioinput");
            setVideoDevices(cameras);
            setAudioDevices(mics);
            setSelectedVideoId(stream.getVideoTracks()[0]?.getSettings().deviceId || cameras[0]?.deviceId || "");
            setSelectedAudioId(stream.getAudioTracks()[0]?.getSettings().deviceId || mics[0]?.deviceId || "");
        } catch (err: any) {
            console.error("Camera/mic init error:", err);
            mediaInitRef.current = false; // allow retry

            // NotAllowedError = user denied permissions
            if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                setMediaError("Camera/microphone permission denied. Please allow access and try again.");
                setCallStatus("Permission denied");
                return;
            }

            // NotFoundError = no camera found — try audio only
            if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
                try {
                    const audioOnlyStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    localStreamRef.current = audioOnlyStream;
                    setIsCameraOff(true);
                    setMediaStreamReady(true);
                    setCallStatus("Ready to join (audio only)");
                    const mics = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "audioinput");
                    setAudioDevices(mics);
                } catch (audioErr: any) {
                    setMediaError(`Media init failed: ${audioErr.message}`);
                    setCallStatus("Media error");
                }
                return;
            }

            // OverconstrainedError — relax constraints and retry
            if (err.name === "OverconstrainedError" || err.name === "ConstraintNotSatisfiedError") {
                try {
                    const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                    localStreamRef.current = fallbackStream;
                    if (localVideoRef.current) {
                        localVideoRef.current.srcObject = fallbackStream;
                        await localVideoRef.current.play().catch(() => { });
                    }
                    setMediaStreamReady(true);
                    setCallStatus("Ready to join");
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    setVideoDevices(devices.filter(d => d.kind === "videoinput"));
                    setAudioDevices(devices.filter(d => d.kind === "audioinput"));
                } catch (fallbackErr: any) {
                    setMediaError(`Camera error: ${fallbackErr.message}`);
                    setCallStatus("Camera error");
                }
                return;
            }

            setMediaError(`Media error: ${err.message}`);
            setCallStatus(`Camera error: ${err.message}`);
        }
    };



    // ── useEffect: init local media on mount ──────────────────────────────────
    useEffect(() => {
        initMedia();
        return () => {
            localStreamRef.current?.getTracks().forEach(t => t.stop());
            mediaInitRef.current = false;
        };
    }, []);

    // ── FIX 2: re-assign + play local stream when hasJoined changes ───────────
    // This is the key fix for the "camera feed invisible after joining" bug on
    // mobile in-app browsers. The stream exists but the <video> element lost
    // its srcObject during the React re-render that switches screens.
    useEffect(() => {
        if (localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
            localVideoRef.current.play().catch(() => { });
        }
    }, [hasJoined]);

    // ── useEffect: scroll chat to bottom ──────────────────────────────────────
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessage]);

    // ── useEffect: clear unread badge when chat opens ─────────────────────────
    useEffect(() => { if (showChat) setUnreadCount(0); }, [showChat]);

    // ── Call timer ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (remoteConnected) {
            setCallDuration(0);
            callTimerRef.current = setInterval(() => {
                setCallDuration(s => s + 1);
            }, 1000);
        } else {
            if (callTimerRef.current) {
                clearInterval(callTimerRef.current);
                callTimerRef.current = null;
            }
        }
        return () => {
            if (callTimerRef.current) {
                clearInterval(callTimerRef.current);
                callTimerRef.current = null;
            }
        };
    }, [remoteConnected]);

    // ── useEffect: socket signaling ───────────────────────────────────────────
    useEffect(() => {
        if (!hasJoined || !socket || !mediaStreamReady) return;

        setCallStatus("Connecting to room...");

        const buildPeerConnection = () => {
            const pc = new RTCPeerConnection(ICE_SERVERS);

            pc.onicecandidate = e => {
                if (e.candidate) socket.emit("ice-candidate", e.candidate, roomId);
            }

            pc.oniceconnectionstatechange = () => {
                console.log(`🧊 ICE state: ${pc.iceConnectionState}`);
                if (pc.iceConnectionState === "failed") {
                    console.warn("❌ ICE failed — restarting (Mac mDNS fallback)");
                    pc.restartIce();
                }
                if (pc.iceConnectionState === "disconnected") {
                    setTimeout(() => {
                        if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
                            console.warn("⚠️ ICE still disconnected after 3s — restarting");
                            pc.restartIce();
                        }
                    }, 3000);
                }
            }

            pc.onicegatheringstatechange = () => {
                console.log("🧊 ICE gathering:", pc.iceGatheringState);
            };

            pc.onconnectionstatechange = () => {
                console.log("🔗 Connection state:", pc.connectionState);
                if (pc.connectionState === "connected") {
                    setCallStatus("Connected");
                    setRemoteConnected(true);
                }
                if (pc.connectionState === "failed") {
                    console.error("💀 PC failed — closing for rebuild");
                    setRemoteConnected(false);
                    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
                    pc.close();
                    peerConnectionRef.current = null;
                    setCallStatus("Connection failed — waiting for peer...");
                }
            };

            pc.ontrack = (e) => {
                console.log("🎥 Got remote track:", e.track.kind);
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = e.streams[0];
                    setCallStatus("Connected");
                    setRemoteConnected(true);
                    setShowInvitePopup(false)
                }
            }
            localStreamRef.current?.getTracks().forEach(t =>
                pc.addTrack(t, localStreamRef.current!)
            );
            return pc;
        }

        const pendingCandidates: RTCIceCandidateInit[] = []

        peerConnectionRef.current = buildPeerConnection();

        const handleReady = async () => {
            console.log("✅ READY — creating offer");
            try {
                if (
                    !peerConnectionRef.current ||
                    peerConnectionRef.current.signalingState === "closed"
                ) {
                    console.log("🔄 Rebuilding peer connection after disconnect");
                    peerConnectionRef.current = buildPeerConnection();
                }
                const offer = await peerConnectionRef.current.createOffer();
                await peerConnectionRef.current.setLocalDescription(offer);
                socket.emit("offer", offer, roomId);
            } catch (err) { console.error("Offer failed:", err); }
        };
        const handleOffer = async (offer: RTCSessionDescriptionInit) => {
            try {
                await peerConnectionRef.current?.setRemoteDescription(offer);
                // Flush any ICE candidates that arrived before the offer
                for (const c of pendingCandidates) {
                    await peerConnectionRef.current?.addIceCandidate(new RTCIceCandidate(c));
                }
                pendingCandidates.length = 0;
                const answer = await peerConnectionRef.current?.createAnswer();
                await peerConnectionRef.current?.setLocalDescription(answer);
                socket.emit("answer", answer, roomId);
            } catch (err) { console.error("Answer failed:", err); }
        };

        const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
            try {
                await peerConnectionRef.current?.setRemoteDescription(answer);
                // Flush any ICE candidates that arrived before the answer
                for (const c of pendingCandidates) {
                    await peerConnectionRef.current?.addIceCandidate(new RTCIceCandidate(c));
                }
                pendingCandidates.length = 0;
            } catch (err) { console.error("Set remote answer failed:", err); }
        };

        const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
            try {
                const pc = peerConnectionRef.current;
                if (!pc) return;
                if (pc.remoteDescription && pc.remoteDescription.type) {
                    // Remote desc already set — add immediately
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } else {
                    // Queue it — remote desc not ready yet
                    console.log("⏳ Queuing ICE candidate (remote desc not set yet)");
                    pendingCandidates.push(candidate);
                }
            } catch (err) { console.error("ICE candidate failed:", err); }
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
            setRemoteConnected(false);
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
                peerConnectionRef.current = null;
            }

            let countdown = 10;
            setCallStatus(`Peer disconnected — waiting to rejoin (${countdown}s)...`);
            const cd = setInterval(() => {
                countdown -= 1;
                if (countdown > 0) {
                    setCallStatus(`Peer disconnected — waiting to rejoin (${countdown}s)...`);
                } else {
                    clearInterval(cd);
                    setCallStatus("Peer left. Waiting for them to rejoin...");
                }
            }, 1000);
        };

        socket.on("ready", handleReady);
        socket.on("offer", handleOffer);
        socket.on("answer", handleAnswer);
        socket.on("ice-candidate", handleIceCandidate);
        socket.on("user-joined", handleUserJoined);
        socket.on("existing-user", (name: string) => setRemoteUserName(name));
        socket.on("room-full", handleRoomFull);
        socket.on("user-disconnected", handleUserDisconnected);

        socket.on("chat-message", ({ message, userName: fromName, timeStamp }: {
            message: string; userName: string; timeStamp: number;
        }) => {
            const ts = timeStamp ?? Date.now();
            setChatMessage(prev => [...prev, {
                id: `${ts}-${Math.random()}`, message,
                userName: fromName, timeStamp: ts, isSelf: false,
            }]);
            setShowChat(current => {
                if (!current) setUnreadCount(c => c + 1);
                return current;
            });
        });

        socket.on("chat-typing", ({ isTyping }: { isTyping: boolean }) => setPeerTyping(isTyping));

        socket.on("receive-reaction", ({ emoji }: { emoji: string }) => {
            const id = `${Date.now()}-peer`;
            setReactions(prev => [...prev, { id, emoji, fromSelf: false }]);
            setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 3000);
        });

        socket.emit("join-room", { roomId, userName });

        return () => {
            peerConnectionRef.current?.close();
            peerConnectionRef.current = null;
            socket.off("ready", handleReady);
            socket.off("offer", handleOffer);
            socket.off("answer", handleAnswer);
            socket.off("ice-candidate", handleIceCandidate);
            socket.off("user-joined", handleUserJoined);
            socket.off("room-full", handleRoomFull);
            socket.off("user-disconnected", handleUserDisconnected);
            socket.off("chat-message");
            socket.off("chat-typing");
            socket.off("receive-reaction");
        };
    }, [socket, roomId, router, hasJoined, mediaStreamReady]);

    // ── Toggle mute ───────────────────────────────────────────────────────────
    const toggleMute = () => {
        const audioTrack = localStreamRef.current?.getAudioTracks()[0];
        if (audioTrack) { audioTrack.enabled = !audioTrack.enabled; setIsMuted(!audioTrack.enabled); }
    };

    // ── Toggle camera ─────────────────────────────────────────────────────────
    const toggleCamera = () => {
        const videoTrack = localStreamRef.current?.getVideoTracks()[0];
        if (videoTrack) { videoTrack.enabled = !videoTrack.enabled; setIsCameraOff(!videoTrack.enabled); }
    };

    // ── End call ──────────────────────────────────────────────────────────────
    const handleEndCall = () => {
        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
        if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        peerConnectionRef.current?.close();
        socket?.disconnect();
        router.push("/dashboard");
    };

    // ── Toast helper ──────────────────────────────────────────────────────────
    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2500);
    };

    // ── FIX 1: improved copy with visual feedback ──────────────────────────────
    const copyInviteLink = () => {
        const url = `${window.location.origin}/call/${roomId}`;
        navigator.clipboard.writeText(url).then(() => {
            setLinkCopied(true);
            showToast("Link copied!");
            setTimeout(() => setLinkCopied(false), 2000);
        });
    };
    // ── Send reaction ─────────────────────────────────────────────────────
    const sendReaction = (emoji: string) => {
        if (!socket) return;
        const id = `${Date.now()}-self`;
        setReactions(prev => [...prev, { id, emoji, fromSelf: true }]);

        setTimeout(() => {
            setReactions(prev => prev.filter(r => r.id !== id))
        }, 3000);

        socket.emit("send-reaction", { roomId, emoji });
    }

    // ── Switch camera / mic ───────────────────────────────────────────────────
    const switchDevice = async (deviceId: string, kind: "video" | "audio") => {
        try {
            if (kind === "video" && localStreamRef.current) {
                localStreamRef.current.getVideoTracks().forEach(t => { t.stop(); localStreamRef.current!.removeTrack(t); });
                if (localVideoRef.current) localVideoRef.current.srcObject = null;
                setIsCameraOff(true);
            }
            if (kind === "audio" && localStreamRef.current) {
                localStreamRef.current.getAudioTracks().forEach(t => { t.stop(); localStreamRef.current!.removeTrack(t); });
            }
            await new Promise(r => setTimeout(r, 300));
            const newStream = await navigator.mediaDevices.getUserMedia(
                kind === "video"
                    ? { video: { deviceId: { exact: deviceId } } }
                    : { audio: { deviceId: { exact: deviceId } } }
            );
            const newTrack = kind === "video" ? newStream.getVideoTracks()[0] : newStream.getAudioTracks()[0];
            if (!newTrack) { if (kind === "video") setIsCameraOff(false); return; }
            localStreamRef.current?.addTrack(newTrack);
            const sender = peerConnectionRef.current?.getSenders().find(s => s.track?.kind === kind);
            if (sender) await sender.replaceTrack(newTrack);
            if (kind === "video" && localVideoRef.current) {
                localVideoRef.current.srcObject = localStreamRef.current;
                await localVideoRef.current.play().catch(() => { });
                setIsCameraOff(false);
            }
            if (kind === "video") setSelectedVideoId(deviceId);
            if (kind === "audio") setSelectedAudioId(deviceId);
            setShowDevicePicker(false);
        } catch (err: any) {
            if (kind === "video") {
                setIsCameraOff(false);
                if (localVideoRef.current && localStreamRef.current) localVideoRef.current.srcObject = localStreamRef.current;
            }
            alert(`Could not switch ${kind}: ${err.message}`);
        }
    };

    // ── Chat: send ────────────────────────────────────────────────────────────
    const sendMessage = () => {
        const msg = chatInput.trim();
        if (!msg || !socket) return;
        const timeStamp = Date.now();
        socket.emit("chat-message", { roomId, message: msg, userName, timeStamp });
        setChatMessage(prev => [...prev, { id: `${timeStamp}-self`, message: msg, userName, timeStamp, isSelf: true }]);
        setChatInput("");
        socket.emit("chat-typing", { roomId, userName, isTyping: false });
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };

    // ── Chat: typing indicator ────────────────────────────────────────────────
    const handleChatInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        setChatInput(e.target.value);
        if (!socket) return;
        socket.emit("chat-typing", { roomId, userName, isTyping: true });
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
            socket.emit("chat-typing", { roomId, userName, isTyping: false });
        }, 1500);
    };

    // ── Format helpers ────────────────────────────────────────────────────────
    const formatTime = (ts: number) =>
        new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const formatDuration = (s: number) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
        return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    };

    // ── Screen sharing ────────────────────────────────────────────────────────
    const toggleScreenShare = async () => {
        if (isScreenSharing) {
            screenStreamRef.current?.getTracks().forEach(t => t.stop());
            screenStreamRef.current = null;
            const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
            if (cameraTrack) {
                const sender = peerConnectionRef.current?.getSenders().find(s => s.track?.kind === "video");
                if (sender) await sender.replaceTrack(cameraTrack);
            }
            if (localVideoRef.current && localStreamRef.current) localVideoRef.current.srcObject = localStreamRef.current;
            localStreamRef.current?.getVideoTracks().forEach(t => t.enabled = true);
            setIsScreenSharing(false);
            setIsCameraOff(false);
            return;
        }
        if (!navigator.mediaDevices?.getDisplayMedia) return;
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" } as any, audio: false });
            screenStreamRef.current = screenStream;
            const screenTrack = screenStream.getVideoTracks()[0];
            const sender = peerConnectionRef.current?.getSenders().find(s => s.track?.kind === "video");
            if (sender) await sender.replaceTrack(screenTrack);
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = new MediaStream([screenTrack, ...(localStreamRef.current?.getAudioTracks() || [])]);
            }
            setIsScreenSharing(true);
            setIsCameraOff(false);
            screenTrack.onended = () => toggleScreenShare();
        } catch (err: any) {
            if (err.name === "NotAllowedError") return;
            alert(`Screen sharing failed: ${err.message}`);
        }
    };

    // ── FIX 2: handleJoinNow — ensures video plays after user gesture ─────────
    // On iOS/Android in-app browsers, autoplay is blocked until a user gesture.
    // Clicking "Join now" IS a user gesture, so we force play() here before
    // setting hasJoined=true (which causes the re-render to the call screen).
    const handleJoinNow = async () => {
        if (localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
            try { await localVideoRef.current.play(); } catch (_) { /* blocked, fine */ }
        }
        setHasJoined(true);
    };

    // ── Early returns ─────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-[#101115] flex items-center justify-center">
                <div className="text-xl font-medium text-white animate-pulse">Loading...</div>
            </div>
        );
    }
    if (!user) return null;

    // =========================================================================
    // PREVIEW SCREEN
    // =========================================================================
    if (!hasJoined) {
        return (
            <div className="min-h-screen bg-[#101115] flex flex-col items-center justify-center font-sans text-white p-4 sm:p-6">
                <div className="max-w-5xl w-full flex flex-col md:flex-row gap-6 sm:gap-8 items-center justify-center">

                    {/* ── Video preview ── */}
                    <div className="w-full md:w-[65%] flex flex-col items-center">
                        {/*
                          FIX 2: Increased mobile preview height.
                          - On mobile: aspect-[4/3] gives a taller box (75% of width)
                          - On desktop: aspect-video (16/9) keeps the standard look
                          - min-h ensures it never collapses too small on tiny phones
                        */}
                        <div className="relative w-full aspect-[4/3] sm:aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-800 min-h-[260px]">
                            <video
                                ref={localVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className={`w-full h-full object-cover transform scale-x-[-1] ${isCameraOff ? "hidden" : "block"}`}
                            />
                            {isCameraOff && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-blue-500 shadow-lg flex items-center justify-center">
                                        <span className="text-3xl sm:text-4xl text-white font-medium">{userName.charAt(0).toUpperCase()}</span>
                                    </div>
                                </div>
                            )}
                            {/* Show media error overlay */}
                            {mediaError && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 px-4 text-center">
                                    <p className="text-red-400 text-sm mb-3">{mediaError}</p>
                                    <button
                                        onClick={() => { mediaInitRef.current = false; initMedia(); }}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-full transition-all"
                                    >
                                        Retry
                                    </button>
                                </div>
                            )}
                            <div className="absolute bottom-4 left-4 bg-black/60 text-white text-sm px-3 py-1.5 rounded-md backdrop-blur-md">
                                You ({userName})
                            </div>
                            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                                <button onClick={toggleMute} className={`p-3 sm:p-4 rounded-full transition-all border ${isMuted ? "bg-red-500 hover:bg-red-600 border-transparent text-white" : "bg-gray-800/80 hover:bg-gray-700 border-white/10 backdrop-blur-sm"}`}>
                                    {isMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
                                </button>
                                <button onClick={toggleCamera} className={`p-3 sm:p-4 rounded-full transition-all border ${isCameraOff ? "bg-red-500 hover:bg-red-600 border-transparent text-white" : "bg-gray-800/80 hover:bg-gray-700 border-white/10 backdrop-blur-sm"}`}>
                                    {isCameraOff ? <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Video className="w-5 h-5 sm:w-6 sm:h-6" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ── Join panel ── */}
                    <div className="w-full md:w-[35%] flex flex-col items-center md:items-start text-center md:text-left">
                        <h1 className="text-2xl sm:text-3xl font-medium mb-2 leading-tight">Ready to join?</h1>
                        <p className="text-gray-400 mb-6 sm:mb-8">Joining as <span className="text-white font-medium">{userName}</span></p>
                        <div className="flex flex-col sm:flex-row md:flex-col gap-3 sm:gap-4 w-full max-w-[240px]">
                            {mediaStreamReady ? (
                                // FIX 2: use handleJoinNow instead of setHasJoined(true) directly
                                <button onClick={handleJoinNow} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-full transition-all shadow-lg text-lg w-full">
                                    Join now
                                </button>
                            ) : mediaError ? (
                                <button
                                    onClick={() => { mediaInitRef.current = false; initMedia(); }}
                                    className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-full transition-all shadow-lg text-lg w-full"
                                >
                                    Retry camera
                                </button>
                            ) : (
                                <div className="px-8 py-3 bg-gray-800 text-gray-400 font-medium rounded-full shadow-lg text-lg animate-pulse w-full text-center">
                                    Starting camera...
                                </div>
                            )}
                            <button onClick={handleEndCall} className="px-8 py-3 bg-transparent border border-gray-600 hover:bg-gray-800 hover:text-white text-gray-300 font-medium rounded-full transition-all text-lg w-full">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // =========================================================================
    // IN CALL SCREEN
    // Video fills the full viewport. Every UI element floats over it.
    // Controls auto-hide after 30s of no mouse/touch activity.
    // =========================================================================
    return (
        // Root: full viewport, black bg, no scroll
        <div className="fixed inset-0 bg-[#101115] overflow-hidden">

            {/* ── Full-screen remote video (base layer) ── */}
            <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={`absolute inset-0 w-full h-full object-contain ${remoteConnected ? "block" : "hidden"}`}
            />

            {/* Waiting state — centered over the black bg */}
            {!remoteConnected && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-32 h-32 rounded-full border border-gray-700 flex items-center justify-center animate-pulse bg-gray-800/30">
                        <span className="text-gray-400 font-medium text-lg">Waiting</span>
                    </div>
                </div>
            )}

            {/* ── Status badge — top-left, fades with controls ── */}
            <div className={`absolute top-5 left-5 z-30 transition-opacity duration-500 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                <div className="bg-black/60 text-white px-4 py-2 rounded-lg text-sm font-medium backdrop-blur-md border border-white/10 shadow-sm flex items-center gap-2">
                    {callStatus}
                    {remoteConnected && (
                        <span className="text-white/60 text-xs font-mono">
                            {formatDuration(callDuration)}
                        </span>
                    )}
                    {isScreenSharing && (
                        <span className="flex items-center gap-1 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                            <Monitor className="w-3 h-3" /> Sharing
                        </span>
                    )}
                </div>
            </div>

            {/* Remote peer name — bottom-left of video, fades with controls */}
            {remoteConnected && remoteUserName !== "Waiting..." && (
                <div className={`absolute bottom-28 left-5 z-30 transition-opacity duration-500 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                    <div className="bg-black/60 text-white text-sm px-3 py-1.5 rounded-md backdrop-blur-md">
                        {remoteUserName}
                    </div>
                </div>
            )}

            {/* ── Local PiP — top-right, always visible ── */}
            <div className="absolute top-4 right-4 z-30">
                <div className="relative w-28 sm:w-56 aspect-video rounded-xl border-2 border-white/20 shadow-2xl overflow-hidden bg-gray-900">
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full ${isScreenSharing
                            ? "object-contain block"
                            : `object-cover transform scale-x-[-1] ${isCameraOff ? "hidden" : "block"}`
                            }`}
                    />
                    {isCameraOff && !isScreenSharing && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-blue-500 flex items-center justify-center">
                                <span className="text-lg sm:text-2xl text-white font-medium">{userName.charAt(0).toUpperCase()}</span>
                            </div>
                        </div>
                    )}
                    <div className="absolute bottom-1.5 left-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-md">You</div>
                    {isScreenSharing && (
                        <div className="absolute top-1.5 left-1.5 bg-green-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Monitor className="w-2.5 h-2.5" /> Sharing
                        </div>
                    )}
                </div>
            </div>

            {/* ── Invite popup — bottom-left, above controls bar ── */}
            {showInvitePopup && (
                <div className={`absolute bottom-24 left-4 sm:left-5 z-40 transition-opacity duration-500 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                    <div className="relative bg-[#1e2025]/95 border border-white/10 rounded-2xl shadow-2xl w-[min(calc(100vw-2rem),340px)] overflow-hidden backdrop-blur-md animate-slideUp">
                        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-blue-400 to-transparent" />
                        <div className="p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-blue-500/15 flex items-center justify-center">
                                        <Link2 className="w-3.5 h-3.5 text-blue-400" />
                                    </div>
                                    <span className="text-white font-semibold text-sm">Invite to meeting</span>
                                </div>
                                <button
                                    onClick={() => setShowInvitePopup(false)}
                                    className="w-6 h-6 rounded-full hover:bg-white/10 flex items-center justify-center text-gray-500 hover:text-gray-300 transition-colors"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                                <span className="flex-1 text-gray-400 text-xs font-mono truncate min-w-0">
                                    {typeof window !== "undefined" ? `${window.location.origin}/call/${roomId}` : ""}
                                </span>
                                <button
                                    onClick={copyInviteLink}
                                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${linkCopied
                                        ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                        : "bg-blue-600 hover:bg-blue-500 text-white border border-transparent"
                                        }`}
                                >
                                    {linkCopied ? (<><Check className="w-3 h-3" /> Copied</>) : (<><Copy className="w-3 h-3" /> Copy</>)}
                                </button>
                            </div>
                            <p className="text-gray-600 text-[11px] mt-2">Share this link with people you want in this meeting.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Floating reactions overlay ── */}
            {reactions.map(r => (
                <div
                    key={r.id}
                    className={`absolute z-50 text-4xl pointer-events-none select-none ${r.fromSelf
                            ? "reaction-float-self right-32 sm:right-64 bottom-24"
                            : "reaction-float-peer left-6 bottom-24"
                        }`}
                >
                    {r.emoji}
                </div>
            ))}


            {/* ── Floating controls bar — fixed to bottom, fades in/out ── */}
            <div className={`absolute bottom-0 left-0 right-0 z-40 transition-all duration-500 ${showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-full pointer-events-none"}`}>
                {/* Gradient scrim so buttons are always readable over video */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none" />

                {/* Device picker popup — floats above the controls row */}
                {showDevicePicker && (
                    <div className="absolute bottom-20 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 bg-[#2d2d30]/95 backdrop-blur-md border border-gray-700 rounded-2xl shadow-2xl p-4 sm:w-80 z-50">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-white font-semibold text-sm">Media Settings</h3>
                            <button onClick={() => setShowDevicePicker(false)} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
                        </div>
                        <h3 className="text-gray-400 font-medium text-[10px] uppercase tracking-wider mb-2">Camera</h3>
                        <div className="flex flex-col gap-1.5 mb-5 max-h-32 overflow-y-auto">
                            {videoDevices.map(device => (
                                <button key={device.deviceId} onClick={() => switchDevice(device.deviceId, "video")}
                                    className={`text-left px-3 py-2 rounded-lg text-xs sm:text-sm transition-all ${selectedVideoId === device.deviceId ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-700"}`}>
                                    📷 {device.label || `Camera ${videoDevices.indexOf(device) + 1}`}
                                </button>
                            ))}
                        </div>
                        <h3 className="text-gray-400 font-medium text-[10px] uppercase tracking-wider mb-2">Microphone</h3>
                        <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto">
                            {audioDevices.map(device => (
                                <button key={device.deviceId} onClick={() => switchDevice(device.deviceId, "audio")}
                                    className={`text-left px-3 py-2 rounded-lg text-xs sm:text-sm transition-all ${selectedAudioId === device.deviceId ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-700"}`}>
                                    🎤 {device.label || `Mic ${audioDevices.indexOf(device) + 1}`}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Buttons row */}
                <div className="relative flex items-center justify-center gap-3 sm:gap-4 py-5 px-4">
                    {/* Mic */}
                    <button onClick={toggleMute} className={`p-3 sm:p-4 rounded-full transition-all border ${isMuted ? "bg-[#ea4335] border-transparent hover:bg-red-600 text-white" : "bg-[#3c4043]/90 backdrop-blur-md border-white/10 hover:bg-[#4d5155] text-white shadow-xl"}`}>
                        {isMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
                    </button>

                    {/* Camera */}
                    <button onClick={toggleCamera} className={`p-3 sm:p-4 rounded-full transition-all border ${isCameraOff ? "bg-[#ea4335] border-transparent hover:bg-red-600 text-white" : "bg-[#3c4043]/90 backdrop-blur-md border-white/10 hover:bg-[#4d5155] text-white shadow-xl"}`}>
                        {isCameraOff ? <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Video className="w-5 h-5 sm:w-6 sm:h-6" />}
                    </button>

                    {/* Device picker toggle */}
                    <button onClick={() => setShowDevicePicker(!showDevicePicker)}
                        className={`p-3 sm:p-4 rounded-full transition-all border ${showDevicePicker ? "bg-blue-600 border-transparent text-white" : "bg-[#3c4043]/90 backdrop-blur-md border-white/10 hover:bg-[#4d5155] text-white shadow-xl"}`}
                        title="Switch camera / microphone">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 sm:w-6 sm:h-6">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                        </svg>
                    </button>

                    {/* Screen share — desktop only */}
                    {typeof navigator !== "undefined" &&
                        !!navigator.mediaDevices?.getDisplayMedia &&
                        !/Android|iPhone|iPad/i.test(navigator.userAgent) && (
                            <button onClick={toggleScreenShare}
                                className={`p-3 sm:p-4 rounded-full transition-all border ${isScreenSharing ? "bg-green-600 border-transparent text-white" : "bg-[#3c4043]/90 backdrop-blur-md border-white/10 hover:bg-[#4d5155] text-white shadow-xl"}`}
                                title={isScreenSharing ? "Stop sharing screen" : "Share screen"}>
                                {isScreenSharing ? <MonitorOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Monitor className="w-5 h-5 sm:w-6 sm:h-6" />}
                            </button>
                        )}

                    {/* Invite / info */}
                    <button onClick={() => setShowInvitePopup(!showInvitePopup)}
                        className={`p-3 sm:p-4 rounded-full transition-all border ${showInvitePopup ? "bg-blue-600 border-transparent text-white" : "bg-[#3c4043]/90 backdrop-blur-md border-white/10 hover:bg-[#4d5155] text-white shadow-xl"}`}
                        title="Meeting details">
                        <Info className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>

                    {/* Chat toggle */}
                    <button onClick={() => setShowChat(v => !v)}
                        className={`p-3 sm:p-4 rounded-full transition-all border relative ${showChat ? "bg-blue-600 border-transparent text-white" : "bg-[#3c4043]/90 backdrop-blur-md border-white/10 hover:bg-[#4d5155] text-white shadow-xl"}`}
                        title="Chat">
                        <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6" />
                        {unreadCount > 0 && !showChat && (
                            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-[#101115]">
                                {unreadCount > 9 ? "9+" : unreadCount}
                            </span>
                        )}
                    </button>

                    {remoteConnected && (
                        <div className="relative">
                            <button
                                onClick={() => setShowReactionPicker(v => !v)}
                                className={`p-3 sm:p-4 rounded-full transition-all border text-lg ${showReactionPicker
                                    ? "bg-blue-600 border-transparent text-white"
                                    : "bg-[#3c4043]/90 backdrop-blur-md border-white/10 hover:bg-[#4d5155] text-white shadow-xl"
                                    }`}
                                title="Send reaction"
                            >
                                😊
                            </button>
                            {/* {showReactionPicker && (
                                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2 bg-[#2d2d30]/95 backdrop-blur-md border border-gray-700 rounded-2xl px-3 py-2.5 shadow-2xl z-50">
                                    {REACTION_EMOJIS.map(emoji => (
                                        <button
                                            key={emoji}
                                            onClick={() => sendReaction(emoji)}
                                            className="text-2xl hover:scale-125 transition-transform duration-150 active:scale-95"
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            )} */}
                            {showReactionPicker && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowReactionPicker(false)} />
                                    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2 bg-[#2d2d30]/95 backdrop-blur-md border border-gray-700 rounded-2xl px-3 py-2.5 shadow-2xl z-50">
                                        {REACTION_EMOJIS.map(emoji => (
                                            <button
                                                key={emoji}
                                                onClick={(e) => {
                                                    e.stopPropagation(); // prevent backdrop from firing
                                                    sendReaction(emoji);
                                                }}
                                                className="text-2xl hover:scale-125 transition-transform duration-150 active:scale-95"
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                </>

                            )}
                        </div>
                    )}

                    {/* End call */}
                    <button onClick={handleEndCall} className="p-3 sm:p-4 sm:px-7 bg-[#ea4335] hover:bg-red-600 text-white font-medium rounded-full transition-all shadow-xl sm:ml-2 border border-transparent flex items-center gap-2">
                        <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6" />
                        <span className="hidden sm:inline text-sm font-semibold">End</span>
                    </button>
                </div>
            </div>

            {/* ── Toast notification ── */}
            {toast && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-gray-800/90 backdrop-blur-md text-white text-sm px-5 py-2.5 rounded-full shadow-xl z-50 border border-white/10 animate-fadeIn whitespace-nowrap">
                    ✓ {toast}
                </div>
            )}

            {/* ── Chat panel — slides up from bottom on mobile, side panel on desktop ── */}
            {showChat && (
                <>
                    <div className="fixed inset-0 bg-black/50 z-40 sm:hidden" onClick={() => setShowChat(false)} />
                    <div className="flex flex-col bg-[#1e1f22] z-50 fixed bottom-0 left-0 right-0 h-[70vh] rounded-t-2xl border-t border-white/10 sm:top-0 sm:right-0 sm:left-auto sm:bottom-0 sm:h-full sm:w-72 sm:rounded-none sm:border-t-0 sm:border-l sm:border-white/5 animate-slideUp sm:animate-none">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
                            <span className="text-white font-semibold text-sm">
                                Chat {remoteUserName !== "Waiting..." ? `· ${remoteUserName}` : ""}
                            </span>
                            <button onClick={() => setShowChat(false)} className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2" style={{ scrollbarWidth: "thin" }}>
                            {chatMessage.length === 0 && (
                                <div className="text-center text-gray-600 text-sm mt-10">No messages yet. Say hello! 👋</div>
                            )}
                            {chatMessage.map(msg => (
                                <div key={msg.id} className={`flex flex-col ${msg.isSelf ? "items-end" : "items-start"}`}>
                                    <span className="text-[10px] text-gray-600 mb-1 px-1">
                                        {msg.isSelf ? "You" : msg.userName} · {formatTime(msg.timeStamp)}
                                    </span>
                                    <div className={`max-w-[85%] px-3 py-2 text-sm text-white leading-snug break-words ${msg.isSelf ? "bg-blue-600 rounded-2xl rounded-br-sm" : "bg-white/10 rounded-2xl rounded-bl-sm"}`}>
                                        {msg.message}
                                    </div>
                                </div>
                            ))}
                            {peerTyping && (
                                <div className="flex items-start">
                                    <div className="bg-white/10 rounded-2xl rounded-bl-sm px-3 py-2">
                                        <span className="flex items-center gap-1">
                                            {[0, 1, 2].map(i => (
                                                <span key={i} className="inline-block w-1.5 h-1.5 bg-gray-400 rounded-full"
                                                    style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                                            ))}
                                        </span>
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="px-3 py-3 border-t border-white/5 flex gap-2 shrink-0">
                            <input type="text" value={chatInput} onChange={handleChatInput}
                                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                                placeholder={remoteConnected ? "Type a message…" : "Waiting for peer…"}
                                disabled={!remoteConnected}
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none placeholder-gray-600 disabled:opacity-40 focus:border-blue-500 transition-colors"
                            />
                            <button onClick={sendMessage} disabled={!chatInput.trim() || !remoteConnected}
                                className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-white/5 disabled:cursor-not-allowed flex items-center justify-center shrink-0">
                                <Send className="w-4 h-4 text-white" />
                            </button>
                        </div>
                    </div>
                </>
            )}

            <style>{`
                @keyframes bounce {
                    0%, 60%, 100% { transform: translateY(0); }
                    30% { transform: translateY(-4px); }
                }
                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to   { transform: translateY(0); }
                }
                .animate-slideUp {
                    animation: slideUp 0.28s cubic-bezier(0.32, 0.72, 0, 1);
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateX(-50%) translateY(8px); }
                    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.2s ease-out;
                }
                @keyframes reactionFloatLeft {
                    0%   { opacity: 1; transform: translateY(0) translateX(0) scale(1); }
                    20%  { opacity: 1; transform: translateY(-28px) translateX(12px) scale(1.1); }
                    40%  { opacity: 1; transform: translateY(-56px) translateX(-10px) scale(1.15); }
                    60%  { opacity: 1; transform: translateY(-90px) translateX(14px) scale(1.2); }
                    80%  { opacity: 0.6; transform: translateY(-118px) translateX(-8px) scale(1.0); }
                    100% { opacity: 0; transform: translateY(-145px) translateX(6px) scale(0.8); }
                }
                @keyframes reactionFloatRight {
                    0%   { opacity: 1; transform: translateY(0) translateX(0) scale(1); }
                    20%  { opacity: 1; transform: translateY(-28px) translateX(-12px) scale(1.1); }
                    40%  { opacity: 1; transform: translateY(-56px) translateX(10px) scale(1.15); }
                    60%  { opacity: 1; transform: translateY(-90px) translateX(-14px) scale(1.2); }
                    80%  { opacity: 0.6; transform: translateY(-118px) translateX(8px) scale(1.0); }
                    100% { opacity: 0; transform: translateY(-145px) translateX(-6px) scale(0.8); }
                }
                .reaction-float-self {
                    animation: reactionFloatRight 3s ease-in-out forwards;
                }
                .reaction-float-peer {
                    animation: reactionFloatLeft 3s ease-in-out forwards;
                }
            `}</style>
        </div>
    );
}