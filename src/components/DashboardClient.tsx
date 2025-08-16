"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ClipboardList,
  Target as TargetIcon,
  Users2,
  CalendarCheck,
  Trophy,
  Paperclip,
  CheckCircle2,
  ListChecks,
  AlertTriangle,
  CalendarDays,
  Download,
  FilePlus2,
  FileText,
  X,
  Eraser,
  Lock,
  Plus,
  Trash2,
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/* =========================== TOP TABS =========================== */
const TABS = [
  { key: "checklist", label: "Checklist Area", icon: ClipboardList },
  { key: "evaluasi", label: "Evaluasi Tim", icon: Users2 },
  { key: "target", label: "Target & Achievement", icon: TargetIcon },
  { key: "sparta", label: "Project Tracking (SPARTA)", icon: ListChecks },
  { key: "agenda", label: "Agenda & Jadwal", icon: CalendarCheck },
  { key: "lampiran", label: "Lampiran", icon: Paperclip },
  { key: "achievement", label: "Achievement", icon: Trophy },
] as const;

type TabDef = (typeof TABS)[number]["key"];
const todayISO = () => new Date().toISOString().slice(0, 10);

/* =========================== TYPES =========================== */
type SectionKey =
  | "kas"
  | "buku"
  | "ar"
  | "klaim"
  | "pengiriman"
  | "setoran"
  | "pembelian"
  | "faktur"
  | "retur"
  | "marketing";

type RowValue =
  | { kind: "options"; value: string | null; note?: string }
  | { kind: "number"; value: string; note?: string; suffix?: string }
  | { kind: "score"; value: number; note?: string }
  | {
      kind: "compound";
      value: string | null;
      extras?: { text?: string; currency?: string };
      note?: string;
    };

type ChecklistState = Record<
  SectionKey,
  {
    [rowKey: string]: RowValue;
  }
>;

type EvaluasiAttitude = {
  hari: 1 | 2 | 3 | 4 | 5 | 6;
  scores: Record<string, number>;
  notes: Record<string, string>;
};
type EvaluasiKompetensi = {
  namaKasir: string;
  namaSalesAdmin: string;
  kesalahanMingguIni: string;
  scores: Record<string, number>;
  notes: Record<string, string>;
};

const PRINCIPALS = ["FRI", "SPJ", "APA", "WPL"] as const;
type Principal = (typeof PRINCIPALS)[number];

type TargetState = {
  targetSelesai: string;
  klaimSelesai: Record<Principal, boolean>;
  weekly: Record<Principal, boolean[]>; // 4 minggu
  ketepatanFodks: boolean;
};

type SpartaState = {
  deadline: string;
  steps: boolean[]; // 4 langkah UDI
  progressText: string;
  nextAction: string;
};

type AgendaEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  plan: string[]; // list item
  realisasi: string[]; // list item
  createdAt: string;
};
type AgendaState = { entries: AgendaEntry[] };

type AppState = {
  header: { leader: string; target: string; depo: string };
  checklist: ChecklistState;
  evaluasi: { attitude: EvaluasiAttitude; kompetensi: EvaluasiKompetensi };
  target: TargetState;
  sparta: SpartaState;
  agenda: AgendaState;
};

/* ======= Initializers ======= */
function initChecklist(): ChecklistState {
  return {
    kas: {},
    buku: {},
    ar: {},
    klaim: {},
    pengiriman: {},
    setoran: {},
    pembelian: {},
    faktur: {},
    retur: {},
    marketing: {},
  };
}
function initEvaluasi(): AppState["evaluasi"] {
  return {
    attitude: { hari: 1, scores: {}, notes: {} },
    kompetensi: {
      namaKasir: "",
      namaSalesAdmin: "",
      kesalahanMingguIni: "",
      scores: {},
      notes: {},
    },
  };
}

/* =========================== ROOT =========================== */
export default function DashboardClient() {
  const [active, setActive] = useState<TabDef>("checklist");

  const [state, setState] = useState<AppState>({
    header: {
      leader: "(Auto-fill from user)",
      target: "(Auto-fill)",
      depo: "(Auto-fill)",
    },
    checklist: initChecklist(),
    evaluasi: initEvaluasi(),
    target: {
      targetSelesai: "",
      klaimSelesai: { FRI: false, SPJ: false, APA: false, WPL: false },
      weekly: {
        FRI: [false, false, false, false],
        SPJ: [false, false, false, false],
        APA: [false, false, false, false],
        WPL: [false, false, false, false],
      },
      ketepatanFodks: false,
    },
    sparta: {
      deadline: "",
      steps: [false, false, false, false],
      progressText: "",
      nextAction: "",
    },
    agenda: { entries: [] },
  });

  const update = <K extends keyof AppState>(k: K, v: AppState[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const resetAfterArchive = () =>
    setState((s) => ({
      ...s,
      checklist: initChecklist(),
      evaluasi: initEvaluasi(),
      // target, sparta, agenda tetap; hanya form harian yang direset
    }));

  return (
    <div className="min-h-screen bg-slate-100">
      <Header
        header={state.header}
        onHeaderChange={(h) => update("header", h)}
      />

      <main className="max-w-6xl mx-auto px-3 sm:px-4 pb-16">
        <RoleTabs tabs={TABS} active={active} onChange={setActive} />
        <section className="mt-6">
          {active === "checklist" && (
            <ChecklistArea
              data={state.checklist}
              onChange={(payload) => update("checklist", payload)}
            />
          )}
          {active === "evaluasi" && (
            <EvaluasiTim
              data={state.evaluasi}
              onChange={(payload) => update("evaluasi", payload)}
            />
          )}
          {active === "target" && (
            <TargetAchievement
              data={state.target}
              onChange={(payload) => update("target", payload)}
            />
          )}
          {active === "sparta" && (
            <SpartaTracking
              data={state.sparta}
              onChange={(payload) => update("sparta", payload)}
            />
          )}
          {active === "agenda" && (
            <AgendaJadwal
              data={state.agenda}
              onChange={(payload) => update("agenda", payload)}
            />
          )}
          {active === "lampiran" && (
            <Lampiran appState={state} onArchivedAndReset={resetAfterArchive} />
          )}
          {active === "achievement" && <SimpleTab title="Achievement" />}
        </section>
      </main>
    </div>
  );
}

/* =========================== HEADER =========================== */
function Header({
  header,
  onHeaderChange,
}: {
  header: AppState["header"];
  onHeaderChange: (h: AppState["header"]) => void;
}) {
  return (
    <header className="w-full bg-gradient-to-b from-blue-800 to-blue-700 text-white shadow">
      <div className="max-w-6xl mx-auto px-3 sm:px-4">
        <div className="py-6 text-center">
          <div className="inline-flex items-center gap-2 text-sm uppercase tracking-wide opacity-90">
            <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/20">
              LEADER
            </span>
            <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/20">
              MONITORING
            </span>
            <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/20">
              DAILY
            </span>
          </div>
          <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-wide">
            LEADER MONITORING DAILY
          </h1>
          <p className="mt-1 text-sm text-blue-100">
            Template laporan harian leadership | ASTRO Group
          </p>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MetaPill
              label="Leader"
              value={header.leader}
              onEdit={(v) => onHeaderChange({ ...header, leader: v })}
            />
            <MetaPill
              label="Target"
              value={header.target}
              onEdit={(v) => onHeaderChange({ ...header, target: v })}
            />
            <MetaPill
              label="Depo"
              value={header.depo}
              onEdit={(v) => onHeaderChange({ ...header, depo: v })}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
function MetaPill({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: (v: string) => void;
}) {
  return (
    <div className="bg-white/10 border border-white/15 rounded-xl px-3 py-2 text-center">
      <div className="text-[11px] uppercase tracking-wide text-blue-100">
        {label}
      </div>
      <input
        value={value}
        onChange={(e) => onEdit(e.target.value)}
        className="mt-0.5 w-full bg-transparent text-center font-medium outline-none placeholder:text-blue-100/70"
        placeholder="(isi)"
      />
    </div>
  );
}

/* =========================== ROLE TABS =========================== */
function RoleTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: ReadonlyArray<{
    key: TabDef;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }>;
  active: TabDef;
  onChange: (key: TabDef) => void;
}) {
  return (
    <div className="bg-white border rounded-2xl shadow-sm p-2 flex flex-nowrap overflow-x-auto gap-2">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={
            "group inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm transition whitespace-nowrap " +
            (active === t.key
              ? "bg-blue-600 text-white shadow"
              : "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200")
          }
        >
          <t.icon className="h-4 w-4 opacity-90" />
          <span className="font-medium">{t.label}</span>
        </button>
      ))}
    </div>
  );
}

