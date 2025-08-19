"use client";

import React, { useMemo, useState, useEffect } from "react";
import { ClipboardList, CheckCircle2 } from "lucide-react";
import type { ChecklistState, RowValue, SectionKey } from "@/lib/types";
import { OptionsGroup, NumberWithSuffix, ScoreSelect } from "./common";
import { useAuth } from "@/components/AuthProvider";
import type { Role } from "@/components/AuthProvider";

/* ============================================================
   OVERRIDE STORAGE (per-role) — judul section, label baris, opsi, suffix
   ============================================================ */
type RowOverride = {
  label?: string;
  options?: string[]; // utk row kind: "options"
  suffix?: string; // utk row kind: "number"
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

/* ============================================================
   DEFINISI ROW
   ============================================================ */
type RowDef =
  | { kind: "options"; key: string; label: string; options: string[] }
  | { kind: "number"; key: string; label: string; suffix?: string }
  | { kind: "score"; key: string; label: string }
  | {
      kind: "compound";
      key: string;
      label: string;
      options: string[];
      extra?: { type: "text" | "currency"; placeholder?: string }[];
    };

/*  ⚠️ Tabs: “faktur” dipakai sebagai “Penjualan”. “retur” disembunyikan. */
const SECTION_TABS: { key: SectionKey; label: string }[] = [
  { key: "kas", label: "Kas Kecil" },
  { key: "buku", label: "Buku Penunjang" },
  { key: "ar", label: "AR" },
  { key: "klaim", label: "Klaim" },
  { key: "pengiriman", label: "Pengiriman" },
  { key: "setoran", label: "Setoran Bank" },
  { key: "pembelian", label: "Proses Pembelian" },
  { key: "faktur", label: "Penjualan" }, // <-- gabungan faktur+retur
  // { key: "retur", label: "Retur Penjualan" }, // disembunyikan
  { key: "marketing", label: "Marketing" },
];

/* ============================================================
   COMPONENT
   ============================================================ */
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
              kind: "options",
              key: "saldo-kas-kecil",
              label: "Saldo Kas Kecil",
              options: ["Cocok", "Tidak Cocok"],
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
              label: "Approval",
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
              options: ["Ada Form", "Tidak"],
              extra: [
                { type: "text", placeholder: "Penjelasan..." },
                { type: "currency", placeholder: "Nilai" },
              ],
            },
            {
              kind: "options",
              key: "serah-terima-fat",
              label: "Serah Terima dengan FAT",
              options: ["Sesuai", "Tidak Sesuai"],
            },
            { kind: "score", key: "score-performa", label: "Score Performa" },
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
              key: "kasbon-operasional",
              label: "Buku Kasbon Operasional",
              options: ["Sesuai", "Tidak Sesuai"],
            },
          ],
        },

        ar: {
          title: "AR",
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
              label: "Faktur disesuaikan Rute/Permintaan/Kebutuhan",
              options: ["Sesuai", "Tidak Sesuai"],
            },
            {
              kind: "options",
              key: "overdue-bawakan",
              label: "Faktur perlu ditagih/overdue dibawakan",
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

        /* ===================== KLAIM ===================== */
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

        /* ===================== PENGIRIMAN ===================== */
        pengiriman: {
          title: "Pengiriman",
          rows: [
            {
              kind: "number",
              key: "do-belum-draft-loading",
              label: "Faktur DO yang belum draft loading",
              suffix: "faktur",
            },
            {
              kind: "options",
              key: "draft-loading-besok",
              label: "Pengiriman besok sudah draft loading semua",
              options: ["Sudah", "Ada yang belum"],
            },
            {
              kind: "compound",
              key: "faktur-kembali",
              label: "Faktur kembali dari pengiriman",
              options: ["100%", "Ada yang tidak kembali"],
              extra: [{ type: "text", placeholder: "Alasan…" }],
            },
            {
              kind: "options",
              key: "kondisi-dokumen",
              label: "Kondisi dokumen",
              options: ["Baik", "Perlu perbaikan"],
            },
            {
              kind: "options",
              key: "tanda-terima",
              label: "Tanda terima",
              options: ["Lengkap", "Tidak Lengkap"],
            },
            {
              kind: "options",
              key: "input-apos",
              label: "Input di aPos",
              options: ["Sudah", "Belum Selesai"],
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
              extra: [{ type: "text", placeholder: "Alasan…" }],
            },
          ],
        },

        /* ===================== SETORAN BANK ===================== */
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
              key: "penjumlahan-kas-besar",
              label: "Penjumlahan Kas Besar ke Bank",
              options: ["Sesuai", "Tidak Sesuai", "Tidak Dikerjakan"],
            },
          ],
        },

        /* ===================== PROSES PEMBELIAN ===================== */
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

        /* ===================== PENJUALAN (gabungan faktur + retur) ===================== */
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
              // note: satu input — isi alasan / hari belum disetting
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

        /* tidak dipakai, dibiarkan kosong agar tipe aman */
        retur: { title: "Retur (legacy)", rows: [] },

        /* ===================== MARKETING ===================== */
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
    const clone: Record<SectionKey, { title: string; rows: RowDef[] }> =
      JSON.parse(JSON.stringify(BASE_MAP));
    if (overrides.sections) {
      for (const sec of Object.keys(overrides.sections) as SectionKey[]) {
        const t = overrides.sections[sec]?.title;
        if (t) clone[sec].title = t;
      }
    }
    if (overrides.rows) {
      for (const sec of Object.keys(overrides.rows) as SectionKey[]) {
        const rmap = overrides.rows[sec] || {};
        for (const rowKey of Object.keys(rmap)) {
          const patch = rmap[rowKey]!;
          const idx = clone[sec].rows.findIndex((r) => r.key === rowKey);
          if (idx >= 0) {
            const r = clone[sec].rows[idx] as any;
            if (patch.label) r.label = patch.label;
            if (r.kind === "options" && patch.options)
              r.options = patch.options;
            if (r.kind === "number" && "suffix" in patch)
              r.suffix = patch.suffix;
          }
        }
      }
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
    const next = mergeSectionTitle(cur, sec, title);
    writeRoleOverrides(viewRole, next);
    setRev((x) => x + 1);
  };
  const updateRowLabel = (sec: SectionKey, rowKey: string, label: string) => {
    if (!isSuper) return;
    const cur = readRoleOverrides(viewRole);
    const next = mergeRowOverride(cur, sec, rowKey, { label });
    writeRoleOverrides(viewRole, next);
    setRev((x) => x + 1);
  };
  const updateRowOptions = (sec: SectionKey, rowKey: string, csv: string) => {
    if (!isSuper) return;
    const opts = csv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const cur = readRoleOverrides(viewRole);
    const next = mergeRowOverride(cur, sec, rowKey, { options: opts });
    writeRoleOverrides(viewRole, next);
    setRev((x) => x + 1);
  };
  const updateRowSuffix = (sec: SectionKey, rowKey: string, suffix: string) => {
    if (!isSuper) return;
    const cur = readRoleOverrides(viewRole);
    const next = mergeRowOverride(cur, sec, rowKey, { suffix });
    writeRoleOverrides(viewRole, next);
    setRev((x) => x + 1);
  };
  const resetOverrides = () => {
    if (!isSuper) return;
    if (!confirm(`Reset semua pengaturan teks untuk role ${viewRole}?`)) return;
    writeRoleOverrides(viewRole, {});
    setRev((x) => x + 1);
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
              title="Reset semua override role ini"
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {/* Info instruksi */}
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

      {/* Section title + grid */}
      <div className="px-3 sm:px-6 pb-4">
        <div className="mb-3 text-sm font-semibold text-slate-700 flex items-center gap-2">
          {editMode ? (
            <input
              value={section.title}
              onChange={(e) => updateSectionTitle(secActive, e.target.value)}
              className="min-w-[220px] w-full sm:w-96 rounded-lg border-slate-300 text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="Judul section…"
            />
          ) : (
            <span>{section.title}</span>
          )}
        </div>

        <div className="hidden sm:grid grid-cols-12 text-[13px] font-medium text-slate-600 border-y bg-slate-50">
          <div className="col-span-6 py-2.5 px-2">Area Tanggung Jawab</div>
          <div className="col-span-4 py-2.5 px-2">Status / Isian</div>
          <div className="col-span-2 py-2.5 px-2">Catatan</div>
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
      </div>
    </div>
  );
}

