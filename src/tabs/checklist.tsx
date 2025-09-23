"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { ClipboardList, CheckCircle2, Plus, Trash2 } from "lucide-react";
import type { ChecklistState, RowValue, SectionKey } from "@/lib/types";
import { NumberWithSuffix, ScoreSelect } from "./common";
import { useAuth } from "@/components/AuthProvider";
import type { Role } from "@/components/AuthProvider";

/* ================= OVERRIDES ================= */
type AddedRowMeta = {
  __added?: boolean;
  __delete?: boolean;
  order?: number;
  extras?: { text?: boolean; currency?: boolean; number?: boolean };
  kind?: "options" | "number" | "score" | "compound";
};

type RowOverride = AddedRowMeta & {
  label?: string;
  options?: string[];
  suffix?: string;
  // NEW: aktifkan mode daftar (+) generik untuk compound
  list?: boolean;
  listLabels?: { text?: string; currency?: string; number?: string };
};

// >>> dukung section custom (key diawali x_)
type AnySectionKey = SectionKey | `x_${string}`;
type ExtraSectionMeta = { title: string; hidden?: boolean; order?: number };

type ChecklistOverrides = {
  sections?: Partial<Record<SectionKey, { title?: string; hidden?: boolean }>>;
  rows?: Partial<Record<AnySectionKey, Record<string, RowOverride>>>;
  extraSections?: Record<`x_${string}`, ExtraSectionMeta>;
};

const OV_KEY = "sitrep-checklist-copy-v3";
const ROLES: Role[] = ["admin", "sales", "gudang"];

/* ===== Helpers untuk override (WAJIB ADA) ===== */
function mergeRowOverride(
  src: ChecklistOverrides,
  sec: AnySectionKey,
  rowKey: string,
  patch: RowOverride
): ChecklistOverrides {
  const rows: NonNullable<ChecklistOverrides["rows"]> = { ...(src.rows || {}) };
  const secMap: Record<string, RowOverride> = { ...(rows?.[sec] || {}) };
  rows[sec] = { ...secMap, [rowKey]: { ...(secMap[rowKey] || {}), ...patch } };
  return { ...src, rows };
}
function mergeSectionTitle(
  src: ChecklistOverrides,
  sec: SectionKey,
  title: string
): ChecklistOverrides {
  const sections: NonNullable<ChecklistOverrides["sections"]> = {
    ...(src.sections || {}),
  };
  const prev = sections[sec] ?? {};
  sections[sec] = { ...prev, title };
  return { ...src, sections };
}
function mergeSectionHidden(
  src: ChecklistOverrides,
  sec: SectionKey,
  hidden: boolean
): ChecklistOverrides {
  const sections: NonNullable<ChecklistOverrides["sections"]> = {
    ...(src.sections || {}),
  };
  const prev = sections[sec] ?? {};
  sections[sec] = { ...prev, hidden };
  return { ...src, sections };
}
function mergeExtraSection(
  src: ChecklistOverrides,
  key: `x_${string}`,
  meta: ExtraSectionMeta
): ChecklistOverrides {
  const extra = { ...(src.extraSections || {}) };
  extra[key] = { ...(extra[key] || {}), ...meta };
  return { ...src, extraSections: extra };
}
function deleteExtraSection(
  src: ChecklistOverrides,
  key: `x_${string}`
): ChecklistOverrides {
  const extra = { ...(src.extraSections || {}) };
  delete extra[key];
  const rows = { ...(src.rows || {}) };
  delete rows[key];
  return { ...src, extraSections: extra, rows };
}

/* ====== LOCAL (tetap dipakai untuk mempertahankan logika lama) ====== */
function readRoleOverrides(role: Role): ChecklistOverrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`${OV_KEY}:${role}`);
    return raw ? (JSON.parse(raw) as ChecklistOverrides) : {};
  } catch {
    return {};
  }
}
function writeRoleOverrides(role: Role, v: ChecklistOverrides) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${OV_KEY}:${role}`, JSON.stringify(v));
}

/* ====== SERVER SYNC (Supabase via Next.js API) ====== */
async function fetchOverridesFromServer(
  role: Role
): Promise<ChecklistOverrides> {
  const res = await fetch(`/api/checklist/overrides?role=${role}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`GET /overrides ${res.status}`);
  const json = await res.json();
  return (json?.overrides ?? {}) as ChecklistOverrides;
}
async function saveOverridesToServer(
  role: Role,
  overrides: ChecklistOverrides,
  editorRole?: string
) {
  const res = await fetch(`/api/checklist/overrides?role=${role}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-User-Role": editorRole ?? "",
    },
    body: JSON.stringify({ overrides }),
  });
  if (!res.ok) throw new Error(`PUT /overrides ${res.status}`);
}

/* ================= DEFINISI ROW & BASE ================= */
type RowBase = { key: string; label: string };

type RowDefOptions = RowBase & { kind: "options"; options: string[] };
type RowDefNumber = RowBase & { kind: "number"; suffix?: string };
type RowDefScore = RowBase & { kind: "score" };
type RowDefCompound = RowBase & {
  kind: "compound";
  options: string[];
  extra?: { type: "text" | "currency" | "number"; placeholder?: string }[];
  // NEW: jika true, kolom extra menjadi repeatable (+)
  list?: boolean;
  listLabels?: { text?: string; currency?: string; number?: string };
};

type RowDef = RowDefOptions | RowDefNumber | RowDefScore | RowDefCompound;

function isOptions(r: RowDef): r is RowDefOptions {
  return r.kind === "options";
}
function isNumber(r: RowDef): r is RowDefNumber {
  return r.kind === "number";
}
function isScore(r: RowDef): r is RowDefScore {
  return r.kind === "score";
}
function isCompound(r: RowDef): r is RowDefCompound {
  return r.kind === "compound";
}

/* =============== UTIL FORMAT CURRENCY =============== */
const toDigits = (s: string) => (s || "").replace(/[^\d]/g, "");
const formatIDR = (digitStr?: string) => {
  if (!digitStr) return "";
  const n = Number(digitStr);
  if (isNaN(n)) return "";
  return new Intl.NumberFormat("id-ID").format(n);
};

/* =============== FIELD CURRENCY AUTO-WIDTH =============== */
function CurrencyField({
  valueDigits,
  onChangeDigits,
  placeholder,
  className = "",
}: {
  valueDigits?: string;
  onChangeDigits: (digits: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mirrorRef = useRef<HTMLSpanElement | null>(null);
  const [widthPx, setWidthPx] = useState<number>(0);

  const display = formatIDR(valueDigits);

  useEffect(() => {
    const mirror = mirrorRef.current;
    if (!mirror) return;
    mirror.textContent = display || placeholder || "";
    const contentWidth = Math.ceil(mirror.getBoundingClientRect().width);
    const PADDING_X = 24;
    const PREFIX_SPACE = 28;
    const MIN_W = 140;
    const next = Math.max(contentWidth + PADDING_X + PREFIX_SPACE, MIN_W);
    setWidthPx(next);
  }, [display, placeholder]);

  return (
    <div className={`relative w-full ${className}`}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm select-none">
        Rp.
      </span>
      <input
        ref={inputRef}
        value={display}
        onChange={(e) => onChangeDigits(toDigits(e.target.value))}
        inputMode="numeric"
        placeholder={placeholder || "contoh: 4.235.523"}
        className={
          "rounded-xl border-2 border-slate-300 bg-white text-sm " +
          "px-3 py-2 pl-12 text-right " +
          "focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 " +
          "placeholder:text-left"
        }
        style={{
          width: widthPx ? `${widthPx}px` : undefined,
          maxWidth: "100%",
        }}
      />
      <span
        ref={mirrorRef}
        className="invisible absolute left-0 top-0 whitespace-pre px-3 py-2 font-normal text-sm"
        aria-hidden
      />
    </div>
  );
}
//
function OptionsEditor({
  options,
  onChange,
}: {
  options: string[];
  onChange: (opts: string[]) => void;
}) {
  const [items, setItems] = React.useState<string[]>(
    (options && options.length ? options : ["", ""]).slice()
  );

  // Sinkron bila options dari luar berubah
  useEffect(() => {
    setItems((options && options.length ? options : ["", ""]).slice());
  }, [JSON.stringify(options)]);

  // Notifikasi keluar setiap kali items berubah (dibersihkan)
  useEffect(() => {
    const cleaned = items.map((s) => s.trim()).filter(Boolean);
    onChange(cleaned);
  }, [items, onChange]);

  const addItem = () => setItems((arr) => [...arr, ""]);
  const removeItem = (idx: number) =>
    setItems((arr) => arr.filter((_, i) => i !== idx));
  const updateItem = (idx: number, val: string) =>
    setItems((arr) => {
      const next = [...arr];
      next[idx] = val;
      return next;
    });

  return (
    <div className="mb-2 rounded-lg border border-slate-300 bg-white p-2">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-medium text-slate-600">
          Pilihan Checkbox
        </div>
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50"
          title="Tambah pilihan"
        >
          <Plus className="h-3.5 w-3.5" /> Tambah
        </button>
      </div>

      {items.length === 0 && (
        <div className="text-xs text-slate-500 px-1">Belum ada pilihan.</div>
      )}

      <div className="space-y-2">
        {items.map((it, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              value={it}
              onChange={(e) => updateItem(idx, e.target.value)}
              placeholder={`Pilihan #${idx + 1}`}
              className="flex-1 rounded-xl border-2 border-slate-300 bg-white text-sm px-3 py-2 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
            />
            <button
              type="button"
              onClick={() => removeItem(idx)}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
              title="Hapus pilihan ini"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =============== SERIALIZER utk SECTION AKTIF SAJA =============== */
type TidyChecklistRow = {
  sectionKey: string;
  sectionTitle: string;
  rowKey: string;
  rowLabel: string;
  valueJoined?: string | null;
  numberValue?: string | number | null;
  scoreValue?: number | null;
  extra_text?: string | null;
  extra_currency?: string | null;
  extra_number?: string | number | null;
  note?: string | null;
};

function rowDefLabel(def: RowDef): string {
  return def.label || "";
}

type SectionState = Record<string, RowValue>;
type ExtendedChecklistState = ChecklistState &
  Record<AnySectionKey, SectionState>;

function parseListFromExtrasText(
  raw?: string | null
): Array<{ text?: string; currency?: string; number?: string }> {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      return arr.map((x) => ({
        text: x?.text ? String(x.text) : "",
        currency: x?.currency ? String(x.currency) : "",
        number: x?.number ? String(x.number) : "",
      }));
    }
    return [];
  } catch {
    return [];
  }
}

