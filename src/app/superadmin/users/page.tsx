// src/app/superadmin/users/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

type Item = {
  id: string;
  display_name: string;
  role: string;
  created_at: string;
};
type Role = "superadmin" | "admin" | "sales" | "gudang";

export default function UsersPage() {
  const { user, role } = useAuth(); // ⬅️ ambil role dari context
  const [list, setList] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  // form
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [urole, setUrole] = useState<Role>("admin");
  const [password, setPassword] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/users");
    const json = await res.json();
    setLoading(false);
    if (!res.ok) return setMsg(json?.error || "Gagal memuat");
    setList(json.items || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate() {
    setMsg(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, displayName, role: urole, password }),
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
  }

  if (!user || !role) return <div className="p-6">Harap login.</div>;
  if (role !== "superadmin")
    return <div className="p-6">Hanya superadmin.</div>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-xl font-bold">User Management</h1>

      <div className="mt-4 rounded-lg border p-4">
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
            value={urole}
            onChange={(e) => setUrole(e.target.value as Role)}
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
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((u) => (
                <tr key={u.id}>
                  <td className="p-2">{u.display_name}</td>
                  <td className="p-2">{u.role}</td>
                  <td className="p-2">
                    {new Date(u.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
