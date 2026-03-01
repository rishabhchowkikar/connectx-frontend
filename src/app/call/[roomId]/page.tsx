"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSocket } from "@/hooks/useSocket"; // ← Import your new hook
import { Copy, X, Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";
import { AuthContext } from "@/context/AuthContext";

export default function CallRoom() {
    const { roomId } = useParams<{ roomId: string }>();
    const router = useRouter();
    const socket = useSocket();
    const auth = useContext(AuthContext);
    const userName = auth?.user?.name || "Guest";

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);

    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [callStatus, setCallStatus] = useState("Initializing media...");

    // New states for the UI
    const [hasJoined, setHasJoined] = useState(false);
    const [showInvitePopup, setShowInvitePopup] = useState(true);
    const [remoteConnected, setRemoteConnected] = useState(false);
    const [mediaStreamReady, setMediaStreamReady] = useState(false);
    const [remoteUserName, setRemoteUserName] = useState("Waiting...");

    // 1. Initialize local media immediately (for the preview screen)
    useEffect(() => {
        const initMedia = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "user" },
                    audio: true,
                });
                localStreamRef.current = stream;

                // If localVideoRef is already mounted, set it
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }

                setMediaStreamReady(true);
                setCallStatus("Ready to join");
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

    // 2. Re-assign local stream when `hasJoined` changes because the preview video 
    // ref unmounts and mounts a new one in the main call screen
    useEffect(() => {
        if (localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
        }
    }, [hasJoined]);

    // 3. Socket signaling logic ONLY AFTER hasJoined is true
    // useEffect(() => {
    //     if (!hasJoined || !socket || !mediaStreamReady) return;

    //     setCallStatus("Connecting to room...");

    //     const joinRoom = () => {
    //         // socket.emit("join-room", roomId);
    //         socket.emit("join-room", { roomId, userName });
    //     };

    //     if (socket.connected) {
    //         joinRoom();
    //     } else {
    //         const onConnect = () => joinRoom();
    //         socket.on("connect", onConnect);
    //         return () => socket.off("connect", onConnect);
    //     }

    //     // Setup RTCPeerConnection
    //     peerConnectionRef.current = new RTCPeerConnection({
    //         iceServers: [
    //             { urls: "stun:stun.l.google.com:19302" },
    //             { urls: "stun:stun1.l.google.com:19302" },
    //             { urls: "stun:stun2.l.google.com:19302" },
    //         ],
    //     });

    //     if (localStreamRef.current) {
    //         localStreamRef.current.getTracks().forEach((track) => {
    //             peerConnectionRef.current?.addTrack(track, localStreamRef.current!);
    //         });
    //     }

    //     peerConnectionRef.current.ontrack = (event) => {
    //         if (remoteVideoRef.current) {
    //             remoteVideoRef.current.srcObject = event.streams[0];
    //             setCallStatus("Connected");
    //             setRemoteConnected(true);
    //             setShowInvitePopup(false); // hide invite popup when someone joins
    //         }
    //     };

    //     peerConnectionRef.current.onicecandidate = (event) => {
    //         if (event.candidate) {
    //             socket.emit("ice-candidate", event.candidate, roomId);
    //         }
    //     };

    //     // Socket listeners
    //     const handleReady = async () => {
    //         try {
    //             const offer = await peerConnectionRef.current?.createOffer();
    //             await peerConnectionRef.current?.setLocalDescription(offer);
    //             socket.emit("offer", offer, roomId);
    //         } catch (err) {
    //             console.error("Offer creation failed:", err);
    //         }
    //     };

    //     const handleOffer = async (offer: any) => {
    //         try {
    //             await peerConnectionRef.current?.setRemoteDescription(offer);
    //             const answer = await peerConnectionRef.current?.createAnswer();
    //             await peerConnectionRef.current?.setLocalDescription(answer);
    //             socket.emit("answer", answer, roomId);
    //         } catch (err) {
    //             console.error("Answer failed:", err);
    //         }
    //     };

    //     const handleAnswer = async (answer: any) => {
    //         try {
    //             await peerConnectionRef.current?.setRemoteDescription(answer);
    //         } catch (err) {
    //             console.error("Set remote answer failed:", err);
    //         }
    //     };

    //     const handleIceCandidate = async (candidate: any) => {
    //         try {
    //             await peerConnectionRef.current?.addIceCandidate(candidate);
    //         } catch (err) {
    //             console.error("Add ICE candidate failed:", err);
    //         }
    //     };

    //     const handleUserJoined = (joiningUserName: string) => {
    //         // setCallStatus("User joined. Negotiating...");
    //         setRemoteUserName(joiningUserName);
    //         setCallStatus(`${joiningUserName} joined. Negotiating...`);
    //     };

    //     const handleRoomFull = () => {
    //         alert("Room is full (max 2 users)");
    //         router.push("/dashboard");
    //     };

    //     const handleUserDisconnected = () => {
    //         setCallStatus("Other user disconnected");
    //         setRemoteConnected(false);
    //         if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    //     };

    //     socket.on("ready", handleReady);
    //     socket.on("offer", handleOffer);
    //     socket.on("answer", handleAnswer);
    //     socket.on("ice-candidate", handleIceCandidate);
    //     socket.on("user-joined", handleUserJoined);
    //     socket.on("existing-user", (existingUserName: string) => {
    //         setRemoteUserName(existingUserName);
    //     });
    //     socket.on("room-full", handleRoomFull);
    //     socket.on("user-disconnected", handleUserDisconnected);

    //     return () => {
    //         if (peerConnectionRef.current) {
    //             peerConnectionRef.current.close();
    //         }
    //         socket.off("ready", handleReady);
    //         socket.off("offer", handleOffer);
    //         socket.off("answer", handleAnswer);
    //         socket.off("ice-candidate", handleIceCandidate);
    //         socket.off("user-joined", handleUserJoined);
    //         socket.off("room-full", handleRoomFull);
    //         socket.off("user-disconnected", handleUserDisconnected);
    //     };
    // }, [socket, roomId, router, hasJoined, mediaStreamReady]);
    useEffect(() => {
        if (!hasJoined || !socket || !mediaStreamReady) return;

        setCallStatus("Connecting to room...");

        // ✅ Setup RTCPeerConnection FIRST — always
        peerConnectionRef.current = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" },
                { urls: "stun:stun2.l.google.com:19302" },
            ],
        });

        // Add local tracks to peer connection
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => {
                peerConnectionRef.current?.addTrack(track, localStreamRef.current!);
            });
        }

        // When remote stream arrives
        peerConnectionRef.current.ontrack = (event) => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = event.streams[0];
                setCallStatus("Connected");
                setRemoteConnected(true);
                setShowInvitePopup(false);
            }
        };

        // Send ICE candidates to other peer
        peerConnectionRef.current.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("ice-candidate", event.candidate, roomId);
            }
        };

        // ── Socket Handlers ──────────────────────────────────────

        const handleReady = async () => {
            try {
                const offer = await peerConnectionRef.current?.createOffer();
                await peerConnectionRef.current?.setLocalDescription(offer);
                socket.emit("offer", offer, roomId);
            } catch (err) {
                console.error("Offer creation failed:", err);
            }
        };

        const handleOffer = async (offer: any) => {
            try {
                await peerConnectionRef.current?.setRemoteDescription(offer);
                const answer = await peerConnectionRef.current?.createAnswer();
                await peerConnectionRef.current?.setLocalDescription(answer);
                socket.emit("answer", answer, roomId);
            } catch (err) {
                console.error("Answer failed:", err);
            }
        };

        const handleAnswer = async (answer: any) => {
            try {
                await peerConnectionRef.current?.setRemoteDescription(answer);
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

        // ── Register ALL listeners BEFORE joining the room ───────
        socket.on("ready", handleReady);
        socket.on("offer", handleOffer);
        socket.on("answer", handleAnswer);
        socket.on("ice-candidate", handleIceCandidate);
        socket.on("user-joined", handleUserJoined);
        socket.on("existing-user", (name: string) => setRemoteUserName(name));
        socket.on("room-full", handleRoomFull);
        socket.on("user-disconnected", handleUserDisconnected);

        // ── Join room LAST — after everything is ready ────────────
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


    // ======================================
    // UI STREAM: PREVIEW (BEFORE JOINING)
    // ======================================
    if (!hasJoined) {
        return (
            <div className="min-h-screen bg-[#101115] flex flex-col items-center justify-center font-sans text-white p-6">
                <div className="max-w-5xl w-full flex flex-col md:flex-row gap-8 items-center justify-center">
                    {/* Left: Video Preview */}
                    <div className="w-full md:w-[65%] flex flex-col items-center">
                        <div className="relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-800">
                            <video
                                ref={localVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className={`w-full h-full object-cover transform scale-x-[-1] ${isCameraOff ? "hidden" : "block"}`}
                            />
                            {/* {isCameraOff && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                                    <div className="w-24 h-24 rounded-full bg-gray-800 flex items-center justify-center">
                                        <VideoOff className="w-10 h-10 text-gray-400" />
                                    </div>
                                </div>
                            )} */}
                            {/* // ✅ Change to this (Shows first letter of username): */}
                            {isCameraOff && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                                    <div className="w-24 h-24 rounded-full bg-blue-500 shadow-lg flex items-center justify-center">
                                        <span className="text-4xl text-white font-medium">{userName.charAt(0).toUpperCase()}</span>
                                    </div>
                                </div>
                            )}

                            {/* Toolbar below preview */}
                            <div className="absolute bottom-4 left-4 bg-black/60 text-white text-sm px-3 py-1.5 rounded-md backdrop-blur-md">
                                You ({userName})
                            </div>
                            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                                <button
                                    onClick={toggleMute}
                                    className={`p-4 rounded-full transition-all border ${isMuted ? "bg-red-500 hover:bg-red-600 border-transparent text-white" : "bg-gray-800/80 hover:bg-gray-700 border-white/10 backdrop-blur-sm"} `}
                                >
                                    {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                                </button>
                                <button
                                    onClick={toggleCamera}
                                    className={`p-4 rounded-full transition-all border ${isCameraOff ? "bg-red-500 hover:bg-red-600 border-transparent text-white" : "bg-gray-800/80 hover:bg-gray-700 border-white/10 backdrop-blur-sm"} `}
                                >
                                    {isCameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right: Join Info */}
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
        <div className="relative h-screen bg-[#202124] overflow-hidden flex flex-col">
            {/* Top Left Status */}
            <div className="absolute top-4 left-6 flex items-center gap-4 z-20">
                <div className="bg-black/60 text-white px-5 py-2 rounded-lg text-sm font-medium backdrop-blur-md border border-white/10 shadow-sm">
                    {callStatus}
                </div>
            </div>

            {/* Video Container */}
            <div className="flex-1 w-full relative">
                {remoteConnected ? (
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex flex-col items-center">
                            <div className="w-32 h-32 rounded-full border border-gray-700 flex items-center justify-center animate-pulse bg-gray-800/30 mb-6">
                                <div className="text-gray-400 font-medium text-lg">Waiting</div>
                            </div>
                        </div>
                    </div>
                )}

                {remoteConnected && remoteUserName !== "Waiting..." && (
                    <div className="absolute bottom-6 left-6 bg-black/60 text-white text-sm px-3 py-1.5 rounded-md backdrop-blur-md z-10">
                        {remoteUserName}
                    </div>
                )}

                {/* Local PIP Video */}
                <div className="absolute top-4 right-4 z-20 transition-all duration-300">
                    <div className="relative w-64 aspect-video rounded-xl border-2 border-gray-600 shadow-2xl overflow-hidden bg-gray-900 group">
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

            {/* Invite Popup Floating over UI */}
            {!remoteConnected && showInvitePopup && (
                <div className="absolute bottom-24 left-6 bg-white rounded-lg shadow-2xl p-6 w-[360px] z-30 animate-in slide-in-from-bottom-4 duration-300">
                    <div className="flex justify-between items-start mb-4">
                        <h2 className="text-gray-900 font-medium text-lg">Your meeting's ready</h2>
                        <button onClick={() => setShowInvitePopup(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <p className="text-gray-600 text-sm mb-4">
                        Share this meeting link with others you want in the meeting.
                    </p>
                    <div className="bg-gray-100 rounded-md p-3 flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 truncate mr-3">
                            {typeof window !== 'undefined' ? `${window.location.origin}/call/${roomId}` : ''}
                        </span>
                        <button onClick={copyInviteLink} className="text-gray-500 hover:text-gray-800 transition-colors bg-transparent border-none p-2 shrink-0 rounded hover:bg-gray-200">
                            <Copy className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Bottom Controls Bar */}
            <div className="h-24 bg-[#202124] flex items-center justify-center gap-5 z-20 shrink-0 border-t border-gray-800">
                <button
                    onClick={toggleMute}
                    className={`p-4 rounded-full transition-all border ${isMuted ? "bg-[#ea4335] border-transparent hover:bg-red-600 text-white" : "bg-[#3c4043] border-gray-600 hover:bg-[#4d5155] text-white shadow-md"}`}
                >
                    {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>

                <button
                    onClick={toggleCamera}
                    className={`p-4 rounded-full transition-all border ${isCameraOff ? "bg-[#ea4335] border-transparent hover:bg-red-600 text-white" : "bg-[#3c4043] border-gray-600 hover:bg-[#4d5155] text-white shadow-md"}`}
                >
                    {isCameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                </button>

                <button
                    onClick={handleEndCall}
                    className="p-4 px-6 bg-[#ea4335] hover:bg-red-600 text-white font-medium rounded-full transition-all shadow-lg ml-3 border border-transparent flex items-center gap-2"
                >
                    <PhoneOff className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
}