"use client";

import { useAuth } from "@/components/AuthProvider";

export default function UserTopBar() {
  const { user, role, signOut } = useAuth(); // ⬅️ ambil role di sini

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-700">
          {user ? (
            <>
              Masuk sebagai: <span className="font-medium">{user.name}</span>{" "}
              <span className="text-slate-500">({role ?? "unknown"})</span>
            </>
          ) : (
            <span className="opacity-60">Tidak terautentikasi</span>
          )}
        </div>

        {user && (
          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            title="Keluar"
          >
            Keluar
          </button>
        )}
      </div>
    </div>
  );
}
