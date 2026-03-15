"use client";

import { useState, useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import {
    Users, Video, Link2, Copy, CheckCheck,
    ArrowRight, Sparkles, Shield, Zap, Globe, X, Plus,
} from "lucide-react";
import { AuthContext } from "@/context/AuthContext";

const FEATURES = [
    {
        icon: <Users className="w-5 h-5" />,
        title: "Up to 10 Participants",
        desc: "Host group sessions with crystal-clear quality.",
        color: "from-violet-500 to-purple-600",
        bg: "bg-violet-50", border: "border-violet-100", text: "text-violet-600",
    },
    {
        icon: <Shield className="w-5 h-5" />,
        title: "Admin Controlled",
        desc: "Host approves who joins — full control over your room.",
        color: "from-emerald-500 to-teal-600",
        bg: "bg-emerald-50", border: "border-emerald-100", text: "text-emerald-600",
    },
    {
        icon: <Zap className="w-5 h-5" />,
        title: "Ultra Low Latency",
        desc: "Real-time communication with sub-100ms delay.",
        color: "from-amber-500 to-orange-500",
        bg: "bg-amber-50", border: "border-amber-100", text: "text-amber-600",
    },
    {
        icon: <Globe className="w-5 h-5" />,
        title: "Works Everywhere",
        desc: "No downloads needed — runs in any modern browser.",
        color: "from-sky-500 to-blue-600",
        bg: "bg-sky-50", border: "border-sky-100", text: "text-sky-600",
    },
];

export default function GroupCallingPage() {
    const router = useRouter();
    const auth = useContext(AuthContext);
    const { user, loading } = auth || {};

    const [roomIdInput, setRoomIdInput] = useState("");
    const [copied, setCopied] = useState(false);
    const [generatedRoom, setGeneratedRoom] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"create" | "join">("create");
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        if (!loading && !user) router.replace("/login");
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="min-h-full w-full flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
                    <p className="text-slate-500 text-sm font-medium">Loading...</p>
                </div>
            </div>
        );
    }

    if (!user) return null;

    const createGroupRoom = async () => {
        setIsCreating(true);
        await new Promise((r) => setTimeout(r, 600));
        // ✅ Format: group_uuid
        const newRoom = `group_${uuidv4()}`;
        setGeneratedRoom(newRoom);
        setIsCreating(false);
    };

    const startNow = () => {
        if (generatedRoom) {
            // ✅ Routes to /group-call/[roomId]
            router.push(`/group-call/${generatedRoom}`);
        }
    };

    const joinRoom = () => {
        const trimmed = roomIdInput.trim();
        if (!trimmed) return;

        // Handle both full URLs and just the room ID
        let roomId = trimmed;
        if (trimmed.includes("/group-call/")) {
            roomId = trimmed.split("/group-call/").pop() || trimmed;
        } else if (trimmed.includes("/call/")) {
            roomId = trimmed.split("/call/").pop() || trimmed;
        }

        router.push(`/group-call/${roomId}`);
    };

    const copyLink = async () => {
        if (!generatedRoom) return;
        const url = `${window.location.origin}/group-call/${generatedRoom}`;
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    return (
        <div className="min-h-full bg-slate-50 pb-16">
            {/* Header */}
            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700 px-6 md:px-12 pt-10 pb-28">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-20 -right-20 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
                    <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-purple-900/20 rounded-full blur-2xl" />
                </div>
                <div className="relative z-10 max-w-4xl">
                    <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm text-white/90 text-xs font-semibold px-3 py-1.5 rounded-full border border-white/20 mb-5">
                        <Sparkles className="w-3.5 h-3.5" />
                        Group Calling — ConnectX
                    </div>
                    <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-3 leading-tight tracking-tight">
                        Meet Together, <span className="text-indigo-200">Anywhere.</span>
                    </h1>
                    <p className="text-indigo-100 text-base md:text-lg max-w-2xl leading-relaxed">
                        Start an instant group video call or join an existing room. Host controls who joins — secure by default.
                    </p>
                </div>
            </div>

            {/* Main Card */}
            <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-8 -mt-20">
                <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                    {/* Tabs */}
                    <div className="flex border-b border-slate-100">
                        <button
                            onClick={() => setActiveTab("create")}
                            className={`flex-1 py-4 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${activeTab === "create"
                                ? "text-indigo-700 border-b-2 border-indigo-600 bg-indigo-50/40"
                                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                                }`}
                        >
                            <Plus className="w-4 h-4" /> Create Room
                        </button>
                        <button
                            onClick={() => setActiveTab("join")}
                            className={`flex-1 py-4 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${activeTab === "join"
                                ? "text-indigo-700 border-b-2 border-indigo-600 bg-indigo-50/40"
                                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                                }`}
                        >
                            <Link2 className="w-4 h-4" /> Join Room
                        </button>
                    </div>

                    <div className="p-6 md:p-8">
                        {/* CREATE TAB */}
                        {activeTab === "create" && (
                            <div className="space-y-6">
                                {!generatedRoom ? (
                                    <div className="flex flex-col items-center text-center py-4">
                                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200 mb-5">
                                            <Users className="w-9 h-9 text-white" />
                                        </div>
                                        <h2 className="text-2xl font-bold text-slate-800 mb-2">Start a Group Call</h2>
                                        <p className="text-slate-500 text-sm max-w-sm mb-8">
                                            Create a new group room instantly. You'll be the host — approve who joins before they enter.
                                        </p>
                                        <button
                                            onClick={createGroupRoom}
                                            disabled={isCreating}
                                            className="inline-flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-violet-700 hover:from-indigo-700 hover:to-violet-800 text-white font-semibold px-8 py-4 rounded-xl shadow-lg shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:scale-100 text-base"
                                        >
                                            {isCreating ? (
                                                <><div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Creating room...</>
                                            ) : (
                                                <><Video className="w-5 h-5" /> Create Group Room</>
                                            )}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-5">
                                        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                                            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                                                <CheckCheck className="w-5 h-5 text-emerald-600" />
                                            </div>
                                            <div>
                                                <p className="text-emerald-800 font-semibold text-sm">Room Created!</p>
                                                <p className="text-emerald-600 text-xs">Share the link below to invite participants.</p>
                                            </div>
                                            <button onClick={() => setGeneratedRoom(null)} className="ml-auto text-emerald-400 hover:text-emerald-600">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Room ID</label>
                                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 font-mono text-slate-700 text-sm tracking-wide break-all">
                                                {generatedRoom}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Invite Link</label>
                                            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3 pr-2">
                                                <Link2 className="w-4 h-4 text-slate-400 shrink-0" />
                                                <span className="text-slate-600 text-xs sm:text-sm truncate flex-1">
                                                    {typeof window !== "undefined" ? `${window.location.origin}/group-call/${generatedRoom}` : ""}
                                                </span>
                                                <button
                                                    onClick={copyLink}
                                                    className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${copied
                                                        ? "bg-emerald-100 text-emerald-700"
                                                        : "bg-white border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 shadow-sm"
                                                        }`}
                                                >
                                                    {copied ? <><CheckCheck className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                            <button
                                                onClick={startNow}
                                                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-700 hover:from-indigo-700 hover:to-violet-800 text-white font-semibold px-6 py-3.5 rounded-xl shadow-md shadow-indigo-200 transition-all text-sm"
                                            >
                                                <Video className="w-4 h-4" /> Start Call Now
                                            </button>
                                            <button
                                                onClick={() => setGeneratedRoom(null)}
                                                className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-6 py-3.5 rounded-xl transition-all text-sm"
                                            >
                                                Create Another
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* JOIN TAB */}
                        {activeTab === "join" && (
                            <div className="space-y-6">
                                <div className="flex flex-col items-center text-center py-2">
                                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-200 mb-5">
                                        <Link2 className="w-9 h-9 text-white" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Join a Room</h2>
                                    <p className="text-slate-500 text-sm max-w-sm mb-8">
                                        Enter the room ID or paste the full invite link. The host will admit you before you enter.
                                    </p>
                                </div>

                                <div className="max-w-md mx-auto w-full">
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Room ID or Link</label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                            <Link2 className="w-4 h-4" />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="e.g. group_8ed7c101-f192-41e4-95ff"
                                            value={roomIdInput}
                                            onChange={(e) => setRoomIdInput(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && roomIdInput.trim() && joinRoom()}
                                            className="w-full pl-10 pr-14 py-4 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-slate-800 bg-white shadow-sm transition-all text-sm"
                                        />
                                        <button
                                            onClick={joinRoom}
                                            disabled={!roomIdInput.trim()}
                                            className={`absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-lg transition-all ${roomIdInput.trim() ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-slate-100 text-slate-300 cursor-not-allowed"}`}
                                        >
                                            <ArrowRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <button
                                        onClick={joinRoom}
                                        disabled={!roomIdInput.trim()}
                                        className="mt-4 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-semibold px-6 py-3.5 rounded-xl shadow-md shadow-blue-200 disabled:shadow-none transition-all text-sm"
                                    >
                                        <Users className="w-4 h-4" /> Join Group Call
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Feature Cards */}
                <div className="mt-10">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-1">
                        Why Group Calling on ConnectX?
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        {FEATURES.map((f) => (
                            <div key={f.title} className={`${f.bg} ${f.border} border rounded-xl p-5 group hover:shadow-md transition-all`}>
                                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${f.color} flex items-center justify-center text-white mb-4 shadow-sm group-hover:scale-110 transition-transform`}>
                                    {f.icon}
                                </div>
                                <h4 className={`font-semibold text-sm ${f.text} mb-1`}>{f.title}</h4>
                                <p className="text-slate-500 text-xs leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}