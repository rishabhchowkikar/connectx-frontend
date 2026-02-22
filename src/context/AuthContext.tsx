"use client";

import React, { createContext, useState, useEffect, ReactNode } from "react";
import { jwtDecode } from "jwt-decode";
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

// const API_BASE = "http://localhost:5001"; // ← your backend port
const API_BASE = process.env.NEXT_PUBLIC_API_URL;

// Create axios instance with baseURL
const api = axios.create({
    baseURL: API_BASE,
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const token = localStorage.getItem("token");

        if (token) {
            try {
                const decoded: any = jwtDecode(token);
                if (decoded.exp * 1000 > Date.now()) {
                    setUser({
                        id: decoded.id,
                        name: decoded.name || "User",
                        email: decoded.email || "",
                    });
                } else {
                    localStorage.removeItem("token");
                }
            } catch (err) {
                console.error("Token decode failed", err);
                localStorage.removeItem("token");
            }
        }
        setLoading(false);
    }, []);

    const register = async (name: string, email: string, password: string) => {
        setError(null);
        try {
            const res = await api.post("/api/auth/register", { name, email, password });
            const { token } = res.data;
            localStorage.setItem("token", token);

            const decoded: any = jwtDecode(token);
            setUser({
                id: decoded.id,
                name: decoded.name || name,
                email: decoded.email || email,
            });
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
            const { token } = res.data;
            localStorage.setItem("token", token);

            const decoded: any = jwtDecode(token);
            setUser({
                id: decoded.id,
                name: decoded.name || "User",
                email: decoded.email || email,
            });
        } catch (err: any) {
            const msg = err.response?.data?.msg || "Invalid email or password";
            setError(msg);
            throw new Error(msg);
        }
    };

    const logout = () => {
        localStorage.removeItem("token");
        setUser(null);
        setError(null);
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