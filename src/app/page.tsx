"use client";

import { useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthContext } from "@/context/AuthContext";

export default function Home() {
  const { user, loading } = useContext(AuthContext)!;
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    }
  }, [user, loading, router]);

  // Show loading state while checking auth
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans">
      <div className="text-xl font-medium text-zinc-700 animate-pulse">Redirecting...</div>
    </div>
  );
}
