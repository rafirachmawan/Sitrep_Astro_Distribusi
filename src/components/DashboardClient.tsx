"use client";

import React, { useMemo, useState } from "react";
import {
  ClipboardList,
  Target,
  Users2,
  CalendarCheck,
  Trophy,
  Paperclip,
  CheckCircle2,
  ListChecks,
} from "lucide-react";

// --- Tab list matching screenshot labels
const TABS = [
  { key: "checklist", label: "Checklist Area", icon: ClipboardList },
  { key: "evaluasi", label: "Evaluasi Tim", icon: Users2 },
  { key: "target", label: "Target & Achievement", icon: Target },
  { key: "sparta", label: "Project Tracking (SPARTA)", icon: ListChecks },
  { key: "agenda", label: "Agenda & Jadwal", icon: CalendarCheck },
  { key: "achievement", label: "Achievement", icon: Trophy },
  { key: "lampiran", label: "Lampiran", icon: Paperclip },
] as const;

type TabDef = (typeof TABS)[number];

export default function DashboardClient() {
  // In your app, get this from useAuth()
  const role = "Sales Supervisor – BLM";
  const [active, setActive] = useState<TabDef["key"]>("checklist");

  return (
    <div className="min-h-screen bg-slate-100">
      <Header role={role} />

      <main className="max-w-6xl mx-auto px-4 pb-16">
        <RoleTabs tabs={TABS} active={active} onChange={setActive} />

        <section className="mt-6">
          {active === "checklist" ? (
            <ChecklistArea />
          ) : (
            <SimpleTab
              title={TABS.find((t) => t.key === active)?.label || ""}
            />
          )}
        </section>
      </main>
    </div>
  );
}

// --- HEADER (blue banner)
function Header({ role }: { role: string }) {
  return (
    <header className="w-full bg-gradient-to-b from-blue-800 to-blue-700 text-white shadow">
      <div className="max-w-6xl mx-auto px-4">
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

          {/* Sub-metadata bar */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MetaPill label="Leader" value="(Auto‑fill from user)" />
            <MetaPill label="Target" value="(Auto‑fill)" />
            <MetaPill label="Depo" value="(Auto‑fill)" />
          </div>
        </div>
      </div>

      {/* Thin tab hint bar similar to the screenshot */}
      <div className="bg-white/95">
        <div className="max-w-6xl mx-auto px-4">
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

// --- ROLE TABS (chips row)
function RoleTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: {
    key: TabDef["key"];
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
  active: TabDef["key"];
  onChange: (key: TabDef["key"]) => void;
}) {
  return (
    <div className="bg-white border rounded-2xl shadow-sm p-2 flex flex-wrap gap-2">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={
            "group inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm transition " +
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

// --- CHECKLIST AREA (card + table-like UI)
function ChecklistArea() {
  const sections: Section[] = useMemo(
    () => [
      {
        title: "1 Kas Kecil",
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
              { type: "text", placeholder: "Penjelasan…" },
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
      {
        title: "2 Buku Penunjang",
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
      {
        title: "3 AR",
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
    ],
    []
  );

  return (
    <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
      {/* Section header */}
      <div className="px-4 md:px-6 py-4 border-b bg-slate-50 flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-blue-600" />
        <h2 className="text-slate-800 font-semibold">Checklist Area</h2>
      </div>

      {/* Info callout */}
      <div className="px-4 md:px-6 py-4">
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
          <div className="mt-0.5 h-5 w-5 flex items-center justify-center rounded-full bg-blue-100">
            <CheckCircle2 className="h-4 w-4 text-blue-700" />
          </div>
          <p className="text-sm text-slate-700">
            <span className="font-medium">Instruksi:</span> Isi sesuai kondisi
            di lapangan. Skor performa 1–5 akan memberi warna otomatis
            (Merah=1–2, Kuning=3, Hijau=4–5).
          </p>
        </div>
      </div>

      {/* Sections */}
      <div className="px-4 md:px-6 pb-4 space-y-8">
        {sections.map((sec, si) => (
          <section key={si}>
            <div className="mb-3 text-sm font-semibold text-slate-700">
              {sec.title}
            </div>
            <div className="grid grid-cols-12 text-[13px] font-medium text-slate-600 border-y bg-slate-50">
              <div className="col-span-6 py-2.5 px-2">Area Tanggung Jawab</div>
              <div className="col-span-4 py-2.5 px-2">Status / Isian</div>
              <div className="col-span-2 py-2.5 px-2">Catatan</div>
            </div>
            <div className="divide-y">
              {sec.rows.map((row, ri) => (
                <ChecklistRow key={ri} row={row} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

type Section = {
  title: string;
  rows: RowDef[];
};

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

function ChecklistRow({ row }: { row: RowDef }) {
  const [note, setNote] = useState("");

  return (
    <div className="grid grid-cols-12 items-start bg-white">
      <div className="col-span-6 py-3 px-2 text-sm">
        {"label" in row ? (row as any).label : ""}
      </div>
      <div className="col-span-4 py-3 px-2">
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
      <div className="col-span-2 py-3 px-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Catatan…"
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
        className="w-24 rounded-lg border-slate-300 text-sm focus:ring-2 focus:ring-blue-500"
      />
      {suffix && <span className="text-sm text-slate-600">{suffix}</span>}
    </div>
  );
}

// helper warna untuk skor (1–5)
function colorByScore(score: number) {
  if (score <= 2)
    return "border-rose-300 bg-rose-50 text-rose-700 focus:ring-rose-400";
  if (score === 3)
    return "border-amber-300 bg-amber-50 text-amber-700 focus:ring-amber-400";
  return "border-emerald-300 bg-emerald-50 text-emerald-700 focus:ring-emerald-400";
}

function ScoreSelect() {
  const [score, setScore] = useState(3);
  return (
    <select
      value={score}
      onChange={(e) => setScore(Number(e.target.value))}
      className={
        "w-28 rounded-lg border text-sm focus:ring-2 " + colorByScore(score)
      }
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );
}

// --- Simple placeholder for other tabs
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
