"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ListChecks, CalendarDays, Plus, Trash2, Wrench } from "lucide-react";
import type { SpartaState } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import type { Role } from "@/components/AuthProvider";

/* -------------------------- Types -------------------------- */
type TargetRole = Exclude<Role, "superadmin">;

export type ProjectProgress = {
  steps: boolean[];
  progressText: string;
  nextAction: string;
  kendala: string;
};

// pastikan state punya field progress (state baru)
type SpartaStateWithProgress = SpartaState & {
  projectsProgress?: Record<string, ProjectProgress>;
};

// state lama (kompatibilitas)
type LegacyFields = {
  steps?: boolean[];
  deadline?: string;
  progressText?: string;
  nextAction?: string;
};
type SpartaStateAny = SpartaStateWithProgress & LegacyFields;

type ProjectDef = {
  id: string;
  title: string;
  steps: string[];
  deadline: string; // YYYY-MM-DD
  targetRole: TargetRole; // proyek ini untuk role apa
};

/* -------------------------- Catalog (superadmin) -------------------------- */
const CATALOG_KEY = "sitrep-sparta-catalog-v3"; // bump versi
const TARGET_ROLES: TargetRole[] = ["admin", "sales", "gudang"];

function defaultCatalog(): ProjectDef[] {
  return [
    {
      id: "udi",
      title: "Penyelesaian Klaim UDI",
      steps: [
        "Menyelesaikan Q3 2024",
        "Menyelesaikan Q4 2024",
        "Menyelesaikan Q1 2025 (termasuk reward Q1 2025)",
        "Menyelesaikan Q2 2025 (termasuk reward proporsional Q2 2025)",
      ],
      deadline: "",
      targetRole: "admin",
    },
  ];
}

function readCatalog(): ProjectDef[] {
  if (typeof window === "undefined") return defaultCatalog();
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as ProjectDef[];
      // normalisasi bila ada item lama tanpa targetRole
      return arr.map((p) => ({ targetRole: "admin", ...p }));
    }
    // fallback dari versi lama jika ada
    const rawV2 = localStorage.getItem("sitrep-sparta-catalog-v2");
    if (rawV2) {
      const arr = JSON.parse(rawV2) as ProjectDef[];
      return arr.map((p) => ({ targetRole: p.targetRole ?? "admin", ...p }));
    }
    const rawV1 = localStorage.getItem("sitrep-sparta-catalog-v1");
    if (rawV1) {
      const old = JSON.parse(rawV1) as Array<Omit<ProjectDef, "targetRole">>;
      return old.map((p) => ({ ...p, targetRole: "admin" as TargetRole }));
    }
    return defaultCatalog();
  } catch {
    return defaultCatalog();
  }
}
function writeCatalog(items: ProjectDef[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CATALOG_KEY, JSON.stringify(items));
}

/* -------------------------- Util -------------------------- */
// Parse aman untuk "YYYY-MM-DD" sebagai tanggal lokal (hindari offset timezone)
function parseYMD(ymd?: string): Date | null {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDeadlineWithDay(deadline?: string): string | null {
  const dt = parseYMD(deadline);
  if (!dt) return null;
  // Contoh: "Rabu, 20 Agustus 2025"
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(dt);
}

function weekdayNameId(deadline?: string): string | null {
  const dt = parseYMD(deadline);
  if (!dt) return null;
  return new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(dt);
}

function daysLeft(deadline?: string) {
  const d = parseYMD(deadline);
  if (!d) return null;
  const today = new Date();
  const base = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  ).getTime();
  return Math.ceil((d.getTime() - base) / (1000 * 60 * 60 * 24));
}

function clampBoolArray(arr: boolean[] | undefined, len: number): boolean[] {
  const a = Array.isArray(arr) ? arr.slice(0, len) : [];
  while (a.length < len) a.push(false);
  return a;
}

