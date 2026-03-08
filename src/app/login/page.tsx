"use client";

import { useState, useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthContext } from "@/context/AuthContext";
import Link from "next/link";
import { GoogleLogin } from "@react-oauth/google";

export default function LoginPage() {
    const { login, googleAuth, error, clearError, user, loading } = useContext(AuthContext)!;
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // Redirect if already logged in (client-side check)
    useEffect(() => {
        if (!loading && user) {
            router.replace("/dashboard");
        }
    }, [user, loading, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        clearError();

        try {
            await login(email.trim(), password);
            // After successful login, redirect to dashboard
            // Use window.location for full page reload to ensure cookie is set
            window.location.href = "/dashboard";
        } catch (err) {
            // error is already set in context
            setSubmitting(false);
        }
    };
    const handleGoogleSuccess = async (credentialResponse: any) => {
        clearError();
        try {
            await googleAuth(credentialResponse.credential);
            window.location.href = '/dashboard'
        } catch (error) {

        }
    }

    const handleGoogleError = () => {
        console.error("Google Sign In Failed");
    };

    // Middleware handles auth redirects, so we can show the form immediately
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 px-4">
            <div className="w-full max-w-md bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-gray-100">
                <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">
                    Welcome Back
                </h2>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-center text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email
                        </label>
                        <input
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 border text-black border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Password
                        </label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 border text-black border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            required
                            autoComplete="current-password"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className={`w-full py-3 px-4 bg-indigo-600 text-white font-medium rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all ${submitting ? "opacity-70 cursor-not-allowed" : ""
                            }`}
                    >
                        {submitting ? "Signing in..." : "Login"}
                    </button>
                </form>
                {/* ── OR Divider ── */}
                <div className="flex items-center my-6">
                    <div className="flex-1 h-px bg-gray-200"></div>
                    <span className="px-4 text-sm text-gray-400 font-medium">OR</span>
                    <div className="flex-1 h-px bg-gray-200"></div>
                </div>
                {/* ── Google Sign In Button ── */}
                <div className="flex justify-center">
                    <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={handleGoogleError}
                        shape="rectangular"
                        theme="outline"
                        size="large"
                        text="signin_with"
                        width="100%"
                    />
                </div>

                <p className="mt-8 text-center text-gray-600 text-sm">
                    Don't have an account?{" "}
                    <Link href="/register" className="text-indigo-600 hover:text-indigo-800 font-medium">
                        Register here
                    </Link>
                </p>
            </div>
        </div>
    );
}