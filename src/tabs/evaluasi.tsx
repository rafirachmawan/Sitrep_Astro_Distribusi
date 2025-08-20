"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Users2, Plus, Trash2 } from "lucide-react";
import type {
  AppState,
  EvaluasiAttitude,
  EvaluasiKompetensi,
} from "@/lib/types";
import { ScoreSelect } from "./common";
import { useAuth } from "@/components/AuthProvider";

/* =========================
   Tema / Person
   ========================= */
type Theme = "attitude" | "kompetensi" | "prestasi" | "kepatuhan" | "kosong";

const PERSONS = ["laras", "emi", "novi"] as const;
type Person = (typeof PERSONS)[number];
const PERSON_LABEL_BASE: Record<Person, string> = {
  laras: "Laras",
  emi: "Emi",
  novi: "Novi",
};

/* =========================
   Default Items
   ========================= */
const ATTITUDE_ITEMS_BASE = [
  {
    code: "H",
    title: "Harmonis & Integritas",
    ask: "Apakah yang bersangkutan jujur, tidak manipulatif, mengakui kesalahan, konsisten menepati janji, menjaga keharmonisan tim, dan menjaga etika, bertindak hormat, dan berkomitmen?",
    n1: "Nilai 1 jika: kata provokatif, berpolitik, manipulatif, berbohong, mengadu domba, bermuka dua.",
  },
  {
    code: "E",
    title: "Etos Profesional",
    ask: "Apakah yang bersangkutan menjaga kualitas pekerjaan, tepat waktu, bertanggung jawab, berpenampilan dan bersikap profesional, dan bisa mengatur waktu agar deadline tercapai, tidak perhitungan dalam penyelesaian tugas?",
    n1: "Nilai 1 jika: berpenampilan seperti tidak niat kerja, kualitas pekerjaan asal-asalan, selalu miss deadline.",
  },
  {
    code: "B",
    title: "Berinovasi untuk Maju",
    ask: "Apakah yang bersangkutan partisipatif atau pasif; berkontribusi dalam brainstorming, memberi feedback/saran/masukan, dan berkeinginan untuk belajar?",
    n1: "Nilai 1 jika: pasif, merasa diri sudah mentok, bekerja asal gaji tetapi tidak ada pengembangan dan kontribusi.",
  },
  {
    code: "A",
    title: "Ahli & Adaptif",
    ask: "Apakah yang bersangkutan cepat belajar, ingin menguasai area kerja, inisiatif, tidak mudah tersinggung jika menerima masukan, cepat beradaptasi, dan kompeten di bidangnya?",
    n1: "Nilai 1 jika: tidak kompeten, sering salah, sangat lambat belajar, bebal, mudah tersinggung saat diberi masukan.",
  },
  {
    code: "T",
    title: "Tepat Manfaat & Peduli",
    ask: "Apakah yang bersangkutan efisien (tidak molor-molor), memahami kebutuhan pelanggan/rekan/atasan, cepat paham (tidak salah paham), punya empati & kepedulian, dan menghormati waktu orang lain?",
    n1: "Nilai 1 jika: tidak empati/peduli pada hal penting yang butuh bantuan, sering salah paham, hasil tidak tepat sasaran, kurang kepedulian, lambat & molor-molor dalam mengerjakan tugas.",
  },
] as const;
type AttItem = { code: string; title: string; ask: string; n1: string };

const KOMPETENSI_ITEMS_BASE = [
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
type SimpleItem = { key: string; title: string };

const PRESTASI_ITEMS_BASE = [
  { key: "targetTercapai", title: "Pencapaian Target" },
  { key: "inisiatif", title: "Inisiatif Perbaikan" },
  { key: "kolaborasi", title: "Kolaborasi Tim" },
  { key: "kualitasOutput", title: "Kualitas Output" },
] as const;

const SOP_ITEMS_BASE = [
  { key: "patuhSOP", title: "Kepatuhan SOP" },
  { key: "ketepatanDokumen", title: "Ketepatan Dokumen" },
  { key: "arsipRapi", title: "Kerapian & Arsip" },
  { key: "disiplinProses", title: "Disiplin Proses" },
] as const;

/* =========================
   OVERRIDES (superadmin)
   ========================= */
const EVAL_OV_KEY = "sitrep-eval-ov-v2";
type EvalOverrides = {
  personLabels?: Partial<Record<Person, string>>;
  titles?: Partial<Record<Exclude<Theme, "kosong">, string>>;
  attitudeItems?: AttItem[];
  kompetensiItems?: SimpleItem[];
  prestasiItems?: SimpleItem[];
  sopItems?: SimpleItem[];
};
function readOv(): EvalOverrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(EVAL_OV_KEY);
    return raw ? (JSON.parse(raw) as EvalOverrides) : {};
  } catch {
    return {};
  }
}
function writeOv(v: EvalOverrides) {
  if (typeof window === "undefined") return;
  localStorage.setItem(EVAL_OV_KEY, JSON.stringify(v));
}