function stringifyListToExtrasText(
  items: Array<{ text?: string; currency?: string; number?: string }>
) {
  return JSON.stringify(
    items.map((x) => ({
      text: (x.text || "").trim(),
      currency: (x.currency || "").trim(),
      number: (x.number || "").trim(),
    }))
  );
}

function toTidyRowsForSection(
  data: ExtendedChecklistState,
  sectionKey: AnySectionKey,
  FINAL_MAP: Record<string, { title: string; rows: RowDef[] }>
): TidyChecklistRow[] {
  const sec = FINAL_MAP[sectionKey];
  if (!sec) return [];
  const secTitle = sec.title;
  const out: TidyChecklistRow[] = [];
  sec.rows.forEach((def) => {
    const v = data[sectionKey]?.[def.key];
    if (!v) {
      out.push({
        sectionKey: String(sectionKey),
        sectionTitle: secTitle,
        rowKey: def.key,
        rowLabel: rowDefLabel(def),
        valueJoined: null,
        numberValue: null,
        scoreValue: null,
        extra_text: null,
        extra_currency: null,
        extra_number: null,
        note: null,
      });
      return;
    }
    if (v.kind === "options") {
      out.push({
        sectionKey: String(sectionKey),
        sectionTitle: secTitle,
        rowKey: def.key,
        rowLabel: rowDefLabel(def),
        valueJoined: v.value ?? null,
        numberValue: null,
        scoreValue: null,
        extra_text: null,
        extra_currency: null,
        extra_number: null,
        note: v.note ?? null,
      });
    } else if (v.kind === "number") {
      out.push({
        sectionKey: String(sectionKey),
        sectionTitle: secTitle,
        rowKey: def.key,
        rowLabel: rowDefLabel(def),
        valueJoined: null,
        numberValue: v.value ?? null,
        scoreValue: null,
        extra_text: null,
        extra_currency: null,
        extra_number: null,
        note: v.note ?? null,
      });
    } else if (v.kind === "score") {
      out.push({
        sectionKey: String(sectionKey),
        sectionTitle: secTitle,
        rowKey: def.key,
        rowLabel: rowDefLabel(def),
        valueJoined: null,
        numberValue: null,
        scoreValue: v.value ?? null,
        extra_text: null,
        extra_currency: null,
        extra_number: null,
        note: v.note ?? null,
      });
    } else if (v.kind === "compound") {
      out.push({
        sectionKey: String(sectionKey),
        sectionTitle: secTitle,
        rowKey: def.key,
        rowLabel: rowDefLabel(def),
        valueJoined: v.value ?? null,
        numberValue: null,
        scoreValue: null,
        extra_text: v.extras?.text ?? null,
        extra_currency: v.extras?.currency ?? null,
        extra_number: v.extras?.number ?? null,
        note: v.note ?? null,
      });
    }
  });
  return out;
}

// URL GAS
const FALLBACK_GAS_URL: string =
  (typeof window !== "undefined" && (process.env.NEXT_PUBLIC_GAS_URL ?? "")) ||
  "";

