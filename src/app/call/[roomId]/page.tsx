"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import io, { Socket } from "socket.io-client";

const SOCKET_URL = "http://10.149.226.168:5001"; // ← CHANGE THIS to your laptop IP:5001 when testing locally
// When deployed → change to "https://your-backend.onrender.com"

let socket: Socket | null = null;

export default function CallRoom() {
    const { roomId } = useParams<{ roomId: string }>();
    const router = useRouter();

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null); // Important for cleanup

    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [callStatus, setCallStatus] = useState("Connecting to room...");

    useEffect(() => {
        // Connect socket
        socket = io(SOCKET_URL, {
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        const initializeCall = async () => {
            try {
                // Get local media
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true,
                });

                localStreamRef.current = stream;

                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }

                // Create peer connection
                peerConnectionRef.current = new RTCPeerConnection({
                    iceServers: [
                        { urls: "stun:stun.l.google.com:19302" },
                        // You can add TURN later when needed
                    ],
                });

                // Add local tracks to peer connection
                stream.getTracks().forEach((track) => {
                    peerConnectionRef.current?.addTrack(track, stream);
                });

                // Receive remote stream
                peerConnectionRef.current.ontrack = (event) => {
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = event.streams[0];
                        setCallStatus("Connected");
                    }
                };

                // ICE candidate forwarding
                peerConnectionRef.current.onicecandidate = (event) => {
                    if (event.candidate) {
                        socket?.emit("ice-candidate", event.candidate, roomId);
                    }
                };

                // Join room
                socket?.emit("join-room", roomId, "user-" + Math.random().toString(36).slice(2));

            } catch (err) {
                console.error("Media / Peer error:", err);
                setCallStatus("Failed to access camera or microphone");
                alert("Please allow camera and microphone access");
            }
        };

        initializeCall();

        // ────────────────────────────────────────────────
        // Socket signaling handlers
        // ────────────────────────────────────────────────

        socket?.on("user-joined", async () => {
            setCallStatus("Other user joined");
            // Create offer (one side initiates)
            try {
                const offer = await peerConnectionRef.current?.createOffer();
                await peerConnectionRef.current?.setLocalDescription(offer);
                socket?.emit("offer", offer, roomId);
            } catch (err) {
                console.error("Offer creation failed:", err);
            }
        });

        socket?.on("offer", async (offer) => {
            try {
                await peerConnectionRef.current?.setRemoteDescription(offer);
                const answer = await peerConnectionRef.current?.createAnswer();
                await peerConnectionRef.current?.setLocalDescription(answer);
                socket?.emit("answer", answer, roomId);
            } catch (err) {
                console.error("Answer failed:", err);
            }
        });

        socket?.on("answer", async (answer) => {
            try {
                await peerConnectionRef.current?.setRemoteDescription(answer);
            } catch (err) {
                console.error("Set remote answer failed:", err);
            }
        });

        socket?.on("ice-candidate", async (candidate) => {
            try {
                await peerConnectionRef.current?.addIceCandidate(candidate);
            } catch (err) {
                console.error("Add ICE candidate failed:", err);
            }
        });

        socket?.on("room-full", () => {
            alert("Room is full (max 2 users)");
            router.push("/dashboard");
        });

        socket?.on("user-disconnected", () => {
            setCallStatus("Other user left the call");
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = null;
            }
        });

        // Cleanup when component unmounts or roomId changes
        return () => {
            // Stop all local media tracks (camera & mic LED off)
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) => {
                    track.stop();
                });
                localStreamRef.current = null;
            }

            // Close peer connection
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
                peerConnectionRef.current = null;
            }

            // Disconnect socket
            if (socket) {
                socket.disconnect();
                socket = null;
            }
        };
    }, [roomId, router]);

    const toggleMute = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!isMuted);
            }
        }
    };

    const toggleCamera = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsCameraOff(!isCameraOff);
            }
        }
    };

    const handleEndCall = () => {
        // Manually stop media before navigation
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => track.stop());
            localStreamRef.current = null;
        }

        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }

        if (socket) {
            socket.disconnect();
            socket = null;
        }

        router.push("/dashboard");
    };

    return (
        <div className="relative h-screen bg-black overflow-hidden">
            {/* Remote video - full screen */}
            <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Local video - picture-in-picture */}
            <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="absolute bottom-6 right-6 w-44 h-60 rounded-xl border-4 border-white shadow-2xl object-cover z-10"
            />

            {/* Controls bar */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-5 bg-black/60 backdrop-blur-md px-10 py-5 rounded-full border border-white/20 z-20">
                <button
                    onClick={toggleMute}
                    className={`px-6 py-3 rounded-full font-medium transition-all ${isMuted
                            ? "bg-red-600 hover:bg-red-700 text-white"
                            : "bg-gray-700 hover:bg-gray-600 text-white"
                        }`}
                >
                    {isMuted ? "Unmute" : "Mute"}
                </button>

                <button
                    onClick={toggleCamera}
                    className={`px-6 py-3 rounded-full font-medium transition-all ${isCameraOff
                            ? "bg-red-600 hover:bg-red-700 text-white"
                            : "bg-gray-700 hover:bg-gray-600 text-white"
                        }`}
                >
                    {isCameraOff ? "Camera On" : "Camera Off"}
                </button>

                <button
                    onClick={handleEndCall}
                    className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-full transition-all shadow-lg"
                >
                    End Call
                </button>
            </div>

            {/* Status indicator */}
            <div className="absolute top-6 left-6 bg-black/60 text-white px-5 py-2 rounded-full text-sm font-medium backdrop-blur-md border border-white/20 z-20">
                {callStatus} • Room: {roomId?.slice(0, 8)}...
            </div>
        </div>
    );
}