/* =========================
   Hari → Tema (default)
   ========================= */
const DAY_LABEL_ID: Record<number, string> = {
  0: "Minggu",
  1: "Senin",
  2: "Selasa",
  3: "Rabu",
  4: "Kamis",
  5: "Jumat",
  6: "Sabtu",
};
const THEME_BY_DOW: Record<number, Theme> = {
  0: "kosong",
  1: "attitude",
  2: "kompetensi",
  3: "kosong",
  4: "prestasi",
  5: "kepatuhan",
  6: "prestasi",
};

/* =========================
   Helper
   ========================= */
function clampScores<T extends { key?: string; code?: string }>(
  items: T[],
  old: Record<string, number> | undefined,
  getKey: (it: T) => string
) {
  const next: Record<string, number> = {};
  for (const it of items) {
    const k = getKey(it);
    next[k] = old && typeof old[k] === "number" ? old[k] : 3; // default 3
  }
  return next;
}

/* =========================
   Component
   ========================= */
export default function EvaluasiTim({
  data,
  onChange,
}: {
  data: AppState["evaluasi"];
  onChange: (v: AppState["evaluasi"]) => void;
}) {
  const { role } = useAuth();
  const isSuper = role === "superadmin";

  // hari/tema default
  const now = new Date();
  const dow = now.getDay();
  const hariLabel = DAY_LABEL_ID[dow];
  const themeAuto: Theme = THEME_BY_DOW[dow];

  // superadmin bisa override tema (akses semua)
  const [forceTheme, setForceTheme] = useState<Theme | null>(null);
  const theme: Theme = isSuper ? forceTheme ?? themeAuto : themeAuto;

  // hari num disimpan (legacy)
  useEffect(() => {
    const hariNum = dow === 0 ? 0 : dow;
    onChange({ ...data, attitude: { ...data.attitude, hari: hariNum } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dow]);

  // overrides
  const [ov, setOv] = useState<EvalOverrides>(readOv);
  useEffect(() => writeOv(ov), [ov]);
  const resetOv = () => {
    if (
      confirm("Reset semua pengaturan Evaluasi (items, judul, label person)?")
    ) {
      setOv({});
    }
  };

  // mode edit
  const [editMode, setEditMode] = useState(false);

  // label person (rename-able)
  const PERSON_LABEL: Record<Person, string> = {
    laras: ov.personLabels?.laras || PERSON_LABEL_BASE.laras,
    emi: ov.personLabels?.emi || PERSON_LABEL_BASE.emi,
    novi: ov.personLabels?.novi || PERSON_LABEL_BASE.novi,
  };

  // items efektif (pakai override jika ada)
  const ATTITUDE_ITEMS: AttItem[] =
    ov.attitudeItems ?? ATTITUDE_ITEMS_BASE.map((x) => ({ ...x }));
  const KOMPETENSI_ITEMS: SimpleItem[] =
    ov.kompetensiItems ?? KOMPETENSI_ITEMS_BASE.map((x) => ({ ...x }));
  const PRESTASI_ITEMS: SimpleItem[] =
    ov.prestasiItems ?? PRESTASI_ITEMS_BASE.map((x) => ({ ...x }));
  const SOP_ITEMS: SimpleItem[] =
    ov.sopItems ?? SOP_ITEMS_BASE.map((x) => ({ ...x }));

  // judul tiap tema
  const TITLE_DEFAULT: Record<Exclude<Theme, "kosong">, string> = {
    attitude: "Penilaian Attitude (HEBAT)",
    kompetensi: "Penilaian Kompetensi",
    prestasi: "Penilaian Prestasi",
    kepatuhan: "Penilaian Kepatuhan SOP",
  };
  const TITLES = {
    attitude: ov.titles?.attitude ?? TITLE_DEFAULT.attitude,
    kompetensi: ov.titles?.kompetensi ?? TITLE_DEFAULT.kompetensi,
    prestasi: ov.titles?.prestasi ?? TITLE_DEFAULT.prestasi,
    kepatuhan: ov.titles?.kepatuhan ?? TITLE_DEFAULT.kepatuhan,
  };

  // person terpilih
  const [who, setWho] = useState<Person>("laras");
  const evalKey = `evaluasi_${who}`;
  const evaluasiText: string = ((data as any)[evalKey] as string) ?? "";

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div
      className="bg-white border rounded-2xl shadow-sm overflow-hidden"
      onClick={stop}
      onMouseDown={stop}
      onPointerDown={stop}
    >
      {/* Header */}
      <div className="px-3 sm:px-6 py-4 border-b bg-slate-50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users2 className="h-5 w-5 text-blue-600" />
          <h2 className="text-slate-800 font-semibold">Evaluasi Tim</h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm text-slate-700">
            <span className="font-medium">Hari:</span> {hariLabel}
          </div>

          {/* Tema: auto, tapi superadmin bisa pilih manual */}
          <div className="text-sm text-slate-700">
            <span className="font-medium">Tema:</span>{" "}
            {theme === "attitude"
              ? "Attitude"
              : theme === "kompetensi"
              ? "Kompetensi"
              : theme === "prestasi"
              ? "Prestasi"
              : theme === "kepatuhan"
              ? "Kepatuhan SOP"
              : "Kosong (tidak ada form)"}{" "}
            {isSuper && forceTheme && (
              <span className="ml-1 text-xs text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 border border-amber-200">
                (override)
              </span>
            )}
          </div>

          {isSuper && (
            <>
              <div className="hidden md:flex items-center gap-1">
                {(
                  [
                    "attitude",
                    "kompetensi",
                    "prestasi",
                    "kepatuhan",
                    "kosong",
                  ] as Theme[]
                ).map((t) => (
                  <button
                    key={t}
                    className={
                      "px-2.5 py-1 rounded-md text-xs border " +
                      (theme === t && forceTheme === t
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-slate-700 hover:bg-slate-50")
                    }
                    onClick={() => setForceTheme(t)}
                    title="Pilih tema secara manual (override)"
                  >
                    {t}
                  </button>
                ))}
                <button
                  className="px-2.5 py-1 rounded-md text-xs border bg-slate-50 hover:bg-white"
                  onClick={() => setForceTheme(null)}
                  title="Kembali pakai tema otomatis (berdasar hari)"
                >
                  Auto
                </button>
              </div>

              <label className="flex items-center gap-1 text-sm ml-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-blue-600"
                  checked={editMode}
                  onChange={(e) => setEditMode(e.target.checked)}
                />
                Mode Edit
              </label>
              <button
                onClick={resetOv}
                className="text-xs px-2 py-1 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50"
                title="Reset semua override evaluasi"
              >
                Reset
              </button>
            </>
          )}
        </div>
      </div>

      {/* Selector Person + rename (superadmin) */}
      {theme !== "kosong" && (
        <div className="px-3 sm:px-6 py-3 border-b bg-white">
          <div className="text-sm text-slate-600 mb-2">
            Nama yang dievaluasi:
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-2">
              {PERSONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setWho(p);
                  }}
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

            {isSuper && editMode && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">Rename:</span>
                <input
                  value={PERSON_LABEL[who]}
                  onChange={(e) =>
                    setOv((prev) => ({
                      ...prev,
                      personLabels: {
                        ...(prev.personLabels || {}),
                        [who]: e.target.value,
                      },
                    }))
                  }
                  className="rounded-lg border-slate-300 text-sm focus:ring-2 focus:ring-amber-500"
                  placeholder={`Label untuk ${who}`}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="px-3 sm:px-6 pb-6">
        {theme === "attitude" && (
          <AttitudeForm
            title={TITLES.attitude}
            setTitle={(t) =>
              setOv((p) => ({
                ...p,
                titles: { ...(p.titles || {}), attitude: t },
              }))
            }
            items={ATTITUDE_ITEMS}
            editable={isSuper && editMode}
            onItemsChange={(arr) =>
              setOv((p) => ({ ...p, attitudeItems: arr }))
            }
            data={
              ((data as any)[`attitude_${who}`] as EvaluasiAttitude) ?? {
                scores: {},
                notes: {},
              }
            }
            onDataChange={(scores, notes) =>
              onChange({
                ...(data as any),
                [`attitude_${who}`]: {
                  ...(((data as any)[
                    `attitude_${who}`
                  ] as EvaluasiAttitude) ?? {
                    scores: {},
                    notes: {},
                  }),
                  scores,
                  notes,
                },
              } as any)
            }
          />
        )}

        {theme === "kompetensi" && (
          <SimpleForm
            title={TITLES.kompetensi}
            setTitle={(t) =>
              setOv((p) => ({
                ...p,
                titles: { ...(p.titles || {}), kompetensi: t },
              }))
            }
            items={KOMPETENSI_ITEMS}
            editable={isSuper && editMode}
            onItemsChange={(arr) =>
              setOv((p) => ({ ...p, kompetensiItems: arr }))
            }
            data={
              (data as any)[`kompetensi_${who}`] ?? (data as any).kompetensi
            }
            onDataChange={(payload) =>
              onChange({
                ...(data as any),
                [`kompetensi_${who}`]: {
                  ...((data as any)[`kompetensi_${who}`] ??
                    (data as any).kompetensi),
                  ...payload,
                },
              } as any)
            }
          />
        )}

        {theme === "prestasi" && (
          <SimpleForm
            title={TITLES.prestasi}
            setTitle={(t) =>
              setOv((p) => ({
                ...p,
                titles: { ...(p.titles || {}), prestasi: t },
              }))
            }
            items={PRESTASI_ITEMS}
            editable={isSuper && editMode}
            onItemsChange={(arr) =>
              setOv((p) => ({ ...p, prestasiItems: arr }))
            }
            data={
              ((data as any)[`prestasi_${who}`] as {
                scores: Record<string, number>;
                notes: Record<string, string>;
              }) ?? {
                scores: {},
                notes: {},
              }
            }
            onDataChange={(payload) =>
              onChange({
                ...(data as any),
                [`prestasi_${who}`]: {
                  ...(((data as any)[`prestasi_${who}`] as any) ?? {
                    scores: {},
                    notes: {},
                  }),
                  ...payload,
                },
              } as any)
            }
          />
        )}

        {theme === "kepatuhan" && (
          <SimpleForm
            title={TITLES.kepatuhan}
            setTitle={(t) =>
              setOv((p) => ({
                ...p,
                titles: { ...(p.titles || {}), kepatuhan: t },
              }))
            }
            items={SOP_ITEMS}
            editable={isSuper && editMode}
            onItemsChange={(arr) => setOv((p) => ({ ...p, sopItems: arr }))}
            data={
              ((data as any)[`kepatuhan_${who}`] as {
                scores: Record<string, number>;
                notes: Record<string, string>;
              }) ?? {
                scores: {},
                notes: {},
              }
            }
            onDataChange={(payload) =>
              onChange({
                ...(data as any),
                [`kepatuhan_${who}`]: {
                  ...(((data as any)[`kepatuhan_${who}`] as any) ?? {
                    scores: {},
                    notes: {},
                  }),
                  ...payload,
                },
              } as any)
            }
          />
        )}

        {theme === "kosong" && (
          <div className="p-4 text-sm text-slate-600 border border-dashed rounded-xl bg-slate-50">
            Hari ini <span className="font-medium">kosong</span> (tidak ada
            form).
          </div>
        )}

        {/* Evaluasi — hanya superadmin yang bisa edit */}
        {theme !== "kosong" && (
          <div className="mt-5">
            <div className="text-sm font-medium text-slate-700 mb-1">
              Evaluasi {isSuper ? "(superadmin)" : ""}
            </div>
            {isSuper ? (
              <textarea
                rows={3}
                value={evaluasiText}
                onChange={(e) =>
                  onChange({
                    ...(data as any),
                    [evalKey]: e.target.value,
                  } as any)
                }
                placeholder={`Catatan evaluasi untuk ${PERSON_LABEL[who]}…`}
                className="w-full rounded-lg border-slate-300 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <div className="text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-2 min-h-[40px]">
                {evaluasiText?.trim() ? (
                  evaluasiText
                ) : (
                  <span className="text-slate-400">Belum ada evaluasi</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Attitude Form (HEBAT) — full editable schema (superadmin)
   ============================================================ */
function AttitudeForm({
  title,
  setTitle,
  items,
  editable,
  onItemsChange,
  data,
  onDataChange,
}: {
  title: string;
  setTitle: (t: string) => void;
  items: AttItem[];
  editable: boolean;
  onItemsChange: (items: AttItem[]) => void;
  data: EvaluasiAttitude;
  onDataChange: (
    scores: Record<string, number>,
    notes: Record<string, string>
  ) => void;
}) {
  // sinkron skor/notes ke schema terbaru
  const [scores, setScores] = useState<Record<string, number>>(
    clampScores(items, data?.scores, (it) => it.code)
  );
  const [notes, setNotes] = useState<Record<string, string>>(data?.notes || {});
  useEffect(() => {
    setScores((prev) => clampScores(items, prev, (it) => it.code));
    // notes dibiarkan apa adanya per code; jika code baru, note default ""
  }, [items]);
  useEffect(() => onDataChange(scores, notes), [scores, notes, onDataChange]);

  const avg =
    Math.round(
      (Object.values(scores).reduce((a, b) => a + b, 0) /
        Math.max(1, items.length)) *
        10
    ) / 10;

  return (
    <div className="space-y-4">
      {/* Title (editable) */}
      <div className="flex items-center gap-2">
        {editable ? (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-lg border-slate-300 text-sm focus:ring-2 focus:ring-amber-500"
          />
        ) : (
          <div className="text-sm font-medium text-slate-700">{title}</div>
        )}
      </div>

      <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-600">
        <span className="font-medium">Skala 1–5:</span> 1 sangat jelek, 2
        kurang, 3 cukup, 4 baik, 5 sangat baik.
      </div>

      <div className="divide-y border rounded-xl bg-white">
        {items.map((item, i) => (
          <div
            key={`${item.code}-${i}`}
            className="p-4 grid grid-cols-1 sm:grid-cols-12 gap-3"
          >
            <div className="sm:col-span-7">
              <div className="flex items-start gap-2">
                <span className="inline-flex h-6 min-w-6 w-6 mt-0.5 items-center justify-center rounded-md bg-blue-600 text-white text-xs font-bold">
                  {item.code}
                </span>
                <div className="w-full space-y-2">
                  {editable ? (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          value={item.code}
                          onChange={(e) => {
                            const v = e.target.value.trim();
                            const next = items.slice();
                            next[i] = { ...next[i], code: v };
                            onItemsChange(next);
                            // skor akan reclamp di useEffect
                          }}
                          placeholder="Kode"
                          className="rounded-lg border-slate-300 text-sm focus:ring-2 focus:ring-amber-500"
                          title="Mengubah KODE akan membuat skor lama tidak terpakai untuk item ini."
                        />
                        <input
                          value={item.title}
                          onChange={(e) => {
                            const next = items.slice();
                            next[i] = { ...next[i], title: e.target.value };
                            onItemsChange(next);
                          }}
                          placeholder="Judul"
                          className="col-span-2 rounded-lg border-slate-300 text-sm focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      <textarea
                        rows={2}
                        value={item.ask}
                        onChange={(e) => {
                          const next = items.slice();
                          next[i] = { ...next[i], ask: e.target.value };
                          onItemsChange(next);
                        }}
                        placeholder="Pertanyaan"
                        className="w-full rounded-lg border-slate-300 text-xs focus:ring-2 focus:ring-amber-500"
                      />
                      <textarea
                        rows={2}
                        value={item.n1}
                        onChange={(e) => {
                          const next = items.slice();
                          next[i] = { ...next[i], n1: e.target.value };
                          onItemsChange(next);
                        }}
                        placeholder={`Catatan (mis. "Nilai 1 jika: ...")`}
                        className="w-full rounded-lg border-slate-300 text-xs italic focus:ring-2 focus:ring-amber-500"
                      />
                    </>
                  ) : (
                    <>
                      <h4 className="font-medium text-slate-800">
                        {item.title}
                      </h4>
                      <p className="mt-1 text-xs text-slate-600">{item.ask}</p>
                      <p className="mt-0.5 text-xs text-slate-500 italic">
                        {item.n1}
                      </p>
                    </>
                  )}
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
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {editable && (
              <div className="sm:col-span-12 -mt-2">
                <button
                  onClick={() => {
                    const next = items.slice();
                    next.splice(i, 1);
                    onItemsChange(next);
                  }}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50"
                  title="Hapus item"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Hapus
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {editable && (
        <button
          onClick={() =>
            onItemsChange([
              ...items,
              {
                code: `X${items.length + 1}`,
                title: "Item Baru",
                ask: "",
                n1: "",
              },
            ])
          }
          className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border hover:bg-slate-50"
        >
          <Plus className="h-4 w-4" /> Tambah Item
        </button>
      )}

      <div className="text-sm text-slate-500">
        Rata-rata skor (HEBAT):{" "}
        <span className="font-semibold text-slate-800">
          {isFinite(avg) ? avg : 0}
        </span>
      </div>
    </div>
  );
}

/* ============================================================
   Simple Form (Kompetensi / Prestasi / Kepatuhan) — full editable
   ============================================================ */
function SimpleForm({
  title,
  setTitle,
  items,
  editable,
  onItemsChange,
  data,
  onDataChange,
}: {
  title: string;
  setTitle: (t: string) => void;
  items: SimpleItem[];
  editable: boolean;
  onItemsChange: (items: SimpleItem[]) => void;
  data: { scores: Record<string, number>; notes: Record<string, string> };
  onDataChange: (
    payload: Partial<{
      scores: Record<string, number>;
      notes: Record<string, string>;
    }>
  ) => void;
}) {
  const [scores, setScores] = useState<Record<string, number>>(
    clampScores(items, data?.scores, (it) => it.key)
  );
  const [notes, setNotes] = useState<Record<string, string>>(data?.notes || {});
  useEffect(() => {
    setScores((prev) => clampScores(items, prev, (it) => it.key));
  }, [items]);
  useEffect(
    () => onDataChange({ scores, notes }),
    [scores, notes, onDataChange]
  );

  const avg =
    Math.round(
      (Object.values(scores).reduce((a, b) => a + b, 0) /
        Math.max(1, items.length)) *
        10
    ) / 10;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {editable ? (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-lg border-slate-300 text-sm focus:ring-2 focus:ring-amber-500"
          />
        ) : (
          <div className="text-sm font-medium text-slate-700">{title}</div>
        )}
      </div>

      <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-600">
        <span className="font-medium">Skala 1–5:</span> 1 sangat jelek, 2
        kurang, 3 cukup, 4 baik, 5 sangat baik.
      </div>

      <div className="divide-y border rounded-xl bg-white">
        {items.map((item, i) => (
          <div
            key={`${item.key}-${i}`}
            className="p-4 grid grid-cols-1 sm:grid-cols-12 gap-3"
          >
            <div className="sm:col-span-7">
              {editable ? (
                <div className="grid grid-cols-3 gap-2">
                  <input
                    value={item.key}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      const next = items.slice();
                      next[i] = { ...next[i], key: v };
                      onItemsChange(next);
                    }}
                    placeholder="Key"
                    className="rounded-lg border-slate-300 text-sm focus:ring-2 focus:ring-amber-500"
                    title="Mengubah KEY akan membuat skor lama tidak terpakai untuk item ini."
                  />
                  <input
                    value={item.title}
                    onChange={(e) => {
                      const next = items.slice();
                      next[i] = { ...next[i], title: e.target.value };
                      onItemsChange(next);
                    }}
                    placeholder="Judul"
                    className="col-span-2 rounded-lg border-slate-300 text-sm focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              ) : (
                <h4 className="font-medium text-slate-800">{item.title}</h4>
              )}
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
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {editable && (
              <div className="sm:col-span-12 -mt-2">
                <button
                  onClick={() => {
                    const next = items.slice();
                    next.splice(i, 1);
                    onItemsChange(next);
                  }}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50"
                  title="Hapus item"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Hapus
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {editable && (
        <button
          onClick={() =>
            onItemsChange([
              ...items,
              { key: `x_${items.length + 1}`, title: "Item Baru" },
            ])
          }
          className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border hover:bg-slate-50"
        >
          <Plus className="h-4 w-4" /> Tambah Item
        </button>
      )}

      <div className="text-sm text-slate-500">
        Rata-rata skor:{" "}
        <span className="font-semibold text-slate-800">
          {isFinite(avg) ? avg : 0}
        </span>
      </div>
    </div>
  );
}