/* ============================================================
   ROW COMPONENT (dengan UI edit superadmin)
   ============================================================ */
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
  useEffect(() => {
    if (value && value.note !== note) onChange({ ...(value as any), note });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-12 items-start bg-white">
      <div className="sm:col-span-6 py-3 px-2 text-sm">
        {editable ? (
          <input
            value={(row as any).label}
            onChange={(e) => onEditLabel(e.target.value)}
            className="w-full rounded-lg border-slate-300 text-sm focus:ring-2 focus:ring-blue-500"
            placeholder="Nama area/pertanyaan…"
          />
        ) : (
          (row as any).label
        )}
      </div>

      <div className="sm:col-span-4 py-3 px-2">
        <div className="sm:hidden text-xs text-slate-500 mb-1">
          Status / Isian
        </div>

        {editable && row.kind === "options" && (
          <input
            defaultValue={(row.options || []).join(", ")}
            onBlur={(e) => onEditOptions(e.target.value)}
            className="mb-2 w-full rounded-lg border-slate-300 text-xs focus:ring-2 focus:ring-amber-500"
            placeholder="Opsi dipisah koma"
            title="Edit opsi (pisah dengan koma). Klik di luar untuk menyimpan."
          />
        )}
        {editable && row.kind === "number" && (
          <input
            defaultValue={row.suffix || ""}
            onBlur={(e) => onEditSuffix(e.target.value)}
            className="mb-2 w-full rounded-lg border-slate-300 text-xs focus:ring-2 focus:ring-amber-500"
            placeholder="Suffix (mis: pcs, faktur, kali)"
            title="Edit suffix. Klik di luar untuk menyimpan."
          />
        )}

        {row.kind === "options" && (
          <OptionsGroup
            options={row.options}
            value={(value as any)?.value ?? null}
            onChange={(v) => onChange({ kind: "options", value: v, note })}
          />
        )}
        {row.kind === "number" && (
          <NumberWithSuffix
            suffix={row.suffix}
            value={(value as any)?.value ?? ""}
            onChange={(v) =>
              onChange({ kind: "number", value: v, suffix: row.suffix, note })
            }
          />
        )}
        {row.kind === "score" && (
          <ScoreSelect
            value={(value as any)?.value ?? 3}
            onChange={(v) => onChange({ kind: "score", value: v, note })}
          />
        )}
        {row.kind === "compound" && (
          <div className="space-y-2">
            <OptionsGroup
              options={row.options}
              value={(value as any)?.value ?? null}
              onChange={(v) =>
                onChange({
                  kind: "compound",
                  value: v,
                  note,
                  extras: {
                    text: (value as any)?.extras?.text,
                    currency: (value as any)?.extras?.currency,
                  },
                })
              }
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input
                placeholder={row.extra?.[0]?.placeholder}
                value={(value as any)?.extras?.text ?? ""}
                onChange={(e) =>
                  onChange({
                    kind: "compound",
                    value: (value as any)?.value ?? null,
                    note,
                    extras: {
                      text: e.target.value,
                      currency: (value as any)?.extras?.currency,
                    },
                  })
                }
                className="w-full rounded-lg border-slate-300 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
              />
              {row.extra?.[1]?.type === "currency" && (
                <input
                  placeholder={row.extra?.[1]?.placeholder}
                  value={(value as any)?.extras?.currency ?? ""}
                  onChange={(e) =>
                    onChange({
                      kind: "compound",
                      value: (value as any)?.value ?? null,
                      note,
                      extras: {
                        text: (value as any)?.extras?.text,
                        currency: e.target.value,
                      },
                    })
                  }
                  inputMode="numeric"
                  className="w-full rounded-lg border-slate-300 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
          </div>
        )}
      </div>

      <div className="sm:col-span-2 py-3 px-2">
        <div className="sm:hidden text-xs text-slate-500 mb-1">Catatan</div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Catatan..."
          className="w-full rounded-lg border-slate-300 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}
