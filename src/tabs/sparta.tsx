"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ListChecks,
  CalendarDays,
  Plus,
  Trash2,
  Wrench,
  History,
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
  position?: number;
};

type HistoryItem = {
  id: string;
  account_id: string;
  period: string;
  payload: { projectsProgress?: Record<string, ProjectProgress> } | null;
  created_at: string;
};

/* -------------------------- Catalog (server-synced) -------------------------- */
const TARGET_ROLES: TargetRole[] = ["admin", "sales", "gudang"];

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
    position: typeof p.position === "number" ? p.position : 0,
  };
}

function reindex(items: ProjectDef[]) {
  return items.map((p, i) => ({ ...p, position: i }));
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
function firstDayOfMonth(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function lastDayOfMonth(d = new Date()) {
  const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const last = new Date(+nextMonth - 1);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(last.getDate()).padStart(2, "0")}`;
}

/* -------------------------- Component -------------------------- */
export default function SpartaTracking({
  data,
  onChange,
}: {
  data: SpartaState;
  onChange: (v: SpartaState) => void;
}) {
  const { role, user } = useAuth() as {
    role?: Role;
    user?: { id?: string; email?: string };
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

  // ===== Catalog global (superadmin publish; semua device load dari server) =====
  const [catalog, setCatalog] = useState<ProjectDef[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<
    "idle" | "loading" | "loaded" | "error"
  >("idle");

  const loadCatalog = useCallback(async () => {
    try {
      setCatalogStatus("loading");
      const res = await fetch("/api/sparta/catalog", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { items?: ProjectDef[] };
      const items = (json.items || []).map(normalizeProject);
      // pastikan urut by position
      items.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      setCatalog(items);
      setCatalogStatus("loaded");
    } catch (e) {
      console.error("GET /api/sparta/catalog", e);
      setCatalog([]);
      setCatalogStatus("error");
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // Publish (superadmin)
  const [publishStatus, setPublishStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const publishCatalog = async () => {
    try {
      setPublishStatus("saving");
      const res = await fetch("/api/sparta/catalog", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: catalog,
          updatedBy: accountId ?? null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPublishStatus("saved");
      setTimeout(() => setPublishStatus("idle"), 1200);
      await loadCatalog();
    } catch (e) {
      console.error("PUT /api/sparta/catalog", e);
      setPublishStatus("error");
    }
  };

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
  }, [catalog.length]);

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
    const p: ProjectDef = normalizeProject({
      title: "Proyek Baru",
      steps: ["Langkah 1", "Langkah 2"],
      deadline: "",
      targetRole: "admin",
      position: catalog.length,
    });
    setCatalog((c) => reindex([...c, p]));
  };
  const updateProject = (id: string, patch: Partial<ProjectDef>) =>
    setCatalog((c) => c.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const deleteProject = (id: string) => {
    if (!confirm("Hapus proyek ini?")) return;
    setCatalog((c) => reindex(c.filter((x) => x.id !== id)));
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
    const src =
      isSuper && viewRole === "semua"
        ? catalog
        : catalog.filter((p) =>
            isSuper
              ? p.targetRole === viewRole
              : p.targetRole === (role as TargetRole)
          );
    return [...src].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }, [catalog, isSuper, viewRole, role]);

  /* ====== LOAD / SAVE KE SERVER (progress per akun) ====== */
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
        body: JSON.stringify({ projectsProgress: progressMap }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1200);
      await loadFromServer();
      await loadHistory(); // refresh riwayat setelah simpan
    } catch (e) {
      console.error("PUT /api/sparta/progress", e);
      setSaveStatus("error");
    }
  };

  /* ====== RIWAYAT SIMPAN (range tanggal) ====== */
  const [fromDate, setFromDate] = useState(firstDayOfMonth());
  const [toDate, setToDate] = useState(lastDayOfMonth());
  const [historyAccountId, setHistoryAccountId] = useState<string>(
    accountId || ""
  );
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [histStatus, setHistStatus] = useState<
    "idle" | "loading" | "loaded" | "error"
  >("idle");

  const loadHistory = useCallback(async () => {
    try {
      setHistStatus("loading");
      const params = new URLSearchParams();
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      if (isSuper) {
        // superadmin bisa kosongkan accountId untuk lihat semua
        if (historyAccountId.trim())
          params.set("accountId", historyAccountId.trim());
      } else if (accountId) {
        params.set("accountId", accountId);
      }

      const url = `/api/sparta/history?${params.toString()}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { items?: HistoryItem[] };
      setHistory(json.items || []);
      setHistStatus("loaded");
    } catch (e) {
      console.error("GET /api/sparta/history", e);
      setHistStatus("error");
    }
  }, [fromDate, toDate, historyAccountId, isSuper, accountId]);

  useEffect(() => {
    // muat awal
    loadHistory();
  }, [loadHistory]);

  // ringkas payload untuk tampilan card
  const summarizePayload = (payload: HistoryItem["payload"]) => {
    const pp = payload?.projectsProgress || {};
    let totalSteps = 0;
    let doneSteps = 0;
    Object.values(pp).forEach((p) => {
      const steps = Array.isArray(p.steps) ? p.steps : [];
      totalSteps += steps.length;
      doneSteps += steps.filter(Boolean).length;
    });
    const pct = totalSteps ? Math.round((doneSteps / totalSteps) * 100) : 0;
    return { totalSteps, doneSteps, pct };
  };

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
          {catalogStatus === "loading" && (
            <span className="ml-2 text-xs text-slate-500">Catalog…</span>
          )}
          {catalogStatus === "error" && (
            <span className="ml-2 text-xs text-rose-600">Catalog gagal</span>
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
                <>
                  <button
                    onClick={addProject}
                    className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" /> Tambah Proyek
                  </button>

                  <button
                    onClick={loadCatalog}
                    className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border hover:bg-slate-50"
                    title="Reload catalog dari server"
                  >
                    Reload
                  </button>

                  <button
                    onClick={publishCatalog}
                    disabled={publishStatus === "saving"}
                    className={
                      "inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md " +
                      (publishStatus === "saving"
                        ? "bg-blue-400 text-white cursor-not-allowed"
                        : "bg-blue-600 text-white hover:bg-blue-700")
                    }
                    title="Publish catalog ke server (Supabase)"
                  >
                    {publishStatus === "saving"
                      ? "Publishing…"
                      : "Publish Catalog"}
                  </button>
                  {publishStatus === "saved" && (
                    <span className="text-xs text-emerald-700">
                      Catalog tersimpan ✔
                    </span>
                  )}
                  {publishStatus === "error" && (
                    <span className="text-xs text-rose-600">
                      Gagal publish catalog
                    </span>
                  )}
                </>
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

      {/* ======== Riwayat Simpan ======== */}
      <div className="px-3 sm:px-6 py-4 border-t bg-slate-50">
        <div className="flex items-center gap-2 mb-3">
          <History className="h-5 w-5 text-slate-600" />
          <div className="font-semibold text-slate-800">Riwayat Simpan</div>
          {histStatus === "loading" && (
            <span className="text-xs text-slate-500">Memuat…</span>
          )}
          {histStatus === "error" && (
            <span className="text-xs text-rose-600">Gagal memuat</span>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-2 mb-3">
          <div className="flex flex-col">
            <label className="text-xs text-slate-600">Dari</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-md border-slate-300 text-sm"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-slate-600">Sampai</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-md border-slate-300 text-sm"
            />
          </div>

          {isSuper && (
            <div className="flex flex-col">
              <label className="text-xs text-slate-600">
                Account ID (opsional)
              </label>
              <input
                value={historyAccountId}
                onChange={(e) => setHistoryAccountId(e.target.value)}
                placeholder="email/uid — kosongkan utk semua akun"
                className="rounded-md border-slate-300 text-sm px-2 py-1.5 min-w-[240px]"
              />
            </div>
          )}

          <button
            onClick={loadHistory}
            className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
          >
            Tampilkan
          </button>
        </div>

        {history.length === 0 ? (
          <div className="text-sm text-slate-600">
            Belum ada riwayat pada rentang ini.
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((h) => {
              const s = summarizePayload(h.payload);
              const when = new Date(h.created_at).toLocaleString();
              return (
                <div
                  key={h.id}
                  className="rounded-lg border bg-white p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="font-medium text-slate-800">{when}</div>
                      <div className="text-slate-500">•</div>
                      <div className="text-slate-600">
                        Period: <span className="font-medium">{h.period}</span>
                      </div>
                      <div className="text-slate-500">•</div>
                      <div className="text-slate-600">
                        Akun:{" "}
                        <span className="font-medium">{h.account_id}</span>
                      </div>
                    </div>
                    <div className="text-slate-700">
                      Steps: <span className="font-medium">{s.doneSteps}</span>{" "}
                      / {s.totalSteps} • {s.pct}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
