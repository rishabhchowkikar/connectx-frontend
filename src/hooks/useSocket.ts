import { useEffect, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";

export const useSocket = () => {
    const socketRef = useRef<Socket | null>(null);
    const [socket, setSocket] = useState<Socket | null>(null);

    useEffect(() => {
        const socket_url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";
        const newSocket = io(socket_url, {
            transports: ["websocket"],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        socketRef.current = newSocket;

        newSocket.on("connect", () => {
            console.log(`Socket Connected: ${newSocket.id}`);
            setSocket(newSocket);  // ← Triggers re-render with real socket
        });

        newSocket.on("disconnect", () => {
            console.log("Socket Disconnected");
            setSocket(null);
        });

        return () => {
            newSocket.disconnect();
            socketRef.current = null;
        };
    }, []);

    return socket;
};