/* -------------------------- Component -------------------------- */
export default function SpartaTracking({
  data,
  onChange,
}: {
  data: SpartaState;
  onChange: (v: SpartaState) => void;
}) {
  const { role } = useAuth();
  const isSuper = role === "superadmin";

  // Catalog global (dikelola superadmin)
  const [catalog, setCatalog] = useState<ProjectDef[]>(readCatalog);
  useEffect(() => writeCatalog(catalog), [catalog]);

  // Toggle kelola proyek (judul, deadline, langkah, target role)
  const [manage, setManage] = useState(false);

  // Superadmin: filter tampilan proyek (lihat sebagai per-role atau semua)
  const [viewRole, setViewRole] = useState<TargetRole | "semua">("semua");

  // Back-compat: migrasi struktur lama → projectsProgress (sekali)
  useEffect(() => {
    const legacy = data as SpartaStateAny;
    if (
      !legacy.projectsProgress &&
      (Array.isArray(legacy.steps) ||
        legacy.deadline ||
        legacy.progressText ||
        legacy.nextAction)
    ) {
      const first = catalog[0];
      if (first) {
        const prog: Record<string, ProjectProgress> = {
          [first.id]: {
            steps: clampBoolArray(legacy.steps, first.steps.length),
            progressText: legacy.progressText ?? "",
            nextAction: legacy.nextAction ?? "",
            kendala: "",
          },
        };
        const nextState: SpartaStateWithProgress = {
          ...(data as object),
          projectsProgress: prog,
        } as SpartaStateWithProgress;
        onChange(nextState as SpartaState);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper get/set progress per proyek (state per user)
  const getProgress = (id: string, stepLen: number): ProjectProgress => {
    const map: Record<string, ProjectProgress> =
      (data as SpartaStateWithProgress).projectsProgress ?? {};
    const cur = map[id] ?? {
      steps: [],
      progressText: "",
      nextAction: "",
      kendala: "",
    };
    return {
      steps: clampBoolArray(cur.steps, stepLen),
      progressText: cur.progressText,
      nextAction: cur.nextAction,
      kendala: cur.kendala ?? "",
    };
  };

  const setProgress = (id: string, patch: Partial<ProjectProgress>) => {
    const prevMap: Record<string, ProjectProgress> =
      (data as SpartaStateWithProgress).projectsProgress ?? {};
    const cur: ProjectProgress = prevMap[id] ?? {
      steps: [],
      progressText: "",
      nextAction: "",
      kendala: "",
    };
    const nextAll: Record<string, ProjectProgress> = {
      ...prevMap,
      [id]: { ...cur, ...patch },
    };
    const nextState: SpartaStateWithProgress = {
      ...(data as object),
      projectsProgress: nextAll,
    } as SpartaStateWithProgress;
    onChange(nextState as SpartaState);
  };

  // --- Actions (kelola proyek, hanya superadmin) ---
  const addProject = () => {
    const p: ProjectDef = {
      id: crypto.randomUUID(),
      title: "Proyek Baru",
      steps: ["Langkah 1", "Langkah 2"],
      deadline: "",
      targetRole: "admin",
    };
    setCatalog((c) => [...c, p]);
  };
  const updateProject = (id: string, patch: Partial<ProjectDef>) =>
    setCatalog((c) => c.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const deleteProject = (id: string) => {
    if (!confirm("Hapus proyek ini?")) return;
    setCatalog((c) => c.filter((x) => x.id !== id));

    const prevMap: Record<string, ProjectProgress> =
      (data as SpartaStateWithProgress).projectsProgress ?? {};
    if (prevMap[id]) {
      const { [id]: _, ...rest } = prevMap;
      const nextState: SpartaStateWithProgress = {
        ...(data as object),
        projectsProgress: rest,
      } as SpartaStateWithProgress;
      onChange(nextState as SpartaState);
    }
  };

  // Edit langkah satu-per-satu (manage mode)
  const updateStepText = (projId: string, idx: number, text: string) => {
    setCatalog((c) =>
      c.map((p) =>
        p.id !== projId
          ? p
          : {
              ...p,
              steps: p.steps.map((s, i) => (i === idx ? text : s)),
            }
      )
    );
  };
  const addStep = (projId: string) => {
    setCatalog((c) =>
      c.map((p) =>
        p.id !== projId ? p : { ...p, steps: [...p.steps, "Langkah baru"] }
      )
    );
  };
  const removeStep = (projId: string, idx: number) => {
    setCatalog((c) =>
      c.map((p) =>
        p.id !== projId
          ? p
          : { ...p, steps: p.steps.filter((_, i) => i !== idx) }
      )
    );
  };

  // Tentukan proyek yang tampil untuk user saat ini
  const visibleCatalog = useMemo(() => {
    if (isSuper) {
      if (viewRole === "semua") return catalog;
      return catalog.filter((p) => p.targetRole === viewRole);
    }
    // non-superadmin: hanya lihat proyek untuk rolenya
    return catalog.filter((p) => p.targetRole === (role as TargetRole));
  }, [catalog, isSuper, viewRole, role]);

  return (
    <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
      <div className="px-3 sm:px-6 py-4 border-b bg-slate-50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-slate-800">
            SPARTA Project Tracking
          </h3>
        </div>

        {isSuper && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Lihat role:</label>
            <select
              className="rounded-md border-slate-300 text-sm"
              value={viewRole}
              onChange={(e) =>
                setViewRole(e.target.value as TargetRole | "semua")
              }
            >
              <option value="semua">Semua</option>
              {TARGET_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <button
              onClick={() => setManage((m) => !m)}
              className={
                "inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border " +
                (manage
                  ? "bg-amber-50 border-amber-300 text-amber-800"
                  : "hover:bg-slate-50")
              }
              title="Kelola daftar proyek (judul, deadline, langkah, role tujuan)"
            >
              <Wrench className="h-4 w-4" />
              Kelola Proyek
            </button>

            {manage && (
              <button
                onClick={addProject}
                className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" /> Tambah Proyek
              </button>
            )}
          </div>
        )}
      </div>

      {/* Daftar Project */}
      <div className="p-3 sm:p-6 space-y-6">
        {visibleCatalog.length === 0 ? (
          <div className="text-sm text-slate-600">
            Belum ada proyek untuk{" "}
            {isSuper && viewRole !== "semua" ? `role ${viewRole}` : "role Anda"}
            .
          </div>
        ) : (
          visibleCatalog.map((proj) => {
            const sisa = daysLeft(proj.deadline || undefined);
            const prog = getProgress(proj.id, proj.steps.length);
            const percent = Math.round(
              (prog.steps.filter(Boolean).length /
                Math.max(1, proj.steps.length)) *
                100
            );
            const formattedDeadline = formatDeadlineWithDay(proj.deadline);
            const weekday = weekdayNameId(proj.deadline);

            return (
              <div
                key={proj.id}
                className="rounded-2xl border bg-white overflow-hidden"
              >
                {/* Header kartu */}
                <div className="px-3 sm:px-4 py-3 border-b bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                  {/* Judul + Deadline + Target Role (editable bila manage mode) */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {manage ? (
                      <input
                        value={proj.title}
                        onChange={(e) =>
                          updateProject(proj.id, { title: e.target.value })
                        }
                        className="rounded-lg border-slate-300 text-sm focus:ring-2 focus:ring-amber-500 min-w-[240px]"
                      />
                    ) : (
                      <div className="font-semibold text-slate-800">
                        {proj.title}
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-sm">
                      <CalendarDays className="h-4 w-4 text-slate-500" />
                      <span className="text-slate-600">Deadline:</span>
                      {manage ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={proj.deadline || ""}
                            onChange={(e) =>
                              updateProject(proj.id, {
                                deadline: e.target.value,
                              })
                            }
                            className="rounded-lg border-slate-300 text-sm focus:ring-2 focus:ring-amber-500"
                          />
                          {weekday && (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                              {weekday}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="font-medium text-slate-800">
                          {formattedDeadline ?? "-"}
                        </span>
                      )}
                    </div>

                    {manage && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-slate-600">Untuk role:</span>
                        <select
                          value={proj.targetRole}
                          onChange={(e) =>
                            updateProject(proj.id, {
                              targetRole: e.target.value as TargetRole,
                            })
                          }
                          className="rounded-md border-slate-300 text-sm focus:ring-2 focus:ring-amber-500"
                        >
                          {TARGET_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Badge sisa waktu */}
                  <div
                    className={
                      "text-sm px-2 py-1 rounded-lg " +
                      (sisa === null
                        ? "bg-slate-100 text-slate-600"
                        : sisa >= 0
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700")
                    }
                  >
                    Sisa waktu:{" "}
                    {sisa === null
                      ? "-"
                      : sisa >= 0
                      ? `${sisa} hari`
                      : `Lewat ${Math.abs(sisa)} hari`}
                  </div>

                  {manage && (
                    <button
                      onClick={() => deleteProject(proj.id)}
                      className="inline-flex items-center gap-2 text-sm px-2.5 py-1.5 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50"
                      title="Hapus proyek"
                    >
                      <Trash2 className="h-4 w-4" /> Hapus
                    </button>
                  )}
                </div>

                {/* Body kartu */}
                <div className="p-3 sm:p-4 space-y-4">
                  {/* Langkah-langkah */}
                  <div>
                    <div className="text-sm font-medium text-slate-700 mb-2">
                      Langkah-Langkah:
                    </div>

                    {manage ? (
                      <div className="space-y-2">
                        {proj.steps.map((text, i) => (
                          <div key={i} className="flex gap-2">
                            <input
                              value={text}
                              onChange={(e) =>
                                updateStepText(proj.id, i, e.target.value)
                              }
                              className="w-full rounded-lg border-slate-300 text-sm focus:ring-2 focus:ring-amber-500"
                              placeholder={`Langkah ${i + 1}`}
                            />
                            <button
                              onClick={() => removeStep(proj.id, i)}
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50"
                              title="Hapus langkah"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => addStep(proj.id)}
                          className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border hover:bg-slate-50"
                        >
                          <Plus className="h-4 w-4" /> Tambah Langkah
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2">
                        {proj.steps.map((text, i) => {
                          const current = prog.steps[i];
                          return (
                            <label
                              key={i}
                              className="flex items-start gap-2 text-sm"
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 mt-0.5 accent-blue-600"
                                checked={current}
                                onChange={() => {
                                  const next = prog.steps.slice();
                                  next[i] = !next[i];
                                  setProgress(proj.id, { steps: next });
                                }}
                              />
                              <span
                                className={
                                  current
                                    ? "line-through text-slate-400"
                                    : "text-slate-800"
                                }
                              >
                                {i + 1}. {text}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Persentase */}
                  <div>
                    <div className="text-sm font-medium text-slate-700 mb-1">
                      Persentase
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="text-sm text-slate-700 w-16 text-right">
                        {percent}%
                      </div>
                    </div>
                  </div>

                  {/* Progress, Next Action, Kendala (hanya saat tidak manage) */}
                  {!manage && (
                    <>
                      <div>
                        <div className="text-sm font-medium text-slate-700 mb-1">
                          Progress
                        </div>
                        <textarea
                          rows={2}
                          value={prog.progressText}
                          onChange={(e) =>
                            setProgress(proj.id, {
                              progressText: e.target.value,
                            })
                          }
                          placeholder="Contoh: sudah selesai sampai Q4 2024…"
                          className="w-full rounded-lg border-slate-300 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <div className="text-sm font-medium text-slate-700 mb-1">
                          Next Action
                        </div>
                        <textarea
                          rows={2}
                          value={prog.nextAction}
                          onChange={(e) =>
                            setProgress(proj.id, {
                              nextAction: e.target.value,
                            })
                          }
                          placeholder="Contoh: besok follow-up ke Pak Adi…"
                          className="w-full rounded-lg border-slate-300 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <div className="text-sm font-medium text-slate-700 mb-1">
                          Kendala
                        </div>
                        <textarea
                          rows={2}
                          value={prog.kendala}
                          onChange={(e) =>
                            setProgress(proj.id, { kendala: e.target.value })
                          }
                          placeholder="Contoh: kendala koordinasi dengan tim logistik…"
                          className="w-full rounded-lg border-slate-300 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
