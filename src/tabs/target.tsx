"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Target as TargetIcon, Plus, Trash2 } from "lucide-react";
import type { TargetState, TargetDeadlines } from "@/lib/types";
import { PRINCIPALS } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import type { Role } from "@/components/AuthProvider";

/* ================= OVERRIDES (hanya label UI, lokal) ================= */
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
  extraPrincipals?: Record<string, { label: string }>;
};

const OV_KEY = "sitrep-target-copy-v2";
const ROLES: Role[] = ["admin", "sales", "gudang"];

/* ====== FODKS list ====== */
type FodksItem = {
  id: string;
  name: string;
  note: string;
  createdBy?: string;
  createdAt?: string;
};

/* ====== Payload untuk server ====== */
type SavedChecks = {
  klaimSelesai: Record<string, boolean>;
  weekly: Record<string, boolean[]>;
  fodksList: FodksItem[];
};

type MinimalAuth = {
  role?: Role | string;
  user?: { id?: string; email?: string };
};

/* — helper keyboard untuk aksesibilitas (Enter/Space) — */
function handleKeyActivate(e: React.KeyboardEvent, fn: () => void) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
}

/* ===== local overrides (label UI) ===== */
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
type CopyShape = NonNullable<TargetOverrides["copy"]>;
type CopyKeys = keyof Required<CopyShape>;
function patchCopy(
  src: TargetOverrides,
  key: CopyKeys,
  value: string
): TargetOverrides {
  const copyMap = { ...(src.copy || {}) } as Record<
    CopyKeys,
    string | undefined
  >;
  copyMap[key] = value;
  const copy: TargetOverrides["copy"] = copyMap;
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

/* ================= Baris FODKS: ketik lancar (debounce) ================= */
const FodksRow = React.memo(function FodksRow({
  item,
  canEdit,
  onChange,
  onDelete,
}: {
  item: FodksItem;
  canEdit: boolean;
  onChange: (patch: Partial<FodksItem>) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [note, setNote] = useState(item.note);

  useEffect(() => {
    setName(item.name);
    setNote(item.note);
  }, [item.name, item.note]);

  const deb = useRef<number | null>(null);
  const schedule = useCallback(
    (patch: Partial<FodksItem>) => {
      if (deb.current) window.clearTimeout(deb.current);
      deb.current = window.setTimeout(() => onChange(patch), 300);
    },
    [onChange]
  );

  const createdInfo = useMemo(() => {
    if (!item.createdAt) return "";
    try {
      return new Date(item.createdAt).toLocaleString();
    } catch {
      return item.createdAt;
    }
  }, [item.createdAt]);

  return (
    <tr>
      <td className="py-2 px-2 align-top">
        <input
          disabled={!canEdit}
          className={`w-full rounded-xl border-2 text-sm px-3 py-2 focus:outline-none ${
            canEdit
              ? "border-slate-300 bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
              : "border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed"
          }`}
          placeholder="Tuliskan FODKS apa yang diinput…"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            schedule({ name: e.target.value });
          }}
        />
        <div className="mt-1 text-[11px] text-slate-500">
          Dibuat oleh: {item.createdBy ?? "—"}{" "}
          {createdInfo ? `• ${createdInfo}` : ""}
        </div>
      </td>
      <td className="py-2 px-2 align-top">
        <textarea
          disabled={!canEdit}
          rows={1}
          className={`w-full rounded-xl border-2 text-sm px-3 py-2 focus:outline-none ${
            canEdit
              ? "border-slate-300 bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
              : "border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed"
          }`}
          placeholder="Keterangan (opsional)…"
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            schedule({ note: e.target.value });
          }}
        />
      </td>
      {onDelete ? (
        <td className="py-2 px-2 align-top">
          <button
            type="button"
            onClick={onDelete}
            className="px-2 py-2 rounded-md bg-rose-600 text-white hover:bg-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-100"
            aria-label="Hapus item"
            title="Hapus item (superadmin saja)"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </td>
      ) : null}
    </tr>
  );
});

