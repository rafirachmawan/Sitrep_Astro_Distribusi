/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import type { Role } from "@/components/AuthProvider";
import type { TabDef } from "@/lib/types";
import { getRoleTabContent, setRoleTabContent } from "@/lib/roleContent";

/* ====== Label tab supaya rapi ====== */
const TAB_LABELS: Record<string, string> = {
  checklist: "Checklist Area",
  evaluasi: "Evaluasi Tim",
  target: "Target & Achievement",
  sparta: "Project Tracking (SPARTA)",
  agenda: "Agenda & Jadwal",
  lampiran: "Lampiran",
  achievement: "Achievement",
};

/* ====== Viewer: dipakai oleh sales/gudang ====== */
export function RoleContentViewer({ role, tab }: { role: Role; tab: TabDef }) {
  const label = TAB_LABELS[tab] ?? tab;
  const [content, setContent] = useState("");

  useEffect(() => {
    setContent(getRoleTabContent(role, tab));
  }, [role, tab]);

  if (!content) {
    return (
      <div className="bg-white border rounded-2xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-2">{label}</h3>
        <div className="border rounded-xl p-4 text-center text-slate-600 bg-slate-50">
          Belum ada konten untuk role ini pada tab{" "}
          <span className="font-medium">{label}</span>. Silakan hubungi{" "}
          <span className="font-medium">superadmin</span> untuk mengisi.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-2xl shadow-sm p-6">
      <h3 className="text-lg font-semibold text-slate-800 mb-3">{label}</h3>
      <article className="prose prose-sm max-w-none text-slate-800 whitespace-pre-wrap">
        {content}
      </article>
    </div>
  );
}

/* ====== Editor: hanya superadmin ====== */
const EDITABLE_ROLES: Role[] = ["sales", "gudang"];
const TAB_OPTIONS: { key: TabDef; label: string }[] = [
  { key: "checklist", label: TAB_LABELS.checklist },
  { key: "evaluasi", label: TAB_LABELS.evaluasi },
  { key: "target", label: TAB_LABELS.target },
  { key: "sparta", label: TAB_LABELS.sparta },
  { key: "agenda", label: TAB_LABELS.agenda },
  { key: "lampiran", label: TAB_LABELS.lampiran },
  { key: "achievement", label: TAB_LABELS.achievement },
] as any;

export function RoleContentEditor() {
  const { role: authRole } = useAuth();

  // ✅ Fallback: kalau AuthContext belum terisi saat render pertama,
  // ambil dari localStorage supaya tombol "User Manager" tetap muncul.
  const [myRole, setMyRole] = useState<Role | null>(authRole);
  useEffect(() => {
    if (authRole) {
      setMyRole(authRole);
      return;
    }
    if (typeof window !== "undefined") {
      const r = (localStorage.getItem("sitrep-user-role") || "") as Role | "";
      setMyRole(r || null);
    }
  }, [authRole]);

  const [role, setRole] = useState<Role>("sales");
  const [tab, setTab] = useState<TabDef>("checklist");
  const [value, setValue] = useState("");

  useEffect(() => {
    setValue(getRoleTabContent(role, tab) || "");
  }, [role, tab]);

  const title = useMemo(
    () => `${role} • ${TAB_LABELS[tab] ?? tab}`,
    [role, tab]
  );

  const save = () => {
    setRoleTabContent(role, tab, value.trim());
    alert(`Konten disimpan untuk ${title}`);
  };

  return (
    <div className="mb-6 bg-white border rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 sm:px-6 py-3 bg-blue-50 border-b flex flex-wrap items-center justify-between gap-3">
        <div className="font-semibold text-slate-800">Role Copy Manager</div>

        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-600">
            Superadmin dapat mengubah teks per role
          </div>
          {myRole === "superadmin" && (
            <Link
              href="/superadmin/users"
              className="rounded-lg border px-3 py-1.5 text-sm hover:bg-white"
              title="Kelola akun & role"
            >
              User Manager
            </Link>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full rounded-lg border-slate-300 text-sm bg-white focus:ring-2 focus:ring-blue-500"
            >
              {EDITABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tab
            </label>
            <select
              value={tab}
              onChange={(e) => setTab(e.target.value as TabDef)}
              className="w-full rounded-lg border-slate-300 text-sm bg-white focus:ring-2 focus:ring-blue-500"
            >
              {TAB_OPTIONS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Konten ({title})
          </label>
          <textarea
            rows={6}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Tulis instruksi/SOP/catatan untuk role ini. Dukungan baris baru tampil apa adanya."
            className="w-full rounded-lg border-slate-300 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center justify-end">
          <button
            onClick={save}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
          >
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
