"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/** ==== Definisi Role/User ==== */
export type Role = "superadmin" | "admin" | "sales" | "gudang";

export type User = {
  id: string;
  name: string;
  role: Role;
};

type AuthContextType = {
  user: User | null;
  role: Role | null;
  signIn: (payload: { name: string; role: Role }) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const STORAGE_KEY = "sitrep-auth";

/** ==== Provider (default export) ==== */
export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);

  // load dari localStorage saat mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {}
  }, []);

  // persist ke localStorage saat berubah
  useEffect(() => {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  }, [user]);

  const signIn: AuthContextType["signIn"] = ({ name, role }) =>
    setUser({ id: crypto.randomUUID(), name, role });

  const signOut = () => setUser(null);

  const value = useMemo<AuthContextType>(
    () => ({ user, role: user?.role ?? null, signIn, signOut }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** ==== Hook akses auth ==== */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam <AuthProvider />");
  return ctx;
}

/** ==== Guard role opsional ==== */
export function RequireRole({
  allow,
  fallback = null,
  children,
}: {
  allow: Role[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { role } = useAuth();
  if (!role || !allow.includes(role)) return <>{fallback}</>;
  return <>{children}</>;
}
