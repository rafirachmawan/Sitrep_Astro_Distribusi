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

/* ================= OVERRIDES (server-synced + local cache) ================= */
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
  /** ⬇️ deadines ikut disimpan di server (per role) */
  deadlines?: TargetDeadlines;
};

const OV_KEY = "sitrep-target-copy-v2";
const ROLE_PREF_KEY = "sitrep-target-role-pref";
const ROLES: Role[] = ["admin", "sales", "gudang"];

/* ====== FODKS list ====== */
type FodksItem = {
  id: string;
  name: string;
  note: string;
  createdBy?: string;
  createdAt?: string;
};

/* ====== Payload checks untuk server ====== */
type SavedChecks = {
  klaimSelesai: Record<string, boolean>;
  weekly: Record<string, boolean[]>;
  fodksList: FodksItem[];
};

type MinimalAuth = {
  role?: Role | string;
  user?: { id?: string; email?: string };
};

/* — helper keyboard (Enter/Space) — */
function handleKeyActivate(e: React.KeyboardEvent, fn: () => void) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
}

/* ===== local cache (tanpa any) ===== */
function readOverrides(role: Role): TargetOverrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`${OV_KEY}:${role}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return (
      parsed && typeof parsed === "object" ? parsed : {}
    ) as TargetOverrides;
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
  const copyMap: CopyShape = { ...(src.copy || {}) };
  (copyMap as Record<string, string | undefined>)[key as string] = value;
  return { ...src, copy: copyMap };
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

/* ======== KUNCI PRINCIPAL & DEADLINES (fix error ts7053) ======== */
/** ambil union key langsung dari tipe deadlines kamu */
type PKey = Extract<keyof TargetDeadlines["klaim"], string>;
/** array principal base bertipe literal union */
const BASE_P = PRINCIPALS as readonly string[] as readonly PKey[];
/** type-guard: apakah string termasuk principal base */
function isBasePrincipal(k: string): k is PKey {
  return (BASE_P as readonly string[]).includes(k);
}
/** map default berisi "" utk semua principal base */
function blankPrincipalMap(): Record<PKey, string> {
  const acc = {} as Record<PKey, string>;
  for (const k of BASE_P) acc[k] = "";
  return acc;
}

/** patch deadline tipe-safe */
function patchDeadlines(
  src: TargetOverrides,
  scope: keyof TargetDeadlines,
  value: string,
  p?: PKey
): TargetOverrides {
  const cur: TargetDeadlines = {
    klaim: {
      ...blankPrincipalMap(),
      ...(src.deadlines?.klaim ?? {}),
    } as Record<PKey, string>,
    weekly: {
      ...blankPrincipalMap(),
      ...(src.deadlines?.weekly ?? {}),
    } as Record<PKey, string>,
    targetSelesai: src.deadlines?.targetSelesai ?? "",
    fodks: src.deadlines?.fodks ?? "",
  };

  if (scope === "klaim" && p) {
    (cur.klaim as Record<PKey, string>)[p] = value;
  } else if (scope === "weekly" && p) {
    (cur.weekly as Record<PKey, string>)[p] = value;
  } else if (scope === "targetSelesai") {
    cur.targetSelesai = value;
  } else if (scope === "fodks") {
    cur.fodks = value;
  }
  return { ...src, deadlines: cur };
}

/* ====== SERVER SYNC untuk overrides (Supabase via API) ====== */
async function fetchOverridesFromServer(role: Role): Promise<TargetOverrides> {
  const res = await fetch(`/api/target/overrides?role=${role}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`GET /target/overrides ${res.status}`);
  const json = (await res.json()) as { overrides?: TargetOverrides };
  return json.overrides ?? {};
}
async function saveOverridesToServer(role: Role, overrides: TargetOverrides) {
  const res = await fetch(`/api/target/overrides?role=${role}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ overrides }),
  });
  if (!res.ok) throw new Error(`PUT /target/overrides ${res.status}`);
}

/* ================= Baris FODKS (debounce) ================= */
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
          onChange={(ev) => {
            setName(ev.target.value);
            schedule({ name: ev.target.value });
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
          onChange={(ev) => {
            setNote(ev.target.value);
            schedule({ note: ev.target.value });
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

  // DETEKSI superadmin yang lebih longgar
  const isSuper = useMemo(() => {
    const r = String(role || "").toLowerCase();
    return r === "superadmin" || r === "super" || r === "owner" || r === "root";
  }, [role]);

  /** SIMPAN PER USER (stabil lintas device) */
  const STORAGE_MODE: "byUser" | "byRole" = "byUser";

  // Ambil dua kemungkinan ID dari auth
  const uid = auth.user?.id || null;
  const email = auth.user?.email || null;

  // Opsional: paksa accountId dari localStorage untuk debugging
  const FORCE_ACCOUNT_ID =
    typeof window !== "undefined"
      ? localStorage.getItem("sitrep-force-account-id")
      : null;

  // Primary accountId
  const accountId: string | null =
    FORCE_ACCOUNT_ID ||
    (STORAGE_MODE === "byUser" ? email || uid || null : `role:${role}`);

  // Alt ID untuk kompatibilitas (mis. data lama tersimpan dengan UID)
  const altId: string | null = (() => {
    if (FORCE_ACCOUNT_ID) return null;
    if (!email || !uid) return null;
    return accountId === email ? uid : email;
  })();

  // periode bulanan
  const period = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  // role picker utk superadmin (hanya utk label/preview)
  const [targetRole, setTargetRole] = useState<Role>(() => {
    if (typeof window === "undefined") return "admin";
    return (localStorage.getItem(ROLE_PREF_KEY) as Role) || "admin";
  });
  useEffect(() => {
    if (isSuper) localStorage.setItem(ROLE_PREF_KEY, targetRole);
  }, [isSuper, targetRole]);
  const viewRole = (isSuper ? targetRole : (role as Role)) || "admin";

  const [editMode, setEditMode] = useState(false);
  const [lastSync, setLastSync] = useState<string>("—");
  const [saveError, setSaveError] = useState<string>("");

  /** ✅ Simpan overrides di state (tanpa 'rev') */
  const [overrides, setOverrides] = useState<TargetOverrides>({});

  // helper: refetch overrides utk role tertentu dan tulis ke local cache
  const refreshOverrides = useCallback(async (r: Role) => {
    const remote = await fetchOverridesFromServer(r);
    writeOverrides(r, remote);
    setOverrides(remote);
    setLastSync(new Date().toLocaleString());
    return remote;
  }, []);

  /* ==== sinkronisasi awal & saat tab kembali aktif ==== */
  useEffect(() => {
    // baca cache dulu biar cepat render
    setOverrides(readOverrides(viewRole));
    (async () => {
      try {
        await refreshOverrides(viewRole);
      } catch {
        // diamkan; UI tetap jalan dgn cache
      }
    })();
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void refreshOverrides(viewRole);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [viewRole, refreshOverrides]);

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

  /* ===== list principal: base + custom (dedup) ===== */
  const allPrincipals: string[] = useMemo(() => {
    const base = [...PRINCIPALS];
    const extras = Object.keys(overrides.extraPrincipals || {});
    return Array.from(new Set([...base, ...extras]));
  }, [overrides.extraPrincipals]);

  const principalLabel = (p: string) =>
    overrides.principals?.[p]?.label ??
    overrides.extraPrincipals?.[p]?.label ??
    p;

  /* === save helpers: optimistic update + server, lalu refetch === */
  const doSave = async (next: TargetOverrides) => {
    setSaveError("");
    writeOverrides(viewRole, next); // optimistik
    setOverrides(next);
    try {
      await saveOverridesToServer(viewRole, next);
      await refreshOverrides(viewRole);
    } catch {
      setSaveError("Gagal menyimpan ke server.");
      // rollback ke server state terbaru
      await refreshOverrides(viewRole);
    }
  };

  const saveCopy = async (k: CopyKeys, v: string) => {
    const cur = readOverrides(viewRole);
    await doSave(patchCopy(cur, k, v));
  };
  const savePrincipalLabel = async (p: string, v: string) => {
    const cur = readOverrides(viewRole);
    await doSave(patchPrincipalLabel(cur, p, v));
  };
  const resetOverrides = async () => {
    if (!isSuper) return;
    if (
      !confirm(
        `Reset pengaturan teks & principal custom untuk role ${viewRole}?`
      )
    )
      return;
    await doSave({});
  };

  /* ====== STATE LOKAL CHECKLIST ====== */
  const [klaimMap, setKlaimMap] = useState<Record<string, boolean>>(
    data.klaimSelesai || {}
  );
  const [weeklyMap, setWeeklyMap] = useState<Record<string, boolean[]>>(
    data.weekly || {}
  );
  const [fodksListLocal, setFodksListLocal] = useState<FodksItem[]>([]);

  // sinkronkan ke parent (untuk konsistensi antar section)
  useEffect(() => {
    onChange({
      ...data,
      klaimSelesai: klaimMap,
      weekly: weeklyMap,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(klaimMap), JSON.stringify(weeklyMap)]);

  /* ====== LOAD dari server (checks) ====== */
  const [loadStatus, setLoadStatus] = useState<
    "idle" | "loading" | "loaded" | "error"
  >("idle");

  const loadFromServer = useCallback(async () => {
    if (!accountId) return;
    try {
      setLoadStatus("loading");
      const altParam = altId ? `&altId=${encodeURIComponent(altId)}` : "";
      const url = `/api/target/checks?accountId=${encodeURIComponent(
        accountId
      )}&period=${period}${altParam}`;
      const res = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as Partial<SavedChecks>;
      if (json.klaimSelesai) setKlaimMap(json.klaimSelesai);
      if (json.weekly) setWeeklyMap(json.weekly);
      if (json.fodksList) setFodksListLocal(json.fodksList);
      setLoadStatus("loaded");
    } catch {
      setLoadStatus("error");
    }
  }, [accountId, altId, period]);

  useEffect(() => {
    loadFromServer();
  }, [loadFromServer]);

  /* ====== SUBMIT (PUT checks) ====== */
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
      const altParam = altId ? `&altId=${encodeURIComponent(altId)}` : "";
      const url = `/api/target/checks?accountId=${encodeURIComponent(
        accountId
      )}&period=${period}${altParam}`;

      const res = await fetch(url, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1500);
      await loadFromServer();
    } catch {
      setSaveStatus("error");
    }
  };

  /* ===== tambah/hapus principal (superadmin saja) ===== */
  const addPrincipal = async (key: string, label: string) => {
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
    await doSave(addExtraPrincipal(cur, k, lbl));
    setWeeklyMap((prev) => ({
      ...prev,
      [k]: prev[k] ?? [false, false, false, false],
    }));
    setKlaimMap((prev) => ({ ...prev, [k]: prev[k] ?? false }));
  };

  const removePrincipal = async (key: string) => {
    if (!isSuper) return;
    if (!confirm(`Hapus principal ${key}?`)) return;
    const cur = readOverrides(viewRole);
    await doSave(removeExtraPrincipal(cur, key));
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

  /* ===== deadline (superadmin, persist ke server via overrides) ===== */
  type DeadlineScope = keyof TargetDeadlines;
  const setDeadline = async (scope: DeadlineScope, value: string, p?: PKey) => {
    if (!isSuper) return;
    const cur = readOverrides(viewRole);
    const next = patchDeadlines(cur, scope, value, p);
    await doSave(next);

    // update parent (opsional, supaya state di halaman ini konsisten)
    onChange({
      ...data,
      deadlines: next.deadlines || data.deadlines,
    });
  };

  const getDeadline = (scope: DeadlineScope, p?: PKey): string => {
    const d = overrides.deadlines;
    if (scope === "klaim" && p)
      return (d?.klaim as Record<PKey, string> | undefined)?.[p] ?? "";
    if (scope === "weekly" && p)
      return (d?.weekly as Record<PKey, string> | undefined)?.[p] ?? "";
    if (scope === "targetSelesai") return d?.targetSelesai ?? "";
    if (scope === "fodks") return d?.fodks ?? "";
    return "";
  };

  /* ===== FODKS logic ===== */
  const uidGen = () =>
    Math.random().toString(36).slice(2) + Date.now().toString(36);
  const addFodksItem = () => {
    const next: FodksItem[] = [
      ...fodksListLocal,
      {
        id: uidGen(),
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

  const showDebug =
    isSuper ||
    (typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("debug") === "1");

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
            {!accountId && (
              <span className="ml-2 text-xs text-slate-500">
                Menunggu akun…
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Submit */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!accountId || saveStatus === "saving"}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-white text-sm focus:outline-none focus:ring-4 ${
                !accountId
                  ? "bg-emerald-400/60 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-100"
              }`}
              title={!accountId ? "Login dulu, akun belum siap" : "Simpan"}
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
                  onChange={(ev) => setTargetRole(ev.target.value as Role)}
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
                    onChange={(ev) => setEditMode(ev.target.checked)}
                  />
                  Mode Edit
                </label>
                <button
                  type="button"
                  onClick={() => void resetOverrides()}
                  className="text-xs px-2 py-1 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50"
                >
                  Reset Label
                </button>
                <span className="ml-2 text-[11px] text-slate-500">
                  viewRole: <b>{viewRole}</b> • sync: {lastSync}
                </span>
                <button
                  type="button"
                  onClick={() => void refreshOverrides(viewRole)}
                  className="text-xs px-2 py-1 rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50"
                  title="Paksa refresh dari server"
                >
                  Refresh
                </button>
              </>
            )}
          </div>
        </div>

        {saveError && (
          <div className="px-3 sm:px-6 py-2 text-xs text-rose-700 bg-rose-50 border-b">
            {saveError}
          </div>
        )}

        {/* ===== Bagian 1: Klaim selesai ===== */}
        <div className="p-3 sm:p-6">
          <div className="mb-3 text-sm font-semibold text-slate-700 flex items-center gap-2">
            {editMode ? (
              <input
                defaultValue={copy.klaimTitle}
                onBlur={(ev) => void saveCopy("klaimTitle", ev.target.value)}
                className="w-full max-w-[420px] rounded-2xl border-2 border-slate-300 bg-white text-sm px-3 py-2 text-center focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
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
                  {isSuper && editMode ? (
                    <th className="py-2 px-2">Aksi</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y border rounded-xl bg-white">
                {allPrincipals.map((p) => {
                  const checked = klaimMap[p] || false;
                  const isBase = isBasePrincipal(p);
                  return (
                    <tr key={p}>
                      <td className="py-3 px-2 font-medium text-slate-800">
                        {editMode ? (
                          <input
                            defaultValue={principalLabel(p)}
                            onBlur={(ev) =>
                              void savePrincipalLabel(p, ev.target.value)
                            }
                            className="w-full rounded-2xl border-2 border-slate-300 bg-white text-sm px-3 py-2 text-center focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
                            placeholder={`Nama principal untuk ${p}`}
                          />
                        ) : (
                          principalLabel(p)
                        )}
                      </td>

                      <td className="py-3 px-2">
                        <input
                          type="date"
                          disabled={!isSuper || !isBase}
                          className={`w-full rounded-2xl border-2 border-slate-300 bg-white text-sm px-3 py-2 text-center focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 ${
                            !isSuper || !isBase
                              ? "opacity-60 cursor-not-allowed bg-slate-50 text-slate-500"
                              : ""
                          }`}
                          value={isBase ? getDeadline("klaim", p) : ""}
                          onChange={(ev) =>
                            isBase &&
                            void setDeadline("klaim", ev.target.value, p)
                          }
                        />
                      </td>

                      <td
                        className="py-3 px-2"
                        role="button"
                        tabIndex={0}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          toggleKlaim(p);
                        }}
                        onKeyDown={(ev) =>
                          handleKeyActivate(ev, () => toggleKlaim(p))
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
                            onClick={(ev) => {
                              ev.stopPropagation();
                              toggleKlaim(p);
                            }}
                          />
                          <span className="text-sm text-slate-700">
                            Selesai
                          </span>
                        </label>
                      </td>

                      {isSuper && editMode ? (
                        <td className="py-3 px-2">
                          {overrides.extraPrincipals?.[p] && (
                            <button
                              type="button"
                              onClick={() => void removePrincipal(p)}
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
              onBlur={(ev) => void saveCopy("weeklyTitle", ev.target.value)}
              className="w-full max-w-[520px] rounded-2xl border-2 border-slate-300 bg-white text-sm px-3 py-2 text-center focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
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
                          onBlur={(ev) =>
                            void savePrincipalLabel(p, ev.target.value)
                          }
                          className="w-full rounded-2xl border-2 border-slate-300 bg-white text-sm px-3 py-2 text-center focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
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
                        onClick={(ev) => {
                          ev.stopPropagation();
                          toggleWeekly(p, w);
                        }}
                        onKeyDown={(ev) =>
                          handleKeyActivate(ev, () => toggleWeekly(p, w))
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
                            onClick={(ev) => {
                              ev.stopPropagation();
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
                            onClick={() => void removePrincipal(p)}
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
              onBlur={(ev) => void saveCopy("fodksTitle", ev.target.value)}
              className="w-full max-w-[420px] rounded-2xl border-2 border-slate-300 bg-white text-sm px-3 py-2 text-center focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
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
            onKeyDown={(ev) => handleKeyActivate(ev, addFodksItem)}
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
                {isSuper && editMode ? (
                  <th className="text-left py-2 px-2 w-[80px]">Aksi</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {fodksListLocal.length === 0 && (
                <tr>
                  <td
                    colSpan={isSuper && editMode ? 3 : 2}
                    className="py-6 px-2 text-center text-slate-500"
                  >
                    Belum ada input FODKS. Klik{" "}
                    <span className="font-medium">Tambah</span> untuk
                    menambahkan.
                  </td>
                </tr>
              )}

              {fodksListLocal.map((it) => {
                const editable = canEditItem(it) && editMode;
                return (
                  <FodksRow
                    key={it.id}
                    item={it}
                    canEdit={editable}
                    onChange={(patch) => patchFodksItem(it.id, patch)}
                    onDelete={
                      isSuper && editMode
                        ? () => removeFodksItem(it.id)
                        : undefined
                    }
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showDebug && (
        <pre className="text-xs bg-slate-50 p-3 rounded-xl border overflow-x-auto">
          {JSON.stringify({ viewRole, overrides }, null, 2)}
        </pre>
      )}
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
          onChange={(ev) => setKey(ev.target.value)}
          className="rounded-2xl border-2 border-blue-200 bg-white text-sm px-3 py-2 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
          placeholder="Key unik (contoh: p_klaim-baru)"
        />
        <input
          value={label}
          onChange={(ev) => setLabel(ev.target.value)}
          className="rounded-2xl border-2 border-blue-200 bg-white text-sm px-3 py-2 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
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
