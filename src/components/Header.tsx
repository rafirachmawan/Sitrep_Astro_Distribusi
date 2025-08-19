"use client";

import React from "react";
import type { AppState } from "@/lib/types";

export default function Header({
  header,
  onHeaderChange,
}: {
  header: AppState["header"];
  onHeaderChange: (h: AppState["header"]) => void;
}) {
  return (
    <header className="w-full bg-gradient-to-b from-blue-800 to-blue-700 text-white shadow">
      <div className="max-w-6xl mx-auto px-3 sm:px-4">
        <div className="py-6 text-center">
          <div className="inline-flex items-center gap-2 text-sm uppercase tracking-wide opacity-90">
            <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/20">
              LEADER
            </span>
            <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/20">
              MONITORING
            </span>
            <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/20">
              DAILY
            </span>
          </div>

          <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-wide">
            LEADER MONITORING DAILY
          </h1>
          <p className="mt-1 text-sm text-blue-100">
            Template laporan harian leadership | ASTRO Group
          </p>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MetaPill
              label="Nama"
              value={header.leader}
              onEdit={(v) => onHeaderChange({ ...header, leader: v })}
            />
            <MetaPill
              label="Role"
              value={header.target}
              onEdit={(v) => onHeaderChange({ ...header, target: v })}
            />
            <MetaPill
              label="Depo"
              value={header.depo || "TULUNGAGUNG"}
              onEdit={(v) => onHeaderChange({ ...header, depo: v })}
            />
          </div>
        </div>
      </div>
    </header>
  );
}

function MetaPill({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: (v: string) => void;
}) {
  return (
    <div className="bg-white/10 border border-white/15 rounded-xl px-3 py-2 text-center">
      <div className="text-[11px] uppercase tracking-wide text-blue-100">
        {label}
      </div>
      <input
        value={value ?? ""}
        onChange={(e) => onEdit(e.target.value)}
        className="mt-0.5 w-full bg-transparent text-center font-medium outline-none placeholder:text-blue-100/70"
        placeholder="(auto)"
      />
    </div>
  );
}
