"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSocket } from "@/hooks/useSocket"; // ← Import your new hook

export default function CallRoom() {
    const { roomId } = useParams<{ roomId: string }>();
    const router = useRouter();

    const socket = useSocket(); // ← This gives you the socket instance

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);

    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [callStatus, setCallStatus] = useState("Connecting to room...");

    // useEffect(() => {
    //     if (!socket) {
    //         console.warn("Socket not ready yet");
    //         return;
    //     }

    //     console.log("Socket is ready. Joining room:", roomId);

    //     const initializeCall = async () => {
    //         try {
    //             // Get local media
    //             const stream = await navigator.mediaDevices.getUserMedia({
    //                 video: { facingMode: "user" }, // Prefer front camera on mobile
    //                 audio: true,
    //             });

    //             localStreamRef.current = stream;

    //             if (localVideoRef.current) {
    //                 localVideoRef.current.srcObject = stream;
    //             }

    //             // Create peer connection
    //             peerConnectionRef.current = new RTCPeerConnection({
    //                 iceServers: [
    //                     { urls: "stun:stun.l.google.com:19302" },
    //                     { urls: "stun:stun1.l.google.com:19302" },
    //                     { urls: "stun:stun2.l.google.com:19302" },
    //                 ],
    //             });

    //             // Add local tracks
    //             stream.getTracks().forEach((track) => {
    //                 peerConnectionRef.current?.addTrack(track, stream);
    //             });

    //             // Receive remote stream
    //             peerConnectionRef.current.ontrack = (event) => {
    //                 console.log("Remote stream received!");
    //                 if (remoteVideoRef.current) {
    //                     remoteVideoRef.current.srcObject = event.streams[0];
    //                     setCallStatus("Connected");
    //                 }
    //             };

    //             // Send ICE candidates to other peer
    //             peerConnectionRef.current.onicecandidate = (event) => {
    //                 if (event.candidate) {
    //                     console.log("Sending ICE candidate");
    //                     socket.emit("ice-candidate", event.candidate, roomId);
    //                 }
    //             };

    //             // Join the room
    //             socket.emit("join-room", roomId);

    //         } catch (err: any) {
    //             console.error("Media/Peer error:", err.name, err.message);
    //             setCallStatus(`Failed: ${err.name} - ${err.message}`);
    //             alert("Camera/microphone access failed. Please allow it in browser settings.");
    //         }
    //     };

    //     initializeCall();

    //     // ────────────────────────────────────────────────
    //     // Signaling handlers
    //     // ────────────────────────────────────────────────

    //     socket.on("ready", async () => {
    //         console.log("Room is ready – creating offer");
    //         try {
    //             const offer = await peerConnectionRef.current?.createOffer();
    //             await peerConnectionRef.current?.setLocalDescription(offer);
    //             socket.emit("offer", offer, roomId);
    //         } catch (err) {
    //             console.error("Offer creation failed:", err);
    //         }
    //     });

    //     socket.on("offer", async (offer) => {
    //         console.log("Received offer");
    //         try {
    //             await peerConnectionRef.current?.setRemoteDescription(offer);
    //             const answer = await peerConnectionRef.current?.createAnswer();
    //             await peerConnectionRef.current?.setLocalDescription(answer);
    //             socket.emit("answer", answer, roomId);
    //         } catch (err) {
    //             console.error("Answer failed:", err);
    //         }
    //     });

    //     socket.on("answer", async (answer) => {
    //         console.log("Received answer");
    //         try {
    //             await peerConnectionRef.current?.setRemoteDescription(answer);
    //         } catch (err) {
    //             console.error("Set remote answer failed:", err);
    //         }
    //     });

    //     socket.on("ice-candidate", async (candidate) => {
    //         console.log("Received ICE candidate");
    //         try {
    //             await peerConnectionRef.current?.addIceCandidate(candidate);
    //         } catch (err) {
    //             console.error("Add ICE candidate failed:", err);
    //         }
    //     });

    //     socket.on("user-joined", () => {
    //         console.log("Another user joined the room");
    //         setCallStatus("Waiting for connection...");
    //     });

    //     socket.on("room-full", () => {
    //         console.log("Room is full");
    //         alert("Room is full (max 2 users)");
    //         router.push("/dashboard");
    //     });

    //     socket.on("user-disconnected", () => {
    //         console.log("Other user left");
    //         setCallStatus("Other user disconnected");
    //         if (remoteVideoRef.current) {
    //             remoteVideoRef.current.srcObject = null;
    //         }
    //     });

    //     // Cleanup
    //     return () => {
    //         console.log("Cleaning up call room");

    //         // Stop media tracks
    //         if (localStreamRef.current) {
    //             localStreamRef.current.getTracks().forEach((track) => track.stop());
    //             localStreamRef.current = null;
    //         }

    //         // Close peer connection
    //         if (peerConnectionRef.current) {
    //             peerConnectionRef.current.close();
    //             peerConnectionRef.current = null;
    //         }

    //         // Socket cleanup is handled by useSocket hook
    //     };
    // }, [socket, roomId, router]);


    useEffect(() => {
        if (!socket) {
            console.warn("Socket not ready yet");
            return;
        }

        console.log("Socket instance ready for room:", roomId);

        let joined = false; // Prevent duplicate joins

        const joinRoom = () => {
            if (joined) return;
            console.log("Emitting join-room for:", roomId);
            socket.emit("join-room", roomId);
            joined = true;
        };

        // Join immediately if already connected
        if (socket.connected) {
            console.log("Socket already connected → joining now");
            joinRoom();
        } else {
            // Wait for connect event
            const onConnect = () => {
                console.log("Socket connected event fired → joining room");
                joinRoom();
            };
            socket.on("connect", onConnect);

            // Cleanup connect listener
            return () => {
                socket.off("connect", onConnect);
            };
        }

        // Retry join every 3 seconds if not confirmed
        // const retryInterval = setInterval(() => {
        //     if (!joined && socket.connected) {
        //         console.log("Retry join-room (not yet confirmed)");
        //         socket.emit("join-room", roomId);
        //     }
        // }, 3000);

        const initializeCall = async () => {
            try {
                console.log("Starting getUserMedia...");
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "user" },
                    audio: true,
                });

                console.log("Stream acquired! Tracks:", stream.getTracks().length);
                localStreamRef.current = stream;

                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                    console.log("Local video srcObject set successfully");
                } else {
                    console.warn("localVideoRef.current is null!");
                }

                // Create peer connection
                peerConnectionRef.current = new RTCPeerConnection({
                    iceServers: [
                        { urls: "stun:stun.l.google.com:19302" },
                        { urls: "stun:stun1.l.google.com:19302" },
                        { urls: "stun:stun2.l.google.com:19302" },
                    ],
                });

                stream.getTracks().forEach((track) => {
                    peerConnectionRef.current?.addTrack(track, stream);
                });

                peerConnectionRef.current.ontrack = (event) => {
                    console.log("REMOTE STREAM RECEIVED!");
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = event.streams[0];
                        setCallStatus("Connected");
                    }
                };

                peerConnectionRef.current.onicecandidate = (event) => {
                    if (event.candidate) {
                        console.log("Sending ICE candidate");
                        socket.emit("ice-candidate", event.candidate, roomId);
                    }
                };

            } catch (err: any) {
                console.error("getUserMedia or Peer error:", err.name, err.message, err.stack);
                setCallStatus(`Failed: ${err.name} - ${err.message}`);
                alert(`Camera/mic failed: ${err.message}\n\nCheck browser permissions or use HTTPS.`);
            }
        };

        // Run media init
        initializeCall();

        // ────────────────────────────────────────────────
        // Signaling handlers
        // ────────────────────────────────────────────────

        socket.on("ready", async () => {
            console.log("Received 'ready' → creating offer");
            try {
                const offer = await peerConnectionRef.current?.createOffer();
                await peerConnectionRef.current?.setLocalDescription(offer);
                socket.emit("offer", offer, roomId);
            } catch (err) {
                console.error("Offer creation failed:", err);
            }
        });

        socket.on("offer", async (offer) => {
            console.log("Received offer");
            try {
                await peerConnectionRef.current?.setRemoteDescription(offer);
                const answer = await peerConnectionRef.current?.createAnswer();
                await peerConnectionRef.current?.setLocalDescription(answer);
                socket.emit("answer", answer, roomId);
            } catch (err) {
                console.error("Answer failed:", err);
            }
        });

        socket.on("answer", async (answer) => {
            console.log("Received answer");
            try {
                await peerConnectionRef.current?.setRemoteDescription(answer);
            } catch (err) {
                console.error("Set remote answer failed:", err);
            }
        });

        socket.on("ice-candidate", async (candidate) => {
            console.log("Received ICE candidate");
            try {
                await peerConnectionRef.current?.addIceCandidate(candidate);
            } catch (err) {
                console.error("Add ICE candidate failed:", err);
            }
        });

        socket.on("user-joined", () => {
            console.log("Another user joined the room");
            setCallStatus("Waiting for connection...");
        });

        socket.on("room-full", () => {
            console.log("Room is full");
            alert("Room is full (max 2 users)");
            router.push("/dashboard");
        });

        socket.on("user-disconnected", () => {
            console.log("Other user left");
            setCallStatus("Other user disconnected");
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = null;
            }
        });

        // Cleanup
        return () => {
            console.log("Cleaning up call room");

            // clearInterval(retryInterval);

            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) => track.stop());
                localStreamRef.current = null;
            }

            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
                peerConnectionRef.current = null;
            }

            // Socket cleanup handled by useSocket hook
        };
    }, [socket, roomId, router]);

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

            {/* Local video - PIP */}
            <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="absolute bottom-6 right-6 w-44 h-60 rounded-xl border-4 border-white shadow-2xl object-cover z-10"
            />

            {/* Controls */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-5 bg-black/60 backdrop-blur-md px-10 py-5 rounded-full border border-white/20 z-20">
                <button
                    onClick={toggleMute}
                    className={`px-6 py-3 rounded-full font-medium transition-all ${isMuted ? "bg-red-600 hover:bg-red-700 text-white" : "bg-gray-700 hover:bg-gray-600 text-white"
                        }`}
                >
                    {isMuted ? "Unmute" : "Mute"}
                </button>

                <button
                    onClick={toggleCamera}
                    className={`px-6 py-3 rounded-full font-medium transition-all ${isCameraOff ? "bg-red-600 hover:bg-red-700 text-white" : "bg-gray-700 hover:bg-gray-600 text-white"
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

            {/* Status */}
            <div className="absolute top-6 left-6 bg-black/60 text-white px-5 py-2 rounded-full text-sm font-medium backdrop-blur-md border border-white/20 z-20">
                {callStatus} • Room: {roomId?.slice(0, 8)}...
            </div>
        </div>
    );
}