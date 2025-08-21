"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { ClipboardList, CheckCircle2 } from "lucide-react";
import type { ChecklistState, RowValue, SectionKey } from "@/lib/types";
import { OptionsGroup, NumberWithSuffix, ScoreSelect } from "./common";
import { useAuth } from "@/components/AuthProvider";
import type { Role } from "@/components/AuthProvider";

/* ================= OVERRIDES ================= */
type RowOverride = {
  label?: string;
  options?: string[];
  suffix?: string;
};
type ChecklistOverrides = {
  sections?: Partial<Record<SectionKey, { title?: string }>>;
  rows?: Partial<Record<SectionKey, Record<string, RowOverride>>>;
};

const OV_KEY = "sitrep-checklist-copy-v1";
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
  const rows = { ...(src.rows || {}) };
  const secMap = { ...(rows[sec] || {}) };
  rows[sec] = { ...secMap, [rowKey]: { ...(secMap[rowKey] || {}), ...patch } };
  return { ...src, rows };
}
function mergeSectionTitle(
  src: ChecklistOverrides,
  sec: SectionKey,
  title: string
): ChecklistOverrides {
  const sections = { ...(src.sections || {}) };
  sections[sec] = { ...(sections[sec] || {}), title };
  return { ...src, sections };
}

/* ================= DEFINISI ROW ================= */
type RowDef =
  | { kind: "options"; key: string; label: string; options: string[] }
  | { kind: "number"; key: string; label: string; suffix?: string }
  | { kind: "score"; key: string; label: string }
  | {
      kind: "compound";
      key: string;
      label: string;
      options: string[];
      extra?: { type: "text" | "currency" | "number"; placeholder?: string }[];
    };

const SECTION_TABS: { key: SectionKey; label: string }[] = [
  { key: "kas", label: "Kas Kecil" },
  { key: "buku", label: "Buku Penunjang" },
  { key: "ar", label: "AR" },
  { key: "klaim", label: "Klaim" },
  { key: "pengiriman", label: "Pengiriman" },
  { key: "setoran", label: "Setoran Bank" },
  { key: "pembelian", label: "Proses Pembelian" },
  { key: "faktur", label: "Penjualan" },
  { key: "marketing", label: "Marketing" },
];

