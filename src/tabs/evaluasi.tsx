"use client";
import React, { useEffect, useState } from "react";
import { Users2 } from "lucide-react";
import type {
  AppState,
  EvaluasiAttitude,
  EvaluasiKompetensi,
} from "@/lib/types";
import { ScoreSelect, ThemedSelect } from "./common";

/* =========================
   Konfigurasi Tema / Person
   ========================= */
type Theme = "attitude" | "kompetensi" | "prestasi" | "kepatuhan" | "kosong";

const PERSONS = ["laras", "emi", "novi"] as const;
type Person = (typeof PERSONS)[number];
const PERSON_LABEL: Record<Person, string> = {
  laras: "Laras",
  emi: "Emi",
  novi: "Novi",
};

/* =========================
   Item penilaian + penjelasan
   ========================= */
const HEBAT_ITEMS = [
  { code: "H", title: "Harmonis & Integritas" },
  { code: "E", title: "Etos Profesional" },
  { code: "B", title: "Berinovasi untuk Maju" },
  { code: "A", title: "Ahli & Adaptif" },
  { code: "T", title: "Tepat Manfaat & Peduli" },
] as const;

const HEBAT_EXPLAINS: Record<
  (typeof HEBAT_ITEMS)[number]["code"],
  { ask: string; n1: string }
> = {
  H: {
    ask: "Apakah yang bersangkutan jujur, tidak manipulatif, mengakui kesalahan, konsisten menepati janji, menjaga keharmonisan tim, dan menjaga etika, bertindak hormat, dan berkomitmen?",
    n1: "Nilai 1 jika: kata provokatif, berpolitik, manipulatif, berbohong, mengadu domba, bermuka dua.",
  },
  E: {
    ask: "Apakah yang bersangkutan menjaga kualitas pekerjaan, tepat waktu, bertanggung jawab, berpenampilan dan bersikap profesional, dan bisa mengatur waktu agar deadline tercapai, tidak perhitungan dalam penyelesaian tugas?",
    n1: "Nilai 1 jika: berpenampilan seperti tidak niat kerja, kualitas pekerjaan asal-asalan, selalu miss deadline.",
  },
  B: {
    ask: "Apakah yang bersangkutan partisipatif atau pasif; berkontribusi dalam brainstorming, memberi feedback/saran/masukan, dan berkeinginan untuk belajar?",
    n1: "Nilai 1 jika: pasif, merasa diri sudah mentok, bekerja asal gaji tetapi tidak ada pengembangan dan kontribusi.",
  },
  A: {
    ask: "Apakah yang bersangkutan cepat belajar, ingin menguasai area kerja, inisiatif, tidak mudah tersinggung jika menerima masukan, cepat beradaptasi, dan kompeten di bidangnya?",
    n1: "Nilai 1 jika: tidak kompeten, sering salah, sangat lambat belajar, bebal, mudah tersinggung saat diberi masukan.",
  },
  T: {
    ask: "Apakah yang bersangkutan efisien (tidak molor-molor), memahami kebutuhan pelanggan/rekan/atasan, cepat paham (tidak salah paham), punya empati & kepedulian, dan menghormati waktu orang lain?",
    n1: "Nilai 1 jika: tidak empati/peduli pada hal penting yang butuh bantuan, sering salah paham, hasil tidak tepat sasaran, kurang kepedulian, lambat & molor-molor dalam mengerjakan tugas.",
  },
};

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

/* Prestasi & Kepatuhan SOP – form sederhana (skor 1–5 + catatan) */
const PRESTASI_ITEMS = [
  { key: "targetTercapai", title: "Pencapaian Target" },
  { key: "inisiatif", title: "Inisiatif Perbaikan" },
  { key: "kolaborasi", title: "Kolaborasi Tim" },
  { key: "kualitasOutput", title: "Kualitas Output" },
] as const;

const SOP_ITEMS = [
  { key: "patuhSOP", title: "Kepatuhan SOP" },
  { key: "ketepatanDokumen", title: "Ketepatan Dokumen" },
  { key: "arsipRapi", title: "Kerapian & Arsip" },
  { key: "disiplinProses", title: "Disiplin Proses" },
] as const;

