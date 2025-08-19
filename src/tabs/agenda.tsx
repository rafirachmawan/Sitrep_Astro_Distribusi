"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Lock, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import type { Role } from "@/components/AuthProvider";

/* =========================== TYPES (lokal) =========================== */
export type AgendaEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  plan: string[];
  realisasi: string[];
  planSubmitted?: boolean;
  realSubmitted?: boolean;
  createdAt: string;
  updatedAt: string;
};
export type AgendaState = { entries: AgendaEntry[] };

const todayISO = () => new Date().toISOString().slice(0, 10);

/* =========================== DEFAULT COPY (bisa di-override superadmin) =========================== */
const DEFAULT_COPY = {
  headerTitle: "Agenda & Jadwal",
  dateLabel: "Tanggal",
  statusPlanLocked: "terkunci",
  statusPlanNotSubmitted: "belum disubmit",
  statusRealLocked: "terkunci",
  statusRealNotSubmitted: "belum disubmit",
  topRealHint: "*Realisasi diisi & disubmit dari kartu di bawah",
  planLabel: "Plan",
  realLabel: "Realisasi",
  addRowText: "Tambah Baris",
  submitPlanText: "Submit Plan",
  submitRealText: "Submit Realisasi",
  deletePlanText: "Hapus Plan",
  deleteRealText: "Hapus Realisasi",
  deleteEntryText: "Hapus Entri",
  createdAtPrefix: "Entri dibuat",
  updatedAtPrefix: "• diperbarui",
  emptyRealTop: "Belum ada realisasi untuk tanggal ini.",
  empty: "(kosong)",
};

type AgendaOverrides = {
  copy?: Partial<typeof DEFAULT_COPY>;
};

const OV_KEY = "sitrep-agenda-copy-v1";
const ROLES: Role[] = ["admin", "sales", "gudang"];