/* ================= COMPONENT ================= */
export default function ChecklistArea({
  data,
  onChange,
}: {
  data: ChecklistState;
  onChange: (v: ChecklistState) => void;
}) {
  const { role } = useAuth();
  const isSuper = role === "superadmin";

  const [targetRole, setTargetRole] = useState<Role>("admin");
  const viewRole = (isSuper ? targetRole : (role as Role)) || "admin";
  const [editMode, setEditMode] = useState(false);
  const [rev, setRev] = useState(0);

  const BASE_MAP: Record<SectionKey, { title: string; rows: RowDef[] }> =
    useMemo(
      () => ({
        kas: {
          title: "Kas Kecil",
          rows: [
            {
              kind: "compound",
              key: "saldo-kas-kecil",
              label: "Saldo Kas Kecil",
              options: ["Cocok", "Tidak Cocok"],
              extra: [{ type: "currency", placeholder: "123" }],
            },
            {
              kind: "number",
              key: "voucher-individual",
              label: "Voucher Individual",
              suffix: "pcs",
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
              // ✅ permintaan: ganti label
              label: "Approval untuk Voucher Kas Kecil",
              options: ["Sesuai", "Tidak Sesuai"],
            },
            {
              kind: "options",
              key: "kasbon-operasional",
              label: "Kasbon Operasional",
              options: ["Clear", "Belum Kembali"],
            },
            {
              kind: "options",
              key: "dok-bukti-biaya",
              label: "Dokumentasi Bukti Biaya",
              options: ["Valid", "Perlu Validasi"],
            },
            {
              kind: "compound",
              key: "dropping-kas-kecil",
              label: "Dropping Kas Kecil",
              options: ["Ada", "Tidak"],
              // ✅ permintaan: catat nomor form (contoh TUKC-T-25-001)
              extra: [
                {
                  type: "text",
                  placeholder: "Nomor Form (cth: TUKC-T-25-001)",
                },
              ],
            },
            {
              kind: "options",
              key: "serah-terima-fat",
              label: "Serah Terima dengan FAT",
              // ✅ permintaan: Sudah / Belum
              options: ["Sudah", "Belum"],
            },
          ],
        },
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
              // ✅ perbaiki bug key bentrok dengan 'kasbon-operasional' di section Kas
              key: "buku-kasbon-operasional",
              label: "Buku Kasbon Operasional",
              options: ["Sesuai", "Tidak Sesuai"],
            },
          ],
        },
        ar: {
          title: "AR",
          // ✅ “disesuaikan desain SITREP” – tetap inti yang sama, rapikan label
          rows: [
            {
              kind: "options",
              key: "faktur-h2",
              label: "Faktur Tagihan Sales disiapkan H-2",
              options: ["Sesuai", "Tidak Sesuai"],
            },
            {
              kind: "options",
              key: "faktur-disuaikan",
              label: "Penyesuaian Faktur ke Rute/Permintaan/Kebutuhan",
              options: ["Sesuai", "Tidak Sesuai"],
            },
            {
              kind: "options",
              key: "overdue-bawakan",
              label: "Overdue/Perlu Ditagih Dibawakan",
              options: ["Sesuai", "Tidak Sesuai"],
            },
            {
              kind: "options",
              key: "penyerahan-faktur",
              label: "Penyerahan Faktur",
              options: ["On Time", "Terlambat"],
            },
          ],
        },
        klaim: {
          title: "Klaim",
          rows: [
            {
              kind: "options",
              key: "klaim-bs-proses",
              label: "Semua Klaim BS sudah terproses/sedang diproses",
              options: ["Beres", "Belum Diurus"],
            },
            {
              kind: "options",
              key: "klaim-bank-garansi-proses",
              label: "Semua Klaim Bank Garansi terproses/sedang diproses",
              options: ["Beres", "Belum Diurus"],
            },
            {
              kind: "options",
              key: "klaim-on-track",
              label: "Pengerjaan Klaim on Track / Behind Schedule",
              options: ["On Track", "Behind Schedule"],
            },
            {
              kind: "options",
              key: "update-monitoring-klaim",
              label: "Update Monitoring Klaim",
              options: ["Lengkap", "Tidak Lengkap"],
            },
          ],
        },
        pengiriman: {
          title: "Pengiriman",
          rows: [
            {
              kind: "number",
              key: "do-belum-draft-loading",
              label: "Faktur DO yang belum draft loading",
              suffix: "faktur",
            },
            // ✅ Gabungkan Kondisi Dokumen, Tanda Terima, Input aPos ke dalam Faktur Kembali
            {
              kind: "compound",
              key: "faktur-kembali",
              label: "Faktur Kembali dari Pengiriman",
              options: ["100%", "Ada yang tidak kembali"],
              extra: [
                { type: "text", placeholder: "Kondisi dokumen…" },
                { type: "text", placeholder: "Tanda terima…" },
                { type: "text", placeholder: "Status input di aPos…" },
              ],
            },
            {
              kind: "options",
              key: "draft-loading-besok",
              label: "Pengiriman besok sudah draft loading semua",
              options: ["Sudah", "Ada yang belum"],
            },
            {
              kind: "number",
              key: "faktur-dibatalkan",
              label: "Faktur yang dibatalkan",
              suffix: "faktur",
            },
            {
              kind: "compound",
              key: "konfirmasi-sales",
              label: "Konfirmasi ke Tim Salesman",
              options: ["Sudah", "Belum"],
              extra: [{ type: "text", placeholder: "Catatan/Alasan…" }],
            },
          ],
        },
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
              // ✅ permintaan: bukan Penjumlahan tetapi Penjurnalan
              label: "Penjurnalan Kas Besar ke Bank",
              options: ["Sesuai", "Tidak Sesuai", "Tidak Dikerjakan"],
            },
          ],
        },
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
        faktur: {
          title: "Penjualan",
          rows: [
            {
              kind: "number",
              key: "jumlah-penjualan-terinput",
              label: "Jumlah penjualan terinput",
            },
            {
              kind: "compound",
              key: "harga-promo",
              label: "Harga & Promo",
              options: ["Sesuai", "Tidak Sesuai"],
              extra: [{ type: "text", placeholder: "Alasan…" }],
            },
            {
              kind: "number",
              key: "oj-belum-terinput",
              label: "Jumlah Order Jual belum terinput",
              suffix: "faktur",
            },
            {
              kind: "number",
              key: "retur-terinput",
              label: "Retur Penjualan terinput",
              suffix: "faktur",
            },
            {
              kind: "compound",
              key: "harga-diskon-retur",
              label: "Harga & Diskon di Faktur Retur Jual",
              options: ["Sesuai", "Tidak Sesuai"],
              extra: [{ type: "text", placeholder: "Alasan…" }],
            },
            {
              kind: "number",
              key: "retur-belum-terinput",
              label: "Jumlah Retur Jual belum terinput",
              suffix: "faktur",
            },
            {
              kind: "compound",
              key: "faktur-perlu-pajak",
              label: "Faktur Penjualan yang Perlu Pajak",
              options: ["Beres", "Belum Diurus"],
              extra: [{ type: "text", placeholder: "Penjelasan…" }],
            },
            {
              kind: "compound",
              key: "new-product-setting",
              label:
                "New Product/Perubahan Harga sudah setting harga dan skema diskon",
              options: ["Sudah", "Belum"],
              extra: [
                { type: "text", placeholder: "Alasan / hari belum disetting…" },
              ],
            },
            {
              kind: "compound",
              key: "budget-retur-dijalankan",
              label: "Budget Retur dijalankan",
              options: ["Sesuai", "Tidak Sesuai"],
              extra: [{ type: "text", placeholder: "Penjelasan…" }],
            },
          ],
        },
        retur: { title: "Retur (legacy)", rows: [] },
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

  const overrides = useMemo(() => readRoleOverrides(viewRole), [viewRole, rev]);

  const FINAL_MAP = useMemo(() => {
    // deep clone bertipe
    const clone = (Object.keys(BASE_MAP) as SectionKey[]).reduce((acc, k) => {
      const sec = BASE_MAP[k];
      acc[k] = {
        title: sec.title,
        rows: sec.rows.map((r) => ({ ...r })) as RowDef[],
      };
      return acc;
    }, {} as Record<SectionKey, { title: string; rows: RowDef[] }>);

    // apply overrides
    if (overrides.sections) {
      (Object.keys(overrides.sections) as SectionKey[]).forEach((sec) => {
        const t = overrides.sections?.[sec]?.title;
        if (t) clone[sec].title = t;
      });
    }
    if (overrides.rows) {
      (Object.keys(overrides.rows) as SectionKey[]).forEach((sec) => {
        const rmap = overrides.rows?.[sec] || {};
        Object.keys(rmap).forEach((rowKey) => {
          const patch = rmap[rowKey]!;
          const idx = clone[sec].rows.findIndex((r) => r.key === rowKey);
          if (idx >= 0) {
            const r = clone[sec].rows[idx];
            if (patch.label) r.label = patch.label;
            if (r.kind === "number" && patch.suffix !== undefined) {
              r.suffix = patch.suffix;
            }
            if (
              (r.kind === "options" || r.kind === "compound") &&
              patch.options
            ) {
              r.options = patch.options;
            }
          }
        });
      });
    }
    return clone;
  }, [BASE_MAP, overrides]);

  const [secActive, setSecActive] = useState<SectionKey>("kas");
  const section = FINAL_MAP[secActive];

  const patchData = (sec: SectionKey, key: string, v: RowValue) =>
    onChange({ ...data, [sec]: { ...data[sec], [key]: v } });

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
  const resetOverrides = () => {
    if (!isSuper) return;
    if (!confirm(`Reset semua pengaturan teks untuk role ${viewRole}?`)) return;
    writeRoleOverrides(viewRole, {});
    setRev((x) => x + 1);
  };

  const goNext = () => {
    const idx = SECTION_TABS.findIndex((t) => t.key === secActive);
    const next = SECTION_TABS[(idx + 1) % SECTION_TABS.length].key;
    setSecActive(next);
  };

  return (
    <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
      <div className="px-3 sm:px-6 py-4 border-b bg-slate-50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-blue-600" />
          <h2 className="text-slate-800 font-semibold">Checklist Area</h2>
        </div>

        {isSuper && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Role:</label>
            <select
              className="rounded-lg border-slate-300 text-sm bg-white"
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
            bawah. Semua isian akan masuk ke Lampiran.
          </p>
        </div>
      </div>

      {/* Sub tabs */}
      <div className="px-3 sm:px-6 pb-3 overflow-x-auto">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex flex-nowrap gap-2">
          {SECTION_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setSecActive(t.key)}
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

      {/* Section */}
      <div className="px-3 sm:px-6 pb-4">
        <div className="mb-3 text-sm font-semibold text-slate-700 flex items-center gap-2">
          {editMode ? (
            <input
              value={section.title}
              onChange={(e) => updateSectionTitle(secActive, e.target.value)}
              className="min-w-[220px] w-full sm:w-96 rounded-lg border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="Judul section…"
            />
          ) : (
            <span>{section.title}</span>
          )}
        </div>

        {/* Header 4/3/5 */}
        <div className="hidden sm:grid grid-cols-12 text-[13px] font-medium text-slate-600 border-y bg-slate-50">
          <div className="col-span-4 py-2.5 px-2">Area Tanggung Jawab</div>
          <div className="col-span-3 py-2.5 px-2 pl-3">Status / Isian</div>
          <div className="col-span-5 py-2.5 px-2">Keterangan</div>
        </div>

        {section.rows.length === 0 ? (
          <div className="p-4 text-sm text-slate-600 border border-dashed border-slate-300 rounded-xl mt-3 bg-slate-50">
            Konten menyusul untuk bagian{" "}
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
                  onChange={(v) => patchData(secActive, row.key, v)}
                />
              );
            })}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={goNext}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
            title="Ke section berikutnya"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= ROW ================= */