// POST helper
async function postToGAS(gasUrl: string, payload: Record<string, unknown>) {
  if (!gasUrl) {
    console.warn(
      "[ChecklistArea] GAS URL kosong. Isi props gasUrl atau NEXT_PUBLIC_GAS_URL."
    );
    return;
  }
  await fetch(gasUrl, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/* ================= COMPONENT ================= */
export default function ChecklistArea({
  data,
  onChange,
  gasUrl, // optional
}: {
  data: ChecklistState;
  onChange: (v: ChecklistState) => void;
  gasUrl?: string;
}) {
  const { role, name } = useAuth() as { role?: string; name?: string };
  const isSuper = role === "superadmin";

  const [targetRole, setTargetRole] = useState<Role>("admin");
  const viewRole = (isSuper ? targetRole : (role as Role)) || "admin";
  const [editMode, setEditMode] = useState(false);
  const [simpleMode, setSimpleMode] = useState(true);

  const [rev, setRev] = useState(0);

  // UI states
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    kind?: "ok" | "err";
  } | null>(null);

  // Anchor untuk scroll (tepat di atas konten section)
  const sectionAnchorRef = useRef<HTMLDivElement | null>(null);

  // helper toast non-blocking
  const showToast = (msg: string, kind: "ok" | "err" = "ok") => {
    setToast({ msg, kind });
    window.setTimeout(() => setToast(null), 2200);
  };

  // helper scroll: jangan terlalu atas, tapi ke anchor konten section
  const scrollToSectionAnchor = (offsetPx = 16) => {
    if (typeof window === "undefined") return;
    const el = sectionAnchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const top = window.scrollY + rect.top - offsetPx;
    window.scrollTo({ top, behavior: "smooth" });
  };

  useEffect(() => {
    // Perbaiki override lama yang bikin opsi Dropping kosong
    const cur = readRoleOverrides(viewRole);
    const row = (cur.rows?.kas || {})["dropping-kas-kecil"];

    if (row && Array.isArray(row.options) && row.options.length === 0) {
      const next = mergeRowOverride(cur, "kas", "dropping-kas-kecil", {
        options: ["Ada", "Tidak"],
      });
      writeRoleOverrides(viewRole, next);
      void saveOverridesToServer(viewRole, next, role).catch(() => {});
      setRev((x) => x + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewRole, rev]);

  /* ===== sinkronisasi awal dari SERVER → localStorage (per role) ===== */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const remote = await fetchOverridesFromServer(viewRole);
        if (!alive) return;
        writeRoleOverrides(viewRole, remote); // simpan ke local agar logic lama tetap sama
        setRev((x) => x + 1); // picu re-render supaya overrides terbaru terpakai
      } catch (e) {
        // diamkan saja; fallback tetap ke localStorage
        console.warn("Gagal memuat overrides dari server:", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [viewRole]);

  /* ===== BASE (fixed) ===== */
  const BASE_MAP: Record<SectionKey, { title: string; rows: RowDef[] }> =
    useMemo(
      () => ({
        /* ===== 1. KAS KECIL ===== */
        kas: {
          title: "Kas Kecil",
          rows: [
            {
              kind: "compound",
              key: "saldo-kas-kecil",
              label: "Saldo Kas Kecil",
              options: ["Cocok", "Tidak Cocok"],
              extra: [{ type: "currency", placeholder: "Saldo (Rp)" }],
            },
            {
              kind: "compound",
              key: "voucher-individual",
              label: "Voucher Individual",
              options: ["Clear", "Tidak Beres"],
              extra: [{ type: "number", placeholder: "pcs" }],
            },
            {
              kind: "options",
              key: "voucher-harian",
              label: "Voucher Harian",
              options: ["Clear", "Tidak Beres"],
            },
            {
              kind: "options",
              key: "approval",
              label: "Approval",
              options: ["Sesuai", "Tidak Sesuai"],
            },
            {
              kind: "compound",
              key: "kasbon-operasional",
              label: "Kasbon Operasional",
              options: ["Clear", "Belum Kembali"],
              extra: [{ type: "text", placeholder: "Keterangan" }],
            },
            {
              kind: "options",
              key: "dok-bukti-biaya",
              label: "Dokumentasi Bukti Pengeluaran Biaya",
              options: ["Valid", "Tidak Valid"],
            },
            {
              kind: "compound",
              key: "dropping-kas-kecil",
              label: "Dropping Kas Kecil",
              options: ["Ada", "Tidak"],
              extra: [
                { type: "currency", placeholder: "Nilai (Rp)" },
                { type: "text", placeholder: "Nomor Dropping Kas" },
              ],
            },
            {
              kind: "options",
              key: "serah-terima-fat",
              label: "Serah Terima dengan FAT",
              options: ["Sudah"],
            },

            {
              kind: "compound",
              key: "rekonsiliasi-kas-kecil",
              label: "Rekonsiliasi Kas Kecil harian",
              options: ["Selesai", "Belum"],
              extra: [{ type: "text", placeholder: "Catatan selisih" }],
            },
            {
              kind: "number",
              key: "jumlah-voucher-bulan-ini",
              label: "Jumlah voucher bulan berjalan",
              suffix: "voucher",
            },
            {
              kind: "options",
              key: "saldo-batas-minimum",
              label: "Saldo di atas batas minimum",
              options: ["Ya", "Tidak"],
            },
          ],
        },

        /* ===== 2. BUKU PENUNJANG ===== */
        buku: {
          title: "Buku Penunjang",
          rows: [
            {
              kind: "options",
              key: "bbm-berlangganan",
              label: "Buku Kontrol BBM Berlangganan",
              options: ["Sesuai", "Tidak Sesuai"],
            },
            {
              kind: "options",
              key: "khusus-materai",
              label: "Buku Khusus Materai",
              options: ["Sesuai", "Tidak Sesuai"],
            },
            {
              kind: "options",
              key: "buku-kasbon-operasional",
              label: "Buku Kasbon Operasional",
              options: ["Sesuai", "Tidak Sesuai"],
            },
            {
              kind: "options",
              key: "buku-pengeluaran-kas",
              label: "Buku Pengeluaran Kas diperbarui",
              options: ["Sesuai", "Tidak Sesuai"],
            },
            {
              kind: "compound",
              key: "buku-retur-pembelian",
              label: "Buku Retur Pembelian",
              options: ["Lengkap", "Tidak Lengkap"],
              extra: [{ type: "text", placeholder: "Penjelasan kekurangan" }],
            },
          ],
        },

        /* ===== 3. AR ===== */
        ar: {
          title: "AR",
          rows: [
            {
              kind: "options",
              key: "faktur-h2",
              label: "Faktur Tagihan Sales disiapkan H-2",
              options: ["Dilakukan", "Tidak Dilakukan"],
            },
            {
              kind: "options",
              key: "faktur-disuaikan",
              label: "Faktur Tagihan disesuaikan Rute, Permintaan, Kebutuhan",
              options: ["Dilakukan", "Tidak Dilakukan"],
            },
            {
              kind: "options",
              key: "faktur-perlu-ditagih",
              label:
                "Faktur yang perlu ditagih/overdue/sales teman tidak masuk dibawakan",
              options: ["Dilakukan", "Tidak Dilakukan"],
            },
            {
              kind: "options",
              key: "penyerahan-faktur",
              label: "Penyerahan Faktur ke Salesman/Spv",
              options: ["On Time", "Terlambat"],
            },
            {
              kind: "compound",
              key: "pengembalian-faktur-admin",
              label: "Pengembalian Faktur AR ke Admin",
              options: ["Kembali Lengkap", "Ada yang tidak kembali"],
              extra: [{ type: "text", placeholder: "Penjelasan" }],
            },
            {
              kind: "options",
              key: "penagihan-tagihan-karyawan",
              label: "Penagihan Tagihan Karyawan",
              options: ["Beres", "Tidak Diurus"],
            },
            {
              kind: "compound",
              key: "faktur-tunai-tertagihkan",
              label: "Semua Faktur Tunai yang Terkirim → Tertagihkan",
              options: ["Beres", "Tidak"],
              extra: [{ type: "text", placeholder: "Penjelasan" }],
            },
            {
              kind: "options",
              key: "laporan-ar-mingguan",
              label: "Laporan AR Mingguan",
              options: ["Sudah", "Lewat Deadline"],
            },
            {
              kind: "compound",
              key: "total-od",
              label: "Total OD",
              options: [],
              extra: [{ type: "currency", placeholder: "Rp." }],
            },
            {
              kind: "compound",
              key: "total-od-60",
              label: "Total OD > 60 hari",
              options: [],
              extra: [
                { type: "currency", placeholder: "Rp." },
                { type: "number", placeholder: "Jumlah Faktur" },
              ],
            },
            {
              kind: "compound",
              key: "setoran-giro-1",
              label: "Setoran Giro",
              options: [],
              extra: [
                { type: "text", placeholder: "Nama Outlet" },
                { type: "text", placeholder: "Jatuh Tempo Tgl" },
                { type: "text", placeholder: "Jatuh Tempo Giro Tgl" },
                { type: "text", placeholder: "Penagih" },
              ],
            },
            {
              kind: "compound",
              key: "setoran-giro-2",
              label: "Setoran Giro (2)",
              options: [],
              extra: [
                { type: "text", placeholder: "Nama Outlet" },
                { type: "text", placeholder: "Jatuh Tempo Tgl" },
                { type: "text", placeholder: "Jatuh Tempo Giro Tgl" },
                { type: "text", placeholder: "Penagih" },
              ],
            },
            {
              kind: "compound",
              key: "setoran-giro-3",
              label: "Setoran Giro (3)",
              options: [],
              extra: [
                { type: "text", placeholder: "Nama Outlet" },
                { type: "text", placeholder: "Jatuh Tempo Tgl" },
                { type: "text", placeholder: "Jatuh Tempo Giro Tgl" },
                { type: "text", placeholder: "Penagih" },
              ],
            },
          ],
        },

        /* ===== 4. KLAIM ===== */
        klaim: {
          title: "Klaim",
          rows: [
            {
              kind: "compound",
              key: "klaim-bs-proses",
              label: "Semua Klaim BS sudah terproses/sedang diproses",
              options: ["Beres", "Belum Diurus"],
              extra: [{ type: "text", placeholder: "Penjelasan" }],
            },
            {
              kind: "compound",
              key: "klaim-bank-garansi-proses",
              label: "Semua Klaim Bank Garansi terproses/sedang diproses",
              options: ["Beres", "Belum Diurus"],
              extra: [{ type: "text", placeholder: "Penjelasan" }],
            },
            {
              kind: "compound",
              key: "klaim-on-track",
              label: "Pengerjaan Klaim on Track / Behind Schedule",
              options: ["Iya", "Behind Schedule"],
              extra: [{ type: "text", placeholder: "Penjelasan" }],
            },
            {
              kind: "options",
              key: "update-monitoring-klaim",
              label: "Update Monitoring Klaim",
              options: ["Lengkap", "Tidak Lengkap"],
            },
          ],
        },

        /* ===== 5. PENGIRIMAN ===== */
        pengiriman: {
          title: "Pengiriman",
          rows: [
            {
              kind: "number",
              key: "do-belum-draft-loading",
              label: "Faktur DO yang belum draft loading",
              suffix: "Faktur",
            },
            {
              kind: "compound",
              key: "draft-loading-besok",
              label: "Pengiriman Besok Sudah Draft Loading Semua",
              options: ["Iya", "Belum"],
              extra: [
                { type: "number", placeholder: "Jumlah faktur belum draft" },
              ],
            },
            {
              kind: "compound",
              key: "faktur-kembali",
              label: "Faktur Kembali dari Pengiriman",
              options: [
                "100%",
                "Ada yang tidak kembali",
                "Kondisi Dokumen Baik",
                "Tanda terima lengkap",
                "Input di aPos",
              ],
              extra: [{ type: "text", placeholder: "Alasan" }],
            },
            {
              kind: "compound",
              key: "faktur-dibatalkan",
              label: "Faktur yang dibatalkan",
              options: ["Ada", "Tidak"],
              extra: [
                { type: "number", placeholder: "Jumlah Faktur" },
                { type: "text", placeholder: "Nomor Faktur" },
              ],
            },
            {
              kind: "compound",
              key: "coret-nota",
              label: "Coret Nota",
              options: ["Ada", "Tidak"],
            },
            {
              kind: "compound",
              key: "konfirmasi-sales",
              label: "Konfirmasi ke Tim Salesman",
              options: ["Sudah", "Belum"],
            },
          ],
        },

        /* ===== 6. SETORAN BANK ===== */
        setoran: {
          title: "Setoran Bank",
          rows: [
            {
              kind: "options",
              key: "kas-besar-disetorkan",
              label: "Kas besar disetorkan bank semua",
              options: ["Sesuai", "Tidak Sesuai"],
            },
            {
              kind: "options",
              key: "setoran-sesuai-entity",
              label: "Setoran Bank sesuai Entity",
              options: ["Sesuai", "Tidak Sesuai"],
            },
            {
              kind: "compound",
              key: "setoran-astro-dm",
              label: "Nominal Setoran Astro DM",
              options: [],
              extra: [{ type: "currency", placeholder: "Astro DM (Rp)" }],
            },
            {
              kind: "compound",
              key: "setoran-astro-tumbuh",
              label: "Nominal Setoran Astro Tumbuh",
              options: [],
              extra: [{ type: "currency", placeholder: "Astro Tumbuh (Rp)" }],
            },
            {
              kind: "options",
              key: "penjurnalan-kas-besar",
              label: "Penjurnalan Kas Besar ke Bank",
              options: ["Sesuai", "Tidak Sesuai", "Tidak Dikerjakan"],
            },
          ],
        },

        /* ===== 7. PROSES PEMBELIAN ===== */
        pembelian: {
          title: "Proses Pembelian",
          rows: [
            {
              kind: "options",
              key: "laporan-doi-update",
              label: "Laporan DOI harian update dan update barang baru",
              options: ["Sesuai", "Tidak Sesuai"],
            },
            {
              kind: "options",
              key: "rekomendasi-po-admin",
              label: "Ada rekomendasi PO dari Admin Pembelian",
              options: ["Sesuai", "Tidak Sesuai"],
            },
            {
              kind: "options",
              key: "kelengkapan-rekomendasi-po",
              label: "Kelengkapan Rekomendasi PO",
              options: ["Sesuai", "Tidak Sesuai"],
            },
            {
              kind: "number",
              key: "jumlah-kiriman-po",
              label: "Jumlah Kiriman PO diterima hari ini",
              suffix: "PO",
            },
          ],
        },

        /* ===== 8. PENJUALAN ===== */
        faktur: {
          title: "Penjualan",
          rows: [
            {
              kind: "number",
              key: "jumlah-penjualan-terinput",
              label: "Jumlah penjualan terinput",
              suffix: "Jumlah Faktur",
            },
            {
              kind: "compound",
              key: "harga-promo",
              label: "Harga & Promo",
              options: ["Sesuai", "Tidak Sesuai"],
              extra: [{ type: "text", placeholder: "Alasan" }],
            },
            {
              kind: "compound",
              key: "oj-belum-terinput",
              label: "Jumlah Order Jual belum terinput",
              options: [],
              extra: [
                { type: "number", placeholder: "Jumlah Faktur" },
                { type: "text", placeholder: "Alasan" },
              ],
            },
            {
              kind: "number",
              key: "retur-terinput",
              label: "Retur Penjualan terinput",
              suffix: "Jumlah Faktur",
            },
            {
              kind: "compound",
              key: "harga-diskon-retur",
              label: "Harga & Diskon di Faktur Retur Jual",
              options: ["Sesuai", "Tidak Sesuai"],
              extra: [{ type: "text", placeholder: "Alasan" }],
            },
            {
              kind: "compound",
              key: "retur-belum-terinput",
              label: "Jumlah Retur Jual belum terinput",
              options: [],
              extra: [
                { type: "number", placeholder: "Jumlah Faktur" },
                { type: "text", placeholder: "Alasan" },
              ],
            },
            {
              kind: "compound",
              key: "faktur-perlu-pajak",
              label: "Faktur Penjualan yang Perlu Pajak",
              options: ["Beres", "Belum Diurus"],
              extra: [{ type: "text", placeholder: "Penjelasan" }],
            },
            {
              kind: "compound",
              key: "new-product-setting",
              label:
                "New Product/Perubahan Harga sudah setting harga dan skema diskon",
              options: ["Sudah", "Belum", "Tidak Ada"],
              extra: [
                {
                  type: "number",
                  placeholder: "Sudah berapa hari belum disetting",
                },
              ],
            },
            {
              kind: "compound",
              key: "budget-retur-dijalankan",
              label: "Budget Retur dijalankan",
              options: ["Sesuai", "Tidak Sesuai"],
              extra: [{ type: "text", placeholder: "Penjelasan" }],
            },
          ],
        },

        /* ===== 9. MUTASI ANTAR DEPO ===== */
        retur: {
          title: "Mutasi antar Depo",
          rows: [
            {
              kind: "options",
              key: "mutasi-antar-depo",
              label: "Mutasi antar Depo",
              options: ["Sudah", "Belum"],
            },
            {
              kind: "options",
              key: "mutasi-ttd",
              label: "Tanda Terima",
              options: ["Sudah", "Belum"],
            },
            {
              kind: "options",
              key: "mutasi-faktur-fb-rb",
              label: "Pembuatan Faktur FB RB",
              options: ["Sudah", "Belum"],
            },
          ],
        },

        /* ===== 10. MARKETING ===== */
        marketing: {
          title: "Marketing",
          rows: [
            {
              kind: "options",
              key: "katalog-update",
              label: "Katalog Update dan Tersedia",
              options: ["Beres", "Belum Diurus"],
            },
          ],
        },
      }),
      []
    );

  // refresh overrides dari localStorage (tetap pakai pola lama)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const overrides = useMemo(() => readRoleOverrides(viewRole), [viewRole, rev]);

  /* ===== FINAL MAP (base + custom) ===== */
  const FINAL_MAP = useMemo(() => {
    const clone: Record<AnySectionKey, { title: string; rows: RowDef[] }> = (
      Object.keys(BASE_MAP) as SectionKey[]
    ).reduce((acc, k) => {
      const sec = BASE_MAP[k];
      acc[k] = {
        title: sec.title,
        rows: sec.rows.map((r) => ({ ...r })) as RowDef[],
      };
      return acc;
    }, {} as Record<AnySectionKey, { title: string; rows: RowDef[] }>);

    if (overrides.sections) {
      (Object.keys(overrides.sections) as SectionKey[]).forEach((sec) => {
        const patch = overrides.sections?.[sec];
        if (patch?.title) clone[sec].title = patch.title;
        if (patch?.hidden) clone[sec].rows = [];
      });
    }

    const extras = overrides.extraSections || {};
    (Object.keys(extras) as `x_${string}`[]).forEach((ek) => {
      const meta = extras[ek];
      clone[ek] = clone[ek] || { title: meta.title, rows: [] };
      clone[ek].title = meta.title;
      if (meta.hidden) clone[ek].rows = [];
    });

    if (overrides.rows) {
      (Object.keys(overrides.rows) as AnySectionKey[]).forEach((sec) => {
        const rmap = overrides.rows?.[sec] || {};
        const existingKeys = new Set(
            (clone[sec]?.rows || []).map((r) => r.key)
          ),
          curRows = (clone[sec]?.rows || []) as RowDef[];

        const patched = curRows
          .filter((r) => !(rmap[r.key]?.__delete === true))
          .map((r) => {
            const p = rmap[r.key];
            if (!p) return r;
            const rn: RowDef = { ...r };
            if (p.label) rn.label = p.label;
            if (isNumber(rn) && p.suffix !== undefined) rn.suffix = p.suffix;
            if (
              (isOptions(rn) || isCompound(rn)) &&
              Array.isArray(p.options) &&
              p.options.length > 0
            ) {
              rn.options = p.options;
            }
            if (isCompound(rn) && p.extras) {
              const extrasArr = [];
              if (p.extras.text) extrasArr.push({ type: "text" as const });
              if (p.extras.currency)
                extrasArr.push({ type: "currency" as const });
              if (p.extras.number) extrasArr.push({ type: "number" as const });
              rn.extra = extrasArr;
            }
            // NEW: support daftar (+)
            if (isCompound(rn)) {
              if (p.list !== undefined) rn.list = p.list;
              if (p.listLabels) rn.listLabels = { ...p.listLabels };
            }

            return rn;
          });

        Object.keys(rmap).forEach((rowKey) => {
          const p = rmap[rowKey]!;
          if (p.__delete) return;
          if (!existingKeys.has(rowKey) && p.kind) {
            const def: RowDef =
              p.kind === "options"
                ? {
                    key: rowKey,
                    label: p.label || rowKey,
                    kind: "options",
                    options: p.options || [],
                  }
                : p.kind === "number"
                ? {
                    key: rowKey,
                    label: p.label || rowKey,
                    kind: "number",
                    suffix: p.suffix,
                  }
                : p.kind === "score"
                ? { key: rowKey, label: p.label || rowKey, kind: "score" }
                : {
                    key: rowKey,
                    label: p.label || rowKey,
                    kind: "compound",
                    options: p.options || [],
                    extra: [
                      ...(p.extras?.text ? [{ type: "text" as const }] : []),
                      ...(p.extras?.currency
                        ? [{ type: "currency" as const }]
                        : []),
                      ...(p.extras?.number
                        ? [{ type: "number" as const }]
                        : []),
                    ],
                    // NEW:
                    list: Boolean(p.list),
                    listLabels: p.listLabels ? { ...p.listLabels } : undefined,
                  };

            patched.push(def);
          }
        });

        const withOrder = patched.map((r, idx) => {
          const ord = rmap[r.key]?.order;
          return { r, idx, ord: typeof ord === "number" ? ord : idx };
        });
        withOrder.sort((a, b) => a.ord - b.ord || a.idx - b.idx);
        clone[sec] = {
          title: clone[sec]?.title || "",
          rows: withOrder.map((x) => x.r),
        };
      });
    }

    return clone;
  }, [BASE_MAP, overrides]);

  /* ===== TABS: base + custom ===== */
  // ⬇️ FIX PENTING: label base tabs ambil dari FINAL_MAP agar judul tab ikut berubah saat di-rename
  const BASE_TABS = useMemo(() => {
    return (Object.keys(BASE_MAP) as SectionKey[]).map((k) => ({
      key: k as AnySectionKey,
      label: FINAL_MAP[k]?.title || BASE_MAP[k].title,
      order: 0,
      isCustom: false,
    }));
  }, [BASE_MAP, FINAL_MAP]);

  const EXTRA_TABS = useMemo(() => {
    const ex = overrides.extraSections || {};
    return Object.keys(ex).map((k) => {
      const kk = k as `x_${string}`;
      return {
        key: kk as AnySectionKey,
        label: ex[kk].title,
        order: ex[kk].order ?? 999,
        isCustom: true,
      };
    });
  }, [overrides.extraSections]);

  const SECTION_TABS = useMemo(() => {
    const arr = [...BASE_TABS, ...EXTRA_TABS];
    arr.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
    return arr;
  }, [BASE_TABS, EXTRA_TABS]);

  const [secActive, setSecActive] = useState<AnySectionKey>("kas");
  const section = FINAL_MAP[secActive];

  // ====== update data tanpa any
  const patchData = (sec: AnySectionKey, key: string, v: RowValue) => {
    const prev = data as ExtendedChecklistState;
    const next: ExtendedChecklistState = { ...prev };
    const curSec: SectionState = { ...(prev[sec] || {}) };
    curSec[key] = v;
    next[sec] = curSec;
    onChange(next as unknown as ChecklistState);
  };

  // ===== Superadmin Section/Row Handlers =====
  const updateSectionTitleAny = (sec: AnySectionKey, title: string) => {
    if (!isSuper) return;
    const cur = readRoleOverrides(viewRole);
    let next: ChecklistOverrides;
    if (String(sec).startsWith("x_")) {
      next = mergeExtraSection(cur, sec as `x_${string}`, { title });
    } else {
      next = mergeSectionTitle(cur, sec as SectionKey, title);
    }
    writeRoleOverrides(viewRole, next);
    void saveOverridesToServer(viewRole, next, role).catch(console.error);
    setRev((x) => x + 1);
  };

  const addSection = (rawKey: string, title: string) => {
    if (!isSuper) return;
    const key = rawKey.trim();
    const ttl = (title ?? "").trim();

    if (!/^x_[a-z0-9\-]+$/i.test(key)) {
      alert(
        'Key section custom harus diawali "x_" dan hanya huruf/angka/dash. Contoh: x_kas-cabang'
      );
      return;
    }
    if (!ttl) {
      alert("Judul section tidak boleh kosong");
      return;
    }

    const cur = readRoleOverrides(viewRole);
    const next = mergeExtraSection(cur, key as `x_${string}`, { title: ttl });
    writeRoleOverrides(viewRole, next);
    void saveOverridesToServer(viewRole, next, role).catch(console.error);
    setRev((x) => x + 1);
    setSecActive(key as AnySectionKey);
  };

  const removeSection = (key: `x_${string}`) => {
    if (!isSuper) return;
    if (
      !confirm(
        `Hapus section ${key}? Semua baris custom di dalamnya juga ikut terhapus.`
      )
    )
      return;
    const cur = readRoleOverrides(viewRole);
    const next = deleteExtraSection(cur, key);
    writeRoleOverrides(viewRole, next);
    void saveOverridesToServer(viewRole, next, role).catch(console.error);
    setRev((x) => x + 1);
    setSecActive("kas");
  };

  const updateRowLabel = (
    sec: AnySectionKey,
    rowKey: string,
    label: string
  ) => {
    if (!isSuper) return;
    const cur = readRoleOverrides(viewRole);
    const next = mergeRowOverride(cur, sec, rowKey, { label });
    writeRoleOverrides(viewRole, next);
    void saveOverridesToServer(viewRole, next, role).catch(console.error);
    setRev((x) => x + 1);
  };
  const updateRowOptions = (
    sec: AnySectionKey,
    rowKey: string,
    csv: string
  ) => {
    if (!isSuper) return;
    const opts = csv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const cur = readRoleOverrides(viewRole);
    const next = mergeRowOverride(cur, sec, rowKey, { options: opts });
    writeRoleOverrides(viewRole, next);
    void saveOverridesToServer(viewRole, next, role).catch(console.error);
    setRev((x) => x + 1);
  };
  const updateRowSuffix = (
    sec: AnySectionKey,
    rowKey: string,
    suffix: string
  ) => {
    if (!isSuper) return;
    const cur = readRoleOverrides(viewRole);
    const next = mergeRowOverride(cur, sec, rowKey, { suffix });
    writeRoleOverrides(viewRole, next);
    void saveOverridesToServer(viewRole, next, role).catch(console.error);
    setRev((x) => x + 1);
  };
  const deleteRow = (sec: AnySectionKey, rowKey: string) => {
    if (!isSuper) return;
    if (!confirm("Hapus baris ini dari section?")) return;
    const cur = readRoleOverrides(viewRole);
    const next = mergeRowOverride(cur, sec, rowKey, { __delete: true });
    writeRoleOverrides(viewRole, next);
    void saveOverridesToServer(viewRole, next, role).catch(console.error);
    setRev((x) => x + 1);
  };
  const addRow = (
    sec: AnySectionKey,
    payload: {
      key: string;
      label: string;
      kind: AddedRowMeta["kind"];
      optionsCsv?: string;
      suffix?: string;
      extras?: AddedRowMeta["extras"];
      // NEW:
      list?: boolean;
      listLabels?: { text?: string; currency?: string; number?: string };
    }
  ) => {
    if (!isSuper) return;
    const key = payload.key.trim();
    if (!key) return alert("Key wajib diisi");
    const cur = readRoleOverrides(viewRole);
    const options = (payload.optionsCsv || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const patch: RowOverride = {
      __added: true,
      kind: payload.kind,
      label: payload.label || payload.key,
      options: options.length ? options : undefined,
      suffix: payload.suffix,
      extras: payload.extras,
      // NEW:
      list: payload.list,
      listLabels: payload.listLabels,
    };

    const next = mergeRowOverride(cur, sec, key, patch);
    writeRoleOverrides(viewRole, next);
    void saveOverridesToServer(viewRole, next, role).catch(console.error);
    setRev((x) => x + 1);
  };

  const resetOverrides = () => {
    if (!isSuper) return;
    if (
      !confirm(
        `Reset semua pengaturan teks & tambah/hapus untuk role ${viewRole}?`
      )
    )
      return;
    const next: ChecklistOverrides = {};
    writeRoleOverrides(viewRole, next);
    void saveOverridesToServer(viewRole, next, role).catch(console.error);
    setRev((x) => x + 1);
  };

  // ======== Submit section AKTIF (non-blocking) ========
  const submitCurrentSectionAndNext = () => {
    const rows = toTidyRowsForSection(
      data as ExtendedChecklistState,
      secActive,
      FINAL_MAP as Record<string, { title: string; rows: RowDef[] }>
    );
    const payload = {
      module: "checklist-area",
      submittedAt: new Date().toISOString(),
      submittedBy: name || "Unknown",
      role: role || "unknown",
      sectionSubmitted: String(secActive),
      sectionTitle: section?.title || "",
      rows,
    };

    const idx = SECTION_TABS.findIndex((t) => t.key === secActive);
    const nextKey = SECTION_TABS[(idx + 1) % SECTION_TABS.length].key;
    setSecActive(nextKey);

    requestAnimationFrame(() => {
      scrollToSectionAnchor(16);
    });

    void postToGAS(gasUrl || FALLBACK_GAS_URL, payload)
      .then(() => showToast("Terkirim ✅", "ok"))
      .catch((e) => {
        console.error("Gagal mengirim ke Spreadsheet:", e);
        showToast("Gagal kirim. Cek koneksi/log.", "err");
      });
  };

  const isHiddenActive = useMemo(() => {
    if (String(secActive).startsWith("x_")) {
      return Boolean(
        overrides.extraSections?.[secActive as `x_${string}`]?.hidden
      );
    }
    return Boolean(overrides.sections?.[secActive as SectionKey]?.hidden);
  }, [overrides, secActive]);

  const toggleSectionHiddenAny = (sec: AnySectionKey, hidden: boolean) => {
    if (!isSuper) return;
    const cur = readRoleOverrides(viewRole);
    let next: ChecklistOverrides;
    if (String(sec).startsWith("x_")) {
      const k = sec as `x_${string}`;
      const prev = (cur.extraSections || {})[k];
      next = mergeExtraSection(cur, k, {
        title: prev?.title ?? (FINAL_MAP[k]?.title || "Custom Section"),
        hidden,
        order: prev?.order,
      });
    } else {
      next = mergeSectionHidden(cur, sec as SectionKey, hidden);
    }
    writeRoleOverrides(viewRole, next);
    void saveOverridesToServer(viewRole, next, role).catch(console.error);
    setRev((x) => x + 1);
  };

  return (
    <div className="bg-white border rounded-2xl shadow-sm overflow-hidden relative">
      {/* Toast kecil non-blocking */}
      {toast && (
        <div
          className={
            "fixed z-50 bottom-4 left-4 px-3 py-2 rounded-lg text-sm shadow " +
            (toast.kind === "err"
              ? "bg-rose-600 text-white"
              : "bg-emerald-600 text-white")
          }
        >
          {toast.msg}
        </div>
      )}

      <div className="px-3 sm:px-6 py-4 border-b bg-slate-50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-blue-600" />
          <h2 className="text-slate-800 font-semibold">Checklist Area</h2>
        </div>

        {/* kanan: toolbar superadmin */}
        {isSuper && (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Role target:</span>
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
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-blue-600"
                checked={editMode}
                onChange={(e) => setEditMode(e.target.checked)}
              />
              <span className="font-medium">Mode Editor</span>
            </label>

            {editMode && (
              <>
                {/* Toggle Mode Sederhana (dipakai PATCH 7) */}
                <label className="text-xs flex items-center gap-2 border rounded-md px-2 py-1">
                  <input
                    type="checkbox"
                    checked={simpleMode}
                    onChange={(e) => setSimpleMode(e.target.checked)}
                    className="h-4 w-4 accent-blue-600"
                  />
                  Mode Sederhana
                </label>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAddSection(true)}
                    className="text-xs px-2 py-1 rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50"
                    title="Tambah Section (tab) baru"
                  >
                    + Section
                  </button>
                  <button
                    onClick={resetOverrides}
                    className="text-xs px-2 py-1 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50"
                    title="Reset semua pengaturan role ini"
                  >
                    Reset Pengaturan
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-3 sm:px-6 py-4">
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
          <div className="mt-0.5 h-5 w-5 flex items-center justify-center rounded-full bg-blue-100">
            <CheckCircle2 className="h-4 w-4 text-blue-700" />
          </div>
          <p className="text-sm text-slate-700">
            <span className="font-medium">Instruksi:</span> Gunakan sub-tab di
            bawah. Klik <span className="font-semibold">Submit</span> untuk{" "}
            <span className="font-semibold">
              mengirim data section aktif ke Spreadsheet
            </span>
            , lalu otomatis pindah ke section berikutnya dan scroll ke
            kontennya. Untuk Superadmin: aktifkan{" "}
            <span className="font-semibold">Mode Edit</span> untuk
            menambah/hapus/ubah pertanyaan atau menambah section custom.
          </p>
        </div>
      </div>

      {/* Sub tabs */}
      <div className="px-3 sm:px-6 pb-3">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex flex-wrap gap-2 gap-y-2">
          {SECTION_TABS.map((t) => (
            <div key={String(t.key)} className="relative">
              <button
                onClick={() => {
                  setSecActive(t.key);
                  setQuickAddOpen(false);
                  requestAnimationFrame(() => {
                    scrollToSectionAnchor(16);
                  });
                }}
                className={
                  "px-3.5 py-2 rounded-lg text-sm transition whitespace-nowrap " +
                  (secActive === t.key
                    ? "bg-blue-600 text-white shadow"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100")
                }
              >
                {t.label}
              </button>
              {isSuper && editMode && t.isCustom && (
                <button
                  onClick={() => removeSection(t.key as `x_${string}`)}
                  className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-rose-600 text-white text-xs"
                  title="Hapus section custom ini"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ANCHOR SCROLL */}
      <div ref={sectionAnchorRef} />

      {/* Section header & super controls */}
      <div className="px-3 sm:px-6 pb-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="text-sm font-semibold text-slate-700 flex-1">
            {editMode ? (
              <input
                value={section?.title || ""}
                onChange={(e) =>
                  updateSectionTitleAny(secActive, e.target.value)
                }
                className="min-w-[220px] w-full sm:w-96 rounded-xl border-2 border-slate-300 bg-white text-sm px-3 py-2 text-center placeholder:text-center focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
                placeholder="Judul section…"
              />
            ) : (
              <span>{section?.title}</span>
            )}
          </div>

          {isSuper && editMode && (
            <>
              <button
                onClick={() => setQuickAddOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50"
                title={`Tambah baris ke ${section?.title || ""}`}
              >
                <Plus className="h-3.5 w-3.5" /> Tambah
              </button>

              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-600">Sembunyikan:</label>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-rose-600"
                  onChange={(e) =>
                    toggleSectionHiddenAny(secActive, e.target.checked)
                  }
                  checked={isHiddenActive}
                />
              </div>
            </>
          )}
        </div>

        {isSuper && editMode && quickAddOpen && (
          <InlineAddRow
            sectionLabel={section?.title || ""}
            onCancel={() => setQuickAddOpen(false)}
            onAdd={(payload) => {
              addRow(secActive, payload);
              setQuickAddOpen(false);
            }}
          />
        )}

        {/* Header 4/3/5 */}
        <div className="hidden sm:grid grid-cols-12 text-[13px] font-medium text-slate-600 border-y bg-slate-50">
          <div className="col-span-4 py-2.5 px-2">
            Tanggung Jawab
            <div className="text-[11px] font-normal text-slate-500">
              Nama pertanyaan
            </div>
          </div>
          <div className="col-span-3 py-2.5 px-2 pl-3">
            Hasil Kontrol
            <div className="text-[11px] font-normal text-slate-500">
              Centang/angka/score
            </div>
          </div>
          <div className="col-span-5 py-2.5 px-2">
            Keterangan
            <div className="text-[11px] font-normal text-slate-500">
              Catatan tambahan (opsional)
            </div>
          </div>
        </div>

        {!section || section.rows.length === 0 ? (
          <div className="p-4 text-sm text-slate-600 border border-dashed border-slate-300 rounded-xl mt-3 bg-slate-50">
            Konten kosong untuk bagian{" "}
            <span className="font-medium">{section?.title || ""}</span>.
          </div>
        ) : (
          <div className="divide-y">
            {section.rows.map((row) => {
              const ext = data as ExtendedChecklistState;
              const current = ext[secActive]?.[row.key];
              return (
                <ChecklistRow
                  key={row.key}
                  row={row}
                  value={current}
                  editable={isSuper && editMode}
                  onEditLabel={(label) =>
                    updateRowLabel(secActive, row.key, label)
                  }
                  onEditOptions={(csv) =>
                    updateRowOptions(secActive, row.key, csv)
                  }
                  onEditSuffix={(suf) =>
                    updateRowSuffix(secActive, row.key, suf)
                  }
                  onDelete={() => deleteRow(secActive, row.key)}
                  onChange={(v) => patchData(secActive, row.key, v)}
                />
              );
            })}
          </div>
        )}

        {isSuper && editMode && (
          <AddRowPanel onAdd={(payload) => addRow(secActive, payload)} />
        )}

        {/* Bottom actions: 1 tombol Submit */}
        <div className="sticky bottom-3 flex justify-end px-3 sm:px-6 mt-4">
          <button
            onClick={submitCurrentSectionAndNext}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 shadow"
            title="Kirim section aktif, lanjut ke berikutnya"
          >
            Submit Section →
          </button>
        </div>
      </div>

      {/* Add Section Inline */}
      {isSuper && editMode && showAddSection && (
        <div className="px-3 sm:px-6 pb-4">
          <AddSectionInline
            onCancel={() => setShowAddSection(false)}
            onAdd={(k, t) => {
              addSection(k, t);
              setShowAddSection(false);
              requestAnimationFrame(() => scrollToSectionAnchor(16));
            }}
          />
        </div>
      )}
    </div>
  );
}

/* ================= RowValue Helpers ================= */
type RVOptions = Extract<RowValue, { kind: "options" }>;
type RVNumber = Extract<RowValue, { kind: "number" }>;
type RVScore = Extract<RowValue, { kind: "score" }>;
type RVCompound = Extract<RowValue, { kind: "compound" }>;

/* ========= Multi-select (checkbox) helpers ========= */
const SEP = " | ";
function parseMulti(v: string | null, options: string[]): string[] {
  if (!v) return [];
  const parts = v
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.filter((p) => options.includes(p));
}
function joinMulti(arr: string[]): string | null {
  return arr.length ? arr.join(SEP) : null;
}

/* ========= Checkbox UI ========= */
function MultiCheckGroup({
  options,
  valueJoined,
  onChangeJoined,
}: {
  options: string[];
  valueJoined: string | null | undefined;
  onChangeJoined: (nextJoined: string | null) => void;
}) {
  const selected = parseMulti(valueJoined ?? null, options);

  const toggle = (opt: string) => {
    const set = new Set(selected);
    if (set.has(opt)) set.delete(opt);
    else set.add(opt);
    onChangeJoined(joinMulti(Array.from(set)));
  };

  return (
    <div className="space-y-1">
      {options.map((opt) => {
        const checked = selected.includes(opt);
        return (
          <label
            key={opt}
            className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-slate-100"
          >
            <input
              type="checkbox"
              className="h-4 w-4 accent-blue-600"
              checked={checked}
              onChange={() => toggle(opt)}
            />
            <span className="text-sm text-slate-700">{opt}</span>
          </label>
        );
      })}
    </div>
  );
}

/* ================= ROW ================= */
function ChecklistRow({
  row,
  value,
  onChange,
  editable,
  onEditLabel,
  onEditOptions,
  onEditSuffix,
  onDelete,
}: {
  row: RowDef;
  value?: RowValue;
  editable?: boolean;
  onEditLabel: (label: string) => void;
  onEditOptions: (csv: string) => void;
  onEditSuffix: (suffix: string) => void;
  onDelete: () => void;
  onChange: (v: RowValue) => void;
}) {
  const [note, setNote] = useState(value?.note || "");
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const compVal = value?.kind === "compound" ? value : undefined;
  const compExtras = compVal?.extras;

  // === Khusus "faktur-dibatalkan": kelola daftar nomor faktur via tombol +
  const isFakturDibatalkan = isCompound(row) && row.key === "faktur-dibatalkan";
  const [invoiceNumbers, setInvoiceNumbers] = useState<string[]>([]);
  useEffect(() => {
    if (!isFakturDibatalkan) return;
    const raw = (compExtras?.text || "").trim();
    const parts = raw
      ? raw
          .split(SEP)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    setInvoiceNumbers(parts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFakturDibatalkan, compExtras?.text]);

  const syncInvoiceNumbers = (arr: string[]) => {
    const joined = arr
      .map((s) => s.trim())
      .filter(Boolean)
      .join(SEP);
    onChange({
      kind: "compound",
      value: compVal?.value ?? null,
      note,
      extras: {
        text: joined, // nomor faktur disimpan pipe-separated
        currency: compExtras?.currency,
        number: compExtras?.number, // jumlah faktur tetap di extra.number
      },
    } as RVCompound);
  };

  // === Khusus "coret-nota": daftar item via tombol +, ditampilkan di kolom Keterangan
  const isCoretNota = isCompound(row) && row.key === "coret-nota";
  type CoretItem = { reason: string; rj: string };
  const [coretItems, setCoretItems] = useState<CoretItem[]>([]);
  const CORET_REASONS = [
    "Barang kosong",
    "Rusak tidak dimuat",
    "Tidak terima toko sehingga dikembalikan gudang",
  ];
  useEffect(() => {
    if (!isCoretNota) return;
    const raw = compExtras?.text;
    if (!raw) {
      setCoretItems([]);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const safe = parsed
          .map((it) => ({
            reason: String(it?.reason ?? ""),
            // backward-compatible: jika data lama pakai 'detail', fallback ke situ
            rj: String(it?.rj ?? it?.detail ?? ""),
          }))
          .filter((it) => it.reason || it.rj);
        setCoretItems(safe);
      } else {
        setCoretItems([]);
      }
    } catch {
      // fallback jika bukan JSON — kosongkan agar tidak crash
      setCoretItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCoretNota, compExtras?.text]);

  const syncCoretItems = (items: CoretItem[]) => {
    const json = JSON.stringify(
      items.map((it) => ({
        reason: (it.reason || "").trim(),
        rj: (it.rj || "").trim(),
      }))
    );
    onChange({
      kind: "compound",
      value: compVal?.value ?? null,
      note,
      extras: {
        text: json, // simpan list sebagai JSON string
        currency: compExtras?.currency,
        number: compExtras?.number,
      },
    } as RVCompound);
  };

  const adjustHeight = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    if (!value) return;
    if (value.note === note) return;

    if (value.kind === "options") {
      onChange({ ...value, note });
    } else if (value.kind === "number") {
      onChange({ ...value, note });
    } else if (value.kind === "score") {
      onChange({ ...value, note });
    } else if (value.kind === "compound") {
      onChange({ ...value, note });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note]);

  useEffect(() => {
    adjustHeight();
  }, [value?.note]);

  const hasTextExtra =
    isCompound(row) && row.extra?.some((e) => e.type === "text");
  const hasCurrencyExtra =
    isCompound(row) && row.extra?.some((e) => e.type === "currency");
  const hasNumberExtra =
    isCompound(row) && row.extra?.some((e) => e.type === "number");

  const textPlaceholder = isCompound(row)
    ? row.extra?.find((e) => e.type === "text")?.placeholder
    : undefined;
  const currencyPlaceholder = isCompound(row)
    ? row.extra?.find((e) => e.type === "currency")?.placeholder
    : undefined;
  const numberPlaceholder = isCompound(row)
    ? row.extra?.find((e) => e.type === "number")?.placeholder
    : undefined;

  const valueJoined =
    value && (value.kind === "options" || value.kind === "compound")
      ? value.value
      : null;

  const numStr = value?.kind === "number" ? String(value.value ?? "") : "";
  const scoreVal = value?.kind === "score" ? value.value : 3;

  const isListCompound = isCompound(row) && row.list === true;

  const [listItems, setListItems] = useState<
    Array<{ text?: string; currency?: string; number?: string }>
  >([]);

  useEffect(() => {
    if (!isListCompound) return;
    const parsed = parseListFromExtrasText(compExtras?.text);
    setListItems(parsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListCompound, compExtras?.text]);

  const syncListItems = (
    items: Array<{ text?: string; currency?: string; number?: string }>
  ) => {
    const json = stringifyListToExtrasText(items);
    onChange({
      kind: "compound",
      value: compVal?.value ?? null,
      note,
      extras: {
        text: json, // daftar disimpan sebagai JSON di text
        currency: undefined, // kolom single tidak dipakai di mode list
        number: undefined,
      },
    } as RVCompound);
  };

  const INPUT_BASE =
    "w-full rounded-xl border-2 border-slate-300 bg-white text-sm px-3 py-2 text-center " +
    "placeholder:text-center focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-12 items-start bg-white">
      {/* Label */}
      <div className="sm:col-span-4 py-3 px-2 text-sm">
        {editable ? (
          <div className="flex items-center gap-2">
            <input
              value={row.label}
              onChange={(e) => onEditLabel(e.target.value)}
              className={INPUT_BASE}
              placeholder="Nama tanggung jawab/pertanyaan…"
            />
            <button
              onClick={onDelete}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50"
              title="Hapus baris ini"
            >
              <Trash2 className="h-3.5 w-3.5" /> Hapus
            </button>
          </div>
        ) : (
          row.label
        )}
      </div>
      {/* Hasil Kontrol */}
      <div className="sm:col-span-3 py-3 px-2 pl-3">
        <div className="sm:hidden text-xs text-slate-500 mb-1">
          Hasil Kontrol
        </div>
        <div className="border border-slate-300 rounded-lg p-2 bg-slate-50">
          {editable && (isOptions(row) || isCompound(row)) && (
            <OptionsEditor
              options={row.options || []}
              onChange={(opts) => onEditOptions(opts.join(", "))}
            />
          )}

          {editable && isNumber(row) && (
            <input
              defaultValue={row.suffix || ""}
              onBlur={(e) => onEditSuffix(e.target.value)}
              className={`${INPUT_BASE} mb-2`}
              placeholder="Suffix (mis: pcs, faktur, kali)"
            />
          )}

          {/* Options */}
          {/* Checkbox untuk options & compound */}
          {(isOptions(row) || isCompound(row)) && (
            <MultiCheckGroup
              options={row.options}
              valueJoined={valueJoined}
              onChangeJoined={(joined) => {
                if (isOptions(row)) {
                  // mode lama: pure checkbox
                  onChange({
                    kind: "options",
                    value: joined,
                    note,
                  } as RVOptions);
                } else {
                  // mode baru: checkbox + extras (text / currency / number)
                  onChange({
                    kind: "compound",
                    value: joined, // simpan pilihan checkbox di sini
                    note,
                    // pertahankan extras yang sudah ada
                    extras: {
                      text: compExtras?.text ?? null,
                      currency: compExtras?.currency ?? null,
                      number: compExtras?.number ?? null,
                    },
                  } as RVCompound);
                }
              }}
            />
          )}

          {/* Number */}
          {isNumber(row) && (
            <NumberWithSuffix
              suffix={row.suffix}
              value={numStr}
              onChange={(v) =>
                onChange({
                  kind: "number",
                  value: v,
                  suffix: row.suffix,
                  note,
                } as RVNumber)
              }
            />
          )}

          {/* Score */}
          {isScore(row) && (
            <ScoreSelect
              value={scoreVal}
              onChange={(v) =>
                onChange({ kind: "score", value: v, note } as RVScore)
              }
            />
          )}

          {/* === Repeatable (+) generic list === */}
          {isListCompound ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-slate-600">
                  {row.listLabels?.text ||
                  row.listLabels?.currency ||
                  row.listLabels?.number
                    ? "Item"
                    : "Daftar Item"}
                </div>
                <button
                  onClick={() => {
                    const next = [
                      ...listItems,
                      {
                        ...(hasTextExtra ? { text: "" } : {}),
                        ...(hasCurrencyExtra ? { currency: "" } : {}),
                        ...(hasNumberExtra ? { number: "" } : {}),
                      },
                    ];
                    setListItems(next);
                    syncListItems(next);
                  }}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50"
                  title="Tambah item"
                >
                  <Plus className="h-3.5 w-3.5" /> Tambah Item
                </button>
              </div>

              {listItems.length === 0 && (
                <div className="text-xs text-slate-500 px-1">
                  Belum ada item. Klik{" "}
                  <span className="font-medium">Tambah Item</span>.
                  {/* catatan: pastikan kolom (Text/Currency/Number) dicentang saat membuat baris */}
                </div>
              )}

              <div className="space-y-2">
                {listItems.map((it, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 md:grid-cols-6 gap-2"
                  >
                    {/* Text */}
                    {hasTextExtra && (
                      <input
                        value={it.text || ""}
                        onChange={(e) => {
                          const next = [...listItems];
                          next[idx] = { ...next[idx], text: e.target.value };
                          setListItems(next);
                          syncListItems(next);
                        }}
                        className={INPUT_BASE + " md:col-span-2"}
                        placeholder={
                          row.listLabels?.text || textPlaceholder || "Teks"
                        }
                      />
                    )}

                    {/* Currency */}
                    {hasCurrencyExtra && (
                      <div className={"md:col-span-2"}>
                        <CurrencyField
                          valueDigits={it.currency || ""}
                          onChangeDigits={(digits) => {
                            const next = [...listItems];
                            next[idx] = { ...next[idx], currency: digits };
                            setListItems(next);
                            syncListItems(next);
                          }}
                          placeholder={
                            row.listLabels?.currency ||
                            currencyPlaceholder ||
                            "contoh: 4.235.523"
                          }
                        />
                      </div>
                    )}

                    {/* Number */}
                    {hasNumberExtra && (
                      <input
                        type="number"
                        inputMode="numeric"
                        value={it.number || ""}
                        onChange={(e) => {
                          const next = [...listItems];
                          next[idx] = { ...next[idx], number: e.target.value };
                          setListItems(next);
                          syncListItems(next);
                        }}
                        className={INPUT_BASE + " md:col-span-1"}
                        placeholder={
                          row.listLabels?.number ||
                          numberPlaceholder ||
                          "Jumlah"
                        }
                      />
                    )}

                    {/* Hapus item */}
                    <div className="md:col-span-1 flex">
                      <button
                        onClick={() => {
                          const next = listItems.filter((_, i) => i !== idx);
                          setListItems(next);
                          syncListItems(next);
                        }}
                        className="w-full md:w-auto h-9 px-3 inline-flex items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                        title="Hapus item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : isFakturDibatalkan ? (
            // === cabang faktur-dibatalkan (yang lama) ===
            <div className="space-y-2">
              {hasNumberExtra && (
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder={numberPlaceholder || "Jumlah Faktur"}
                  value={compExtras?.number ?? ""}
                  onChange={(e) =>
                    onChange({
                      kind: "compound",
                      value: compVal?.value ?? null,
                      note,
                      extras: {
                        text: compExtras?.text,
                        currency: compExtras?.currency,
                        number: e.target.value,
                      },
                    } as RVCompound)
                  }
                  className={INPUT_BASE}
                />
              )}

              <button
                onClick={() => setInvoiceNumbers((arr) => [...arr, ""])}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50"
                title="Tambah nomor faktur dibatalkan"
              >
                <Plus className="h-3.5 w-3.5" /> Tambah Nomor Faktur
              </button>

              {invoiceNumbers.length === 0 && (
                <div className="text-xs text-slate-500 px-1">
                  Klik <span className="font-medium">Tambah Nomor Faktur</span>{" "}
                  untuk memasukkan nomor faktur yang dibatalkan.
                </div>
              )}

              <div className="space-y-2">
                {invoiceNumbers.map((val, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      value={val}
                      onChange={(e) => {
                        const next = [...invoiceNumbers];
                        next[idx] = e.target.value;
                        setInvoiceNumbers(next);
                        syncInvoiceNumbers(next);
                      }}
                      className={INPUT_BASE}
                      placeholder={`Nomor Faktur #${idx + 1}`}
                    />
                    <button
                      onClick={() => {
                        const next = invoiceNumbers.filter((_, i) => i !== idx);
                        setInvoiceNumbers(next);
                        syncInvoiceNumbers(next);
                      }}
                      className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                      title="Hapus nomor ini"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : isCoretNota ? (
            <></>
          ) : (
            // === Default extras (text / currency / number) ===
            (hasTextExtra || hasCurrencyExtra || hasNumberExtra) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {hasTextExtra && (
                  <input
                    placeholder={textPlaceholder}
                    value={compExtras?.text ?? ""}
                    onChange={(e) =>
                      onChange({
                        kind: "compound",
                        value: compVal?.value ?? null,
                        note,
                        extras: {
                          text: e.target.value,
                          currency: compExtras?.currency,
                          number: compExtras?.number,
                        },
                      } as RVCompound)
                    }
                    className={INPUT_BASE}
                  />
                )}

                {hasCurrencyExtra && (
                  <div className="md:col-span-2">
                    <CurrencyField
                      valueDigits={compExtras?.currency}
                      onChangeDigits={(digits) =>
                        onChange({
                          kind: "compound",
                          value: compVal?.value ?? null,
                          note,
                          extras: {
                            text: compExtras?.text,
                            currency: digits,
                            number: compExtras?.number,
                          },
                        } as RVCompound)
                      }
                      placeholder={currencyPlaceholder || "contoh: 4.235.523"}
                    />
                  </div>
                )}

                {hasNumberExtra && (
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder={numberPlaceholder || "Jumlah"}
                    value={compExtras?.number ?? ""}
                    onChange={(e) =>
                      onChange({
                        kind: "compound",
                        value: compVal?.value ?? null,
                        note,
                        extras: {
                          text: compExtras?.text,
                          currency: compExtras?.currency,
                          number: e.target.value,
                        },
                      } as RVCompound)
                    }
                    className={INPUT_BASE}
                  />
                )}
              </div>
            )
          )}
        </div>{" "}
        {/* end: .border border-slate-300 ... */}
      </div>{" "}
      {/* end: .sm:col-span-3 (Hasil Kontrol) */}
      {/* Keterangan */}
      <div className="sm:col-span-5 py-3 px-2">
        <div className="sm:hidden text-xs text-slate-500 mb-1">Keterangan</div>

        {/* === Khusus coret-nota: render daftar item (alasan + Nomor RJ) di sini dan sembunyikan textarea umum === */}
        {isCoretNota ? (
          <div className="border border-slate-300 rounded-lg p-2 bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-slate-600">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                  <div className="md:col-span-3">Pilih Alasan</div>
                  <div className="md:col-span-2">Nomor RJ</div>
                </div>
              </div>
              <button
                onClick={() =>
                  setCoretItems((arr) => [...arr, { reason: "", rj: "" }])
                }
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50"
                title="Tambah item coret nota"
              >
                <Plus className="h-3.5 w-3.5" /> Tambah Coret Nota
              </button>
            </div>

            {coretItems.length === 0 && (
              <div className="text-xs text-slate-500 px-1">
                Klik <span className="font-medium">Tambah Coret Nota</span>{" "}
                untuk menambahkan alasan dan Nomor RJ.
              </div>
            )}

            <div className="space-y-2">
              {coretItems.map((it, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 md:grid-cols-6 gap-2"
                >
                  {/* Dropdown alasan */}
                  <div className="md:col-span-3">
                    <select
                      value={it.reason}
                      onChange={(e) => {
                        const next = [...coretItems];
                        next[idx] = { ...next[idx], reason: e.target.value };
                        setCoretItems(next);
                        syncCoretItems(next);
                      }}
                      className={INPUT_BASE}
                    >
                      <option value="">Pilih alasan…</option>
                      {CORET_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Nomor RJ */}
                  <div className="md:col-span-2">
                    <input
                      value={it.rj}
                      onChange={(e) => {
                        const next = [...coretItems];
                        next[idx] = { ...next[idx], rj: e.target.value };
                        setCoretItems(next);
                        syncCoretItems(next);
                      }}
                      className={INPUT_BASE}
                      placeholder="Nomor RJ"
                    />
                  </div>

                  {/* Hapus item */}
                  <div className="md:col-span-1 flex">
                    <button
                      onClick={() => {
                        const next = coretItems.filter((_, i) => i !== idx);
                        setCoretItems(next);
                        syncCoretItems(next);
                      }}
                      className="w-full md:w-auto h-9 px-3 inline-flex items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                      title="Hapus item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // === Default: textarea keterangan umum
          <textarea
            ref={taRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onInput={adjustHeight}
            placeholder="Keterangan..."
            className="w-full rounded-xl border-2 border-slate-300 bg-white text-sm px-3 py-2 text-center 
                       placeholder:text-center focus:outline-none focus:ring-4 focus:ring-blue-100 
                       focus:border-blue-500 resize-none overflow-y-auto min-h-[40px] max-h-40"
          />
        )}
      </div>
    </div>
  );
}

/* ===== Inline Add Row (Quick +) ===== */
function InlineAddRow({
  sectionLabel,
  onAdd,
  onCancel,
}: {
  sectionLabel: string;
  onAdd: (payload: {
    key: string;
    label: string;
    kind: AddedRowMeta["kind"];
    optionsCsv?: string;
    suffix?: string;
    extras?: AddedRowMeta["extras"];
    // NEW
    list?: boolean;
    listLabels?: { text?: string; currency?: string; number?: string };
  }) => void;
  onCancel: () => void;
}) {
  const [repeatable, setRepeatable] = useState(false);
  const [lblText, setLblText] = useState("");
  const [lblCurr, setLblCurr] = useState("");
  const [lblNum, setLblNum] = useState("");

  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<AddedRowMeta["kind"]>("options");
  const [optionsCsv, setOptionsCsv] = useState("Cocok, Tidak Cocok");
  const [suffix, setSuffix] = useState("");
  const [exText, setExText] = useState(false);
  const [exCurr, setExCurr] = useState(false);
  const [exNum, setExNum] = useState(false);

  const submit = () => {
    onAdd({
      key,
      label,
      kind,
      optionsCsv,
      suffix,
      extras: { text: exText, currency: exCurr, number: exNum },
      // NEW:
      list: repeatable,
      listLabels: {
        text: lblText || undefined,
        currency: lblCurr || undefined,
        number: lblNum || undefined,
      },
    });
    setKey("");
    setLabel("");
    if (kind === "options" || kind === "compound")
      setOptionsCsv("Cocok, Tidak Cocok");
    setSuffix("");
    setExText(false);
    setExCurr(false);
    setExNum(false);
    // reset NEW fields
    setRepeatable(false);
    setLblText("");
    setLblCurr("");
    setLblNum("");
  };

  return (
    <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3">
      <div className="text-xs font-medium text-blue-800 mb-2">
        Tambah baris ke: {sectionLabel}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="rounded-lg border-2 border-blue-200 bg-white text-xs px-3 py-2 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
          placeholder="Key unik (tanpa spasi)"
        />
        <input
          value={label}
          onChange={(e) => {
            const v = e.target.value;
            setLabel(v);
            if (!key) {
              const slug = v
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)/g, "");
              setKey(slug);
            }
          }}
        ></input>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as AddedRowMeta["kind"])}
          className="rounded-lg border-2 border-blue-200 bg-white text-xs px-3 py-2 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
        >
          <option value="options">Checkbox</option>
          <option value="number">Angka+suffix</option>
          <option value="score">Score (1–5)</option>
          <option value="compound">Gabungan</option>
        </select>

        {(kind === "options" || kind === "compound") && (
          <input
            value={optionsCsv}
            onChange={(e) => setOptionsCsv(e.target.value)}
            className="rounded-lg border-2 border-blue-200 bg-white text-xs px-3 py-2 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 md:col-span-2"
            placeholder="Opsi dipisah koma"
          />
        )}

        {kind === "number" && (
          <input
            value={suffix}
            onChange={(e) => setSuffix(e.target.value)}
            className="rounded-lg border-2 border-blue-200 bg-white text-xs px-3 py-2 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
            placeholder="Suffix (pcs/faktur/…)"
          />
        )}

        {kind === "compound" && (
          <div className="md:col-span-5 grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                className="h-4 w-4 accent-blue-600"
                checked={exText}
                onChange={(e) => setExText(e.target.checked)}
              />
              Text
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                className="h-4 w-4 accent-blue-600"
                checked={exCurr}
                onChange={(e) => setExCurr(e.target.checked)}
              />
              Currency
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                className="h-4 w-4 accent-blue-600"
                checked={exNum}
                onChange={(e) => setExNum(e.target.checked)}
              />
              Number
            </label>

            {/* NEW: Repeatable (+) */}
            <label className="flex items-center gap-2 text-xs md:col-span-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-blue-600"
                checked={repeatable}
                onChange={(e) => setRepeatable(e.target.checked)}
              />
              Repeatable (+)
            </label>

            {/* NEW: label kolom opsional kalau repeatable */}
            {repeatable && exText && (
              <input
                value={lblText}
                onChange={(e) => setLblText(e.target.value)}
                className="rounded-lg border-2 border-blue-200 bg-white text-xs px-3 py-2 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
                placeholder="Label Text (opsional)"
              />
            )}
            {repeatable && exCurr && (
              <input
                value={lblCurr}
                onChange={(e) => setLblCurr(e.target.value)}
                className="rounded-lg border-2 border-blue-200 bg-white text-xs px-3 py-2 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
                placeholder="Label Currency (opsional)"
              />
            )}
            {repeatable && exNum && (
              <input
                value={lblNum}
                onChange={(e) => setLblNum(e.target.value)}
                className="rounded-lg border-2 border-blue-200 bg-white text-xs px-3 py-2 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
                placeholder="Label Number (opsional)"
              />
            )}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={submit}
          className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs hover:bg-blue-700 inline-flex items-center gap-1"
        >
          <Plus className="h-3.5 w-3.5" /> Tambah
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-md border text-xs hover:bg-white"
        >
          Batal
        </button>
      </div>
    </div>
  );
}

/* ===== Add Section Inline ===== */
function AddSectionInline({
  onAdd,
  onCancel,
}: {
  onAdd: (key: string, title: string) => void;
  onCancel: () => void;
}) {
  const [key, setKey] = useState("x_");
  const [title, setTitle] = useState("");

  return (
    <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
      <div className="text-xs font-medium text-blue-800 mb-2">
        Tambah Section (Tab) Baru
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input
          value={key}
          onChange={(e) => {
            const raw = e.target.value;
            let v = raw
              .toLowerCase()
              .trim()
              .replace(/[^a-z0-9_-]+/g, "-");
            if (!v.startsWith("x_")) v = "x_" + v.replace(/^x-/, "");
            setKey(v);
          }}
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-lg border-2 border-blue-200 bg-white text-xs px-3 py-2 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
          placeholder="Judul section"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => onAdd(key, title)}
            className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs hover:bg-blue-700"
          >
            Tambah
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md border text-xs hover:bg-white"
          >
            Batal
          </button>
        </div>
      </div>
      <div className="text-[11px] text-blue-800 mt-1">
        Gunakan prefix <code>x_</code> untuk key section custom.
      </div>
    </div>
  );
}

/* ===== Add Row Panel (versi besar) ===== */
function AddRowPanel({
  onAdd,
}: {
  onAdd: (payload: {
    key: string;
    label: string;
    kind: AddedRowMeta["kind"];
    optionsCsv?: string;
    suffix?: string;
    extras?: AddedRowMeta["extras"];
    // NEW
    list?: boolean;
    listLabels?: { text?: string; currency?: string; number?: string };
  }) => void;
}) {
  const [repeatable, setRepeatable] = useState(false);
  const [lblText, setLblText] = useState("");
  const [lblCurr, setLblCurr] = useState("");
  const [lblNum, setLblNum] = useState("");

  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<AddedRowMeta["kind"]>("options");
  const [optionsCsv, setOptionsCsv] = useState("Cocok, Tidak Cocok");
  const [suffix, setSuffix] = useState("");
  const [exText, setExText] = useState(false);
  const [exCurr, setExCurr] = useState(false);
  const [exNum, setExNum] = useState(false);

  const submit = () => {
    onAdd({
      key,
      label,
      kind,
      optionsCsv,
      suffix,
      extras: { text: exText, currency: exCurr, number: exNum },
      // NEW:
      list: repeatable,
      listLabels: {
        text: lblText || undefined,
        currency: lblCurr || undefined,
        number: lblNum || undefined,
      },
    });
    setKey("");
    setLabel("");
    if (kind === "options" || kind === "compound")
      setOptionsCsv("Cocok, Tidak Cocok");
    setSuffix("");
    setExText(false);
    setExCurr(false);
    setExNum(false);
    // reset NEW fields
    setRepeatable(false);
    setLblText("");
    setLblCurr("");
    setLblNum("");
  };

  return (
    <div className="mt-5 border rounded-xl p-3 bg-slate-50">
      <div className="flex items-center gap-2 mb-2">
        <Plus className="h-4 w-4 text-blue-600" />
        <div className="font-medium text-slate-700 text-sm">
          Tambah Pertanyaan / Baris
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="rounded-xl border-2 border-slate-300 bg-white text-sm px-3 py-2 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
          placeholder="Key unik (tanpa spasi), mis: kasbon-baru"
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="rounded-xl border-2 border-slate-300 bg-white text-sm px-3 py-2 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
          placeholder="Label tampilan"
        />
        <div>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as AddedRowMeta["kind"])}
            className="w-full rounded-xl border-2 border-slate-300 bg-white text-sm px-3 py-2 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
          >
            <option value="options">Checkbox (multi)</option>
            <option value="number">Angka + suffix</option>
            <option value="score">Score (1–5)</option>
            <option value="compound">Gabungan + extras</option>
          </select>
        </div>

        {(kind === "options" || kind === "compound") && (
          <input
            value={optionsCsv}
            onChange={(e) => setOptionsCsv(e.target.value)}
            className="rounded-xl border-2 border-slate-300 bg-white text-sm px-3 py-2 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
            placeholder="Opsi dipisah koma"
          />
        )}

        {kind === "number" && (
          <input
            value={suffix}
            onChange={(e) => setSuffix(e.target.value)}
            className="rounded-xl border-2 border-slate-300 bg-white text-sm px-3 py-2 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
            placeholder="Suffix (mis: pcs, faktur, kali)"
          />
        )}

        {kind === "compound" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-blue-600"
                  checked={exText}
                  onChange={(e) => setExText(e.target.checked)}
                />
                Text
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-blue-600"
                  checked={exCurr}
                  onChange={(e) => setExCurr(e.target.checked)}
                />
                Currency
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-blue-600"
                  checked={exNum}
                  onChange={(e) => setExNum(e.target.checked)}
                />
                Number
              </label>

              {/* NEW: Repeatable (+) */}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-blue-600"
                  checked={repeatable}
                  onChange={(e) => setRepeatable(e.target.checked)}
                />
                Repeatable (+)
              </label>
            </div>

            {/* NEW: label kolom opsional kalau repeatable */}
            {repeatable && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {exText && (
                  <input
                    value={lblText}
                    onChange={(e) => setLblText(e.target.value)}
                    className="rounded-xl border-2 border-slate-300 bg-white text-sm px-3 py-2 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
                    placeholder="Label Text (opsional)"
                  />
                )}
                {exCurr && (
                  <input
                    value={lblCurr}
                    onChange={(e) => setLblCurr(e.target.value)}
                    className="rounded-xl border-2 border-slate-300 bg-white text-sm px-3 py-2 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
                    placeholder="Label Currency (opsional)"
                  />
                )}
                {exNum && (
                  <input
                    value={lblNum}
                    onChange={(e) => setLblNum(e.target.value)}
                    className="rounded-xl border-2 border-slate-300 bg-white text-sm px-3 py-2 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
                    placeholder="Label Number (opsional)"
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 flex justify-end">
        <button
          onClick={submit}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Tambah Baris
        </button>
      </div>
    </div>
  );
}
