/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";
// import React, { useEffect } from "react";
import React from "react";
import { useEffect, useMemo, useState } from "react";
import { useCopy } from "@/components/CopyProvider";
import type { Role } from "@/components/AuthProvider";
import type { TabDef } from "@/lib/types";

const EDITABLE_ROLES: Role[] = ["sales", "gudang"];
const TAB_OPTIONS: { key: TabDef; label: string }[] = [
  { key: "checklist", label: "Checklist Area" },
  { key: "evaluasi", label: "Evaluasi Tim" },
  { key: "target", label: "Target & Achievement" },
  { key: "sparta", label: "Project Tracking (SPARTA)" },
  { key: "agenda", label: "Agenda & Jadwal" },
  { key: "lampiran", label: "Lampiran" },
  { key: "achievement", label: "Achievement" },
] as any;

export default function CopyManager() {
  const { copy, setCopy } = useCopy();
  const [role, setRole] = useState<Role>("sales");
  const [tab, setTab] = useState<TabDef>("checklist");
  const [title, setTitle] = useState("");
  const [instruction, setInstruction] = useState("");

  // Defaultnya: mulai dari teks admin (via default copy)
  useEffect(() => {
    const cur = copy[tab] ?? {};
    // cur itu hasil merge default admin + override role aktif login.
    // Tapi editor ini untuk menimpa role lain, jadi awalnya ambil dari cur sebagai baseline.
    setTitle(cur.title ?? "");
    setInstruction(cur.instruction ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const header = useMemo(
    () => `${role} • ${TAB_OPTIONS.find((t) => t.key === tab)?.label ?? tab}`,
    [role, tab]
  );

  const onSave = () => {
    setCopy(role, tab, {
      title: title.trim(),
      instruction: instruction.trim(),
    });
    alert(`Teks disimpan untuk ${header}`);
  };

  return (
    <div className="mb-6 bg-white border rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 sm:px-6 py-3 bg-blue-50 border-b flex flex-wrap items-center justify-between gap-3">
        <div className="font-semibold text-slate-800">Role Copy Manager</div>
        <div className="text-xs text-slate-600">
          Superadmin dapat mengubah teks per role
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Judul
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border-slate-300 text-sm bg-white focus:ring-2 focus:ring-blue-500"
              placeholder="mis. Checklist Area (Sales)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Instruksi
            </label>
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              className="w-full rounded-lg border-slate-300 text-sm bg-white focus:ring-2 focus:ring-blue-500"
              placeholder="Instruksi singkat di header tab"
            />
          </div>
        </div>

        <div className="flex items-center justify-end">
          <button
            onClick={onSave}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
          >
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
