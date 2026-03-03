"use client";

import { useState, useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { Video, Keyboard, ArrowRight } from "lucide-react";
import { AuthContext } from "@/context/AuthContext";

export default function Dashboard() {
    const router = useRouter();
    const { user, loading } = useContext(AuthContext)!;
    const [roomIdInput, setRoomIdInput] = useState("");

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!loading && !user) {
            router.replace("/login");
        }
    }, [user, loading, router]);

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

    // Show loading state while checking auth
    if (loading) {
        return (
            <div className="min-h-full w-full bg-slate-50 flex items-center justify-center">
                <div className="text-xl font-medium text-slate-700 animate-pulse">Loading...</div>
            </div>
        );
    }

    // Don't render if not authenticated (will redirect)
    if (!user) {
        return null;
    }

    return (
        <div className="min-h-full w-full bg-slate-50 flex flex-col font-sans">
            <div className="flex-1 w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between p-6 md:p-12 gap-16">

                {/* Left Side: Actions */}
                <div className="w-full lg:w-[55%] flex flex-col justify-center items-start text-left">
                    <div className="inline-block px-4 py-1.5 bg-indigo-100 text-indigo-700 font-semibold rounded-full text-sm mb-6 border border-indigo-200">
                        🚀 ConnectX Real-Time Video
                    </div>
                    <h2 className="text-4xl md:text-6xl font-extrabold text-slate-900 leading-tight mb-6 tracking-tight">
                        Collaborate <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Instantly.</span> <br className="hidden md:block" />
                        Anytime, anywhere.
                    </h2>
                    <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl leading-relaxed">
                        Create secure, high-definition video rooms in seconds. Experience seamless connection designed for modern teams.
                    </p>

                    <div className="flex flex-col sm:flex-row items-stretch gap-4 w-full max-w-xl">
                        <button
                            onClick={createRoom}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-4 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-3 w-full sm:w-auto hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <Video className="w-5 h-5" />
                            Start Meeting
                        </button>

                        <div className="relative flex items-center w-full flex-1">
                            <div className="absolute left-4 text-slate-400">
                                <Keyboard className="w-5 h-5" />
                            </div>
                            <input
                                type="text"
                                placeholder="Enter room code..."
                                value={roomIdInput}
                                onChange={(e) => setRoomIdInput(e.target.value)}
                                className="w-full pl-12 pr-16 py-4 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-slate-800 bg-white shadow-sm transition-all text-lg"
                                onKeyDown={(e) => e.key === 'Enter' && roomIdInput.trim() && joinRoom()}
                            />
                            <button
                                onClick={joinRoom}
                                disabled={!roomIdInput.trim()}
                                className={`absolute right-2 p-2 rounded-lg transition-all ${roomIdInput.trim()
                                    ? "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                                    : "bg-transparent text-slate-300 cursor-not-allowed"
                                    }`}
                            >
                                <ArrowRight className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Side: Hero Graphic */}
                <div className="w-full lg:w-[45%] flex justify-center items-center relative hidden md:flex">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-tr from-blue-200/40 via-indigo-100/40 to-purple-200/40 blur-3xl rounded-full -z-10"></div>

                    <div className="w-full aspect-square max-w-[500px] relative mt-10 lg:mt-0">
                        {/* Main App Window Mockup */}
                        <div className="absolute inset-0 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col z-20">
                            {/* Window Header */}
                            <div className="h-10 bg-slate-50 border-b border-slate-100 flex items-center px-4 gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                                <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                                <div className="w-3 h-3 rounded-full bg-green-400"></div>
                            </div>
                            {/* Window Body/Video Grid */}
                            <div className="flex-1 p-5 grid grid-cols-2 gap-4 bg-slate-100">
                                <div className="bg-slate-200 rounded-xl overflow-hidden relative shadow-sm border border-slate-200/50">
                                    <div className="absolute bottom-3 left-3 w-8 h-8 rounded-full bg-indigo-500 shadow-md flex justify-center items-center text-white text-xs font-bold ring-2 ring-white">C</div>
                                </div>
                                <div className="bg-slate-300 rounded-xl overflow-hidden relative shadow-sm border border-slate-300/50">
                                    <div className="absolute bottom-3 left-3 w-8 h-8 rounded-full bg-emerald-500 shadow-md flex justify-center items-center text-white text-xs font-bold ring-2 ring-white">M</div>
                                </div>
                                <div className="bg-slate-300 rounded-xl overflow-hidden relative shadow-sm border border-slate-200/50">
                                    <div className="absolute bottom-3 left-3 w-8 h-8 rounded-full bg-amber-500 shadow-md flex justify-center items-center text-white text-xs font-bold ring-2 ring-white">S</div>
                                </div>
                                <div className="bg-slate-200 rounded-xl overflow-hidden relative shadow-sm border border-slate-300/50">
                                    <div className="absolute bottom-3 left-3 w-8 h-8 rounded-full bg-rose-500 shadow-md flex justify-center items-center text-white text-xs font-bold ring-2 ring-white">T</div>
                                </div>
                            </div>
                        </div>

                        {/* Floating visual elements */}
                        <div className="absolute -top-6 -right-6 w-24 h-24 bg-blue-100 rounded-3xl rotate-12 -z-10 mix-blend-multiply opacity-70"></div>
                        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-indigo-100 rounded-full -z-10 mix-blend-multiply opacity-70"></div>
                    </div>
                </div>

            </div>
        </div>
    );
}
