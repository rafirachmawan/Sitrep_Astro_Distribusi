"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import type { Role } from "@/components/AuthProvider";
import { useAuth } from "@/components/AuthProvider";
import { Lock, LogIn } from "lucide-react";

// Demo accounts (mock). Di produksi ganti via API.
const ACCOUNTS: Record<
  string,
  { password: string; role: Role; displayName: string }
> = {
  Yesi: { password: "admin123", role: "admin", displayName: "Yesi" },
  dewi: { password: "superadmin", role: "superadmin", displayName: "Dewi" },
  andi: { password: "sales789", role: "sales", displayName: "Andi" },
  budi: { password: "gudang321", role: "gudang", displayName: "Budi" },
};

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [name, setName] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const key = name.trim().toLowerCase();
    const acc = ACCOUNTS[key];
    if (!acc) return setError("Nama tidak ditemukan.");
    if (pass !== acc.password) return setError("Password salah.");

    setSubmitting(true);
    try {
      // Simpan ke AuthProvider (provider ada di root layout)
      signIn({ name: acc.displayName, role: acc.role });
      router.push("/" as Route);
    } finally {
      setSubmitting(false);
    }
    // ...
    try {
      // Simpan ke AuthProvider
      signIn({ name: acc.displayName, role: acc.role });

      // Opsional: pastikan tidak ada override
      if (typeof window !== "undefined") {
        localStorage.removeItem("sitrep-force-account-id");
      }

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
                Akunmu memiliki role yang sudah dipatenkan. Masukkan{" "}
                <span className="font-medium">Nama</span> dan{" "}
                <span className="font-medium">Password</span>. Setelah berhasil,
                header dashboard otomatis menampilkan <b>Nama</b>, <b>Role</b>,
                dan <b>Depo TULUNGAGUNG</b>.
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
                    Nama
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="mis. Yesi"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="mt-2 flex gap-2 text-xs">
                    {["Yesi", "Dewi", "Andi", "Budi"].map((n) => (
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
                  * Ini tampilan demo. Di produksi, autentikasi sebaiknya lewat
                  API/Server dan password tidak disimpan di front-end.
                </p>
              </form>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
