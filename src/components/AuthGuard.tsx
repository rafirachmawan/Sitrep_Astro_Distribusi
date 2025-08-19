// src/components/AuthGuard.tsx
"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import type { Role } from "./AuthProvider";

export default function AuthGuard({
  children,
  allow, // opsional; kalau tidak diberikan => izinkan semua role
  fallback, // opsional; kalau role tidak diizinkan
}: {
  children: React.ReactNode;
  allow?: Role[];
  fallback?: React.ReactNode;
}) {
  const { user, role } = useAuth();
  const router = useRouter();

  // Wajib login
  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  if (!user) return null; // menunggu redirect

  // Kalau prop allow tidak diisi => izinkan semua role
  if (allow && role && !allow.includes(role)) {
    // Untuk dashboard kita TIDAK mau blok; biarkan DashboardClient yang atur read-only.
    // Kalau kamu butuh blok di halaman tertentu, baru kirim 'allow' & 'fallback'.
    return fallback ? <>{fallback}</> : <>{children}</>;
  }

  return <>{children}</>;
}
