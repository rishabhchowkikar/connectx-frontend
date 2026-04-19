import { useEffect, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";

export const useSocket = () => {
    const socketRef = useRef<Socket | null>(null);
    const [socket, setSocket] = useState<Socket | null>(null);

    useEffect(() => {
        const socket_url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";
        const newSocket = io(socket_url, {
            transports: ["websocket", "polling"],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        });

        socketRef.current = newSocket;
        setSocket(newSocket)

        // Client heartbeat — keeps connection alive when tab is backgrounded
        const heartbeat = setInterval(() => {
            if (newSocket.connected) {
                newSocket.emit("ping");
            }
        }, 25000);

        newSocket.on("connect", () => {
            console.log(`Socket Connected: ${newSocket.id}`);
        });

        newSocket.on("disconnect", (reason) => {
            console.log("❌ Socket Disconnected — reason:", reason); // ← reason tells us WHY
            console.log("Socket Disconnected");
            // setSocket(null);
        });

        return () => {
            clearInterval(heartbeat);
            newSocket.disconnect();
            socketRef.current = null;
        };
    }, []);

    return socket;
};