/* Bentuk data sederhana (skor + catatan) untuk Prestasi & SOP */
type SimpleScoreForm = {
  scores: Record<string, number>;
  notes: Record<string, string>;
};

/* =========================
   Komponen Utama (Manual day & theme)
   ========================= */
export default function EvaluasiTim({
  data,
  onChange,
}: {
  data: AppState["evaluasi"];
  onChange: (v: AppState["evaluasi"]) => void;
}) {
  // Hari manual: simpan ke state & sync ke data.attitude.hari
  const [hari, setHari] = useState<number>(data.attitude.hari || 1);
  useEffect(() => {
    onChange({ ...data, attitude: { ...data.attitude, hari } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hari]);

  // Tema manual (independen dari hari)
  const [theme, setTheme] = useState<Theme>("attitude");

  // Person untuk tema per-orang
  const [who, setWho] = useState<Person>("laras");

  return (
    <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
      <div className="px-3 sm:px-6 py-4 border-b bg-slate-50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users2 className="h-5 w-5 text-blue-600" />
          <h2 className="text-slate-800 font-semibold">Evaluasi Tim</h2>
        </div>

        {/* Hari (manual) + Tema (manual) */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Hari ke</span>
            <ThemedSelect
              value={String(hari)}
              onChange={(e) => setHari(Number(e.target.value))}
              className="w-24"
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </ThemedSelect>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Tema</span>
            <ThemedSelect
              value={theme}
              onChange={(e) => setTheme(e.target.value as Theme)}
              className="w-44"
            >
              <option value="attitude">Attitude</option>
              <option value="kompetensi">Kompetensi</option>
              <option value="prestasi">Prestasi</option>
              <option value="kepatuhan">Kepatuhan SOP</option>
              <option value="kosong">Kosong</option>
            </ThemedSelect>
          </div>
        </div>
      </div>

      {/* Selector Person (muncul untuk tema per-orang) */}
      {(theme === "kompetensi" ||
        theme === "prestasi" ||
        theme === "kepatuhan") && (
        <div className="px-3 sm:px-6 py-3 border-b bg-white">
          <div className="text-sm text-slate-600 mb-2">
            Nama yang dievaluasi:
          </div>
          <div className="flex flex-wrap gap-2">
            {PERSONS.map((p) => (
              <button
                key={p}
                onClick={() => setWho(p)}
                className={
                  "px-3 py-1.5 rounded-lg border text-sm " +
                  (who === p
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50")
                }
              >
                {PERSON_LABEL[p]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-3 sm:px-6 pb-6">
        {theme === "attitude" ? (
          <FormAttitudeControlled
            data={data.attitude}
            onChange={(scores, notes) =>
              onChange({
                ...data,
                attitude: { ...data.attitude, scores, notes },
              })
            }
          />
        ) : theme === "kompetensi" ? (
          <FormKompetensiControlled
            data={(data as any)[`kompetensi_${who}`] ?? data.kompetensi}
            onChange={(payload) =>
              onChange({
                ...(data as any),
                [`kompetensi_${who}`]: {
                  ...((data as any)[`kompetensi_${who}`] ?? data.kompetensi),
                  ...payload,
                },
              } as any)
            }
          />
        ) : theme === "prestasi" ? (
          <FormSimpleScoreControlled
            title="Penilaian Prestasi"
            items={PRESTASI_ITEMS}
            data={
              ((data as any)[`prestasi_${who}`] as SimpleScoreForm) ?? {
                scores: {},
                notes: {},
              }
            }
            onChange={(payload) =>
              onChange({
                ...(data as any),
                [`prestasi_${who}`]: {
                  ...(((data as any)[`prestasi_${who}`] as SimpleScoreForm) ?? {
                    scores: {},
                    notes: {},
                  }),
                  ...payload,
                },
              } as any)
            }
          />
        ) : theme === "kepatuhan" ? (
          <FormSimpleScoreControlled
            title="Penilaian Kepatuhan SOP"
            items={SOP_ITEMS}
            data={
              ((data as any)[`kepatuhan_${who}`] as SimpleScoreForm) ?? {
                scores: {},
                notes: {},
              }
            }
            onChange={(payload) =>
              onChange({
                ...(data as any),
                [`kepatuhan_${who}`]: {
                  ...(((data as any)[
                    `kepatuhan_${who}`
                  ] as SimpleScoreForm) ?? { scores: {}, notes: {} }),
                  ...payload,
                },
              } as any)
            }
          />
        ) : (
          <div className="p-4 text-sm text-slate-600 border border-dashed rounded-xl bg-slate-50">
            Form {theme} menyusul.
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================
   Attitude (HEBAT) + penjelasan
   ========================= */
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
  useEffect(() => onChange(scores, notes), [scores, notes]);

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
              <div className="flex items-start gap-2">
                <span className="inline-flex h-6 min-w-6 w-6 mt-0.5 items-center justify-center rounded-md bg-blue-600 text-white text-xs font-bold">
                  {item.code}
                </span>
                <div>
                  <h4 className="font-medium text-slate-800">{item.title}</h4>
                  <p className="mt-1 text-xs text-slate-600">
                    {HEBAT_EXPLAINS[item.code].ask}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 italic">
                    {HEBAT_EXPLAINS[item.code].n1}
                  </p>
                </div>
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

/* =========================
   Kompetensi (per orang)
   ========================= */
function FormKompetensiControlled({
  data,
  onChange,
}: {
  data: EvaluasiKompetensi;
  onChange: (payload: Partial<EvaluasiKompetensi>) => void;
}) {
  const [scores, setScores] = useState<Record<string, number>>(
    Object.keys(data.scores || {}).length
      ? data.scores
      : Object.fromEntries(KOMPETENSI_ITEMS.map((i) => [i.key, 3]))
  );
  const [notes, setNotes] = useState<Record<string, string>>(data.notes || {});

  // reset saat data (orang) berganti
  useEffect(() => {
    setScores(
      Object.keys(data.scores || {}).length
        ? data.scores
        : Object.fromEntries(KOMPETENSI_ITEMS.map((i) => [i.key, 3]))
    );
    setNotes(data.notes || {});
  }, [data]);

  useEffect(() => onChange({ scores, notes }), [scores, notes]);

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

      <div className="text-sm text-slate-500">
        Rata-rata skor kompetensi:{" "}
        <span className="font-semibold text-slate-800">{avg}</span>
      </div>
    </div>
  );
}

/* =========================
   Form Sederhana (Prestasi / SOP) – per orang
   ========================= */
function FormSimpleScoreControlled({
  title,
  items,
  data,
  onChange,
}: {
  title: string;
  items: ReadonlyArray<{ key: string; title: string }>;
  data: { scores: Record<string, number>; notes: Record<string, string> };
  onChange: (
    payload: Partial<{
      scores: Record<string, number>;
      notes: Record<string, string>;
    }>
  ) => void;
}) {
  const [scores, setScores] = useState<Record<string, number>>(
    Object.keys(data.scores || {}).length
      ? data.scores
      : Object.fromEntries(items.map((i) => [i.key, 3]))
  );
  const [notes, setNotes] = useState<Record<string, string>>(data.notes || {});

  // reset saat orang berubah
  useEffect(() => {
    setScores(
      Object.keys(data.scores || {}).length
        ? data.scores
        : Object.fromEntries(items.map((i) => [i.key, 3]))
    );
    setNotes(data.notes || {});
  }, [data, items]);

  useEffect(() => onChange({ scores, notes }), [scores, notes]);

  const avg =
    Math.round(
      (Object.values(scores).reduce((a, b) => a + b, 0) / items.length) * 10
    ) / 10;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-600">
        <span className="font-medium">{title}</span> · Skala 1–5 (1 sangat
        jelek, 5 sangat baik).
      </div>

      <div className="divide-y border rounded-xl bg-white">
        {items.map((item) => (
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

      <div className="text-sm text-slate-500">
        Rata-rata skor:{" "}
        <span className="font-semibold text-slate-800">{avg}</span>
      </div>
    </div>
  );
}
