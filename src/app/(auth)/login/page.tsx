"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import type { Role } from "@/components/AuthProvider";
import { useAuth } from "@/components/AuthProvider";
import { Lock, LogIn } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

/* =========================
   Akun DEMO (tetap ada)
   ========================= */
const ACCOUNTS: Record<
  string,
  { password: string; role: Role; displayName: string }
> = {
  yessi: {
    password: "admin123",
    role: "admin",
    displayName: "Yessi Aprilliana",
  },
  dewi: { password: "superadmin", role: "superadmin", displayName: "Dewi" },
  andi: { password: "sales789", role: "sales", displayName: "Andi" },
  budi: { password: "gudang321", role: "gudang", displayName: "Budi" },
};

/* =========================
   Supabase browser client
   ========================= */
const supabase =
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )
    : null;

/* Helper */
function toEmail(input: string) {
  const s = input.trim();
  if (!s) return "";
  if (s.includes("@")) return s.toLowerCase();
  const slug =
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 40) || "user";
  return `${slug}@app.local`;
}
function setCookie(name: string, value: string, days = 7) {
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(
    value
  )}; expires=${d.toUTCString()}; path=/; SameSite=Lax`;
}

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [name, setName] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function findAccount(inputName: string) {
    const raw = inputName.trim();
    const keyLower = raw.toLowerCase();
    const firstToken = raw.split(/\s+/)[0]?.toLowerCase() || "";

    return (
      ACCOUNTS[keyLower] ??
      ACCOUNTS[firstToken] ??
      Object.values(ACCOUNTS).find(
        (a) => a.displayName.toLowerCase() === keyLower
      ) ??
      null
    );
  }

  async function trySupabaseLogin(): Promise<
    | { ok: true; displayName: string; role: Role; userId: string }
    | { ok: false; msg?: string }
  > {
    if (!supabase) return { ok: false };

    const email = toEmail(name);
    if (!email || !pass) return { ok: false };

    // 1) auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    if (error || !data.user) {
      return { ok: false, msg: error?.message || "Login gagal" };
    }

    // 2) ambil profile → display_name & role
    const uid = data.user.id;
    const { data: prof } = await supabase
      .from("profiles")
      .select("display_name, role")
      .eq("id", uid)
      .maybeSingle();

    const displayName =
      prof?.display_name ||
      (data.user.user_metadata as any)?.display_name ||
      email.split("@")[0];

    const role = ((prof?.role as Role | undefined) || "admin") as Role;

    // 3) set cookie supaya API superadmin bisa jalan (fallback yang kita pakai)
    setCookie("sitrep-role", role);
    setCookie("sitrep-userid", uid);
    setCookie("sitrep-name", displayName);

    return { ok: true, displayName, role, userId: uid };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // === 1) Coba login via Supabase dulu ===
      const sup = await trySupabaseLogin();
      if (sup.ok) {
        // sinkron ke state lokal sesuai logic-mu
        signIn({ name: sup.displayName, role: sup.role });

        // persist fallback keys (dipakai fitur PDF, dll)
        try {
          localStorage.setItem("sitrep-user-role", sup.role);
          localStorage.setItem("sitrep-user-name", sup.displayName);
          localStorage.removeItem("sitrep-force-account-id");
        } catch {}

        router.push("/" as Route);
        return;
      }

      // === 2) Fallback ke akun DEMO (logika lama) ===
      const acc = findAccount(name);
      if (!acc) {
        setError(sup.msg || "Nama tidak ditemukan.");
        return;
      }
      if (pass !== acc.password) {
        setError("Password salah.");
        return;
      }

      // Simpan ke AuthProvider (logic awal)
      signIn({ name: acc.displayName, role: acc.role });

      // Persist agar fitur lain bisa baca
      try {
        localStorage.setItem("sitrep-user-role", acc.role);
        localStorage.setItem("sitrep-user-name", acc.displayName);
        localStorage.removeItem("sitrep-force-account-id");
      } catch {}

      // Cookie kecil agar API superadmin juga tetap jalan saat demo
      setCookie("sitrep-role", acc.role);
      setCookie("sitrep-userid", `demo:${acc.displayName.toLowerCase()}`);
      setCookie("sitrep-name", acc.displayName);

      router.push("/" as Route);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <header className="w-full bg-gradient-to-b from-blue-800 to-blue-700 text-white shadow">
        <div className="mx-auto max-w-6xl px-3 sm:px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/20 text-xs tracking-wide">
                LEADER
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/20 text-xs tracking-wide">
                MONITORING
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/20 text-xs tracking-wide">
                DAILY
              </span>
            </div>
            <div className="text-[11px] text-blue-100 hidden sm:block">
              Depo:{" "}
              <span className="font-semibold text-white">TULUNGAGUNG</span>
            </div>
          </div>

          <div className="py-6 text-center">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-wide">
              LEADER MONITORING DAILY
            </h1>
            <p className="mt-1 text-sm text-blue-100">
              Template laporan harian leadership | ASTRO Group
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 sm:px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
          <section className="order-2 lg:order-1">
            <div className="rounded-2xl border bg-white shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-800">
                Masuk untuk melanjutkan
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Masukkan <span className="font-medium">Nama</span> dan{" "}
                <span className="font-medium">Password</span>. Sistem akan
                mencoba login ke Supabase terlebih dahulu (akun yang dibuat di
                halaman superadmin). Jika tidak ada, akan pakai akun demo.
              </p>

              <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {[
                  "Checklist Area & Evaluasi",
                  "Project Tracking (SPARTA)",
                  "Agenda & Jadwal",
                  "Lampiran & Rekapan PDF",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2"
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-slate-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="order-1 lg:order-2">
            <div className="rounded-2xl border bg-white shadow-sm p-6">
              <div className="flex items-center gap-2 text-blue-700">
                <Lock className="h-5 w-5" />
                <div className="font-semibold">Login</div>
              </div>

              <form onSubmit={onSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nama / Username
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="mis. Yessi Aprilliana / rafi"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="mt-2 flex gap-2 text-xs">
                    {["Yessi Aprilliana", "Dewi", "Andi", "Budi"].map((n) => (
                      <button
                        type="button"
                        key={n}
                        onClick={() => setName(n)}
                        className="rounded-full border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-50"
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {error && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!name.trim() || !pass || submitting}
                  className={[
                    "inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium",
                    !name.trim() || !pass || submitting
                      ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700",
                  ].join(" ")}
                >
                  <LogIn className="h-5 w-5" />
                  {submitting ? "Memproses…" : "Masuk ke Dashboard"}
                </button>

                <p className="text-xs text-slate-500">
                  * Jika akun dibuat dari halaman superadmin, pakai{" "}
                  <code>{`<username>`}</code> yang kamu input di sana (email
                  internal otomatis <code>{`<username>@app.local`}</code>).
                </p>
              </form>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
