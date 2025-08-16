"use client";

import React, { useMemo, useState } from "react";
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
} from "lucide-react";

/* =========================== TOP TABS =========================== */
const TABS = [
  { key: "checklist", label: "Checklist Area", icon: ClipboardList },
  { key: "evaluasi", label: "Evaluasi Tim", icon: Users2 },
  { key: "target", label: "Target & Achievement", icon: TargetIcon },
  { key: "sparta", label: "Project Tracking (SPARTA)", icon: ListChecks },
  { key: "agenda", label: "Agenda & Jadwal", icon: CalendarCheck },
  { key: "achievement", label: "Achievement", icon: Trophy },
  { key: "lampiran", label: "Lampiran", icon: Paperclip },
] as const;

type TabDef = (typeof TABS)[number];

export default function DashboardClient() {
  const role = "Sales Supervisor - BLM";
  const [active, setActive] = useState<TabDef["key"]>("checklist");

  return (
    <div className="min-h-screen bg-slate-100">
      <Header role={role} />

      <main className="max-w-6xl mx-auto px-3 sm:px-4 pb-16">
        <RoleTabs tabs={TABS} active={active} onChange={setActive} />
        <section className="mt-6">{renderActive(active)}</section>
      </main>
    </div>
  );
}

/* =========================== HEADER =========================== */
function Header({ role }: { role: string }) {
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
            <MetaPill label="Leader" value="(Auto-fill from user)" />
            <MetaPill label="Target" value="(Auto-fill)" />
            <MetaPill label="Depo" value="(Auto-fill)" />
          </div>
        </div>
      </div>

      <div className="bg-white/95">
        <div className="max-w-6xl mx-auto px-3 sm:px-4">
          <div className="flex items-center gap-4 overflow-x-auto py-2 text-[13px] text-slate-600">
            {TABS.map((t, idx) => (
              <div
                key={t.key}
                className="flex items-center gap-2 whitespace-nowrap"
              >
                <span
                  className={
                    "inline-block h-2.5 w-2.5 rounded-sm " +
                    [
                      "bg-rose-400",
                      "bg-amber-400",
                      "bg-emerald-400",
                      "bg-cyan-400",
                      "bg-indigo-400",
                      "bg-fuchsia-400",
                      "bg-slate-400",
                    ][idx % 7]
                  }
                />
                <span className="font-medium">{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/10 border border-white/15 rounded-xl px-3 py-2 text-center">
      <div className="text-[11px] uppercase tracking-wide text-blue-100">
        {label}
      </div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

/* =========================== ROLE TABS (TOP) =========================== */
function RoleTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: ReadonlyArray<{
    key: TabDef["key"];
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }>;
  active: TabDef["key"];
  onChange: (key: TabDef["key"]) => void;
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

/* =========================== ACTIVE VIEW ROUTER =========================== */
function renderActive(key: TabDef["key"]) {
  switch (key) {
    case "checklist":
      return <ChecklistArea />;
    case "evaluasi":
      return <EvaluasiTim />;
    case "target":
      return <TargetAchievement />;
    case "sparta":
      return <SpartaTracking />;
    default:
      return <SimpleTab title={TABS.find((t) => t.key === key)?.label || ""} />;
  }
}

/* =========================== CHECKLIST AREA (with SUB-TABS) =========================== */
type Section = { title: string; rows: RowDef[] };
type RowDef =
  | { kind: "options"; label: string; options: string[] }
  | { kind: "number"; label: string; suffix?: string }
  | { kind: "score"; label: string }
  | {
      kind: "compound";
      label: string;
      options: string[];
      extra?: { type: "text" | "currency"; placeholder?: string }[];
    };

const SECTION_TABS = [
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
] as const;

type SectionKey = (typeof SECTION_TABS)[number]["key"];

function ChecklistArea() {
  const SECTION_MAP: Record<SectionKey, Section> = useMemo(
    () => ({
      kas: {
        title: "Kas Kecil",
        rows: [
          {
            kind: "options",
            label: "Saldo Kas Kecil",
            options: ["Cocok", "Tidak Cocok"],
          },
          { kind: "number", label: "Voucher Individual", suffix: "pcs" },
          {
            kind: "options",
            label: "Voucher Harian",
            options: ["Clear", "Tidak Beres"],
          },
          {
            kind: "options",
            label: "Approval",
            options: ["Sesuai", "Tidak Sesuai"],
          },
          {
            kind: "options",
            label: "Kasbon Operasional",
            options: ["Clear", "Belum Kembali"],
          },
          {
            kind: "options",
            label: "Dokumentasi Bukti Biaya",
            options: ["Valid", "Perlu Validasi"],
          },
          {
            kind: "compound",
            label: "Dropping Kas Kecil",
            options: ["Ada Form", "Tidak"],
            extra: [
              { type: "text", placeholder: "Penjelasan..." },
              { type: "currency", placeholder: "Nilai" },
            ],
          },
          {
            kind: "options",
            label: "Serah Terima dengan FAT",
            options: ["Sesuai", "Tidak Sesuai"],
          },
          { kind: "score", label: "Score Performa" },
        ],
      },
      buku: {
        title: "Buku Penunjang",
        rows: [
          {
            kind: "options",
            label: "Buku Kontrol BBM Berlangganan",
            options: ["Sesuai", "Tidak Sesuai"],
          },
          {
            kind: "options",
            label: "Buku Khusus Materai",
            options: ["Sesuai", "Tidak Sesuai"],
          },
          {
            kind: "options",
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
            label: "Faktur Tagihan Sales disiapkan H-2",
            options: ["Sesuai", "Tidak Sesuai"],
          },
          {
            kind: "options",
            label: "Faktur disesuaikan Rute/Permintaan/Kebutuhan",
            options: ["Sesuai", "Tidak Sesuai"],
          },
          {
            kind: "options",
            label:
              "Faktur yang perlu ditagih/overdue/sales teman tidak masuk dibawakan",
            options: ["Sesuai", "Tidak Sesuai"],
          },
          {
            kind: "options",
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
            bawah. Skor 1–5 memberi warna indikator.
          </p>
        </div>
      </div>

      <div className="px-3 sm:px-6 pb-3">
        <div className="overflow-x-auto">
          <SectionTabs
            tabs={SECTION_TABS}
            active={secActive}
            onChange={setSecActive}
          />
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
            {section.rows.map((row, ri) => (
              <ChecklistRow key={ri} row={row} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: ReadonlyArray<{ key: SectionKey; label: string }>;
  active: SectionKey;
  onChange: (key: SectionKey) => void;
}) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex flex-nowrap gap-2">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={
            "px-3.5 py-2 rounded-lg text-sm transition whitespace-nowrap " +
            (active === t.key
              ? "bg-blue-600 text-white shadow"
              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100")
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* =========================== ROW RENDERERS =========================== */
function ChecklistRow({ row }: { row: RowDef }) {
  const [note, setNote] = useState("");

  return (
    <div className="grid grid-cols-1 sm:grid-cols-12 items-start bg-white">
      <div className="sm:col-span-6 py-3 px-2 text-sm">
        {("label" in row && (row as any).label) || ""}
      </div>
      <div className="sm:col-span-4 py-3 px-2">
        <div className="sm:hidden text-xs text-slate-500 mb-1">
          Status / Isian
        </div>
        {row.kind === "options" && <OptionsGroup options={row.options} />}
        {row.kind === "number" && <NumberWithSuffix suffix={row.suffix} />}
        {row.kind === "score" && <ScoreSelect />}
        {row.kind === "compound" && (
          <div className="space-y-2">
            <OptionsGroup options={row.options} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {row.extra?.map((f, i) => (
                <input
                  key={i}
                  placeholder={f.placeholder}
                  className="w-full rounded-lg border-slate-300 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
                  inputMode={f.type === "currency" ? "numeric" : undefined}
                />
              ))}
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

function OptionsGroup({ options }: { options: string[] }) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          type="button"
          key={opt}
          onClick={() => setValue(opt)}
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

function NumberWithSuffix({ suffix }: { suffix?: string }) {
  const [num, setNum] = useState<string>("");
  return (
    <div className="flex items-center gap-2">
      <input
        value={num}
        onChange={(e) => setNum(e.target.value)}
        inputMode="numeric"
        className="w-full sm:w-28 rounded-lg border-slate-300 text-sm focus:ring-2 focus:ring-blue-500"
      />
      {suffix && <span className="text-sm text-slate-600">{suffix}</span>}
    </div>
  );
}

/* =========================== THEMED SELECT + SCORE =========================== */
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
function ScoreSelect() {
  const [score, setScore] = useState(3);
  return (
    <div className="flex items-center gap-2">
      <span className={"h-2.5 w-2.5 rounded-full " + scoreDot(score)} />
      <ThemedSelect
        value={String(score)}
        onChange={(e) => setScore(Number(e.target.value))}
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

/* =========================== EVALUASI TIM (HARI-BASED) =========================== */
type Theme = "attitude" | "kompetensi" | "prestasi" | "kepatuhan" | "kosong";
const DAY_THEME: Record<1 | 2 | 3 | 4 | 5 | 6, Theme> = {
  1: "attitude",
  2: "kompetensi",
  3: "kosong",
  4: "prestasi",
  5: "kosong",
  6: "kepatuhan",
};

function EvaluasiTim() {
  const [hari, setHari] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const theme = DAY_THEME[hari];
  const [nama, setNama] = useState("");
  const [peran, setPeran] = useState("");

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="Nama anggota…"
            className="w-full rounded-lg border-slate-300 text-sm focus:ring-2 focus:ring-blue-500"
          />
          <input
            value={peran}
            onChange={(e) => setPeran(e.target.value)}
            placeholder="Peran / Posisi…"
            className="w-full rounded-lg border-slate-300 text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="px-3 sm:px-6 pb-6">
        {theme === "attitude" ? (
          <FormAttitude />
        ) : theme === "kompetensi" ? (
          <FormKompetensi />
        ) : theme === "prestasi" ? (
          <FormPlaceholder title="Prestasi" />
        ) : theme === "kepatuhan" ? (
          <FormPlaceholder title="Kepatuhan SOP" />
        ) : (
          <EmptyDay />
        )}
      </div>
    </div>
  );
}

/* ---------- Attitude ---------- */
const HEBAT_ITEMS = [
  {
    code: "H",
    title: "Harmonis & Integritas",
    question:
      "Apakah yang bersangkutan jujur, tidak manipulatif, mengakui kesalahan, konsisten menepati janji, menjaga keharmonisan tim, dan menjaga etika?",
    hint: "Nilai 1 jika: provokatif, berpolitik, memanipulatif, berbohong, mengadu domba, bermuka dua.",
  },
  {
    code: "E",
    title: "Etos Profesional",
    question:
      "Apakah menjaga kualitas pekerjaan, tepat waktu, bertanggung jawab, berpenampilan profesional, dan bisa mengatur waktu agar deadline tercapai?",
    hint: "Nilai 1 jika: berpenampilan tidak rapi, kerja asal-asalan, sering miss deadline.",
  },
  {
    code: "B",
    title: "Berinovasi untuk Maju",
    question:
      "Apakah proaktif memberi masukan, partisipatif dalam perbaikan, memberi feedback dan saran, serta berkeinginan belajar?",
    hint: "Nilai 1 jika: pasif, merasa diri sudah mentok, bekerja asal gaji tanpa kontribusi.",
  },
  {
    code: "A",
    title: "Ahli & Adaptif",
    question:
      "Apakah cepat belajar, menguasai pekerjaan, inisiatif, tidak mudah tersinggung saat menerima masukan, dan adaptif?",
    hint: "Nilai 1 jika: kompetensi kurang, lambat belajar, mudah tersinggung jika dikritik.",
  },
  {
    code: "T",
    title: "Tepat Manfaat & Peduli",
    question:
      "Apakah berdampak positif bagi tim/target, peduli dengan rekan kerja/mitra, dan berkontribusi nyata?",
    hint: "Nilai 1 jika: kurang memberi manfaat, cenderung masa bodoh pada tim/target.",
  },
] as const;

function FormAttitude() {
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(HEBAT_ITEMS.map((i) => [i.code, 3]))
  );
  const [notes, setNotes] = useState<Record<string, string>>({});

  const avg =
    Math.round(
      (Object.values(scores).reduce((a, b) => a + b, 0) / HEBAT_ITEMS.length) *
        10
    ) / 10;

  const setScore = (code: string, v: number) =>
    setScores((p) => ({ ...p, [code]: v }));

  return (
    <div className="space-y-4">
      <ScoreLegend />

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
              <p className="text-sm text-slate-600 mt-1">{item.question}</p>
              <p className="text-xs text-slate-500 mt-1">Hint: {item.hint}</p>
            </div>

            <div className="sm:col-span-2">
              <div className="sm:hidden text-xs text-slate-500 mb-1">Skor</div>
              <ScoreSelect />
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

      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">
          Rata-rata skor (HEBAT):{" "}
          <span className="font-semibold text-slate-800">{avg}</span>
        </div>
        <button
          type="button"
          className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm shadow hover:bg-blue-700"
        >
          Simpan Evaluasi
        </button>
      </div>
    </div>
  );
}

function ScoreLegend() {
  return (
    <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-600">
      <span className="font-medium">Skala 1–5:</span> 1 sangat jelek, 2 kurang,
      3 cukup, 4 baik, 5 sangat baik (bisa jadi teladan).
    </div>
  );
}

/* ---------- KOMPETENSI (Hari 2) ---------- */
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

function FormKompetensi() {
  const [namaKasir, setNamaKasir] = useState("");
  const [namaSalesAdmin, setNamaSalesAdmin] = useState("");
  const [kesalahanMingguIni, setKesalahanMingguIni] = useState("");

  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(KOMPETENSI_ITEMS.map((i) => [i.key, 3]))
  );
  const [notes, setNotes] = useState<Record<string, string>>({});

  const setScore = (key: string, v: number) =>
    setScores((p) => ({ ...p, [key]: v }));

  const avg =
    Math.round(
      (Object.values(scores).reduce((a, b) => a + b, 0) /
        KOMPETENSI_ITEMS.length) *
        10
    ) / 10;

  return (
    <div className="space-y-4">
      <ScoreLegend />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          value={namaKasir}
          onChange={(e) => setNamaKasir(e.target.value)}
          placeholder="Nama Kasir"
          className="w-full rounded-lg border-slate-300 text-sm focus:ring-2 focus:ring-blue-500"
        />
        <input
          value={namaSalesAdmin}
          onChange={(e) => setNamaSalesAdmin(e.target.value)}
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
              <div className="flex items-center gap-2">
                <span
                  className={
                    "h-2.5 w-2.5 rounded-full " + scoreDot(scores[item.key])
                  }
                />
                <ThemedSelect
                  value={String(scores[item.key])}
                  onChange={(e) => setScore(item.key, Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </ThemedSelect>
              </div>
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
          value={kesalahanMingguIni}
          onChange={(e) => setKesalahanMingguIni(e.target.value)}
          rows={3}
          placeholder="Tuliskan ringkas kesalahan/temuan minggu ini..."
          className="w-full rounded-lg border-slate-300 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">
          Rata-rata skor kompetensi:{" "}
          <span className="font-semibold text-slate-800">{avg}</span>
        </div>
        <button
          type="button"
          className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm shadow hover:bg-blue-700"
        >
          Simpan Evaluasi
        </button>
      </div>
    </div>
  );
}

/* ---------- Placeholder ---------- */
function FormPlaceholder({ title }: { title: string }) {
  return (
    <div className="space-y-3">
      <ScoreLegend />
      <div className="p-4 text-sm text-slate-600 border border-dashed rounded-xl bg-slate-50">
        Form {title} menyusul.
      </div>
    </div>
  );
}
function EmptyDay() {
  return (
    <div className="p-4 text-sm text-slate-600 border border-dashed rounded-xl bg-slate-50">
      Tidak ada evaluasi terjadwal pada hari ini.
    </div>
  );
}

/* =========================== TARGET & ACHIEVEMENT =========================== */
const PRINCIPALS = ["FRI", "SPJ", "APA", "WPL"] as const;
type Principal = (typeof PRINCIPALS)[number];

function TargetAchievement() {
  const [targetSelesai, setTargetSelesai] = useState<string>("");
  const [klaimDone, setKlaimDone] = useState<Record<Principal, boolean>>({
    FRI: false,
    SPJ: false,
    APA: false,
    WPL: false,
  });
  const [weekly, setWeekly] = useState<Record<Principal, boolean[]>>({
    FRI: [false, false, false, false],
    SPJ: [false, false, false, false],
    APA: [false, false, false, false],
    WPL: [false, false, false, false],
  });
  const [ketepatanFodks, setKetepatanFodks] = useState<boolean>(false);

  const toggleKlaim = (p: Principal) =>
    setKlaimDone((s) => ({ ...s, [p]: !s[p] }));
  const toggleWeekly = (p: Principal, w: number) =>
    setWeekly((s) => {
      const next = [...s[p]];
      next[w] = !next[w];
      return { ...s, [p]: next };
    });

  return (
    <div className="space-y-6">
      {/* Klaim Bulan Ini */}
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
                              checked={klaimDone[p]}
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
                value={targetSelesai}
                onChange={(e) => setTargetSelesai(e.target.value)}
                inputMode="numeric"
                placeholder="mis. 10"
                className="w-full rounded-lg border-slate-300 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Laporan Penjualan Mingguan */}
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
                          checked={weekly[p][w]}
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

      {/* Ketepatan Fodks */}
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-3 sm:px-6 py-4 border-b bg-slate-50 font-semibold text-slate-800">
          Ketepatan Waktu Input Fodks
        </div>
        <div className="p-3 sm:p-6">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              className="h-5 w-5 accent-blue-600"
              checked={ketepatanFodks}
              onChange={() => setKetepatanFodks((v) => !v)}
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

/* =========================== SPARTA PROJECT TRACKING =========================== */
function daysLeft(deadline: string) {
  if (!deadline) return null;
  const d = new Date(deadline);
  const now = new Date();
  const diff = Math.ceil(
    (d.getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      (1000 * 60 * 60 * 24)
  );
  return diff;
}
const UDI_STEPS = [
  "menyelesaikan Q3 2024",
  "menyelesaikan Q4 2024",
  "menyelesaikan Q1 2025 termasuk reward Q1 2025",
  "menyelesaikan Q2 2025 termasuk reward proporsional Q2 2025",
] as const;

function SpartaTracking() {
  const [deadline, setDeadline] = useState<string>("");
  const [steps, setSteps] = useState<boolean[]>(UDI_STEPS.map(() => false));
  const [progressText, setProgressText] = useState<string>("");
  const [nextAction, setNextAction] = useState<string>("");

  const done = steps.filter(Boolean).length;
  const percent = Math.round((done / steps.length) * 100);
  const sisa = daysLeft(deadline);

  const toggleStep = (idx: number) =>
    setSteps((arr) => {
      const n = [...arr];
      n[idx] = !n[idx];
      return n;
    });

  return (
    <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
      {/* Title & Rules */}
      <div className="px-3 sm:px-6 py-4 border-b bg-slate-50">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-slate-800">
            SPARTA Project Tracking
          </h3>
        </div>
      </div>

      <div className="p-3 sm:p-6 space-y-6">
        {/* Ketentuan */}
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

        {/* Task Card */}
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
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
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
            {/* Steps */}
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
                      checked={steps[i]}
                      onChange={() => toggleStep(i)}
                    />
                    <span
                      className={
                        steps[i]
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

            {/* Percentage */}
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

            {/* Progress text */}
            <div>
              <div className="text-sm font-medium text-slate-700 mb-1">
                Progress
              </div>
              <textarea
                rows={2}
                value={progressText}
                onChange={(e) => setProgressText(e.target.value)}
                placeholder="sudah selesai sampai Q4 2024, yang Q1 dan Q2 2025 menunggu jawaban ..."
                className="w-full rounded-lg border-slate-300 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Next action */}
            <div>
              <div className="text-sm font-medium text-slate-700 mb-1">
                Next Action
              </div>
              <textarea
                rows={2}
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                placeholder="besok follow up ke Pak Adi ..."
                className="w-full rounded-lg border-slate-300 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end">
              <button className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm shadow hover:bg-blue-700">
                Simpan Tracking
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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
