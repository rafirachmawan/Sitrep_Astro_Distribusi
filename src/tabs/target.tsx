"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Target as TargetIcon, Plus, Trash2 } from "lucide-react";
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
  // relabel principal yang sudah ada (base)
  principals?: Record<string, { label?: string }>;
  // principal tambahan (custom) yang bisa ditambah/hapus
  extraPrincipals?: Record<string, { label: string }>;
};

const OV_KEY = "sitrep-target-copy-v2";
const ROLES: Role[] = ["admin", "sales", "gudang"];

// shared key untuk sinkronisasi DEADLINES
const SHARED_DEADLINES_KEY = "sitrep:target:shared-deadlines";

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
  principal: string,
  label: string
): TargetOverrides {
  const principals = { ...(src.principals || {}) };
  principals[principal] = { ...(principals[principal] || {}), label };
  return { ...src, principals };
}
function addExtraPrincipal(
  src: TargetOverrides,
  key: string,
  label: string
): TargetOverrides {
  const extras = { ...(src.extraPrincipals || {}) };
  extras[key] = { label };
  return { ...src, extraPrincipals: extras };
}
function removeExtraPrincipal(
  src: TargetOverrides,
  key: string
): TargetOverrides {
  const extras = { ...(src.extraPrincipals || {}) };
  delete extras[key];
  return { ...src, extraPrincipals: extras };
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

  // daftar principal gabungan: base + custom (berurutan, base dulu)
  const allPrincipals: string[] = useMemo(() => {
    const base = [...PRINCIPALS];
    const extras = Object.keys(overrides.extraPrincipals || {});
    return [...base, ...extras];
  }, [overrides.extraPrincipals]);

  // ambil label tampilan principal
  const principalLabel = (p: string) =>
    overrides.principals?.[p]?.label ??
    overrides.extraPrincipals?.[p]?.label ??
    p;

  const saveCopy = (
    k: keyof NonNullable<TargetOverrides["copy"]>,
    v: string
  ) => {
    const cur = readOverrides(viewRole);
    writeOverrides(viewRole, patchCopy(cur, k, v));
    setRev((x) => x + 1);
  };
  const savePrincipalLabel = (p: string, v: string) => {
    const cur = readOverrides(viewRole);
    writeOverrides(viewRole, patchPrincipalLabel(cur, p, v));
    setRev((x) => x + 1);
  };
  const resetOverrides = () => {
    if (!isSuper) return;
    if (
      !confirm(
        `Reset pengaturan teks & principal custom untuk role ${viewRole}?`
      )
    )
      return;
    writeOverrides(viewRole, {});
    setRev((x) => x + 1);
  };

  const addPrincipal = (key: string, label: string) => {
    if (!isSuper) return;
    const k = key.trim();
    const lbl = label.trim();
    if (!/^p_[a-z0-9\-]+$/i.test(k)) {
      alert(
        'Key principal harus diawali "p_" dan hanya huruf/angka/dash. Contoh: p_new'
      );
      return;
    }
    if (!lbl) {
      alert("Label tidak boleh kosong");
      return;
    }
    const cur = readOverrides(viewRole);
    writeOverrides(viewRole, addExtraPrincipal(cur, k, lbl));
    setRev((x) => x + 1);

    // siapkan slot data di state jika belum ada
    const nextWeeklyMap = {
      ...(data.weekly as unknown as Record<string, boolean[]>),
    };
    if (!nextWeeklyMap[k]) nextWeeklyMap[k] = [false, false, false, false];

    const nextKlaimMap = {
      ...(data.klaimSelesai as unknown as Record<string, boolean>),
    };
    if (typeof nextKlaimMap[k] === "undefined") nextKlaimMap[k] = false;

    const nextDeadlines = { ...(data.deadlines as TargetDeadlines) };
    const nextKlaimDL = {
      ...(nextDeadlines.klaim as unknown as Record<string, string>),
    };
    if (!nextKlaimDL[k]) nextKlaimDL[k] = "";
    const nextWeeklyDL = {
      ...(nextDeadlines.weekly as unknown as Record<string, string>),
    };
    if (!nextWeeklyDL[k]) nextWeeklyDL[k] = "";
    onChange({
      ...data,
      weekly: nextWeeklyMap as unknown as TargetState["weekly"],
      klaimSelesai: nextKlaimMap as unknown as TargetState["klaimSelesai"],
      deadlines: {
        ...nextDeadlines,
        klaim: nextKlaimDL as unknown as TargetDeadlines["klaim"],
        weekly: nextWeeklyDL as unknown as TargetDeadlines["weekly"],
      },
    });
  };

  const removePrincipal = (key: string) => {
    if (!isSuper) return;
    if (!confirm(`Hapus principal ${key}?`)) return;
    const cur = readOverrides(viewRole);
    writeOverrides(viewRole, removeExtraPrincipal(cur, key));
    setRev((x) => x + 1);
    // Catatan: data state tidak dihapus agar tidak kehilangan histori – bisa ditangani sesuai kebutuhan.
  };

  const toggleKlaim = (p: string) => {
    const cur = {
      ...(data.klaimSelesai as unknown as Record<string, boolean>),
    };
    cur[p] = !cur[p];
    onChange({
      ...data,
      klaimSelesai: cur as unknown as TargetState["klaimSelesai"],
    });
  };

  const toggleWeekly = (p: string, w: number) => {
    const cur = { ...(data.weekly as unknown as Record<string, boolean[]>) };
    const arr = cur[p] ? [...cur[p]] : [false, false, false, false];
    arr[w] = !arr[w];
    cur[p] = arr;
    onChange({ ...data, weekly: cur as unknown as TargetState["weekly"] });
  };

  // styling input konsisten
  const INPUT_BASE =
    "w-full rounded-xl border-2 border-slate-300 bg-white text-sm px-3 py-2 text-center placeholder:text-center focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500";
  const INPUT_DISABLED =
    "opacity-60 cursor-not-allowed bg-slate-50 text-slate-500";

  type DeadlineScope = keyof TargetDeadlines;

  const setDeadline = (scope: DeadlineScope, value: string, p?: string) => {
    if (!isSuper) return;
    const next: TargetDeadlines = { ...data.deadlines };
    if (scope === "klaim" && p) {
      const map = { ...(next.klaim as unknown as Record<string, string>) };
      map[p] = value;
      next.klaim = map as unknown as TargetDeadlines["klaim"];
    } else if (scope === "weekly" && p) {
      const map = { ...(next.weekly as unknown as Record<string, string>) };
      map[p] = value;
      next.weekly = map as unknown as TargetDeadlines["weekly"];
    } else if (scope === "targetSelesai") {
      next.targetSelesai = value;
    } else if (scope === "fodks") {
      next.fodks = value;
    }
    onChange({ ...data, deadlines: next });
  };

  const getDeadline = (scope: DeadlineScope, p?: string): string => {
    if (scope === "klaim" && p) {
      return (
        (data.deadlines.klaim as unknown as Record<string, string>)[p] ?? ""
      );
    }
    if (scope === "weekly" && p) {
      return (
        (data.deadlines.weekly as unknown as Record<string, string>)[p] ?? ""
      );
    }
    if (scope === "targetSelesai") return data.deadlines.targetSelesai ?? "";
    if (scope === "fodks") return data.deadlines.fodks ?? "";
    return "";
  };

  /* ================= Sinkronisasi DEADLINES via localStorage ================= */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isSuper) return;
    try {
      localStorage.setItem(
        SHARED_DEADLINES_KEY,
        JSON.stringify(data.deadlines)
      );
    } catch {}
  }, [isSuper, data.deadlines]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const pull = () => {
      try {
        const raw = localStorage.getItem(SHARED_DEADLINES_KEY);
        if (!raw) return;
        const dl = JSON.parse(raw) as TargetDeadlines;
        onChange({
          ...data,
          deadlines: {
            ...data.deadlines,
            targetSelesai: dl.targetSelesai ?? data.deadlines.targetSelesai,
            fodks: dl.fodks ?? data.deadlines.fodks,
            klaim: {
              ...(data.deadlines.klaim as object),
              ...(dl.klaim as object),
            } as TargetDeadlines["klaim"],
            weekly: {
              ...(data.deadlines.weekly as object),
              ...(dl.weekly as object),
            } as TargetDeadlines["weekly"],
          },
        });
      } catch {}
    };

    if (!isSuper) pull();
    const handler = (e: StorageEvent) => {
      if (e.key === SHARED_DEADLINES_KEY && !isSuper) pull();
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [isSuper, data, onChange]);
  /* =================== akhir sinkronisasi =================== */

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
                className="w-full max-w-[420px] rounded-xl border-2 border-slate-300 bg-white text-sm px-3 py-2 text-center focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
                placeholder="Judul bagian klaim…"
              />
            ) : (
              <span>{copy.klaimTitle}</span>
            )}
            <span className="ml-2 text-xs font-normal text-slate-500">
              (reset setiap awal bulan)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[740px] text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left py-2 px-2">Jenis</th>
                  <th className="text-left py-2 px-2">Selesai</th>
                  <th className="text-left py-2 px-2">{copy.deadlineLabel}</th>
                </tr>
              </thead>
              <tbody className="divide-y border rounded-xl bg-white">
                {allPrincipals.map((p) => (
                  <tr key={p}>
                    <td className="py-3 px-2 font-medium text-slate-800">
                      {editMode ? (
                        <div className="flex gap-2 items-center">
                          <input
                            defaultValue={principalLabel(p)}
                            onBlur={(e) =>
                              savePrincipalLabel(p, e.target.value)
                            }
                            className="w-full rounded-xl border-2 border-slate-300 bg-white text-sm px-3 py-2 text-center focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
                            placeholder={`Nama principal untuk ${p}`}
                            title="Ubah nama tampilan principal lalu klik di luar untuk menyimpan"
                          />
                          {overrides.extraPrincipals?.[p] && isSuper && (
                            <button
                              onClick={() => removePrincipal(p)}
                              className="px-2 py-1 rounded-md bg-rose-600 text-white"
                              title="Hapus principal custom ini"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ) : (
                        principalLabel(p)
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-blue-600"
                          checked={
                            (
                              data.klaimSelesai as unknown as Record<
                                string,
                                boolean
                              >
                            )[p] || false
                          }
                          onChange={() => toggleKlaim(p)}
                        />
                        <span className="text-sm text-slate-700">Selesai</span>
                      </label>
                    </td>
                    <td className="py-3 px-2">
                      <input
                        type="date"
                        disabled={!isSuper}
                        className={`w-full rounded-xl border-2 border-slate-300 bg-white text-sm px-3 py-2 text-center focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 ${
                          !isSuper
                            ? "opacity-60 cursor-not-allowed bg-slate-50 text-slate-500"
                            : ""
                        }`}
                        value={getDeadline("klaim", p)}
                        onChange={(e) =>
                          setDeadline("klaim", e.target.value, p)
                        }
                        title={
                          !isSuper
                            ? "Hanya superadmin yang dapat mengubah deadline"
                            : ""
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Form tambah principal */}
          {isSuper && editMode && <AddPrincipalForm onAdd={addPrincipal} />}
        </div>
      </div>

      {/* ===== Bagian 2: Mingguan (tanpa deadline per minggu) ===== */}
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-3 sm:px-6 py-4 border-b bg-slate-50 font-semibold text-slate-800">
          {editMode ? (
            <input
              defaultValue={copy.weeklyTitle}
              onBlur={(e) => saveCopy("weeklyTitle", e.target.value)}
              className="w-full max-w-[520px] rounded-xl border-2 border-slate-300 bg-white text-sm px-3 py-2 text-center focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
              placeholder="Judul bagian mingguan…"
            />
          ) : (
            copy.weeklyTitle
          )}
        </div>
        <div className="p-3 sm:p-6 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
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
              {allPrincipals.map((p) => (
                <tr key={p}>
                  <td className="py-3 px-2 font-medium text-slate-800">
                    {principalLabel(p)}
                  </td>
                  {[0, 1, 2, 3].map((w) => (
                    <td key={w} className="py-3 px-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-blue-600"
                        checked={
                          ((
                            data.weekly as unknown as Record<string, boolean[]>
                          )[p] || [false, false, false, false])[w]
                        }
                        onChange={() => toggleWeekly(p, w)}
                      />
                    </td>
                  ))}
                  <td className="py-3 px-2">
                    <input
                      type="date"
                      disabled={!isSuper}
                      className={`w-full rounded-xl border-2 border-slate-300 bg-white text-sm px-3 py-2 text-center focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 ${
                        !isSuper
                          ? "opacity-60 cursor-not-allowed bg-slate-50 text-slate-500"
                          : ""
                      }`}
                      value={getDeadline("weekly", p)}
                      onChange={(e) => setDeadline("weekly", e.target.value, p)}
                      title={
                        !isSuper
                          ? "Hanya superadmin yang dapat mengubah deadline"
                          : ""
                      }
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
              className="w-full max-w-[420px] rounded-xl border-2 border-slate-300 bg-white text-sm px-3 py-2 text-center focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
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
                className="w-full rounded-xl border-2 border-slate-300 bg-white text-sm px-3 py-2 text-center focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
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
              disabled={!isSuper}
              className={`w-full rounded-xl border-2 border-slate-300 bg-white text-sm px-3 py-2 text-center focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 ${
                !isSuper
                  ? "opacity-60 cursor-not-allowed bg-slate-50 text-slate-500"
                  : ""
              }`}
              value={getDeadline("fodks")}
              onChange={(e) => setDeadline("fodks", e.target.value)}
              title={
                !isSuper ? "Hanya superadmin yang dapat mengubah deadline" : ""
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== Form Tambah Principal ===== */
function AddPrincipalForm({
  onAdd,
}: {
  onAdd: (key: string, label: string) => void;
}) {
  const [key, setKey] = useState("p_");
  const [label, setLabel] = useState("");

  return (
    <div className="mt-4 border rounded-xl p-3 bg-blue-50">
      <div className="text-xs font-medium text-blue-800 mb-2">
        Tambah Principal / Jenis Baru
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="rounded-xl border-2 border-blue-200 bg-white text-sm px-3 py-2 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
          placeholder="Key unik (contoh: p_klaim-baru)"
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="rounded-xl border-2 border-blue-200 bg-white text-sm px-3 py-2 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
          placeholder="Label tampilan"
        />
        <button
          onClick={() => {
            onAdd(key, label);
            setKey("p_");
            setLabel("");
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Tambah
        </button>
      </div>
      <div className="text-[11px] text-blue-800 mt-1">
        Gunakan prefix <code>p_</code> untuk principal custom.
      </div>
    </div>
  );
}
