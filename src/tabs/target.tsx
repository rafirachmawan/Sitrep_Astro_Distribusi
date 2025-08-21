"use client";

import React, { useMemo, useState } from "react";
import { Target as TargetIcon } from "lucide-react";
import type { TargetState, Principal, TargetDeadlines } from "@/lib/types";
import { PRINCIPALS } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import type { Role } from "@/components/AuthProvider";

/* ================= OVERRIDES ================= */
type TargetOverrides = {
  copy?: {
    klaimTitle?: string;
    targetSelesaiLabel?: string;
    weeklyTitle?: string;
    fodksTitle?: string;
    fodksCheckboxLabel?: string;
    deadlineLabel?: string;
  };
  principals?: Record<string, { label?: string }>;
};

const OV_KEY = "sitrep-target-copy-v1";
const ROLES: Role[] = ["admin", "sales", "gudang"];

function readOverrides(role: Role): TargetOverrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`${OV_KEY}:${role}`);
    return raw ? (JSON.parse(raw) as TargetOverrides) : {};
  } catch {
    return {};
  }
}
function writeOverrides(role: Role, v: TargetOverrides) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${OV_KEY}:${role}`, JSON.stringify(v));
}
function patchCopy(
  src: TargetOverrides,
  key: keyof NonNullable<TargetOverrides["copy"]>,
  value: string
): TargetOverrides {
  const copy = { ...(src.copy || {}) };
  copy[key] = value;
  return { ...src, copy };
}
function patchPrincipalLabel(
  src: TargetOverrides,
  principal: Principal,
  label: string
): TargetOverrides {
  const principals = { ...(src.principals || {}) };
  principals[principal] = { ...(principals[principal] || {}), label };
  return { ...src, principals };
}

/* ================= COMPONENT ================= */
export default function TargetAchievement({
  data,
  onChange,
}: {
  data: TargetState;
  onChange: (v: TargetState) => void;
}) {
  const { role } = useAuth();
  const isSuper = role === "superadmin";

  const [targetRole, setTargetRole] = useState<Role>("admin");
  const viewRole = (isSuper ? targetRole : (role as Role)) || "admin";
  const [editMode, setEditMode] = useState(false);
  const [rev, setRev] = useState(0);

  const overrides = useMemo(() => readOverrides(viewRole), [viewRole, rev]);

  const copy = {
    klaimTitle: overrides.copy?.klaimTitle ?? "Penyelesaian Klaim Bulan Ini",
    targetSelesaiLabel:
      overrides.copy?.targetSelesaiLabel ?? "Target Selesai (bulan ini)",
    weeklyTitle:
      overrides.copy?.weeklyTitle ?? "Laporan Penjualan ke Prinsipal Mingguan",
    fodksTitle: overrides.copy?.fodksTitle ?? "Ketepatan Waktu Input FODKS",
    fodksCheckboxLabel:
      overrides.copy?.fodksCheckboxLabel ?? "Tandai jika tepat waktu",
    deadlineLabel: overrides.copy?.deadlineLabel ?? "Deadline",
  };

  const principalLabel = (p: Principal) =>
    overrides.principals?.[p]?.label ?? p;

  const saveCopy = (
    k: keyof NonNullable<TargetOverrides["copy"]>,
    v: string
  ) => {
    const cur = readOverrides(viewRole);
    writeOverrides(viewRole, patchCopy(cur, k, v));
    setRev((x) => x + 1);
  };
  const savePrincipalLabel = (p: Principal, v: string) => {
    const cur = readOverrides(viewRole);
    writeOverrides(viewRole, patchPrincipalLabel(cur, p, v));
    setRev((x) => x + 1);
  };
  const resetOverrides = () => {
    if (!isSuper) return;
    if (!confirm(`Reset pengaturan teks untuk role ${viewRole}?`)) return;
    writeOverrides(viewRole, {});
    setRev((x) => x + 1);
  };

  const toggleKlaim = (p: Principal) =>
    onChange({
      ...data,
      klaimSelesai: { ...data.klaimSelesai, [p]: !data.klaimSelesai[p] },
    });

  const toggleWeekly = (p: Principal, w: number) =>
    onChange({
      ...data,
      weekly: {
        ...data.weekly,
        [p]: data.weekly[p].map((v, i) => (i === w ? !v : v)),
      },
    });

  const INPUT_BASE =
    "w-full rounded-xl border-2 border-slate-300 bg-white text-sm px-3 py-2 text-center placeholder:text-center focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500";

  type DeadlineScope = keyof TargetDeadlines;

  const setDeadline = (scope: DeadlineScope, value: string, p?: Principal) => {
    const next: TargetDeadlines = { ...data.deadlines };
    switch (scope) {
      case "klaim":
        if (!p) break;
        next.klaim = { ...next.klaim, [p]: value };
        break;
      case "weekly":
        if (!p) break;
        next.weekly = { ...next.weekly, [p]: value };
        break;
      case "targetSelesai":
        next.targetSelesai = value;
        break;
      case "fodks":
        next.fodks = value;
        break;
    }
    onChange({ ...data, deadlines: next });
  };

  const getDeadline = (scope: DeadlineScope, p?: Principal): string => {
    switch (scope) {
      case "klaim":
        return data.deadlines.klaim[p as Principal] ?? "";
      case "weekly":
        return data.deadlines.weekly[p as Principal] ?? "";
      case "targetSelesai":
        return data.deadlines.targetSelesai ?? "";
      case "fodks":
        return data.deadlines.fodks ?? "";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-3 sm:px-6 py-4 border-b bg-slate-50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TargetIcon className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-slate-800">
              Target & Achievement
            </h3>
          </div>

          {isSuper && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600">Role:</label>
              <select
                className="rounded-xl border-2 border-slate-300 text-sm bg-white px-2 py-1 text-center focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value as Role)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-blue-600"
                  checked={editMode}
                  onChange={(e) => setEditMode(e.target.checked)}
                />
                Mode Edit
              </label>
              <button
                onClick={resetOverrides}
                className="text-xs px-2 py-1 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50"
                title="Reset override role ini"
              >
                Reset
              </button>
            </div>
          )}
        </div>

        {/* ===== Bagian 1: Klaim selesai ===== */}
        <div className="p-3 sm:p-6">
          <div className="mb-3 text-sm font-semibold text-slate-700 flex items-center gap-2">
            {editMode ? (
              <input
                defaultValue={copy.klaimTitle}
                onBlur={(e) => saveCopy("klaimTitle", e.target.value)}
                className={`${INPUT_BASE} sm:w-[420px]`}
                placeholder="Judul bagian klaim…"
                title="Ubah judul lalu klik di luar untuk menyimpan"
              />
            ) : (
              <span>{copy.klaimTitle}</span>
            )}
            <span className="ml-2 text-xs font-normal text-slate-500">
              (reset setiap awal bulan)
            </span>
          </div>

          <div className="overflow-x-auto">
            {/* penting: min-w agar kolom 3 tidak “hilang” */}
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left py-2 px-2">Jenis</th>
                  <th className="text-left py-2 px-2">Selesai</th>
                  <th className="text-left py-2 px-2">{copy.deadlineLabel}</th>
                </tr>
              </thead>
              <tbody className="divide-y border rounded-xl bg-white">
                {PRINCIPALS.map((p) => (
                  <tr key={p}>
                    <td className="py-3 px-2 font-medium text-slate-800">
                      {editMode ? (
                        <input
                          defaultValue={principalLabel(p)}
                          onBlur={(e) => savePrincipalLabel(p, e.target.value)}
                          className={INPUT_BASE}
                          placeholder={`Nama principal untuk ${p}`}
                          title="Ubah nama tampilan principal lalu klik di luar untuk menyimpan"
                        />
                      ) : (
                        principalLabel(p)
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-blue-600"
                          checked={data.klaimSelesai[p]}
                          onChange={() => toggleKlaim(p)}
                        />
                        <span className="text-sm text-slate-700">Selesai</span>
                      </label>
                    </td>
                    <td className="py-3 px-2">
                      <input
                        type="date"
                        className={INPUT_BASE}
                        value={getDeadline("klaim", p)}
                        onChange={(e) =>
                          setDeadline("klaim", e.target.value, p)
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Target selesai + Deadlinenya (global) */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 mt-5">
            <div className="sm:col-span-8" />
            <div className="sm:col-span-4 space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                {editMode ? (
                  <input
                    defaultValue={copy.targetSelesaiLabel}
                    onBlur={(e) =>
                      saveCopy("targetSelesaiLabel", e.target.value)
                    }
                    className={INPUT_BASE}
                    placeholder="Label Target Selesai…"
                  />
                ) : (
                  copy.targetSelesaiLabel
                )}
              </label>
              <input
                value={data.targetSelesai}
                onChange={(e) =>
                  onChange({ ...data, targetSelesai: e.target.value })
                }
                inputMode="numeric"
                placeholder="mis. 10"
                className={INPUT_BASE}
              />
              <div>
                <span className="block text-sm font-medium text-slate-700 mb-1">
                  {copy.deadlineLabel}
                </span>
                <input
                  type="date"
                  className={INPUT_BASE}
                  value={getDeadline("targetSelesai")}
                  onChange={(e) => setDeadline("targetSelesai", e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Bagian 2: Mingguan ===== */}
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-3 sm:px-6 py-4 border-b bg-slate-50 font-semibold text-slate-800">
          {editMode ? (
            <input
              defaultValue={copy.weeklyTitle}
              onBlur={(e) => saveCopy("weeklyTitle", e.target.value)}
              className={`${INPUT_BASE} sm:w-[520px]`}
              placeholder="Judul bagian mingguan…"
            />
          ) : (
            copy.weeklyTitle
          )}
        </div>
        <div className="p-3 sm:p-6 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left py-2 px-2">Prinsipal</th>
                <th className="text-left py-2 px-2">Minggu 1</th>
                <th className="text-left py-2 px-2">Minggu 2</th>
                <th className="text-left py-2 px-2">Minggu 3</th>
                <th className="text-left py-2 px-2">Minggu 4</th>
                <th className="text-left py-2 px-2">{copy.deadlineLabel}</th>
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {PRINCIPALS.map((p) => (
                <tr key={p}>
                  <td className="py-3 px-2 font-medium text-slate-800">
                    {editMode ? (
                      <input
                        defaultValue={principalLabel(p)}
                        onBlur={(e) => savePrincipalLabel(p, e.target.value)}
                        className={INPUT_BASE}
                        placeholder={`Nama principal untuk ${p}`}
                      />
                    ) : (
                      principalLabel(p)
                    )}
                  </td>
                  {[0, 1, 2, 3].map((w) => (
                    <td key={w} className="py-3 px-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-blue-600"
                        checked={data.weekly[p][w]}
                        onChange={() => toggleWeekly(p, w)}
                      />
                    </td>
                  ))}
                  <td className="py-3 px-2">
                    <input
                      type="date"
                      className={INPUT_BASE}
                      value={getDeadline("weekly", p)}
                      onChange={(e) => setDeadline("weekly", e.target.value, p)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== Bagian 3: FODKS ===== */}
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-3 sm:px-6 py-4 border-b bg-slate-50 font-semibold text-slate-800">
          {editMode ? (
            <input
              defaultValue={copy.fodksTitle}
              onBlur={(e) => saveCopy("fodksTitle", e.target.value)}
              className={`${INPUT_BASE} sm:w-[420px]`}
              placeholder="Judul bagian FODKS…"
            />
          ) : (
            copy.fodksTitle
          )}
        </div>
        <div className="p-3 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              className="h-5 w-5 accent-blue-600"
              checked={data.ketepatanFodks}
              onChange={() =>
                onChange({ ...data, ketepatanFodks: !data.ketepatanFodks })
              }
            />
            {editMode ? (
              <input
                defaultValue={copy.fodksCheckboxLabel}
                onBlur={(e) => saveCopy("fodksCheckboxLabel", e.target.value)}
                className={INPUT_BASE}
                placeholder="Label checkbox…"
              />
            ) : (
              <span className="text-sm text-slate-700">
                {copy.fodksCheckboxLabel}
              </span>
            )}
          </label>

          <div className="sm:col-span-2">
            <span className="block text-sm font-medium text-slate-700 mb-1">
              {copy.deadlineLabel}
            </span>
            <input
              type="date"
              className={INPUT_BASE}
              value={getDeadline("fodks")}
              onChange={(e) => setDeadline("fodks", e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