function readOverrides(role: Role): AgendaOverrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`${OV_KEY}:${role}`);
    return raw ? (JSON.parse(raw) as AgendaOverrides) : {};
  } catch {
    return {};
  }
}
function writeOverrides(role: Role, v: AgendaOverrides) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${OV_KEY}:${role}`, JSON.stringify(v));
}
function patchCopy(
  src: AgendaOverrides,
  key: keyof typeof DEFAULT_COPY,
  value: string
): AgendaOverrides {
  const copy = { ...(src.copy || {}) };
  copy[key] = value;
  return { ...src, copy };
}

/* =========================== EditableText helper =========================== */
function EditableText({
  value,
  canEdit,
  onSave,
  className,
  placeholder,
  title,
}: {
  value: string;
  canEdit: boolean;
  onSave: (v: string) => void;
  className?: string;
  placeholder?: string;
  title?: string;
}) {
  if (!canEdit) return <span className={className}>{value}</span>;
  return (
    <input
      defaultValue={value}
      onBlur={(e) => onSave(e.target.value)}
      className={
        "rounded-lg border-slate-300 px-2 py-1 text-sm focus:ring-2 focus:ring-amber-500 " +
        (className || "")
      }
      placeholder={placeholder}
      title={title || "Ubah teks lalu klik di luar untuk menyimpan"}
    />
  );
}

/* =========================== AGENDA & JADWAL =========================== */
export default function AgendaJadwal({
  data,
  onChange,
}: {
  data: AgendaState;
  onChange: (v: AgendaState) => void;
}) {
  const [date, setDate] = useState(todayISO());

  const { role } = useAuth();
  const isSuper = role === "superadmin";
  const [targetRole, setTargetRole] = useState<Role>("admin");
  const viewRole = (isSuper ? targetRole : (role as Role)) || "admin";
  const [editMode, setEditMode] = useState(false);
  const [rev, setRev] = useState(0); // re-read overrides

  const overrides = useMemo(() => readOverrides(viewRole), [viewRole, rev]);
  const copy = { ...DEFAULT_COPY, ...(overrides.copy || {}) };
  const saveCopy = (k: keyof typeof DEFAULT_COPY, v: string) => {
    const cur = readOverrides(viewRole);
    writeOverrides(viewRole, patchCopy(cur, k, v));
    setRev((x) => x + 1);
  };
  const resetOverrides = () => {
    if (!isSuper) return;
    if (!confirm(`Reset pengaturan teks untuk role ${viewRole}?`)) return;
    writeOverrides(viewRole, {});
    setRev((x) => x + 1);
  };

  // entri aktif utk tanggal yang dipilih
  const current = useMemo(
    () => data.entries.find((e) => e.date === date),
    [data.entries, date]
  );

  // local form atas
  const [plans, setPlans] = useState<string[]>(current?.plan ?? [""]);
  const [reals, setReals] = useState<string[]>(current?.realisasi ?? [""]);

  useEffect(() => {
    setPlans(current?.plan ?? [""]);
    setReals(current?.realisasi ?? [""]);
  }, [current?.id, date]);

  const planLocked = !!current?.planSubmitted;
  const realLocked = !!current?.realSubmitted;

  const addRow = (which: "plan" | "real") => {
    if (which === "plan" && !planLocked) setPlans((p) => [...p, ""]);
    if (which === "real" && !realLocked) setReals((p) => [...p, ""]);
  };
  const setRow = (which: "plan" | "real", i: number, val: string) =>
    which === "plan"
      ? setPlans((p) => p.map((v, idx) => (idx === i ? val : v)))
      : setReals((p) => p.map((v, idx) => (idx === i ? val : v)));

  // upsert by date (submit form atas)
  const upsertByDate = (patch: Partial<AgendaEntry>) => {
    const now = new Date().toISOString();
    const cur = data.entries.find((e) => e.date === date);
    if (!cur) {
      const fresh: AgendaEntry = {
        id: crypto.randomUUID(),
        date,
        plan: [],
        realisasi: [],
        planSubmitted: false,
        realSubmitted: false,
        createdAt: now,
        updatedAt: now,
        ...patch,
      };
      onChange({ entries: [...data.entries, fresh] });
    } else {
      const updated: AgendaEntry = { ...cur, ...patch, updatedAt: now };
      onChange({
        entries: data.entries.map((e) => (e.id === cur.id ? updated : e)),
      });
    }
  };

  // SUBMIT PLAN (form atas)
  const submitPlanTop = () => {
    const clean = plans.map((s) => s.trim()).filter(Boolean);
    if (!date || clean.length === 0)
      return alert("Isi minimal Tanggal & 1 baris Plan.");
    upsertByDate({ plan: clean, planSubmitted: true });
  };

  // ==== helper sekali saja (tidak duplikat) ====
  const patchById = (id: string, patch: Partial<AgendaEntry>) => {
    const now = new Date().toISOString();
    onChange({
      entries: data.entries.map((e) =>
        e.id === id ? ({ ...e, ...patch, updatedAt: now } as AgendaEntry) : e
      ),
    });
  };

  const deletePlanById = (id: string, d: string) => {
    if (!confirm(`Hapus PLAN untuk tanggal ${d}?`)) return;
    patchById(id, { plan: [], planSubmitted: false });
    if (d === date) setPlans([""]);
  };

  const deleteRealById = (id: string, d: string) => {
    if (!confirm(`Hapus REALISASI untuk tanggal ${d}?`)) return;
    patchById(id, { realisasi: [], realSubmitted: false });
    if (d === date) setReals([""]);
  };

  const deleteEntryById = (id: string, d: string) => {
    if (!confirm(`Hapus seluruh entri tanggal ${d}?`)) return;
    onChange({ entries: data.entries.filter((e) => e.id !== id) });
    if (d === date) {
      setPlans([""]);
      setReals([""]);
    }
  };

  // grup list bawah (baru → lama)
  const groups = useMemo(() => {
    const sort = [...data.entries].sort((a, b) =>
      a.date === b.date
        ? a.updatedAt < b.updatedAt
          ? 1
          : -1
        : a.date < b.date
        ? 1
        : -1
    );
    return sort.reduce<Record<string, AgendaEntry[]>>((acc, e) => {
      (acc[e.date] ||= []).push(e);
      return acc;
    }, {});
  }, [data.entries]);

  return (
    <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
      <div className="px-3 sm:px-6 py-4 border-b bg-slate-50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-blue-600" />
          <EditableText
            value={copy.headerTitle}
            canEdit={isSuper && editMode}
            onSave={(v) => saveCopy("headerTitle", v)}
            className="font-semibold text-slate-800"
          />
        </div>

        {isSuper && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Role:</label>
            <select
              className="rounded-lg border-slate-300 text-sm"
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
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {/* FORM ATAS */}
      <div className="p-3 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              <EditableText
                value={copy.dateLabel}
                canEdit={isSuper && editMode}
                onSave={(v) => saveCopy("dateLabel", v)}
              />
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border-slate-300 text-sm focus:ring-2 focus:ring-blue-500"
            />
            {current && (
              <div className="mt-2 text-xs text-slate-500">
                Status:
                <span
                  className={planLocked ? "text-emerald-600" : "text-slate-700"}
                >
                  {" "}
                  {copy.planLabel}{" "}
                  {planLocked
                    ? copy.statusPlanLocked
                    : copy.statusPlanNotSubmitted}
                </span>{" "}
                •{" "}
                <span
                  className={realLocked ? "text-emerald-600" : "text-slate-700"}
                >
                  {copy.realLabel}{" "}
                  {realLocked
                    ? copy.statusRealLocked
                    : copy.statusRealNotSubmitted}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* PLAN (editable & submit di atas) */}
          <div className="border rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-slate-700">
                <EditableText
                  value={copy.planLabel}
                  canEdit={isSuper && editMode}
                  onSave={(v) => saveCopy("planLabel", v)}
                />
              </div>
              {!planLocked ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => addRow("plan")}
                    className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded-md border hover:bg-slate-50"
                  >
                    <Plus className="h-4 w-4" /> {copy.addRowText}
                  </button>
                  <button
                    type="button"
                    onClick={submitPlanTop}
                    className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                  >
                    {copy.submitPlanText}
                  </button>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-emerald-50 text-emerald-700">
                  <Lock className="h-3.5 w-3.5" /> {copy.statusPlanLocked}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {plans.map((v, i) => (
                <input
                  key={i}
                  value={v}
                  onChange={(e) => setRow("plan", i, e.target.value)}
                  placeholder={`${copy.planLabel} ${i + 1}`}
                  disabled={planLocked}
                  className="w-full rounded-lg border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                />
              ))}
            </div>
          </div>

          {/* REALISASI (readonly di atas; inputnya di kartu bawah) */}
          <div className="border rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-slate-700">
                <EditableText
                  value={copy.realLabel}
                  canEdit={isSuper && editMode}
                  onSave={(v) => saveCopy("realLabel", v)}
                />
              </div>
              {realLocked ? (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-emerald-50 text-emerald-700">
                  <Lock className="h-3.5 w-3.5" /> {copy.statusRealLocked}
                </span>
              ) : (
                <span className="text-xs text-slate-500">
                  {copy.topRealHint}
                </span>
              )}
            </div>
            {current?.realisasi?.length ? (
              <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                {current.realisasi.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-slate-500">{copy.emptyRealTop}</div>
            )}
          </div>
        </div>
      </div>

      {/* LIST BAWAH (inline edit/submit & hapus) */}
      <div className="p-3 sm:p-6">
        {Object.keys(groups).length === 0 ? (
          <div className="text-sm text-slate-600">
            Belum ada agenda yang disubmit.
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groups).map(([tgl, items]) => (
              <div key={tgl} className="border rounded-2xl overflow-hidden">
                <div className="px-3 sm:px-4 py-2.5 bg-slate-50 text-sm font-semibold text-slate-800">
                  {tgl}
                </div>
                <div className="p-3 sm:p-4 space-y-3">
                  {items.map((e) => (
                    <AgendaEntryCard
                      key={e.id}
                      entry={e}
                      copy={copy}
                      canEdit={isSuper && editMode}
                      onSaveCopy={saveCopy}
                      onSubmitPlan={(vals) =>
                        patchById(e.id, { plan: vals, planSubmitted: true })
                      }
                      onSubmitReal={(vals) =>
                        patchById(e.id, {
                          realisasi: vals,
                          realSubmitted: true,
                        })
                      }
                      onDeletePlan={() => deletePlanById(e.id, e.date)}
                      onDeleteReal={() => deleteRealById(e.id, e.date)}
                      onDeleteEntry={() => deleteEntryById(e.id, e.date)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================== CARD ITEM =========================== */
function AgendaEntryCard({
  entry,
  copy,
  canEdit,
  onSaveCopy,
  onSubmitPlan,
  onSubmitReal,
  onDeletePlan,
  onDeleteReal,
  onDeleteEntry,
}: {
  entry: AgendaEntry;
  copy: ReturnType<typeof Object.assign>;
  canEdit: boolean;
  onSaveCopy: (k: keyof typeof DEFAULT_COPY, v: string) => void;
  onSubmitPlan: (values: string[]) => void;
  onSubmitReal: (values: string[]) => void;
  onDeletePlan: () => void;
  onDeleteReal: () => void;
  onDeleteEntry: () => void;
}) {
  const [planDraft, setPlanDraft] = useState<string[]>(
    entry.plan.length ? entry.plan : [""]
  );
  const [realDraft, setRealDraft] = useState<string[]>(
    entry.realisasi.length ? entry.realisasi : [""]
  );

  useEffect(() => {
    setPlanDraft(entry.plan.length ? entry.plan : [""]);
    setRealDraft(entry.realisasi.length ? entry.realisasi : [""]);
  }, [entry.id, entry.plan.join("|"), entry.realisasi.join("|")]);

  const addRow = (w: "plan" | "real") =>
    w === "plan"
      ? setPlanDraft((p) => [...p, ""])
      : setRealDraft((p) => [...p, ""]);

  const setRow = (w: "plan" | "real", i: number, v: string) =>
    w === "plan"
      ? setPlanDraft((p) => p.map((x, idx) => (idx === i ? v : x)))
      : setRealDraft((p) => p.map((x, idx) => (idx === i ? v : x)));

  const submitPlan = () => {
    const vals = planDraft.map((s) => s.trim()).filter(Boolean);
    if (!vals.length) return alert("Isi minimal 1 baris Plan.");
    onSubmitPlan(vals);
  };
  const submitReal = () => {
    const vals = realDraft.map((s) => s.trim()).filter(Boolean);
    if (!vals.length) return alert("Isi minimal 1 baris Realisasi.");
    onSubmitReal(vals);
  };

  return (
    <div className="border rounded-xl p-3 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-3">
        {copy.createdAtPrefix} {new Date(entry.createdAt).toLocaleString()}{" "}
        {copy.updatedAtPrefix} {new Date(entry.updatedAt).toLocaleString()}
        <span
          className={
            "ml-2 px-2 py-0.5 rounded " +
            (entry.planSubmitted
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-600")
          }
        >
          {copy.planLabel}{" "}
          {entry.planSubmitted
            ? copy.statusPlanLocked
            : copy.statusPlanNotSubmitted}
        </span>
        <span
          className={
            "px-2 py-0.5 rounded " +
            (entry.realSubmitted
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-600")
          }
        >
          {copy.realLabel}{" "}
          {entry.realSubmitted
            ? copy.statusRealLocked
            : copy.statusRealNotSubmitted}
        </span>
        <button
          onClick={onDeleteEntry}
          className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded border border-rose-200 text-rose-600 hover:bg-rose-50"
          title="Hapus entri tanggal ini"
        >
          <Trash2 className="h-4 w-4" /> {copy.deleteEntryText}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* PLAN area */}
        <div>
          <div className="text-sm font-medium text-slate-700 mb-1">
            <EditableText
              value={copy.planLabel}
              canEdit={canEdit}
              onSave={(v) => onSaveCopy("planLabel", v)}
            />
          </div>
          {entry.planSubmitted ? (
            entry.plan.length ? (
              <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                {entry.plan.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-slate-500">{copy.empty}</div>
            )
          ) : (
            <>
              <div className="space-y-2">
                {planDraft.map((v, i) => (
                  <input
                    key={i}
                    value={v}
                    onChange={(e) => setRow("plan", i, e.target.value)}
                    placeholder={`${copy.planLabel} ${i + 1}`}
                    className="w-full rounded-lg border-slate-300 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => addRow("plan")}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border hover:bg-slate-50"
                >
                  <Plus className="h-4 w-4" /> {copy.addRowText}
                </button>
                <button
                  type="button"
                  onClick={submitPlan}
                  className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                >
                  {copy.submitPlanText}
                </button>
                <button
                  type="button"
                  onClick={onDeletePlan}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="h-4 w-4" /> {copy.deletePlanText}
                </button>
              </div>
            </>
          )}
        </div>

        {/* REALISASI area */}
        <div>
          <div className="text-sm font-medium text-slate-700 mb-1">
            <EditableText
              value={copy.realLabel}
              canEdit={canEdit}
              onSave={(v) => onSaveCopy("realLabel", v)}
            />
          </div>
          {entry.realSubmitted ? (
            entry.realisasi.length ? (
              <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                {entry.realisasi.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-slate-500">{copy.empty}</div>
            )
          ) : (
            <>
              <div className="space-y-2">
                {realDraft.map((v, i) => (
                  <input
                    key={i}
                    value={v}
                    onChange={(e) => setRow("real", i, e.target.value)}
                    placeholder={`${copy.realLabel} ${i + 1}`}
                    className="w-full rounded-lg border-slate-300 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => addRow("real")}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border hover:bg-slate-50"
                >
                  <Plus className="h-4 w-4" /> {copy.addRowText}
                </button>
                <button
                  type="button"
                  onClick={submitReal}
                  className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                >
                  {copy.submitRealText}
                </button>
                <button
                  type="button"
                  onClick={onDeleteReal}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="h-4 w-4" /> {copy.deleteRealText}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