/* =========================================================================
   CHECKLIST AREA (controlled)
   ========================================================================= */
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

const SECTION_TABS: { key: SectionKey; label: string }[] = [
  { key: "kas", label: "Kas Kecil" },
  { key: "buku", label: "Buku Penunjang" },
  { key: "ar", label: "AR" },
  { key: "klaim", label: "Klaim" },
  { key: "pengiriman", label: "Pengiriman" },
  { key: "setoran", label: "Setoran Bank" },
  { key: "pembelian", label: "Proses Pembelian" },
  { key: "faktur", label: "Faktur Penjualan" },
  { key: "retur", label: "Retur Penjualan" },
  { key: "marketing", label: "Marketing" },
];

function ChecklistArea({
  data,
  onChange,
}: {
  data: ChecklistState;
  onChange: (v: ChecklistState) => void;
}) {
  const SECTION_MAP: Record<SectionKey, { title: string; rows: RowDef[] }> =
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
              label:
                "Faktur yang perlu ditagih/overdue/sales teman tidak masuk dibawakan",
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
        klaim: { title: "Klaim", rows: [] },
        pengiriman: { title: "Pengiriman", rows: [] },
        setoran: { title: "Setoran Bank", rows: [] },
        pembelian: { title: "Proses Pembelian", rows: [] },
        faktur: { title: "Faktur Penjualan", rows: [] },
        retur: { title: "Retur Penjualan", rows: [] },
        marketing: { title: "Marketing", rows: [] },
      }),
      []
    );

  const [secActive, setSecActive] = useState<SectionKey>("kas");
  const section = SECTION_MAP[secActive];
  const patch = (sec: SectionKey, key: string, v: RowValue) =>
    onChange({ ...data, [sec]: { ...data[sec], [key]: v } });

  return (
    <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
      <div className="px-3 sm:px-6 py-4 border-b bg-slate-50 flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-blue-600" />
        <h2 className="text-slate-800 font-semibold">Checklist Area</h2>
      </div>

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

      <div className="px-3 sm:px-6 pb-4">
        <div className="mb-3 text-sm font-semibold text-slate-700">
          {section.title}
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
                  onChange={(v) => patch(secActive, row.key, v)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ChecklistRow({
  row,
  value,
  onChange,
}: {
  row: RowDef;
  value?: RowValue;
  onChange: (v: RowValue) => void;
}) {
  const [note, setNote] = useState(value?.note || "");
  useEffect(() => {
    if (value && value.note !== note) onChange({ ...(value as any), note });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-12 items-start bg-white">
      <div className="sm:col-span-6 py-3 px-2 text-sm">{row.label}</div>
      <div className="sm:col-span-4 py-3 px-2">
        <div className="sm:hidden text-xs text-slate-500 mb-1">
          Status / Isian
        </div>

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

function OptionsGroup({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          type="button"
          key={opt}
          onClick={() => onChange(opt)}
          className={
            "px-3 py-1.5 rounded-lg border text-sm transition " +
            (value === opt
              ? "bg-blue-600 text-white border-blue-600 shadow"
              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50")
          }
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
function NumberWithSuffix({
  suffix,
  value,
  onChange,
}: {
  suffix?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        className="w-full sm:w-28 rounded-lg border-slate-300 text-sm focus:ring-2 focus:ring-blue-500"
      />
      {suffix && <span className="text-sm text-slate-600">{suffix}</span>}
    </div>
  );
}
function ThemedSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", ...rest } = props;
  return (
    <select
      {...rest}
      className={
        "w-full rounded-lg border text-sm bg-white text-slate-800 " +
        "border-blue-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 " +
        "disabled:opacity-50 " +
        className
      }
    />
  );
}
function scoreDot(score: number) {
  if (score <= 2) return "bg-rose-500";
  if (score === 3) return "bg-amber-500";
  return "bg-emerald-500";
}
function ScoreSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={"h-2.5 w-2.5 rounded-full " + scoreDot(value)} />
      <ThemedSelect
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </ThemedSelect>
    </div>
  );
}

/* =========================================================================
   EVALUASI TIM (controlled)
   ========================================================================= */
type Theme = "attitude" | "kompetensi" | "prestasi" | "kepatuhan" | "kosong";
const DAY_THEME: Record<1 | 2 | 3 | 4 | 5 | 6, Theme> = {
  1: "attitude",
  2: "kompetensi",
  3: "kosong",
  4: "prestasi",
  5: "kosong",
  6: "kepatuhan",
};

const HEBAT_ITEMS = [
  { code: "H", title: "Harmonis & Integritas" },
  { code: "E", title: "Etos Profesional" },
  { code: "B", title: "Berinovasi untuk Maju" },
  { code: "A", title: "Ahli & Adaptif" },
  { code: "T", title: "Tepat Manfaat & Peduli" },
] as const;

const KOMPETENSI_ITEMS = [
  { key: "menghitungUang", title: "Menghitung uang" },
  { key: "membukukanKasKecil", title: "Membukukan Kas kecil" },
  { key: "penjurnalan", title: "Penjurnalan" },
  { key: "menyelesaikanTugas", title: "Menyelesaikan Tugas" },
  { key: "setoranPas", title: "Setoran Pas" },
  { key: "tepatMenyiapkanTagihan", title: "Tepat Menyiapkan Tagihan" },
  {
    key: "menyiapkanTagihanTepatWaktu",
    title: "Menyiapkan Tagihan Tepat Waktu",
  },
  { key: "menagihAR", title: "Menagih AR ke" },
  { key: "laporanTepatWaktu", title: "Laporan tepat Waktu" },
] as const;

function EvaluasiTim({
  data,
  onChange,
}: {
  data: AppState["evaluasi"];
  onChange: (v: AppState["evaluasi"]) => void;
}) {
  const hari = data.attitude.hari;
  const theme = DAY_THEME[hari];

  const setHari = (h: 1 | 2 | 3 | 4 | 5 | 6) =>
    onChange({ ...data, attitude: { ...data.attitude, hari: h } });
  const setAtt = (
    scores: Record<string, number>,
    notes: Record<string, string>
  ) => onChange({ ...data, attitude: { ...data.attitude, scores, notes } });
  const setKom = (payload: Partial<EvaluasiKompetensi>) =>
    onChange({ ...data, kompetensi: { ...data.kompetensi, ...payload } });

  return (
    <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
      <div className="px-3 sm:px-6 py-4 border-b bg-slate-50 flex items-center gap-2">
        <Users2 className="h-5 w-5 text-blue-600" />
        <h2 className="text-slate-800 font-semibold">Evaluasi Tim</h2>
      </div>

      <div className="px-3 sm:px-6 py-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Hari ke</span>
            <ThemedSelect
              value={String(hari)}
              onChange={(e) => setHari(Number(e.target.value) as any)}
              className="w-24"
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </ThemedSelect>
          </div>

          <div className="text-sm">
            <span className="text-slate-500">Tema:</span>{" "}
            <span className="font-medium">
              {theme === "attitude"
                ? "Attitude"
                : theme === "kompetensi"
                ? "Kompetensi"
                : theme === "prestasi"
                ? "Prestasi"
                : theme === "kepatuhan"
                ? "Kepatuhan SOP"
                : "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="px-3 sm:px-6 pb-6">
        {theme === "attitude" ? (
          <FormAttitudeControlled data={data.attitude} onChange={setAtt} />
        ) : theme === "kompetensi" ? (
          <FormKompetensiControlled data={data.kompetensi} onChange={setKom} />
        ) : (
          <div className="p-4 text-sm text-slate-600 border border-dashed rounded-xl bg-slate-50">
            Form {theme} menyusul.
          </div>
        )}
      </div>
    </div>
  );
}

function FormAttitudeControlled({
  data,
  onChange,
}: {
  data: EvaluasiAttitude;
  onChange: (
    scores: Record<string, number>,
    notes: Record<string, string>
  ) => void;
}) {
  const [scores, setScores] = useState<Record<string, number>>(
    Object.keys(data.scores).length
      ? data.scores
      : Object.fromEntries(HEBAT_ITEMS.map((i) => [i.code, 3]))
  );
  const [notes, setNotes] = useState<Record<string, string>>(data.notes || {});
  useEffect(() => onChange(scores, notes), [scores, notes]); // sinkron

  const avg =
    Math.round(
      (Object.values(scores).reduce((a, b) => a + b, 0) / HEBAT_ITEMS.length) *
        10
    ) / 10;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-600">
        <span className="font-medium">Skala 1–5:</span> 1 sangat jelek, 2
        kurang, 3 cukup, 4 baik, 5 sangat baik.
      </div>

      <div className="divide-y border rounded-xl bg-white">
        {HEBAT_ITEMS.map((item) => (
          <div
            key={item.code}
            className="p-4 grid grid-cols-1 sm:grid-cols-12 gap-3"
          >
            <div className="sm:col-span-7">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white text-xs font-bold">
                  {item.code}
                </span>
                <h4 className="font-medium text-slate-800">{item.title}</h4>
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="sm:hidden text-xs text-slate-500 mb-1">Skor</div>
              <ScoreSelect
                value={scores[item.code]}
                onChange={(v) => setScores((p) => ({ ...p, [item.code]: v }))}
              />
            </div>
            <div className="sm:col-span-3">
              <div className="sm:hidden text-xs text-slate-500 mb-1">
                Catatan
              </div>
              <input
                value={notes[item.code] || ""}
                onChange={(e) =>
                  setNotes((p) => ({ ...p, [item.code]: e.target.value }))
                }
                placeholder="Catatan..."
                className="w-full rounded-lg border-slate-300 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="text-sm text-slate-500">
        Rata-rata skor (HEBAT):{" "}
        <span className="font-semibold text-slate-800">{avg}</span>
      </div>
    </div>
  );
}

function FormKompetensiControlled({
  data,
  onChange,
}: {
  data: EvaluasiKompetensi;
  onChange: (payload: Partial<EvaluasiKompetensi>) => void;
}) {
  const [scores, setScores] = useState<Record<string, number>>(
    Object.keys(data.scores).length
      ? data.scores
      : Object.fromEntries(KOMPETENSI_ITEMS.map((i) => [i.key, 3]))
  );
  const [notes, setNotes] = useState<Record<string, string>>(data.notes || {});
  useEffect(() => onChange({ scores, notes }), [scores, notes]); // sinkron

  const avg =
    Math.round(
      (Object.values(scores).reduce((a, b) => a + b, 0) /
        KOMPETENSI_ITEMS.length) *
        10
    ) / 10;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-600">
        <span className="font-medium">Skala 1–5:</span> 1 sangat jelek, 2
        kurang, 3 cukup, 4 baik, 5 sangat baik.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          value={data.namaKasir}
          onChange={(e) => onChange({ namaKasir: e.target.value })}
          placeholder="Nama Kasir"
          className="w-full rounded-lg border-slate-300 text-sm focus:ring-2 focus:ring-blue-500"
        />
        <input
          value={data.namaSalesAdmin}
          onChange={(e) => onChange({ namaSalesAdmin: e.target.value })}
          placeholder="Nama Sales Admin"
          className="w-full rounded-lg border-slate-300 text-sm focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="divide-y border rounded-xl bg-white">
        {KOMPETENSI_ITEMS.map((item) => (
          <div
            key={item.key}
            className="p-4 grid grid-cols-1 sm:grid-cols-12 gap-3"
          >
            <div className="sm:col-span-7">
              <h4 className="font-medium text-slate-800">{item.title}</h4>
            </div>
            <div className="sm:col-span-2">
              <div className="sm:hidden text-xs text-slate-500 mb-1">Skor</div>
              <ScoreSelect
                value={scores[item.key]}
                onChange={(v) => setScores((p) => ({ ...p, [item.key]: v }))}
              />
            </div>
            <div className="sm:col-span-3">
              <div className="sm:hidden text-xs text-slate-500 mb-1">
                Catatan
              </div>
              <input
                value={notes[item.key] || ""}
                onChange={(e) =>
                  setNotes((p) => ({ ...p, [item.key]: e.target.value }))
                }
                placeholder="Catatan..."
                className="w-full rounded-lg border-slate-300 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Kesalahan yang dibuat di minggu ini
        </label>
        <textarea
          value={data.kesalahanMingguIni}
          onChange={(e) => onChange({ kesalahanMingguIni: e.target.value })}
          rows={3}
          placeholder="Tuliskan ringkas kesalahan/temuan minggu ini..."
          className="w-full rounded-lg border-slate-300 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="text-sm text-slate-500">
        Rata-rata skor kompetensi:{" "}
        <span className="font-semibold text-slate-800">{avg}</span>
      </div>
    </div>
  );
}

/* =========================================================================
   TARGET & ACHIEVEMENT (controlled)
   ========================================================================= */
function TargetAchievement({
  data,
  onChange,
}: {
  data: TargetState;
  onChange: (v: TargetState) => void;
}) {
  const toggleKlaim = (p: Principal) =>
    onChange({
      ...data,
      klaimSelesai: { ...data.klaimSelesai, [p]: !data.klaimSelesai[p] },
    });
  const toggleWeekly = (p: Principal, w: number) =>
    onChange({
      ...data,
      weekly: {
        ...data.weekly,
        [p]: data.weekly[p].map((v, i) => (i === w ? !v : v)),
      },
    });

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-3 sm:px-6 py-4 border-b bg-slate-50 flex items-center gap-2">
          <TargetIcon className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-slate-800">Target & Achievement</h3>
        </div>

        <div className="p-3 sm:p-6">
          <div className="mb-3 text-sm font-semibold text-slate-700">
            Penyelesaian Klaim Bulan Ini{" "}
            <span className="ml-2 text-xs font-normal text-slate-500">
              (reset setiap awal bulan)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-8">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="hidden sm:table-header-group bg-slate-50 text-slate-600">
                    <tr>
                      <th className="text-left py-2 px-2">Jenis</th>
                      <th className="text-left py-2 px-2">Selesai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border rounded-xl bg-white">
                    {PRINCIPALS.map((p) => (
                      <tr key={p} className="grid grid-cols-2 sm:table-row">
                        <td className="py-3 px-2 font-medium text-slate-800">
                          {p}
                        </td>
                        <td className="py-3 px-2">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-blue-600"
                              checked={data.klaimSelesai[p]}
                              onChange={() => toggleKlaim(p)}
                            />
                            <span className="text-sm text-slate-700">
                              Selesai
                            </span>
                          </label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="sm:col-span-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Target Selesai (bulan ini)
              </label>
              <input
                value={data.targetSelesai}
                onChange={(e) =>
                  onChange({ ...data, targetSelesai: e.target.value })
                }
                inputMode="numeric"
                placeholder="mis. 10"
                className="w-full rounded-lg border-slate-300 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-3 sm:px-6 py-4 border-b bg-slate-50 font-semibold text-slate-800">
          Laporan Penjualan ke Prinsipal Mingguan
        </div>
        <div className="p-3 sm:p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left py-2 px-2">Prinsipal</th>
                  <th className="text-left py-2 px-2">Minggu 1</th>
                  <th className="text-left py-2 px-2">Minggu 2</th>
                  <th className="text-left py-2 px-2">Minggu 3</th>
                  <th className="text-left py-2 px-2">Minggu 4</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-white">
                {PRINCIPALS.map((p) => (
                  <tr key={p}>
                    <td className="py-3 px-2 font-medium text-slate-800">
                      {p}
                    </td>
                    {[0, 1, 2, 3].map((w) => (
                      <td key={w} className="py-3 px-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-blue-600"
                          checked={data.weekly[p][w]}
                          onChange={() => toggleWeekly(p, w)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-3 sm:px-6 py-4 border-b bg-slate-50 font-semibold text-slate-800">
          Ketepatan Waktu Input Fodks
        </div>
        <div className="p-3 sm:p-6">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              className="h-5 w-5 accent-blue-600"
              checked={data.ketepatanFodks}
              onChange={() =>
                onChange({ ...data, ketepatanFodks: !data.ketepatanFodks })
              }
            />
            <span className="text-sm text-slate-700">
              Tandai jika tepat waktu
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   SPARTA (controlled)
   ========================================================================= */
const UDI_STEPS = [
  "menyelesaikan Q3 2024",
  "menyelesaikan Q4 2024",
  "menyelesaikan Q1 2025 termasuk reward Q1 2025",
  "menyelesaikan Q2 2025 termasuk reward proporsional Q2 2025",
] as const;
function daysLeft(deadline: string) {
  if (!deadline) return null;
  const d = new Date(deadline);
  const today = new Date();
  const base = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  ).getTime();
  return Math.ceil((d.getTime() - base) / (1000 * 60 * 60 * 24));
}
function SpartaTracking({
  data,
  onChange,
}: {
  data: SpartaState;
  onChange: (v: SpartaState) => void;
}) {
  const percent = Math.round((data.steps.filter(Boolean).length / 4) * 100);
  const sisa = daysLeft(data.deadline);

  return (
    <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
      <div className="px-3 sm:px-6 py-4 border-b bg-slate-50">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-slate-800">
            SPARTA Project Tracking
          </h3>
        </div>
      </div>

      <div className="p-3 sm:p-6 space-y-6">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
          <div className="flex items-start gap-2 text-rose-700">
            <AlertTriangle className="h-5 w-5 mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold mb-1">Ketentuan:</div>
              <ul className="list-disc pl-5 space-y-1">
                <li>Tidak boleh jawaban copy-paste</li>
                <li>Tidak boleh jawaban generik maupun kurang detail</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border">
          <div className="px-3 sm:px-4 py-3 border-b bg-slate-50 flex flex-wrap items-center justify-between gap-3">
            <div className="font-semibold text-slate-800">
              Penyelesaian Klaim UDI
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-600">Deadline:</span>
                <input
                  type="date"
                  value={data.deadline}
                  onChange={(e) =>
                    onChange({ ...data, deadline: e.target.value })
                  }
                  className="rounded-lg border-slate-300 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
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
            </div>
          </div>

          <div className="p-3 sm:p-4 space-y-4">
            <div>
              <div className="text-sm font-medium text-slate-700 mb-2">
                Langkah-Langkah:
              </div>
              <div className="grid grid-cols-1 gap-2">
                {UDI_STEPS.map((text, i) => (
                  <label key={i} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 mt-0.5 accent-blue-600"
                      checked={data.steps[i]}
                      onChange={() =>
                        onChange({
                          ...data,
                          steps: data.steps.map((v, idx) =>
                            idx === i ? !v : v
                          ),
                        })
                      }
                    />
                    <span
                      className={
                        data.steps[i]
                          ? "line-through text-slate-400"
                          : "text-slate-800"
                      }
                    >
                      {i + 1} {text}
                    </span>
                  </label>
                ))}
              </div>
            </div>

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

            <div>
              <div className="text-sm font-medium text-slate-700 mb-1">
                Progress
              </div>
              <textarea
                rows={2}
                value={data.progressText}
                onChange={(e) =>
                  onChange({ ...data, progressText: e.target.value })
                }
                placeholder="sudah selesai sampai Q4 2024 ..."
                className="w-full rounded-lg border-slate-300 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <div className="text-sm font-medium text-slate-700 mb-1">
                Next Action
              </div>
              <textarea
                rows={2}
                value={data.nextAction}
                onChange={(e) =>
                  onChange({ ...data, nextAction: e.target.value })
                }
                placeholder="besok follow up ke Pak Adi ..."
                className="w-full rounded-lg border-slate-300 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   AGENDA & JADWAL (baru)
   ========================================================================= */
function AgendaJadwal({
  data,
  onChange,
}: {
  data: AgendaState;
  onChange: (v: AgendaState) => void;
}) {
  const [date, setDate] = useState(todayISO());

  // entri aktif utk tanggal yang dipilih
  const current = useMemo(
    () => data.entries.find((e) => e.date === date),
    [data.entries, date]
  );

  // local state form atas
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

  // upsert by date (untuk submit form atas)
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

  // SUBMIT FORM ATAS — hanya PLAN yang bisa submit dari atas
  const submitPlanTop = () => {
    const clean = plans.map((s) => s.trim()).filter(Boolean);
    if (!date || clean.length === 0)
      return alert("Isi minimal Tanggal & 1 baris Plan.");
    upsertByDate({ plan: clean, planSubmitted: true });
  };

  // patch/hapus by id (untuk kartu bawah)
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
      <div className="px-3 sm:px-6 py-4 border-b bg-slate-50 flex items-center gap-2">
        <CalendarCheck className="h-5 w-5 text-blue-600" />
        <h2 className="text-slate-800 font-semibold">Agenda & Jadwal</h2>
      </div>

      {/* FORM ATAS */}
      <div className="p-3 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tanggal
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
                  Plan {planLocked ? "terkunci" : "belum disubmit"}
                </span>{" "}
                •{" "}
                <span
                  className={realLocked ? "text-emerald-600" : "text-slate-700"}
                >
                  Realisasi {realLocked ? "terkunci" : "belum disubmit"}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* PLAN (editable & submit di atas) */}
          <div className="border rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-slate-700">Plan</div>
              {!planLocked ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => addRow("plan")}
                    className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded-md border hover:bg-slate-50"
                  >
                    <Plus className="h-4 w-4" /> Tambah Baris
                  </button>
                  <button
                    type="button"
                    onClick={submitPlanTop}
                    className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Submit Plan
                  </button>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-emerald-50 text-emerald-700">
                  <Lock className="h-3.5 w-3.5" /> Terkunci
                </span>
              )}
            </div>
            <div className="space-y-2">
              {plans.map((v, i) => (
                <input
                  key={i}
                  value={v}
                  onChange={(e) => setRow("plan", i, e.target.value)}
                  placeholder={`Plan ${i + 1}`}
                  disabled={planLocked}
                  className="w-full rounded-lg border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                />
              ))}
            </div>
          </div>

          {/* REALISASI (read-only di atas; input & submit dilakukan di kartu bawah) */}
          <div className="border rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-slate-700">
                Realisasi
              </div>
              {realLocked ? (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-emerald-50 text-emerald-700">
                  <Lock className="h-3.5 w-3.5" /> Terkunci
                </span>
              ) : (
                <span className="text-xs text-slate-500">
                  *Realisasi diisi & disubmit dari kartu di bawah
                </span>
              )}
            </div>
            {/* tampilkan ringkas (read-only) */}
            {current?.realisasi?.length ? (
              <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                {current.realisasi.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-slate-500">
                Belum ada realisasi untuk tanggal ini.
              </div>
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

/* ---- Kartu item agenda dengan inline form untuk bagian yang belum disubmit ---- */
function AgendaEntryCard({
  entry,
  onSubmitPlan,
  onSubmitReal,
  onDeletePlan,
  onDeleteReal,
  onDeleteEntry,
}: {
  entry: AgendaEntry;
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
    // refresh draft bila entry berubah
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
        Entri dibuat {new Date(entry.createdAt).toLocaleString()} • diperbarui{" "}
        {new Date(entry.updatedAt).toLocaleString()}
        <span
          className={
            "ml-2 px-2 py-0.5 rounded " +
            (entry.planSubmitted
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-600")
          }
        >
          Plan {entry.planSubmitted ? "terkunci" : "belum submit"}
        </span>
        <span
          className={
            "px-2 py-0.5 rounded " +
            (entry.realSubmitted
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-600")
          }
        >
          Realisasi {entry.realSubmitted ? "terkunci" : "belum submit"}
        </span>
        <button
          onClick={onDeleteEntry}
          className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded border border-rose-200 text-rose-600 hover:bg-rose-50"
          title="Hapus entri tanggal ini"
        >
          <Trash2 className="h-4 w-4" /> Hapus Entri
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* PLAN area */}
        <div>
          <div className="text-sm font-medium text-slate-700 mb-1">Plan</div>
          {entry.planSubmitted ? (
            entry.plan.length ? (
              <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                {entry.plan.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-slate-500">(kosong)</div>
            )
          ) : (
            <>
              <div className="space-y-2">
                {planDraft.map((v, i) => (
                  <input
                    key={i}
                    value={v}
                    onChange={(e) => setRow("plan", i, e.target.value)}
                    placeholder={`Plan ${i + 1}`}
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
                  <Plus className="h-4 w-4" /> Tambah Baris
                </button>
                <button
                  type="button"
                  onClick={submitPlan}
                  className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                >
                  Submit Plan
                </button>
                <button
                  type="button"
                  onClick={onDeletePlan}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="h-4 w-4" /> Hapus Plan
                </button>
              </div>
            </>
          )}
        </div>

        {/* REALISASI area */}
        <div>
          <div className="text-sm font-medium text-slate-700 mb-1">
            Realisasi
          </div>
          {entry.realSubmitted ? (
            entry.realisasi.length ? (
              <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                {entry.realisasi.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-slate-500">(kosong)</div>
            )
          ) : (
            <>
              <div className="space-y-2">
                {realDraft.map((v, i) => (
                  <input
                    key={i}
                    value={v}
                    onChange={(e) => setRow("real", i, e.target.value)}
                    placeholder={`Realisasi ${i + 1}`}
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
                  <Plus className="h-4 w-4" /> Tambah Baris
                </button>
                <button
                  type="button"
                  onClick={submitReal}
                  className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                >
                  Submit Realisasi
                </button>
                <button
                  type="button"
                  onClick={onDeleteReal}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="h-4 w-4" /> Hapus Realisasi
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   LAMPIRAN (Arsip + TTD + PDF)
   ========================================================================= */
type Archive = {
  date: string;
  state: AppState;
  signatureDataUrl?: string;
};
const ARCHIVE_KEY = "sitrep-archives";
function readArchives(): Archive[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    return raw ? (JSON.parse(raw) as Archive[]) : [];
  } catch {
    return [];
  }
}
function writeArchives(arr: Archive[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(arr));
}
function Lampiran({
  appState,
  onArchivedAndReset,
}: {
  appState: AppState;
  onArchivedAndReset: () => void;
}) {
  const [archives, setArchives] = useState<Archive[]>([]);
  const [showSign, setShowSign] = useState(false);
  useEffect(() => setArchives(readArchives()), []);

  const startSave = () => setShowSign(true);
  const onSignConfirm = (dataUrl: string | null) => {
    setShowSign(false);
    if (!dataUrl) return;
    const date = todayISO();
    const archive: Archive = {
      date,
      state: appState,
      signatureDataUrl: dataUrl,
    };
    const arr = readArchives().filter((a) => a.date !== date);
    arr.push(archive);
    writeArchives(arr);
    setArchives(arr);
    generatePdf(archive, true);
    onArchivedAndReset();
  };
  const download = (a: Archive) => generatePdf(a, true);
  const remove = (date: string) => {
    const arr = readArchives().filter((a) => a.date !== date);
    writeArchives(arr);
    setArchives(arr);
  };

  return (
    <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
      <div className="px-3 sm:px-6 py-4 border-b bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="h-5 w-5 text-blue-600" />
          <h2 className="text-slate-800 font-semibold">
            Lampiran & Rekapan PDF
          </h2>
        </div>
        <button
          onClick={startSave}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-600 text-white text-sm shadow hover:bg-blue-700"
          title="Simpan arsip hari ini (dengan tanda tangan) & download PDF"
        >
          <FilePlus2 className="h-4 w-4" />
          Simpan Arsip Hari Ini
        </button>
      </div>

      <div className="p-3 sm:p-6">
        {archives.length === 0 ? (
          <div className="text-sm text-slate-600">
            Belum ada arsip. Klik{" "}
            <span className="font-medium">Simpan Arsip Hari Ini</span> untuk
            membuat rekap PDF tanggal sekarang.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm font-medium text-slate-700">
              Daftar Arsip
            </div>
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left py-2 px-3">Tanggal</th>
                    <th className="text-left py-2 px-3">Leader</th>
                    <th className="text-left py-2 px-3">Depo</th>
                    <th className="text-left py-2 px-3">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {archives
                    .sort((a, b) => (a.date < b.date ? 1 : -1))
                    .map((a) => (
                      <tr key={a.date}>
                        <td className="py-2 px-3 font-medium">{a.date}</td>
                        <td className="py-2 px-3">{a.state.header.leader}</td>
                        <td className="py-2 px-3">{a.state.header.depo}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => download(a)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs hover:bg-slate-50"
                            >
                              <Download className="h-4 w-4" />
                              Download
                            </button>
                            <button
                              onClick={() => remove(a.date)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs text-rose-600 hover:bg-rose-50 border-rose-200"
                            >
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <FileText className="h-4 w-4" />
              PDF bernama{" "}
              <span className="font-medium">SITREP-YYYY-MM-DD.pdf</span>
            </div>
          </div>
        )}
      </div>

      {showSign && (
        <SignatureModal
          onClose={() => setShowSign(false)}
          onConfirm={onSignConfirm}
        />
      )}
    </div>
  );
}

/* =========================== Signature Modal =========================== */
function SignatureModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (dataUrl: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const width = 520,
      height = 180;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#111827";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }, []);

  const pos = (e: React.PointerEvent) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const p = pos(e);
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.beginPath();
    const l = last.current!;
    ctx.moveTo(l.x, l.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const onUp = () => {
    drawing.current = false;
    last.current = null;
  };
  const clear = () => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
  };
  const confirm = () => {
    const dataUrl = canvasRef.current!.toDataURL("image/png");
    if (!dataUrl || dataUrl.length < 2000) {
      alert("Mohon tanda tangani terlebih dahulu.");
      return;
    }
    onConfirm(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-lg overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="font-semibold text-slate-800">
            Tanda Tangan Leader
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4">
          <p className="text-sm text-slate-600 mb-2">
            Silakan tanda tangan di area berikut (bisa mouse atau sentuh).
          </p>
          <div className="border rounded-xl overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            />
          </div>
          <div className="flex items-center justify-between mt-3">
            <button
              onClick={clear}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm hover:bg-slate-50"
            >
              <Eraser className="h-4 w-4" />
              Bersihkan
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-3 py-2 rounded-lg border text-sm hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={confirm}
                className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm shadow hover:bg-blue-700"
              >
                Simpan & Lanjutkan
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================== PDF GENERATOR (layout profesional + Agenda) =========================== */
function generatePdf(
  archive: { date: string; state: AppState; signatureDataUrl?: string },
  autoDownload = true
) {
  const { date, state, signatureDataUrl } = archive;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const BLUE: [number, number, number] = [29, 78, 216];
  const SLATE: [number, number, number] = [71, 85, 105];
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const headerFooter = () => {
    doc.setFillColor(...BLUE);
    doc.rect(40, 20, pageW - 80, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("LEADER MONITORING DAILY", 50, 39);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(date, pageW - 50, 39, { align: "right" });
    doc.setTextColor(120);
    doc.setFontSize(9);
    const pageStr = `Hal. ${doc.internal.getNumberOfPages()}`;
    doc.text(pageStr, pageW - 50, pageH - 16, { align: "right" });
    doc.text(`${state.header.leader} • ${state.header.depo}`, 50, pageH - 16);
  };
  const commonTableOpts = {
    theme: "grid" as const,
    headStyles: {
      fillColor: BLUE,
      textColor: 255,
      fontStyle: "bold" as const,
      halign: "left" as const,
    },
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 5,
      textColor: SLATE as any,
    },
    alternateRowStyles: { fillColor: [246, 248, 252] as any },
    margin: { left: 40, right: 40 },
    didDrawPage: headerFooter,
  };

  // Header data
  doc.setTextColor(...SLATE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Leader: ${state.header.leader}`, 50, 78);
  doc.text(`Target: ${state.header.target}`, 50, 96);
  doc.text(`Depo: ${state.header.depo}`, 50, 114);

  let y = 132;
  const sectionTitle = (title: string) => {
    doc.setDrawColor(...BLUE);
    doc.setLineWidth(2);
    doc.line(40, y, 180, y);
    doc.setTextColor(...SLATE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title, 40, y + 18);
    y += 28;
  };
  const valToString = (v: RowValue | undefined) => {
    if (!v) return "-";
    switch (v.kind) {
      case "options":
        return v.value ?? "-";
      case "number":
        return (v as any).value || "-";
      case "score":
        return String((v as any).value ?? "-");
      case "compound": {
        const c = v as any;
        const extras = [c.extras?.text, c.extras?.currency]
          .filter(Boolean)
          .join(" • ");
        return [c.value || "-", extras].filter(Boolean).join(" | ");
      }
    }
  };

  // CHECKLIST
  sectionTitle("Checklist Area");
  const pushSection = (title: string, sec: Record<string, RowValue>) => {
    const keys = Object.keys(sec);
    if (keys.length === 0) return;
    autoTable(doc, {
      ...commonTableOpts,
      startY: y,
      head: [[`${title}`, "Status / Isian", "Catatan"]],
      body: keys.map((k) => {
        const rv = sec[k];
        const label = k.replace(/-/g, " ");
        return [label, valToString(rv), rv?.note || ""];
      }),
      columnStyles: {
        0: { cellWidth: 220 },
        1: { cellWidth: 170 },
        2: { cellWidth: "auto" },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 16;
  };
  pushSection("Kas Kecil", state.checklist.kas);
  pushSection("Buku Penunjang", state.checklist.buku);
  pushSection("AR", state.checklist.ar);

  // EVALUASI
  sectionTitle("Evaluasi Tim");
  const attScores = state.evaluasi.attitude.scores || {};
  const attAvg =
    Object.keys(attScores).length > 0
      ? Math.round(
          (Object.values(attScores).reduce(
            (a: number, b: any) => a + (b as number),
            0
          ) /
            Object.keys(attScores).length) *
            10
        ) / 10
      : "-";
  autoTable(doc, {
    ...commonTableOpts,
    startY: y,
    head: [["Attitude (HEBAT)", "Skor", "Catatan"]],
    body: Object.entries(attScores).map(([k, v]) => [
      k,
      String(v),
      state.evaluasi.attitude.notes?.[k] || "",
    ]),
    columnStyles: {
      0: { cellWidth: 250 },
      1: { cellWidth: 70, halign: "center" },
      2: { cellWidth: "auto" },
    },
    foot: [[`Rata-rata`, String(attAvg), ""]],
    footStyles: {
      fillColor: [234, 240, 255],
      textColor: SLATE as any,
      fontStyle: "bold" as const,
    },
  });
  y = (doc as any).lastAutoTable.finalY + 16;

  const komScores = state.evaluasi.kompetensi.scores || {};
  autoTable(doc, {
    ...commonTableOpts,
    startY: y,
    head: [["Kompetensi", "Skor", "Catatan"]],
    body: Object.entries(komScores).map(([k, v]) => [
      k.replace(/([A-Z])/g, " $1").trim(),
      String(v),
      state.evaluasi.kompetensi.notes?.[k] || "",
    ]),
    columnStyles: {
      0: { cellWidth: 250 },
      1: { cellWidth: 70, halign: "center" },
      2: { cellWidth: "auto" },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  if (state.evaluasi.kompetensi.kesalahanMingguIni) {
    doc.setFont("helvetica", "bold");
    doc.text("Kesalahan Minggu Ini", 40, y + 12);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(
      state.evaluasi.kompetensi.kesalahanMingguIni,
      pageW - 80
    );
    doc.text(lines, 40, y + 30);
    y = y + 30 + lines.length * 12 + 10;
  }

  // TARGET & ACHIEVEMENT
  sectionTitle("Target & Achievement");
  autoTable(doc, {
    ...commonTableOpts,
    startY: y,
    head: [["Penyelesaian Klaim Bulan Ini", "Selesai?"]],
    body: ["FRI", "SPJ", "APA", "WPL"].map((p) => [
      p,
      state.target.klaimSelesai[p as Principal] ? "✓" : "—",
    ]),
    columnStyles: {
      0: { cellWidth: 240 },
      1: { cellWidth: 80, halign: "center" },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 10;
  doc.setFont("helvetica", "normal");
  doc.text(
    `Target selesai bulan ini: ${state.target.targetSelesai || "-"}`,
    40,
    y + 12
  );
  doc.text(
    `Ketepatan Input Fodks: ${state.target.ketepatanFodks ? "Ya" : "Tidak"}`,
    40,
    y + 28
  );
  y += 40;

  autoTable(doc, {
    ...commonTableOpts,
    startY: y,
    head: [["Prinsipal", "M1", "M2", "M3", "M4"]],
    body: (["FRI", "SPJ", "APA", "WPL"] as Principal[]).map((p) => [
      p,
      state.target.weekly[p][0] ? "✓" : "—",
      state.target.weekly[p][1] ? "✓" : "—",
      state.target.weekly[p][2] ? "✓" : "—",
      state.target.weekly[p][3] ? "✓" : "—",
    ]),
    columnStyles: {
      0: { cellWidth: 180 },
      1: { halign: "center" },
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "center" },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 16;

  // SPARTA
  sectionTitle("SPARTA Project Tracking");
  const steps = state.sparta.steps || [];
  const percent = Math.round((steps.filter(Boolean).length / 4) * 100);
  doc.text(`Deadline: ${state.sparta.deadline || "-"}`, 40, y + 12);
  doc.text(`Progress: ${percent}%`, pageW - 40, y + 12, { align: "right" });
  y += 20;
  autoTable(doc, {
    ...commonTableOpts,
    startY: y,
    head: [["Langkah", "Status"]],
    body: [
      ["1. menyelesaikan Q3 2024", steps[0] ? "✓" : "—"],
      ["2. menyelesaikan Q4 2024", steps[1] ? "✓" : "—"],
      ["3. Q1 2025 termasuk reward Q1 2025", steps[2] ? "✓" : "—"],
      ["4. Q2 2025 + reward proporsional Q2 2025", steps[3] ? "✓" : "—"],
    ],
    columnStyles: { 0: { cellWidth: 360 }, 1: { halign: "center" } },
  });
  y = (doc as any).lastAutoTable.finalY + 12;

  if (state.sparta.progressText) {
    doc.setFont("helvetica", "bold");
    doc.text("Uraian Progress", 40, y + 12);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(state.sparta.progressText, pageW - 80);
    doc.text(lines, 40, y + 30);
    y = y + 30 + lines.length * 12 + 10;
  }
  if (state.sparta.nextAction) {
    doc.setFont("helvetica", "bold");
    doc.text("Next Action", 40, y + 12);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(state.sparta.nextAction, pageW - 80);
    doc.text(lines, 40, y + 30);
    y = y + 30 + lines.length * 12 + 10;
  }

  // AGENDA (hanya yang tanggalnya = date arsip)
  sectionTitle("Agenda & Jadwal (hari ini)");
  const todays = state.agenda?.entries?.filter((e) => e.date === date) ?? [];
  if (todays.length) {
    autoTable(doc, {
      ...commonTableOpts,
      startY: y,
      head: [["Plan", "Realisasi"]],
      body: todays.map((e) => [
        "• " + e.plan.join("\n• "),
        e.realisasi.length ? "• " + e.realisasi.join("\n• ") : "—",
      ]),
      columnStyles: { 0: { cellWidth: 260 }, 1: { cellWidth: "auto" } },
    });
    y = (doc as any).lastAutoTable.finalY + 16;
  } else {
    doc.setFont("helvetica", "normal");
    doc.text("(Tidak ada agenda yang dicatat untuk hari ini)", 40, y + 12);
    y += 28;
  }

  // TTD
  if (y > pageH - 160) doc.addPage();
  headerFooter();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Persetujuan & Tanda Tangan", 40, y + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    "Dengan ini saya menyatakan laporan di atas benar dan dapat dipertanggungjawabkan.",
    40,
    y + 36
  );
  const boxY = y + 50;
  doc.setDrawColor(200);
  doc.rect(pageW - 260, boxY, 200, 100);
  if (signatureDataUrl) {
    doc.addImage(signatureDataUrl, "PNG", pageW - 255, boxY + 10, 190, 60);
  } else {
    doc.setTextColor(150);
    doc.text("(tanda tangan belum tersedia)", pageW - 160, boxY + 60, {
      align: "center",
    });
    doc.setTextColor(...SLATE);
  }
  doc.text(
    state.header.leader || "__________________",
    pageW - 160,
    boxY + 120,
    {
      align: "center",
    }
  );

  const filename = `SITREP-${date}.pdf`;
  if (autoDownload) doc.save(filename);
  return doc;
}

/* =========================== SIMPLE TAB =========================== */
function SimpleTab({ title }: { title: string }) {
  return (
    <div className="bg-white border rounded-2xl shadow-sm p-6 text-slate-700">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-slate-600">
        Konten untuk tab <span className="font-medium">{title}</span> akan
        diletakkan di sini.
      </p>
    </div>
  );
}