type RVOptions = Extract<RowValue, { kind: "options" }>;
type RVNumber = Extract<RowValue, { kind: "number" }>;
type RVScore = Extract<RowValue, { kind: "score" }>;
type RVCompound = Extract<RowValue, { kind: "compound" }>;
type CompoundExtras = NonNullable<RVCompound["extras"]>;

function ChecklistRow({
  row,
  value,
  onChange,
  editable,
  onEditLabel,
  onEditOptions,
  onEditSuffix,
}: {
  row: RowDef;
  value?: RowValue;
  editable?: boolean;
  onEditLabel: (label: string) => void;
  onEditOptions: (csv: string) => void;
  onEditSuffix: (suffix: string) => void;
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
    if (value && value.note !== note) onChange({ ...value, note });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note]);

  useEffect(() => {
    adjustHeight();
  }, [value?.note]);

  const hasTextExtra =
    row.kind === "compound" && row.extra?.some((e) => e.type === "text");
  const hasCurrencyExtra =
    row.kind === "compound" && row.extra?.some((e) => e.type === "currency");
  const hasNumberExtra =
    row.kind === "compound" && row.extra?.some((e) => e.type === "number");

  const textPlaceholder =
    row.kind === "compound"
      ? row.extra?.find((e) => e.type === "text")?.placeholder
      : undefined;
  const currencyPlaceholder =
    row.kind === "compound"
      ? row.extra?.find((e) => e.type === "currency")?.placeholder
      : undefined;
  const numberPlaceholder =
    row.kind === "compound"
      ? row.extra?.find((e) => e.type === "number")?.placeholder
      : undefined;

  // current values per-kind
  const optVal: RVOptions["value"] | null =
    value?.kind === "options" ? value.value : null;
  const numStr: string =
    value?.kind === "number" ? String((value as RVNumber).value ?? "") : "";
  const scoreVal: number =
    value?.kind === "score" ? (value as RVScore).value : 3;
  const compVal: RVCompound | undefined =
    value?.kind === "compound" ? (value as RVCompound) : undefined;
  const compExtras: CompoundExtras | undefined = compVal?.extras as
    | CompoundExtras
    | undefined;

  // --- helper rupiah ---
  const formatIDR = (digitStr?: string) => {
    if (!digitStr) return "";
    const n = Number(digitStr);
    if (isNaN(n)) return "";
    return new Intl.NumberFormat("id-ID").format(n);
  };
  const toDigits = (s: string) => (s || "").replace(/[^\d]/g, "");

  return (
    <div className="grid grid-cols-1 sm:grid-cols-12 items-start bg-white">
      {/* Label */}
      <div className="sm:col-span-4 py-3 px-2 text-sm">
        {editable ? (
          <input
            value={row.label}
            onChange={(e) => onEditLabel(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-blue-500"
            placeholder="Nama area/pertanyaan…"
          />
        ) : (
          row.label
        )}
      </div>

      {/* Status / Isian */}
      <div className="sm:col-span-3 py-3 px-2 pl-3">
        <div className="sm:hidden text-xs text-slate-500 mb-1">
          Status / Isian
        </div>

        {editable && (row.kind === "options" || row.kind === "compound") && (
          <input
            defaultValue={(row.options || []).join(", ")}
            onBlur={(e) => onEditOptions(e.target.value)}
            className="mb-2 w-full rounded-lg border border-amber-300 bg-white text-xs focus:ring-2 focus:ring-amber-500"
            placeholder="Opsi dipisah koma (mis: Cocok, Tidak Cocok)"
            title="Edit opsi (pisah dengan koma). Klik di luar untuk menyimpan."
          />
        )}
        {editable && row.kind === "number" && (
          <input
            defaultValue={row.suffix || ""}
            onBlur={(e) => onEditSuffix(e.target.value)}
            className="mb-2 w-full rounded-lg border border-amber-300 bg-white text-xs focus:ring-2 focus:ring-amber-500"
            placeholder="Suffix (mis: pcs, faktur, kali)"
            title="Edit suffix. Klik di luar untuk menyimpan."
          />
        )}

        {row.kind === "options" && (
          <OptionsGroup
            options={row.options}
            value={optVal}
            onChange={(v) => onChange({ kind: "options", value: v, note })}
          />
        )}
        {row.kind === "number" && (
          <NumberWithSuffix
            suffix={row.suffix}
            value={numStr}
            onChange={(v) =>
              onChange({ kind: "number", value: v, suffix: row.suffix, note })
            }
          />
        )}
        {row.kind === "score" && (
          <ScoreSelect
            value={scoreVal}
            onChange={(v) => onChange({ kind: "score", value: v, note })}
          />
        )}
        {row.kind === "compound" && (
          <div className="space-y-2">
            <OptionsGroup
              options={row.options}
              value={compVal?.value ?? null}
              onChange={(v) =>
                onChange({
                  kind: "compound",
                  value: v,
                  note,
                  extras: {
                    text: compExtras?.text,
                    currency: compExtras?.currency,
                    number: compExtras?.number,
                  },
                })
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
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
                  />
                )}

                {hasCurrencyExtra && (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                      Rp.
                    </span>
                    <input
                      placeholder={currencyPlaceholder || "contoh: 4.235.523"}
                      value={formatIDR(compExtras?.currency)}
                      onChange={(e) => {
                        const rawDigits = toDigits(e.target.value);
                        onChange({
                          kind: "compound",
                          value: compVal?.value ?? null,
                          note,
                          extras: {
                            text: compExtras?.text,
                            currency: rawDigits, // simpan RAW digit
                            number: compExtras?.number,
                          },
                        });
                      }}
                      inputMode="numeric"
                      className="w-full rounded-lg border border-slate-300 bg-white text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 pl-12"
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
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
            )}
          </div>
        )}
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
          className="w-full rounded-lg border border-slate-300 bg-white text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 resize-none overflow-y-auto min-h-[40px] max-h-40"
        />
      </div>
    </div>
  );
}
