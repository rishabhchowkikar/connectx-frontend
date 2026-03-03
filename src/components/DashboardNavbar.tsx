"use client";

import { useContext } from "react";
import { AuthContext } from "@/context/AuthContext";
import { Video, LogOut } from "lucide-react";

export function DashboardNavbar() {
    const auth = useContext(AuthContext);
    const user = auth?.user;
    const logout = auth?.logout;
    const loading = auth?.loading;

    // Show loading state instead of returning null immediately
    if (loading) {
        return (
            <div className="w-full flex justify-between items-center px-6 py-4 bg-white shrink-0 border-b border-gray-200 shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-600 text-white p-1.5 rounded-lg md:hidden">
                        <Video className="w-5 h-5" />
                    </div>
                    <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight hidden md:block">
                        Dashboard
                    </h1>
                </div>
                <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse"></div>
            </div>
        );
    }

    // Only return null if we're sure there's no user (not loading and no user)
    if (!user) return null;

    return (
        <div className="w-full flex justify-between items-center px-6 py-4 bg-white shrink-0 border-b border-gray-200 shadow-sm z-10">
            <div className="flex items-center gap-3">
                <div className="bg-indigo-600 text-white p-1.5 rounded-lg md:hidden">
                    <Video className="w-5 h-5" />
                </div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight hidden md:block">
                    Dashboard
                </h1>
            </div>

            <div className="flex items-center gap-4 md:gap-6">
                <div className="text-sm font-medium text-slate-500 hidden lg:block bg-slate-50 px-3 py-1.5 rounded-md border border-slate-100">
                    {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>

                <div className="h-8 w-[1px] bg-slate-200 hidden md:block"></div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col text-right hidden md:block">
                            <span className="text-sm font-semibold text-slate-800 leading-tight">{user.name}</span>
                            {/* <span className="text-xs text-slate-500">{user.email}</span> */}
                        </div>
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-200 border-2 border-white ring-2 ring-indigo-50">
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                    </div>

                    <button
                        onClick={logout}
                        title="Sign out"
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2 border border-transparent hover:border-red-100"
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="text-sm font-medium hidden sm:block">Sign out</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
