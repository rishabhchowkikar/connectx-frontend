import { useEffect, useRef } from "react";
import io, { Socket } from "socket.io-client";

export const useSocket = () => {
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        const socket_url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001"
        socketRef.current = io(socket_url, {
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        })

        socketRef.current.on('connect', () => {
            console.log(`Socket Connected: ${socketRef.current?.id}`);
        })

        socketRef.current.on('disconnect', () => {
            console.log(`Socket Disconnect`);
        })

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [])
    return socketRef.current
}