/* ================= COMPONENT ================= */
export default function TargetAchievement({
  data,
  onChange,
}: {
  data: TargetState;
  onChange: (v: TargetState) => void;
}) {
  const auth = useAuth() as MinimalAuth;
  const role = (auth.role as Role) || "admin";
  const isSuper = role === "superadmin";
  const accountId = auth.user?.id || auth.user?.email || String(role);

  // periode bulanan untuk GET dan PUT (harus konsisten)
  const period = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

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
    fodksTitle: overrides.copy?.fodksTitle ?? "Input FODKS",
    fodksCheckboxLabel:
      overrides.copy?.fodksCheckboxLabel ?? "Tandai jika sudah input",
    deadlineLabel: overrides.copy?.deadlineLabel ?? "Deadline",
  };

  /* ===== list principal: base + custom ===== */
  const allPrincipals: string[] = useMemo(() => {
    const base = [...PRINCIPALS];
    const extras = Object.keys(overrides.extraPrincipals || {});
    return [...base, ...extras];
  }, [overrides.extraPrincipals]);

  const principalLabel = (p: string) =>
    overrides.principals?.[p]?.label ??
    overrides.extraPrincipals?.[p]?.label ??
    p;

  const saveCopy = (k: CopyKeys, v: string) => {
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

  /* ====== STATE LOKAL CHECKLIST (disubmit ke server) ====== */
  const [klaimMap, setKlaimMap] = useState<Record<string, boolean>>(
    (data.klaimSelesai as unknown as Record<string, boolean>) || {}
  );
  const [weeklyMap, setWeeklyMap] = useState<Record<string, boolean[]>>(
    (data.weekly as unknown as Record<string, boolean[]>) || {}
  );
  const [fodksListLocal, setFodksListLocal] = useState<FodksItem[]>([]);

  // sinkronkan ke parent (untuk konsistensi antar section)
  useEffect(() => {
    onChange({
      ...data,
      klaimSelesai: klaimMap as unknown as TargetState["klaimSelesai"],
      weekly: weeklyMap as unknown as TargetState["weekly"],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(klaimMap), JSON.stringify(weeklyMap)]);

  /* ====== LOAD dari server saat mount / berubah account ====== */
  const [loadStatus, setLoadStatus] = useState<
    "idle" | "loading" | "loaded" | "error"
  >("idle");

  const loadFromServer = useCallback(async () => {
    if (!accountId) return;
    try {
      setLoadStatus("loading");
      const res = await fetch(
        `/api/target/checks?accountId=${encodeURIComponent(
          accountId
        )}&period=${period}`,
        {
          method: "GET",
          credentials: "include",
          headers: { Accept: "application/json" },
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as Partial<SavedChecks>;
      if (json.klaimSelesai) setKlaimMap(json.klaimSelesai);
      if (json.weekly) setWeeklyMap(json.weekly);
      if (json.fodksList) setFodksListLocal(json.fodksList);
      setLoadStatus("loaded");
    } catch (err) {
      console.error("GET /api/target/checks error:", err);
      setLoadStatus("error");
    }
  }, [accountId, period]);

  useEffect(() => {
    loadFromServer();
  }, [loadFromServer]);

  /* ====== TOMBOL SUBMIT (SIMPAN KE SERVER) ====== */
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const handleSubmit = async () => {
    if (!accountId) return;
    try {
      setSaveStatus("saving");
      const payload: SavedChecks = {
        klaimSelesai: klaimMap,
        weekly: weeklyMap,
        fodksList: fodksListLocal,
      };
      const res = await fetch(
        `/api/target/checks?accountId=${encodeURIComponent(
          accountId
        )}&period=${period}`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1500);
      // refresh dari server agar yakin sinkron
      loadFromServer();
    } catch (err) {
      console.error("PUT /api/target/checks error:", err);
      setSaveStatus("error");
    }
  };

  /* ===== tambah/hapus principal (superadmin saja) ===== */
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

    setWeeklyMap((prev) => ({
      ...prev,
      [k]: prev[k] ?? [false, false, false, false],
    }));
    setKlaimMap((prev) => ({ ...prev, [k]: prev[k] ?? false }));
  };

  const removePrincipal = (key: string) => {
    if (!isSuper) return;
    if (!confirm(`Hapus principal ${key}?`)) return;
    const cur = readOverrides(viewRole);
    writeOverrides(viewRole, removeExtraPrincipal(cur, key));
    setRev((x) => x + 1);
    // nilai map lama dibiarkan (histori)
  };

  /* ===== toggle helpers ===== */
  const toggleKlaim = (p: string) =>
    setKlaimMap((prev) => ({ ...prev, [p]: !prev[p] }));

  const toggleWeekly = (p: string, w: number) =>
    setWeeklyMap((prev) => {
      const arr = prev[p] ? [...prev[p]] : [false, false, false, false];
      arr[w] = !arr[w];
      return { ...prev, [p]: arr };
    });

  /* ===== deadline (edit superadmin, persist via parent) ===== */
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

  /* ===== FODKS logic ===== */
  const uid = () =>
    Math.random().toString(36).slice(2) + Date.now().toString(36);
  const addFodksItem = () => {
    const next: FodksItem[] = [
      ...fodksListLocal,
      {
        id: uid(),
        name: "",
        note: "",
        createdBy: String(role),
        createdAt: new Date().toISOString(),
      },
    ];
    setFodksListLocal(next);
  };
  const canEditItem = (it: FodksItem) => isSuper || it.createdBy === role;
  const patchFodksItem = (id: string, patch: Partial<FodksItem>) =>
    setFodksListLocal((list) =>
      list.map((it) => (it.id === id ? { ...it, ...patch } : it))
    );
  const removeFodksItem = (id: string) => {
    if (!isSuper) return;
    setFodksListLocal((list) => list.filter((it) => it.id !== id));
  };

  /* =================== RENDER =================== */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-3 sm:px-6 py-4 border-b bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TargetIcon className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-slate-800">
              Target &amp; Achievement
            </h3>
            {loadStatus === "loading" && (
              <span className="ml-2 text-xs text-slate-500">Memuat…</span>
            )}
            {loadStatus === "error" && (
              <span className="ml-2 text-xs text-rose-600">Gagal memuat</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Submit Simpan ke Server */}
            <button
              type="button"
              onClick={handleSubmit}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100"
            >
              {saveStatus === "saving" ? "Menyimpan…" : "Submit"}
            </button>
            {saveStatus === "saved" && (
              <span className="text-xs text-emerald-700">Tersimpan ✔</span>
            )}
            {saveStatus === "error" && (
              <span className="text-xs text-rose-600">Gagal menyimpan</span>
            )}

            {isSuper && (
              <>
                <label className="text-sm text-slate-600 ml-3">Role:</label>
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
                  type="button"
                  onClick={resetOverrides}
                  className="text-xs px-2 py-1 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50"
                >
                  Reset Label
                </button>
              </>
            )}
          </div>
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
                  <th className="text-left py-2 px-2">{copy.deadlineLabel}</th>
                  <th className="text-left py-2 px-2">Selesai</th>
                </tr>
              </thead>
              <tbody className="divide-y border rounded-xl bg-white">
                {allPrincipals.map((p) => {
                  const checked = klaimMap[p] || false;
                  return (
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
                            />
                            {overrides.extraPrincipals?.[p] && isSuper && (
                              <button
                                type="button"
                                onClick={() => removePrincipal(p)}
                                className="px-2 py-1 rounded-md bg-rose-600 text-white"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ) : (
                          principalLabel(p)
                        )}
                      </td>

                      {/* deadline */}
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
                        />
                      </td>

                      {/* toggle selesai */}
                      <td
                        className="py-3 px-2"
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleKlaim(p);
                        }}
                        onKeyDown={(e) =>
                          handleKeyActivate(e, () => toggleKlaim(p))
                        }
                        style={{ userSelect: "none", cursor: "pointer" }}
                        aria-label={`Toggle selesai ${principalLabel(p)}`}
                      >
                        <label className="inline-flex items-center gap-3 px-2 py-2 rounded-md hover:bg-slate-100 cursor-pointer select-none w-full">
                          <input
                            type="checkbox"
                            className="h-5 w-5 accent-blue-600"
                            checked={checked}
                            readOnly
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleKlaim(p);
                            }}
                          />
                          <span className="text-sm text-slate-700">
                            Selesai
                          </span>
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {isSuper && editMode && <AddPrincipalForm onAdd={addPrincipal} />}
        </div>
      </div>

      {/* ===== Bagian 2: Mingguan ===== */}
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
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left py-2 px-2">Prinsipal</th>
                <th className="text-left py-2 px-2">Minggu 1</th>
                <th className="text-left py-2 px-2">Minggu 2</th>
                <th className="text-left py-2 px-2">Minggu 3</th>
                <th className="text-left py-2 px-2">Minggu 4</th>
                {isSuper && editMode ? (
                  <th className="text-left py-2 px-2">Aksi</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {allPrincipals.map((p) => {
                const weeklyRow = weeklyMap[p] || [false, false, false, false];
                return (
                  <tr key={p}>
                    <td className="py-3 px-2 font-medium text-slate-800">
                      {editMode ? (
                        <input
                          defaultValue={principalLabel(p)}
                          onBlur={(e) => savePrincipalLabel(p, e.target.value)}
                          className="w-full rounded-xl border-2 border-slate-300 bg-white text-sm px-3 py-2 text-center focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
                          placeholder={`Nama principal untuk ${p}`}
                        />
                      ) : (
                        principalLabel(p)
                      )}
                    </td>

                    {[0, 1, 2, 3].map((w) => (
                      <td
                        key={w}
                        className="py-3 px-2"
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWeekly(p, w);
                        }}
                        onKeyDown={(e) =>
                          handleKeyActivate(e, () => toggleWeekly(p, w))
                        }
                        style={{ userSelect: "none", cursor: "pointer" }}
                        aria-label={`Toggle minggu ${
                          w + 1
                        } untuk ${principalLabel(p)}`}
                      >
                        <label className="inline-flex items-center justify-center w-10 h-10 rounded-md hover:bg-slate-100 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="h-5 w-5 accent-blue-600"
                            checked={weeklyRow[w]}
                            readOnly
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleWeekly(p, w);
                            }}
                          />
                        </label>
                      </td>
                    ))}

                    {isSuper && editMode ? (
                      <td className="py-3 px-2">
                        {overrides.extraPrincipals?.[p] && (
                          <button
                            type="button"
                            onClick={() => removePrincipal(p)}
                            className="px-2 py-1 rounded-md bg-rose-600 text-white"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {isSuper && editMode && (
            <div className="mt-4">
              <AddPrincipalForm onAdd={addPrincipal} />
            </div>
          )}
        </div>
      </div>

      {/* ===== Bagian 3: Input FODKS ===== */}
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-3 sm:px-6 py-4 border-b bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          {editMode ? (
            <input
              defaultValue={copy.fodksTitle}
              onBlur={(e) => saveCopy("fodksTitle", e.target.value)}
              className="w-full max-w-[420px] rounded-xl border-2 border-slate-300 bg-white text-sm px-3 py-2 text-center focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
              placeholder="Judul bagian…"
            />
          ) : (
            <div className="font-semibold text-slate-800">
              {copy.fodksTitle}
            </div>
          )}

          <button
            type="button"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => handleKeyActivate(e, addFodksItem)}
            onClick={addFodksItem}
            className="pointer-events-auto relative z-10 select-none inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
            style={{ touchAction: "manipulation" }}
            aria-label="Tambah item FODKS"
            title="Tambah item FODKS"
          >
            <Plus className="h-4 w-4" /> Tambah
          </button>
        </div>

        <div className="p-3 sm:p-6 overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left py-2 px-2 w-[40%]">FODKS</th>
                <th className="text-left py-2 px-2">Keterangan</th>
                {isSuper ? (
                  <th className="text-left py-2 px-2 w-[80px]">Aksi</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {fodksListLocal.length === 0 && (
                <tr>
                  <td
                    colSpan={isSuper ? 3 : 2}
                    className="py-6 px-2 text-center text-slate-500"
                  >
                    Belum ada input FODKS. Klik{" "}
                    <span className="font-medium">Tambah</span> untuk
                    menambahkan.
                  </td>
                </tr>
              )}

              {fodksListLocal.map((it) => {
                const editable = canEditItem(it);
                return (
                  <FodksRow
                    key={it.id}
                    item={it}
                    canEdit={editable}
                    onChange={(patch) => patchFodksItem(it.id, patch)}
                    onDelete={
                      isSuper ? () => removeFodksItem(it.id) : undefined
                    }
                  />
                );
              })}
            </tbody>
          </table>
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
    <div className="border rounded-xl p-3 bg-blue-50">
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
          type="button"
          onClick={() => {
            onAdd(key, label);
            setKey("p_");
            setLabel("");
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
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
