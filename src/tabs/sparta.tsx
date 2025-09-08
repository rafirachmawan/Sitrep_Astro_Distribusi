"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ListChecks,
  CalendarDays,
  Plus,
  Trash2,
  Wrench,
  Search,
} from "lucide-react";
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

type SpartaStateWithProgress = SpartaState & {
  projectsProgress?: Record<string, ProjectProgress>;
};
type SpartaStateAny = SpartaStateWithProgress & {
  steps?: boolean[];
  deadline?: string;
  progressText?: string;
  nextAction?: string;
};

type ProjectDef = {
  id: string;
  title: string;
  steps: string[];
  deadline: string;
  targetRole: TargetRole;
};

/* ===== Riwayat (payload yang disimpan di server) ===== */
type HistoryPayload = {
  period: string;
  accountId: string;
  role?: string | null;
  savedBy?: string | null;
  projectsProgress: Record<string, ProjectProgress>;
};

type HistoryRow = {
  id: string;
  created_at: string; // ISO
  account_id: string;
  role: string | null;
  period: string | null;
  payload: HistoryPayload;
};

/* -------------------------- Catalog (superadmin) -------------------------- */
const CATALOG_KEY = "sitrep-sparta-catalog-v3";
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
function normalizeProject(p: Partial<ProjectDef>): ProjectDef {
  return {
    id:
      p.id ??
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2)),
    title: p.title ?? "Proyek",
    steps: Array.isArray(p.steps) ? p.steps : [],
    deadline: p.deadline ?? "",
    targetRole: (p.targetRole ?? "admin") as TargetRole,
  };
}
function readCatalog(): ProjectDef[] {
  if (typeof window === "undefined") return defaultCatalog();
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as Array<Partial<ProjectDef>>;
      return arr.map(normalizeProject);
    }
    const rawV2 = localStorage.getItem("sitrep-sparta-catalog-v2");
    if (rawV2) {
      const arr = JSON.parse(rawV2) as Array<Partial<ProjectDef>>;
      return arr.map(normalizeProject);
    }
    const rawV1 = localStorage.getItem("sitrep-sparta-catalog-v1");
    if (rawV1) {
      const old = JSON.parse(rawV1) as Array<Omit<ProjectDef, "targetRole">>;
      return old.map((p) => normalizeProject({ ...p, targetRole: "admin" }));
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
function parseYMD(ymd?: string): Date | null {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function formatDeadlineWithDay(deadline?: string): string | null {
  const dt = parseYMD(deadline);
  if (!dt) return null;
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
function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function todayYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}
function firstDayThisMonthYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/* -------------------------- Component -------------------------- */
export default function SpartaTracking({
  data,
  onChange,
}: {
  data: SpartaState;
  onChange: (v: SpartaState) => void;
}) {
  const { role, user, name } = useAuth() as {
    role?: Role;
    user?: { id?: string; email?: string };
    name?: string;
  };
  const isSuper = role === "superadmin";

  // ===== Account identity (stabil) =====
  const uid = user?.id || null;
  const email = user?.email || null;
  const FORCE =
    typeof window !== "undefined"
      ? localStorage.getItem("sitrep-force-account-id")
      : null;

  const accountId: string | null = FORCE || email || uid || null; // pakai email lalu uid
  const altId: string | null =
    FORCE || !email || !uid ? null : accountId === email ? uid : email;

  const period = useMemo(currentPeriod, []);

  // Catalog global (dikelola superadmin)
  const [catalog, setCatalog] = useState<ProjectDef[]>(readCatalog);
  useEffect(() => writeCatalog(catalog), [catalog]);

  const [manage, setManage] = useState(false);
  const [viewRole, setViewRole] = useState<TargetRole | "semua">("semua");

  // ====== STATE PROGRESS PER USER (local + sinkron parent) ======
  const localProgress =
    (data as SpartaStateWithProgress).projectsProgress ?? {};

  const [progressMap, setProgressMap] =
    useState<Record<string, ProjectProgress>>(localProgress);

  // jaga parent tetap sync
  useEffect(() => {
    const next: SpartaStateWithProgress = {
      ...(data as object),
      projectsProgress: progressMap,
    } as SpartaStateWithProgress;
    onChange(next as SpartaState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(progressMap)]);

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
        setProgressMap(prog);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper get/set progress per proyek
  const getProgress = (id: string, stepLen: number): ProjectProgress => {
    const cur = progressMap[id] ?? {
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
    setProgressMap((prev) => {
      const cur: ProjectProgress = prev[id] ?? {
        steps: [],
        progressText: "",
        nextAction: "",
        kendala: "",
      };
      return { ...prev, [id]: { ...cur, ...patch } };
    });
  };

  // --- Actions (kelola proyek, hanya superadmin) ---
  const addProject = () => {
    const p: ProjectDef = {
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2),
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
    setProgressMap((prev) => {
      const { [id]: _drop, ...rest } = prev;
      return rest;
    });
  };
  const updateStepText = (projId: string, idx: number, text: string) => {
    setCatalog((c) =>
      c.map((p) =>
        p.id !== projId
          ? p
          : { ...p, steps: p.steps.map((s, i) => (i === idx ? text : s)) }
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

  // proyek yang tampil
  const visibleCatalog = useMemo(() => {
    if (isSuper) {
      if (viewRole === "semua") return catalog;
      return catalog.filter((p) => p.targetRole === viewRole);
    }
    return catalog.filter((p) => p.targetRole === (role as TargetRole));
  }, [catalog, isSuper, viewRole, role]);

  /* ====== LOAD / SAVE KE SERVER (per akun) ====== */
  const [loadStatus, setLoadStatus] = useState<
    "idle" | "loading" | "loaded" | "error"
  >("idle");
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const loadFromServer = useCallback(async () => {
    if (!accountId) return;
    try {
      setLoadStatus("loading");
      const altParam = altId ? `&altId=${encodeURIComponent(altId)}` : "";
      const url = `/api/sparta/progress?accountId=${encodeURIComponent(
        accountId
      )}&period=${period}${altParam}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as {
        projectsProgress?: Record<string, ProjectProgress>;
      };
      if (json.projectsProgress) setProgressMap(json.projectsProgress);
      setLoadStatus("loaded");
    } catch (e) {
      console.error("GET /api/sparta/progress", e);
      setLoadStatus("error");
    }
  }, [accountId, altId, period]);

  useEffect(() => {
    loadFromServer();
  }, [loadFromServer]);

  const saveToServer = async () => {
    if (!accountId) return;
    try {
      setSaveStatus("saving");
      const altParam = altId ? `&altId=${encodeURIComponent(altId)}` : "";
      const url = `/api/sparta/progress?accountId=${encodeURIComponent(
        accountId
      )}&period=${period}${altParam}`;
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectsProgress: progressMap,
          meta: {
            period,
            accountId,
            role: role || null,
            savedBy: name || email || uid || null,
          } as HistoryPayload,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1200);
      await loadFromServer();
      await fetchHistory(); // langsung refresh riwayat
    } catch (e) {
      console.error("PUT /api/sparta/progress", e);
      setSaveStatus("error");
    }
  };

  /* ====== RIWAYAT (range tanggal + list) ====== */
  const [from, setFrom] = useState<string>(firstDayThisMonthYMD());
  const [to, setTo] = useState<string>(todayYMD());
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [hisStatus, setHisStatus] = useState<
    "idle" | "loading" | "loaded" | "error"
  >("idle");

  const fetchHistory = useCallback(async () => {
    try {
      setHisStatus("loading");
      const q = new URLSearchParams();
      if (from) q.set("from", from);
      if (to) q.set("to", to);
      if (!isSuper) {
        if (accountId) q.set("accountId", accountId);
      } else {
        q.set("scope", "all");
        if (viewRole !== "semua") q.set("role", viewRole);
      }
      const res = await fetch(`/api/sparta/history?${q.toString()}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { items: HistoryRow[] };
      setHistory(json.items || []);
      setHisStatus("loaded");
    } catch (e) {
      console.error("GET /api/sparta/history", e);
      setHisStatus("error");
    }
  }, [from, to, isSuper, accountId, viewRole]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  return (
    <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
      <div className="px-3 sm:px-6 py-4 border-b bg-slate-50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-slate-800">
            SPARTA Project Tracking
          </h3>
          {loadStatus === "loading" && (
            <span className="ml-2 text-xs text-slate-500">Memuat…</span>
          )}
          {loadStatus === "error" && (
            <span className="ml-2 text-xs text-rose-600">Gagal memuat</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={saveToServer}
            disabled={!accountId || saveStatus === "saving"}
            className={`inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md ${
              !accountId
                ? "bg-emerald-400/60 text-white cursor-not-allowed"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
            title={!accountId ? "Login dulu" : "Simpan progress"}
          >
            {saveStatus === "saving" ? "Menyimpan…" : "Simpan"}
          </button>
          {saveStatus === "saved" && (
            <span className="text-xs text-emerald-700">Tersimpan ✔</span>
          )}
          {saveStatus === "error" && (
            <span className="text-xs text-rose-600">Gagal menyimpan</span>
          )}

          {isSuper && (
            <>
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
            </>
          )}
        </div>
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
                  {/* Judul + Deadline + Target Role */}
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

                  {/* Progress, Next Action, Kendala */}
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
                            setProgress(proj.id, { nextAction: e.target.value })
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
                          placeholder="Contoh: kendala koordinasi…"
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

      {/* ===== Riwayat Simpan (Search by date range) ===== */}
      <div className="px-3 sm:px-6 pb-6">
        <div className="mt-6 rounded-2xl border bg-white overflow-hidden">
          <div className="px-3 sm:px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
            <div className="font-semibold text-slate-800">Riwayat Simpan</div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-md border-slate-300 text-sm"
                title="Dari tanggal"
              />
              <span className="text-slate-500 text-sm">s/d</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-md border-slate-300 text-sm"
                title="Sampai tanggal"
              />
              <button
                onClick={() => void fetchHistory()}
                className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border hover:bg-slate-50"
                title="Cari berdasarkan rentang tanggal"
              >
                <Search className="h-4 w-4" /> Cari
              </button>
            </div>
          </div>

          <div className="p-3 sm:p-4">
            {hisStatus === "loading" && (
              <div className="text-sm text-slate-600">Memuat riwayat…</div>
            )}
            {hisStatus === "error" && (
              <div className="text-sm text-rose-600">
                Gagal memuat riwayat. Coba lagi.
              </div>
            )}
            {hisStatus === "loaded" && history.length === 0 && (
              <div className="text-sm text-slate-600">
                Tidak ada data pada rentang ini.
              </div>
            )}

            {history.length > 0 && (
              <div className="space-y-3">
                {history.map((row) => {
                  // Ringkasan persentase per proyek dari snapshot
                  const entries = Object.entries(
                    row.payload.projectsProgress || {}
                  );
                  return (
                    <div
                      key={row.id}
                      className="rounded-xl border p-3 bg-white space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm text-slate-700">
                          <span className="font-medium">
                            {new Date(row.created_at).toLocaleString("id-ID")}
                          </span>{" "}
                          • akun:{" "}
                          <span className="text-slate-600">
                            {row.account_id}
                          </span>{" "}
                          • role:{" "}
                          <span className="text-slate-600">
                            {row.role || "-"}
                          </span>{" "}
                          • period:{" "}
                          <span className="text-slate-600">
                            {row.period || "-"}
                          </span>
                        </div>
                        {row.payload.savedBy && (
                          <div className="text-xs text-slate-500">
                            disimpan oleh: {row.payload.savedBy}
                          </div>
                        )}
                      </div>

                      {entries.length === 0 ? (
                        <div className="text-sm text-slate-600">
                          (Snapshot kosong)
                        </div>
                      ) : (
                        <div className="grid gap-2">
                          {entries.map(([projId, prog]) => {
                            const done = prog.steps.filter(Boolean).length;
                            const total = Math.max(1, prog.steps.length);
                            const pct = Math.round((done / total) * 100);
                            return (
                              <div
                                key={projId}
                                className="flex items-center gap-3"
                              >
                                <div className="w-28 text-xs font-medium text-slate-700">
                                  {projId}
                                </div>
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-blue-600 rounded-full"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <div className="w-14 text-right text-xs text-slate-700">
                                  {pct}%
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
