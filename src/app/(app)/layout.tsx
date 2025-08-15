"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading)
    return <div className="h-screen grid place-items-center">Loading...</div>;
  if (!user) return null; // mencegah flicker saat redirect

  return <div className="min-h-screen">{children}</div>;
}
