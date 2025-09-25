"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import type { Role } from "@/components/AuthProvider";

type Item = {
  id: string;
  display_name: string;
  role: string;
  created_at: string;
};

export default function UsersPage() {
  // role user aktif ambil dari context (bukan user.role)
  const { user, role } = useAuth();

  const [list, setList] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  // form states
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [formRole, setFormRole] = useState<Role>("admin");
  const [password, setPassword] = useState("");

  // status hapus (row-level)
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      const json = await res.json();
      setLoading(false);
      if (!res.ok) {
        setMsg(json?.error || "Gagal memuat");
        setList([]);
        return;
      }
      setList(json.items || []);
      setMsg(null);
    } catch {
      setLoading(false);
      setMsg("Gagal memuat");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate() {
    setMsg(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username,
          displayName,
          role: formRole,
          password,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(json?.error || "Gagal menambah user");
        return;
      }
      setMsg("User berhasil dibuat.");
      setUsername("");
      setDisplayName("");
      setPassword("");
      await load();
    } catch {
      setMsg("Gagal menambah user");
    }
  }

  async function onDelete(targetId: string, targetName: string) {
    setMsg(null);

    // Cegah hapus diri sendiri
    const isSelf = user?.id === targetId; // <- boolean murni
    if (isSelf) {
      setMsg("Tidak bisa menghapus akun sendiri.");
      return;
    }

    const ok = window.confirm(`Hapus user "${targetName}"?`);
    if (!ok) return;

    try {
      setDeletingId(targetId);
      const res = await fetch(`/api/users/${targetId}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      setDeletingId(null);
      if (!res.ok) {
        setMsg(json?.error || "Gagal menghapus user");
        return;
      }
      setMsg("User terhapus.");
      await load();
    } catch {
      setDeletingId(null);
      setMsg("Gagal menghapus user");
    }
  }

  // Guard akses
  if (!user) return <div className="p-6">Harap login.</div>;
  if (role !== "superadmin")
    return <div className="p-6">Hanya superadmin.</div>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header + tombol kembali */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">User Management</h1>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          ← Kembali
        </Link>
      </div>

      {/* Form tambah user */}
      <div className="rounded-lg border p-4">
        <div className="font-semibold mb-2">Tambah User</div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            className="border rounded-md px-2 py-2"
            placeholder="Username (tanpa spasi)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            className="border rounded-md px-2 py-2"
            placeholder="Nama tampilan"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />

          <select
            className="border rounded-md px-2 py-2"
            value={formRole}
            onChange={(e) => setFormRole(e.target.value as Role)}
          >
            <option value="admin">admin</option>
            <option value="sales">sales</option>
            <option value="gudang">gudang</option>
            <option value="superadmin">superadmin</option>
          </select>

          <input
            type="password"
            className="border rounded-md px-2 py-2"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button
          onClick={onCreate}
          className="mt-3 rounded-md bg-blue-600 text-white px-3 py-2"
        >
          Buat User
        </button>

        {msg && <div className="mt-2 text-sm text-slate-600">{msg}</div>}

        <div className="mt-2 text-xs text-slate-500">
          Email internal otomatis menjadi <code>{`<username>@app.local`}</code>.
        </div>
      </div>

      {/* Daftar user */}
      <div className="mt-6 rounded-lg border p-4">
        <div className="font-semibold mb-2">Daftar User</div>

        {loading ? (
          "Memuat…"
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left p-2">Nama</th>
                <th className="text-left p-2">Role</th>
                <th className="text-left p-2">Dibuat</th>
                <th className="text-left p-2">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((u) => {
                const isSelf = user?.id === u.id; // boolean murni
                const isBusy = deletingId === u.id;
                return (
                  <tr key={u.id}>
                    <td className="p-2">{u.display_name}</td>
                    <td className="p-2">{u.role}</td>
                    <td className="p-2">
                      {new Date(u.created_at).toLocaleString()}
                    </td>
                    <td className="p-2">
                      <button
                        onClick={() => onDelete(u.id, u.display_name)}
                        disabled={Boolean(isBusy || isSelf)}
                        className={[
                          "rounded-md border px-2 py-1 text-xs",
                          isBusy || isSelf
                            ? "text-slate-400 border-slate-200 cursor-not-allowed"
                            : "text-rose-700 border-rose-300 hover:bg-rose-50",
                        ].join(" ")}
                        title={
                          isSelf
                            ? "Tidak bisa menghapus akun sendiri"
                            : "Hapus user"
                        }
                      >
                        {isBusy ? "Menghapus…" : "Hapus"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <tr>
                  <td className="p-2 text-slate-500" colSpan={4}>
                    Belum ada data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
