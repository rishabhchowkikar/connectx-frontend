"use client";

import { useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthContext } from "@/context/AuthContext";
import { v4 as uuidv4 } from "uuid";

export default function Dashboard() {
    const { user, logout, loading } = useContext(AuthContext)!;
    const router = useRouter();
    const [roomIdInput, setRoomIdInput] = useState("");

    // Redirect if not authenticated — only after loading is done
    useEffect(() => {
        if (!loading && !user) {
            router.replace("/login"); // replace → cleaner history
        }
    }, [loading, user, router]);

    // Show loading while checking auth
    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
                <div className="text-xl font-medium text-gray-600">Loading...</div>
            </div>
        );
    }

    // If no user → nothing (redirect already triggered)
    if (!user) {
        return null;
    }

    const createRoom = () => {
        const newRoom = uuidv4();
        router.push(`/call/${newRoom}`);
    };

    const joinRoom = () => {
        const trimmed = roomIdInput.trim();
        if (trimmed) {
            router.push(`/call/${trimmed}`);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6 md:p-10">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-10">
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-800">
                        Welcome back, {user.name}
                    </h1>
                    <button
                        onClick={logout}
                        className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                    >
                        Logout
                    </button>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-8 max-w-lg mx-auto">
                    <h2 className="text-2xl font-semibold mb-6 text-center text-gray-800">
                        Start or Join a Call
                    </h2>

                    <div className="space-y-6">
                        <button
                            onClick={createRoom}
                            className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors text-lg"
                        >
                            Create New Room
                        </button>

                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Paste Room ID here"
                                value={roomIdInput}
                                onChange={(e) => setRoomIdInput(e.target.value)}
                                className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <button
                            onClick={joinRoom}
                            disabled={!roomIdInput.trim()}
                            className={`w-full py-4 font-medium rounded-lg text-lg transition-colors ${roomIdInput.trim()
                                ? "bg-blue-600 hover:bg-blue-700 text-white"
                                : "bg-gray-300 text-gray-500 cursor-not-allowed"
                                }`}
                        >
                            Join Room
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}