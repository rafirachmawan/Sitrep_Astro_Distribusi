"use client";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

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

/** ----- Helpers sinkron ke server (opsional, tidak wajib ada) ----- */
async function tryFetchMe(): Promise<{
  id: string;
  email: string;
  name: string;
  role: Role;
} | null> {
  const candidates = ["/api/auth/me", "/api/accounts/me"];
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        cache: "no-store",
        credentials: "include",
      });
      if (res.ok) {
        if (res.status === 204) return null;
        const data = await res.json();
        if (data && data.id && data.name && data.role) {
          return {
            id: String(data.id),
            email: String(
              data.email ||
                `${data.name.toLowerCase().replace(/\s+/g, "")}@demo.local`
            ),
            name: String(data.name),
            role: String(data.role) as Role,
          };
        }
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

async function tryServerLogout() {
  const candidates = ["/api/auth/logout", "/api/accounts/logout"];
  for (const url of candidates) {
    try {
      await fetch(url, { method: "POST", credentials: "include" });
      return;
    } catch {
      /* ignore */
    }
  }
}

/* ===== Cookie helpers (fallback agar API server tahu role saat login demo) ===== */
const setCookie = (
  name: string,
  value: string,
  maxAgeSec = 60 * 60 * 24 * 7
) => {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(
    value
  )}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax`;
};
const delCookie = (name: string) => {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
};
/* ----------------------------------------------------------------- */

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // 1) Hydrate dari localStorage (tetap seperti logic awalmu)
  const [state, setState] = useState<AuthState>(() => {
    if (typeof window === "undefined") return { role: null, user: null };
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? (JSON.parse(raw) as AuthState) : { role: null, user: null };
    } catch {
      return { role: null, user: null };
    }
  });

  // 2) Setelah mount, coba override dari session Supabase (jika ada)
  useEffect(() => {
    let alive = true;
    (async () => {
      const serverAcc = await tryFetchMe();
      if (!alive || !serverAcc) return;

      const next: AuthState = {
        role: serverAcc.role,
        user: {
          id: String(serverAcc.id),
          email: serverAcc.email,
          name: serverAcc.name,
        },
      };
      setState(next);

      try {
        localStorage.setItem(LS_KEY, JSON.stringify(next));
        // sinkron fallback keys yang dipakai modul lain (PDF, dll)
        localStorage.setItem("sitrep-user-role", serverAcc.role);
        localStorage.setItem("sitrep-user-name", serverAcc.name);
        localStorage.removeItem("sitrep-force-account-id");
      } catch {}

      // NEW: set cookie fallback juga, supaya /api/users bisa membaca role
      setCookie("sitrep-role", serverAcc.role);
      setCookie("sitrep-name", serverAcc.name);
      setCookie("sitrep-userid", String(serverAcc.id));
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 3) signIn: tetap sesuai punyamu (tanpa cek password)
  const signIn: AuthCtx["signIn"] = ({ name, role }) => {
    const key = name.trim().toLowerCase();
    const next: AuthState = {
      role,
      user: {
        id: `demo:${key}`, // stabil per nama (seperti semula)
        email: `${key}@demo.local`, // dummy tapi konsisten
        name,
      },
    };
    setState(next);

    if (typeof window !== "undefined") {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      // sinkron fallback agar modul lain membacanya juga
      localStorage.setItem("sitrep-user-role", role);
      localStorage.setItem("sitrep-user-name", name);
      localStorage.removeItem("sitrep-force-account-id");

      // NEW: cookie fallback untuk dipakai rute server (mis. /api/users)
      setCookie("sitrep-role", role);
      setCookie("sitrep-name", name);
      setCookie("sitrep-userid", `demo:${key}`);
    }
  };

  // 4) signOut: tetap reset lokal + coba logout server (kalau endpoint ada)
  const signOut = () => {
    const next: AuthState = { role: null, user: null };
    setState(next);

    if (typeof window !== "undefined") {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      localStorage.removeItem("sitrep-user-role");
      localStorage.removeItem("sitrep-user-name");

      // NEW: bersihkan cookie fallback
      delCookie("sitrep-role");
      delCookie("sitrep-name");
      delCookie("sitrep-userid");
    }

    // fire & forget
    tryServerLogout();
  };

  const value = useMemo<AuthCtx>(
    () => ({ ...state, signIn, signOut }),
    [state]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
