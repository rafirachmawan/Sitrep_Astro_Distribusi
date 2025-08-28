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
};

type ChecklistOverrides = {
  sections?: Partial<Record<SectionKey, { title?: string; hidden?: boolean }>>;
  rows?: Partial<Record<SectionKey, Record<string, RowOverride>>>;
};

const OV_KEY = "sitrep-checklist-copy-v2";
const ROLES: Role[] = ["admin", "sales", "gudang"];

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
function mergeRowOverride(
  src: ChecklistOverrides,
  sec: SectionKey,
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

/* ================= DEFINISI ROW & BASE ================= */
type RowBase = { key: string; label: string };

type RowDefOptions = RowBase & { kind: "options"; options: string[] };
type RowDefNumber = RowBase & { kind: "number"; suffix?: string };
type RowDefScore = RowBase & { kind: "score" };
type RowDefCompound = RowBase & {
  kind: "compound";
  options: string[];
  extra?: { type: "text" | "currency" | "number"; placeholder?: string }[];
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

const SECTION_TABS: { key: SectionKey; label: string }[] = [
  { key: "kas", label: "Kas Kecil" },
  { key: "buku", label: "Buku Penunjang" },
  { key: "ar", label: "AR" },
  { key: "klaim", label: "Klaim" },
  { key: "pengiriman", label: "Pengiriman" },
  { key: "setoran", label: "Setoran Bank" },
  { key: "pembelian", label: "Proses Pembelian" },
  { key: "faktur", label: "Penjualan" },
  { key: "retur", label: "Mutasi antar Depo" },
  { key: "marketing", label: "Marketing" },
];

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

/* =============== SERIALIZER & SENDER ke GAS =============== */
type TidyChecklistRow = {
  sectionKey: SectionKey;
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

function toTidyChecklistRows(
  data: ChecklistState,
  FINAL_MAP: Record<SectionKey, { title: string; rows: RowDef[] }>
): TidyChecklistRow[] {
  const rows: TidyChecklistRow[] = [];
  (Object.keys(FINAL_MAP) as SectionKey[]).forEach((sec) => {
    const secTitle = FINAL_MAP[sec].title;
    FINAL_MAP[sec].rows.forEach((def) => {
      const v = data?.[sec]?.[def.key] as RowValue | undefined;
      if (!v) {
        rows.push({
          sectionKey: sec,
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
        rows.push({
          sectionKey: sec,
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
        rows.push({
          sectionKey: sec,
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
        rows.push({
          sectionKey: sec,
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
        rows.push({
          sectionKey: sec,
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
  });
  return rows;
}

const FALLBACK_GAS_URL: string =
  (typeof window !== "undefined" && (process.env.NEXT_PUBLIC_GAS_URL ?? "")) ||
  "";

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
  onSubmitGeneratePDF, // optional
}: {
  data: ChecklistState;
  onChange: (v: ChecklistState) => void;
  gasUrl?: string;
  onSubmitGeneratePDF?: () => Promise<void> | void;
}) {
  const { role, name } = useAuth() as { role?: string; name?: string };
  const isSuper = role === "superadmin";

  const [targetRole, setTargetRole] = useState<Role>("admin");
  const viewRole = (isSuper ? targetRole : (role as Role)) || "admin";
  const [editMode, setEditMode] = useState(false);
  const [rev, setRev] = useState(0);

  // NEW: inline quick add toggle state
  const [quickAddOpen, setQuickAddOpen] = useState(false);

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
              kind: "compound",
              key: "dok-bukti-biaya",
              label: "Dokumentasi Bukti Biaya",
              options: ["Valid", "Tidak Valid"],
              extra: [{ type: "text", placeholder: "Penjelasan" }],
            },
            {
              kind: "compound",
              key: "dropping-kas-kecil",
              label: "Dropping Kas Kecil",
              options: ["Ada: Form"],
              extra: [{ type: "currency", placeholder: "Nilai (Rp)" }],
            },
            {
              kind: "options",
              key: "serah-terima-fat",
              label: "Serah Terima dengan FAT",
              options: ["Sudah"],
            },

            // contoh tambahan konten
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
              kind: "options",
              key: "draft-loading-besok",
              label: "Pengiriman Besok Sudah Draft Loading Semua",
              options: ["Iya", "Ada yang belum"],
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
              kind: "number",
              key: "faktur-dibatalkan",
              label: "Faktur yang dibatalkan",
              suffix: "Faktur",
            },
            {
              kind: "compound",
              key: "konfirmasi-sales",
              label: "Konfirmasi ke Tim Salesman",
              options: ["Sudah", "Belum"],
              extra: [{ type: "text", placeholder: "Alasan" }],
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const overrides = useMemo(() => readRoleOverrides(viewRole), [viewRole, rev]);

  const FINAL_MAP = useMemo(() => {
    const clone = (Object.keys(BASE_MAP) as SectionKey[]).reduce((acc, k) => {
      const sec = BASE_MAP[k];
      acc[k] = {
        title: sec.title,
        rows: sec.rows.map((r) => ({ ...r })) as RowDef[],
      };
      return acc;
    }, {} as Record<SectionKey, { title: string; rows: RowDef[] }>);

    if (overrides.sections) {
      (Object.keys(overrides.sections) as SectionKey[]).forEach((sec) => {
        const patch = overrides.sections?.[sec];
        if (patch?.title) clone[sec].title = patch.title;
        if (patch?.hidden) clone[sec].rows = [];
      });
    }

    if (overrides.rows) {
      (Object.keys(overrides.rows) as SectionKey[]).forEach((sec) => {
        const rmap = overrides.rows?.[sec] || {};
        const existingKeys = new Set(clone[sec].rows.map((r) => r.key));

        clone[sec].rows = clone[sec].rows
          .filter((r) => !(rmap[r.key]?.__delete === true))
          .map((r) => {
            const patch = rmap[r.key];
            if (!patch) return r;
            const rn: RowDef = { ...r };
            if (patch.label) rn.label = patch.label;
            if (isNumber(rn) && patch.suffix !== undefined)
              rn.suffix = patch.suffix;
            if ((isOptions(rn) || isCompound(rn)) && patch.options)
              rn.options = patch.options;
            type CompoundExtra = {
              type: "text" | "currency" | "number";
              placeholder?: string;
            };
            if (isCompound(rn) && patch.extras) {
              const extras: CompoundExtra[] = [];
              if (patch.extras.text) extras.push({ type: "text" });
              if (patch.extras.currency) extras.push({ type: "currency" });
              if (patch.extras.number) extras.push({ type: "number" });
              rn.extra = extras;
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
                  };
            clone[sec].rows.push(def);
          }
        });

        const withOrder = clone[sec].rows.map((r, idx) => {
          const ord = rmap[r.key]?.order;
          return { r, idx, ord: typeof ord === "number" ? ord : idx };
        });
        withOrder.sort((a, b) => a.ord - b.ord || a.idx - b.idx);
        clone[sec].rows = withOrder.map((x) => x.r);
      });
    }
    return clone;
  }, [BASE_MAP, overrides]);

  const [secActive, setSecActive] = useState<SectionKey>("kas");
  const section = FINAL_MAP[secActive];

  const patchData = (sec: SectionKey, key: string, v: RowValue) =>
    onChange({ ...data, [sec]: { ...data[sec], [key]: v } });

  // ===== Superadmin Edit Handlers =====
  const updateSectionTitle = (sec: SectionKey, title: string) => {
    if (!isSuper) return;
    const cur = readRoleOverrides(viewRole);
    writeRoleOverrides(viewRole, mergeSectionTitle(cur, sec, title));
    setRev((x) => x + 1);
  };
  const updateRowLabel = (sec: SectionKey, rowKey: string, label: string) => {
    if (!isSuper) return;
    const cur = readRoleOverrides(viewRole);
    writeRoleOverrides(viewRole, mergeRowOverride(cur, sec, rowKey, { label }));
    setRev((x) => x + 1);
  };
  const updateRowOptions = (sec: SectionKey, rowKey: string, csv: string) => {
    if (!isSuper) return;
    const opts = csv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const cur = readRoleOverrides(viewRole);
    writeRoleOverrides(
      viewRole,
      mergeRowOverride(cur, sec, rowKey, { options: opts })
    );
    setRev((x) => x + 1);
  };
  const updateRowSuffix = (sec: SectionKey, rowKey: string, suffix: string) => {
    if (!isSuper) return;
    const cur = readRoleOverrides(viewRole);
    writeRoleOverrides(
      viewRole,
      mergeRowOverride(cur, sec, rowKey, { suffix })
    );
    setRev((x) => x + 1);
  };
  const deleteRow = (sec: SectionKey, rowKey: string) => {
    if (!isSuper) return;
    if (!confirm("Hapus baris ini dari section?")) return;
    const cur = readRoleOverrides(viewRole);
    writeRoleOverrides(
      viewRole,
      mergeRowOverride(cur, sec, rowKey, { __delete: true })
    );
    setRev((x) => x + 1);
  };
  const addRow = (
    sec: SectionKey,
    payload: {
      key: string;
      label: string;
      kind: AddedRowMeta["kind"];
      optionsCsv?: string;
      suffix?: string;
      extras?: AddedRowMeta["extras"];
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
    };
    writeRoleOverrides(viewRole, mergeRowOverride(cur, sec, key, patch));
    setRev((x) => x + 1);
  };
  const toggleSectionHidden = (sec: SectionKey, hidden: boolean) => {
    if (!isSuper) return;
    const cur = readRoleOverrides(viewRole);
    writeRoleOverrides(viewRole, mergeSectionHidden(cur, sec, hidden));
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
    writeRoleOverrides(viewRole, {});
    setRev((x) => x + 1);
  };

  const goNext = () => {
    const idx = SECTION_TABS.findIndex((t) => t.key === secActive);
    const next = SECTION_TABS[(idx + 1) % SECTION_TABS.length].key;
    setSecActive(next);
  };

  const submitChecklistAndSend = async () => {
    try {
      if (onSubmitGeneratePDF) await onSubmitGeneratePDF();
      const rows = toTidyChecklistRows(data, FINAL_MAP);
      await postToGAS(gasUrl || FALLBACK_GAS_URL, {
        module: "checklist-area",
        submittedAt: new Date().toISOString(),
        submittedBy: name || "Unknown",
        role: role || "unknown",
        rows,
      });
      alert("Checklist terkirim ke Spreadsheet ✅");
    } catch (e) {
      console.error("Gagal submit & kirim:", e);
      alert("Gagal mengirim ke Spreadsheet. Cek konsol/log.");
    }
  };

  return (
    <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
      <div className="px-3 sm:px-6 py-4 border-b bg-slate-50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-blue-600" />
          <h2 className="text-slate-800 font-semibold">Checklist Area</h2>
        </div>

        {isSuper && (
          <div className="flex items-center gap-2 flex-wrap justify-end">
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
              title="Reset semua override role ini"
            >
              Reset
            </button>
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
            bawah. Setelah TTD & Submit, data akan dikirim ke Spreadsheet. Untuk
            Superadmin: aktifkan{" "}
            <span className="font-semibold">Mode Edit</span> untuk
            menambah/menghapus/ubah pertanyaan per section.
          </p>
        </div>
      </div>

      {/* Sub tabs */}
      <div className="px-3 sm:px-6 pb-3">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex flex-wrap gap-2 gap-y-2">
          {SECTION_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setSecActive(t.key);
                setQuickAddOpen(false);
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
          ))}
        </div>
      </div>

      {/* Section header & super controls */}
      <div className="px-3 sm:px-6 pb-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="text-sm font-semibold text-slate-700 flex-1">
            {editMode ? (
              <input
                value={section.title}
                onChange={(e) => updateSectionTitle(secActive, e.target.value)}
                className="min-w-[220px] w-full sm:w-96 rounded-xl border-2 border-slate-300 bg-white text-sm px-3 py-2 text-center placeholder:text-center focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
                placeholder="Judul section…"
              />
            ) : (
              <span>{section.title}</span>
            )}
          </div>

          {/* NEW: Quick Add (+) */}
          {isSuper && editMode && (
            <>
              <button
                onClick={() => setQuickAddOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50"
                title={`Tambah baris ke ${section.title}`}
              >
                <Plus className="h-3.5 w-3.5" /> Tambah
              </button>

              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-600">Sembunyikan:</label>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-rose-600"
                  onChange={(e) =>
                    toggleSectionHidden(secActive, e.target.checked)
                  }
                  checked={Boolean(overrides.sections?.[secActive]?.hidden)}
                />
              </div>
            </>
          )}
        </div>

        {/* NEW: Inline Add Row Form (appears under header) */}
        {isSuper && editMode && quickAddOpen && (
          <InlineAddRow
            sectionLabel={section.title}
            onCancel={() => setQuickAddOpen(false)}
            onAdd={(payload) => {
              addRow(secActive, payload);
              setQuickAddOpen(false);
            }}
          />
        )}

        {/* Header 4/3/5 */}
        <div className="hidden sm:grid grid-cols-12 text-[13px] font-medium text-slate-600 border-y bg-slate-50">
          <div className="col-span-4 py-2.5 px-2">Area Tanggung Jawab</div>
          <div className="col-span-3 py-2.5 px-2 pl-3">Status / Isian</div>
          <div className="col-span-5 py-2.5 px-2">Keterangan</div>
        </div>

        {section.rows.length === 0 ? (
          <div className="p-4 text-sm text-slate-600 border border-dashed border-slate-300 rounded-xl mt-3 bg-slate-50">
            Konten kosong untuk bagian{" "}
            <span className="font-medium">{section.title}</span>.
          </div>
        ) : (
          <div className="divide-y">
            {section.rows.map((row) => {
              const current = data[secActive][row.key] as RowValue | undefined;
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

        {/* Panel besar (tetap ada) */}
        {isSuper && editMode && (
          <AddRowPanel onAdd={(payload) => addRow(secActive, payload)} />
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            onClick={goNext}
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm hover:bg-slate-200 border"
            title="Ke section berikutnya"
          >
            Next →
          </button>

          <button
            onClick={submitChecklistAndSend}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
            title="TTD+Submit (jalankan generate PDF via prop), lalu kirim ke Spreadsheet"
          >
            Submit & Kirim
          </button>
        </div>
      </div>
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

  const adjustHeight = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    if (value && value.note !== note) onChange({ ...value, note } as RowValue);
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

  const optVal = value?.kind === "options" ? value.value : null;
  const numStr = value?.kind === "number" ? String(value.value ?? "") : "";
  const scoreVal = value?.kind === "score" ? value.value : 3;
  const compVal = value?.kind === "compound" ? value : undefined;
  const compExtras = compVal?.extras;

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
              placeholder="Nama area/pertanyaan…"
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

      {/* Status / Isian */}
      <div className="sm:col-span-3 py-3 px-2 pl-3">
        <div className="sm:hidden text-xs text-slate-500 mb-1">
          Status / Isian
        </div>

        <div className="border border-slate-300 rounded-lg p-2 bg-slate-50">
          {editable && (isOptions(row) || isCompound(row)) && (
            <input
              defaultValue={(row.options || []).join(", ")}
              onBlur={(e) => onEditOptions(e.target.value)}
              className={`${INPUT_BASE} mb-2`}
              placeholder="Opsi dipisah koma (mis: Cocok, Tidak Cocok)"
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

          {isOptions(row) && (
            <MultiCheckGroup
              options={row.options}
              valueJoined={optVal}
              onChangeJoined={(joined) =>
                onChange({
                  kind: "options",
                  value: joined,
                  note,
                } as RVOptions)
              }
            />
          )}

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

          {isScore(row) && (
            <ScoreSelect
              value={scoreVal}
              onChange={(v) =>
                onChange({ kind: "score", value: v, note } as RVScore)
              }
            />
          )}

          {isCompound(row) && (
            <div className="space-y-2">
              <MultiCheckGroup
                options={row.options}
                valueJoined={compVal?.value ?? null}
                onChangeJoined={(joined) =>
                  onChange({
                    kind: "compound",
                    value: joined,
                    note,
                    extras: compExtras,
                  } as RVCompound)
                }
              />

              {(hasTextExtra || hasCurrencyExtra || hasNumberExtra) && (
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
              )}
            </div>
          )}
        </div>
      </div>

      {/* Keterangan */}
      <div className="sm:col-span-5 py-3 px-2">
        <div className="sm:hidden text-xs text-slate-500 mb-1">Keterangan</div>
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
      </div>
    </div>
  );
}

/* ===== NEW: Inline Add Row (Quick +) ===== */
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
  }) => void;
  onCancel: () => void;
}) {
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
    });
    setKey("");
    setLabel("");
    if (kind === "options" || kind === "compound")
      setOptionsCsv("Cocok, Tidak Cocok");
    setSuffix("");
    setExText(false);
    setExCurr(false);
    setExNum(false);
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
          onChange={(e) => setLabel(e.target.value)}
          className="rounded-lg border-2 border-blue-200 bg-white text-xs px-3 py-2 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
          placeholder="Label tampilan"
        />
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
          <div className="md:col-span-5 flex items-center flex-wrap gap-4">
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
  }) => void;
}) {
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
    });
    setKey("");
    setLabel("");
    if (kind === "options" || kind === "compound")
      setOptionsCsv("Cocok, Tidak Cocok");
    setSuffix("");
    setExText(false);
    setExCurr(false);
    setExNum(false);
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
          <div className="flex items-center gap-4">
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
