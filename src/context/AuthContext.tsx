"use client";

import React, { createContext, useState, useEffect, ReactNode } from "react";
import axios from "axios";

interface User {
    id: string;
    name: string;
    email: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    error: string | null;
    register: (name: string, email: string, password: string) => Promise<void>;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    clearError: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

// Create axios instance with baseURL and credentials for cookie-based auth
const api = axios.create({
    baseURL: API_BASE || 'http://localhost:5001', // Fallback for development
    withCredentials: true
});

// Log API base in production for debugging
if (process.env.NODE_ENV === 'production' && !API_BASE) {
    console.error("⚠️ NEXT_PUBLIC_API_URL is not set in production! API calls will fail.");
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ✅ Check authentication status via cookie-based /api/auth/me endpoint
    useEffect(() => {
        const checkUser = async () => {
            try {
                // Check if API_BASE is configured
                if (!API_BASE) {
                    console.error("NEXT_PUBLIC_API_URL is not set! Please configure it in your environment variables.");
                    setUser(null);
                    setLoading(false);
                    return;
                }

                const res = await api.get("/api/auth/me");
                if (res.data && res.data.name) {
                    setUser(res.data);
                } else {
                    console.warn("Auth response missing user data:", res.data);
                    setUser(null);
                }
            } catch (err: any) {
                // Log errors for debugging (especially in production)
                console.error("Auth check failed:", {
                    message: err.message,
                    response: err.response?.data,
                    status: err.response?.status,
                    apiBase: API_BASE,
                    url: err.config?.url
                });
                setUser(null);
            } finally {
                setLoading(false);
            }
        };
        checkUser();
    }, []);

    const register = async (name: string, email: string, password: string) => {
        setError(null);
        try {
            const res = await api.post("/api/auth/register", { name, email, password });
            // Backend sets cookie automatically, just update user from response
            setUser(res.data.user);
        } catch (err: any) {
            const msg = err.response?.data?.msg || "Registration failed. Try again.";
            setError(msg);
            throw new Error(msg);
        }
    };

    const login = async (email: string, password: string) => {
        setError(null);
        try {
            const res = await api.post("/api/auth/login", { email, password });
            // Backend sets cookie automatically, just update user from response
            setUser(res.data.user);
        } catch (err: any) {
            const msg = err.response?.data?.msg || "Invalid email or password";
            setError(msg);
            throw new Error(msg);
        }
    };

    const logout = async () => {
        try {
            await api.post("/api/auth/logout");
        } catch (err) {
            console.error("Logout error", err);
        } finally {
            setUser(null);
            setError(null);
            // Redirect to login after logout
            if (typeof window !== 'undefined') {
                window.location.href = "/login";
            }
        }
    };

    const clearError = () => setError(null);

    return (
        <AuthContext.Provider
            value={{ user, loading, error, register, login, logout, clearError }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = React.useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within an AuthProvider");
    return context;
};