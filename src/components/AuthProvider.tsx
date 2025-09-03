"use client";
import React, { createContext, useContext, useMemo, useState } from "react";

export type Role = "admin" | "sales" | "gudang" | "superadmin";

type User = {
  id: string; // WAJIB stabil
  email: string; // boleh dummy
  name: string;
};

type AuthState = {
  role: Role | null;
  user: User | null;
};

type AuthCtx = AuthState & {
  signIn: (v: { name: string; role: Role }) => void;
  signOut: () => void;
};

const LS_KEY = "sitrep-auth";

const AuthContext = createContext<AuthCtx>({
  role: null,
  user: null,
  signIn: () => {},
  signOut: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    if (typeof window === "undefined") return { role: null, user: null };
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? (JSON.parse(raw) as AuthState) : { role: null, user: null };
    } catch {
      return { role: null, user: null };
    }
  });

  const signIn: AuthCtx["signIn"] = ({ name, role }) => {
    const key = name.trim().toLowerCase();
    const next: AuthState = {
      role,
      user: {
        id: `demo:${key}`, // <-- STABIL per nama
        email: `${key}@demo.local`, // <-- dummy tapi stabil
        name,
      },
    };
    setState(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      // bersihkan override kalau ada
      localStorage.removeItem("sitrep-force-account-id");
    }
  };

  const signOut = () => {
    const next: AuthState = { role: null, user: null };
    setState(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    }
  };

  const value = useMemo<AuthCtx>(
    () => ({ ...state, signIn, signOut }),
    [state]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
