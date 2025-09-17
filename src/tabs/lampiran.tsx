/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FileText, Download, Search, Trash2, PenLine } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import type { AppState, ChecklistState, RowValue } from "@/lib/types";

/* =========================
   Konstanta & Util
   ========================= */
const STORE_KEY = "sitrep-pdf-history-v1";

type PdfEntry = {
  id: string;
  filename: string;
  dateISO: string;
  submittedAt: string;
  name: string;
  role: string;
  pdfDataUrl: string; // data:URL (local) atau http(s) (cloud via proxy)
  storage?: "local" | "remote";
  key?: string;
};

type AnyUser = Partial<{
  id: string;
  email: string;
  name: string;
  role: string;
}>;

const PERSONS = ["laras", "emi", "novi"] as const;
type Person = (typeof PERSONS)[number];
const PERSON_LABEL: Record<Person, string> = {
  laras: "Laras",
  emi: "Emi",
  novi: "Novi",
};

type Theme = "attitude" | "kompetensi" | "prestasi" | "kepatuhan" | "kosong";
const DAY_THEME: Record<1 | 2 | 3 | 4 | 5 | 6, Theme> = {
  1: "attitude",
  2: "kompetensi",
  3: "kosong",
  4: "prestasi",
  5: "kepatuhan", // Jumat = Kepatuhan
  6: "prestasi", // Sabtu = Prestasi
};
const THEME_LABEL: Record<Theme, string> = {
  attitude: "Attitude (HEBAT)",
  kompetensi: "Kompetensi",
  prestasi: "Prestasi",
  kepatuhan: "Kepatuhan SOP",
  kosong: "Evaluasi",
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

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function uuid() {
  return crypto.randomUUID();
}

/** —— MIGRASI: bersihkan dataURI jumbo di storage lama —— */
function loadHistory(): PdfEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORE_KEY) || "[]";
    const parsed = JSON.parse(raw) as PdfEntry[];
    // buang dataURI besar agar tidak bikin quota penuh
    return (parsed || []).map((e) =>
      e?.pdfDataUrl?.startsWith("data:") ? { ...e, pdfDataUrl: "" } : e
    );
  } catch {
    return [];
  }
}

/** Simpan ringan: jangan serialisasi dataURI PDF ke localStorage */
function saveHistory(items: PdfEntry[]) {
  const sanitize = (arr: PdfEntry[]) =>
    arr.map((it) =>
      it.storage === "local" && it.pdfDataUrl?.startsWith("data:")
        ? { ...it, pdfDataUrl: "" }
        : it
    );
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(sanitize(items)));
  } catch {
    // fallback: simpan remote-only (paling ringan)
    try {
      const remoteOnly = items
        .filter((x) => x.storage === "remote")
        .map((x) => ({ ...x, pdfDataUrl: x.pdfDataUrl || "" }));
      localStorage.setItem(STORE_KEY, JSON.stringify(remoteOnly));
    } catch {
      // terakhir: bersihkan supaya tidak nge-loop error
      localStorage.removeItem(STORE_KEY);
    }
  }
}

/* === MERGE HELPERS (gabungan cloud + lokal) === */
function keyOf(e: PdfEntry) {
  if (e.storage === "remote" && e.key) return `remote:${e.key}`;
  if (e.id) return `local:${e.id}`;
  return `file:${e.filename}:${e.dateISO}:${e.name}:${e.role}`;
}
function mergeHistoryLists(...lists: PdfEntry[][]): PdfEntry[] {
  const map = new Map<string, PdfEntry>();
  for (const list of lists) {
    for (const it of list) {
      const k = keyOf(it);
      const cur = map.get(k);
      if (!cur) {
        map.set(k, it);
      } else {
        const pick =
          (cur.storage === "local" && it.storage === "remote") ||
          (it.submittedAt || "") > (cur.submittedAt || "")
            ? it
            : cur;
        map.set(k, pick);
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const byDate = (b.dateISO || "").localeCompare(a.dateISO || "");
    if (byDate !== 0) return byDate;
    return (b.submittedAt || "").localeCompare(a.submittedAt || "");
  });
}

/* =========================
   Loader pdf libs
   ========================= */
async function loadPdfLibs(): Promise<{ html2canvas: any; jsPDF: any }> {
  const h2cMod = await import("html2canvas");
  const html2canvas = (h2cMod as any).default ?? (h2cMod as any);
  const m = await import("jspdf");
  const jsPDF = (m as any).jsPDF ?? (m as any).default ?? (m as any);
  if (!html2canvas) throw new Error("html2canvas tidak ter-load");
  if (!jsPDF) throw new Error("jsPDF tidak ter-load");
  return { html2canvas, jsPDF };
}

/* =========================
   Signature Pad
   ========================= */
function SignaturePad({
  onChange,
}: {
  onChange: (dataUrl: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const ratioRef = useRef(1);
  const widthRef = useRef(560);
  const [empty, setEmpty] = useState(true);
  const SIG_HEIGHT = 140;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const parentW = canvas.parentElement
      ? canvas.parentElement.clientWidth
      : 560;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    ratioRef.current = ratio;
    widthRef.current = parentW;
    canvas.width = Math.round(parentW * ratio);
    canvas.height = Math.round(SIG_HEIGHT * ratio);
    canvas.style.width = "100%";
    canvas.style.height = `${SIG_HEIGHT}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#111827";
    ctx.beginPath();
    ctx.moveTo(0, SIG_HEIGHT - 22);
    ctx.lineTo(parentW, SIG_HEIGHT - 22);
    ctx.stroke();
  }, []);

  const getPos = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return {
      x: (e as any).clientX - rect.left,
      y: (e as any).clientY - rect.top,
    };
  };
  const start = (e: any) => {
    drawingRef.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    e.preventDefault();
  };
  const move = (e: any) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setEmpty(false);
    e.preventDefault();
  };
  const end = () => {
    drawingRef.current = false;
    const dataUrl = canvasRef.current!.toDataURL("image/png");
    onChange(empty ? null : dataUrl);
  };
  const clear = () => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(ratioRef.current, 0, 0, ratioRef.current, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#111827";
    ctx.beginPath();
    ctx.moveTo(0, SIG_HEIGHT - 22);
    ctx.lineTo(widthRef.current, SIG_HEIGHT - 22);
    ctx.stroke();
    setEmpty(true);
    onChange(null);
  };

  return (
    <div className="space-y-2 select-none">
      <div className="text-sm font-medium text-slate-700">Tanda Tangan</div>
      <div
        className="rounded-xl border bg-white p-2"
        style={{ userSelect: "none" }}
      >
        <canvas
          ref={canvasRef}
          className="block w-full rounded-lg"
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>
      <button
        type="button"
        onClick={clear}
        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border hover:bg-slate-50"
      >
        <PenLine className="h-4 w-4" /> Bersihkan
      </button>
    </div>
  );
}

/* =========================
   Checklist → array text
   ========================= */
function renderChecklist(checklist: ChecklistState) {
  const itemToStr = (it: any): string => {
    if (it == null) return "";
    if (typeof it === "string" || typeof it === "number") return String(it);
    if (typeof it === "object") {
      const rj =
        it.rj ?? it.RJ ?? it.no ?? it.nomor ?? it.kode ?? it.id ?? it.doc ?? "";
      const reason =
        it.reason ?? it.alasan ?? it.keterangan ?? it.ket ?? it.desc ?? "";

      if (Array.isArray(it)) {
        // gabungkan array menjadi baris (tanpa prefix '-')
        return it.map(String).join("\n");
      }
      const joined = [rj, reason].filter(Boolean).join(" - ");
      return joined || JSON.stringify(it);
    }
    return String(it);
  };

  const formatExtrasText = (x: any): string => {
    if (!x && x !== 0) return "";
    if (typeof x === "string") {
      const s = x.trim();
      if (
        (s.startsWith("{") && s.endsWith("}")) ||
        (s.startsWith("[") && s.endsWith("]"))
      ) {
        try {
          const parsed = JSON.parse(s);
          return formatExtrasText(parsed);
        } catch {
          return s;
        }
      }
      return s;
    }
    if (Array.isArray(x)) return x.map(itemToStr).filter(Boolean).join("\n"); // baris
    if (typeof x === "object") return itemToStr(x);
    return String(x);
  };

  const out: {
    section: string;
    rows: Array<{ label: string; value: string; note?: string }>;
  }[] = [];

  const sectionKeys = Object.keys(checklist) as Array<keyof ChecklistState>;
  for (const sec of sectionKeys) {
    const rows = checklist[sec];
    if (!rows) continue;
    const lineItems: Array<{ label: string; value: string; note?: string }> =
      [];

    for (const key of Object.keys(rows)) {
      const v = rows[key] as RowValue | undefined;
      if (!v) continue;

      let value = "";
      let noteOut = v.note ?? "";

      if (v.kind === "options") {
        value = String(v.value ?? "");
      } else if (v.kind === "number") {
        value = [v.value ?? "", v.suffix ?? ""].filter(Boolean).join(" ");
      } else if (v.kind === "score") {
        value = String(v.value ?? "");
      } else if (v.kind === "compound") {
        value = String(v.value ?? "");
        const extrasText = formatExtrasText((v.extras as any)?.text);
        const extrasCurrency =
          (v.extras as any)?.currency != null
            ? `Rp ${fmtIDR((v.extras as any).currency)}`
            : "";
        const extraNote = [extrasText, extrasCurrency]
          .filter(Boolean)
          .join(" | ");
        noteOut = [noteOut, extraNote]
          .filter((s) => String(s).trim().length > 0)
          .join("\n"); // baris, nanti jadi <li> saat render
      }

      lineItems.push({
        label: key.replace(/[-_]/g, " "),
        value,
        note: noteOut,
      });
    }

    if (lineItems.length === 0)
      lineItems.push({ label: "", value: "", note: "" });
    out.push({ section: String(sec), rows: lineItems });
  }

  if (out.length === 0) {
    out.push({
      section: "Checklist",
      rows: [{ label: "", value: "", note: "" }],
    });
  }
  return out;
}

/* =========================
   Helpers
   ========================= */
const isPrimitive = (v: unknown): v is string | number | boolean =>
  ["string", "number", "boolean"].includes(typeof v);
const isBoolArray = (a: unknown): a is boolean[] =>
  Array.isArray(a) && a.every((x) => typeof x === "boolean");
const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ((
        {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        } as const
      )[c]!)
  );

// Format Rupiah (separator ribuan)
const fmtIDR = (v: unknown): string => {
  if (v == null || v === "") return "";
  const n =
    typeof v === "number" ? v : Number(String(v).replace(/[^\d-]/g, ""));
  if (!Number.isFinite(n)) return String(v);
  return new Intl.NumberFormat("id-ID").format(n);
};

const hasAnyTruthy = (v: unknown): boolean => {
  if (v == null) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return true;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0 && v.some(hasAnyTruthy);
  if (isRecord(v)) return Object.values(v).some(hasAnyTruthy);
  return !!v;
};

const labelStatusChip = (filled: boolean) =>
  `<span class="chip ${filled ? "ok" : "muted"}">${
    filled ? "Diisi" : "Kosong"
  }</span>`;

const toTitleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/(^|[\s/,-])([\p{L}])/gu, (_m, p1, p2) => p1 + p2.toUpperCase());

/** =========================
 *  NOTE → HTML bullet list
 *  ========================= */
function noteToHTML(note?: string): string {
  const raw = String(note ?? "").trim();
  if (!raw) return "";

  // Normalisasi delimiter umum (tanpa mengubah jumlah item)
  const normalized = raw
    .replace(/\s*\|\s*/g, ", ") // "|" -> ", "
    .replace(/\s*•\s*/g, ", ")
    .replace(/\s*-\s*RJ/gi, ", RJ"); // " - RJ" -> ", RJ"

  let items: string[] = [];

  if (/RJ\d+/i.test(normalized)) {
    // Pisah tiap kemunculan RJnnnnnn (jaga jumlah item)
    items = normalized
      .split(/(?=RJ\d+)/i)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  } else if (normalized.includes("\n")) {
    items = normalized
      .split(/\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  } else {
    items = normalized
      .split(/,\s*/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  // Hilangkan prefix bullet kalau ada, tapi JANGAN dedup
  items = items.map((s) => s.replace(/^[-•]\s*/, ""));

  if (!items.length) return "";

  return `<ul class="ul-kv">${items
    .map((x) => `<li>${escapeHtml(x)}</li>`)
    .join("")}</ul>`;
}

/* =========================
   Evaluasi types
   ========================= */
type ScoreValue = string | number;
type DayLike = 1 | 2 | 3 | 4 | 5 | 6 | "1" | "2" | "3" | "4" | "5" | "6";

type Evaluasi = {
  theme?: string;
  tema?: string;
  hari?: DayLike;
  attitude?: {
    hari?: DayLike;
    scores?: Record<string, ScoreValue>;
    notes?: Record<string, string>;
    [k: string]: unknown;
  };
  [key: string]: unknown;
};

/* ========= Normalisasi & Deteksi Tema Evaluasi ========= */
const THEME_KEY_ALIASES: Record<Theme, string[]> = {
  attitude: ["attitude"],
  kompetensi: ["kompetensi"],
  prestasi: ["prestasi"],
  kepatuhan: [
    "kepatuhan",
    "sop",
    "kepatuhanSOP",
    "kepatuhan_sop",
    "kepatuhanSop",
  ],
  kosong: [],
};

function normalizeThemeName(raw?: string | null): Theme | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (["attitude", "hebat"].includes(s)) return "attitude";
  if (["kompetensi", "skill", "kemampuan"].includes(s)) return "kompetensi";
  if (["prestasi", "achievement"].includes(s)) return "prestasi";
  if (
    [
      "kepatuhan",
      "sop",
      "kepatuhan sop",
      "kepatuhan_sop",
      "kepatuhansop",
    ].includes(s)
  )
    return "kepatuhan";
  return null;
}

const parseHari = (v: DayLike | undefined): (1 | 2 | 3 | 4 | 5 | 6) | null => {
  if (v == null) return null;
  const n = typeof v === "string" ? parseInt(v, 10) : (v as number);
  if ([1, 2, 3, 4, 5, 6].includes(n)) return n as 1 | 2 | 3 | 4 | 5 | 6;
  return null;
};

const hasThemePayload = (evaluasi: Evaluasi, t: Theme): boolean => {
  const keys = THEME_KEY_ALIASES[t];
  return keys.some((k) => (evaluasi as any)[k] != null);
};

function resolveTheme(evaluasi: Evaluasi): {
  theme: Theme;
  hari: (1 | 2 | 3 | 4 | 5 | 6) | null;
} {
  const hari = parseHari(evaluasi.hari ?? evaluasi.attitude?.hari);
  if (hari) {
    const byDay = DAY_THEME[hari];
    if (byDay !== "kosong") return { theme: byDay, hari };
  }
  const explicit =
    normalizeThemeName(evaluasi.theme) || normalizeThemeName(evaluasi.tema);
  if (explicit) return { theme: explicit, hari };
  for (const t of [
    "prestasi",
    "kompetensi",
    "kepatuhan",
    "attitude",
  ] as Theme[])
    if (hasThemePayload(evaluasi, t)) return { theme: t, hari };
  return { theme: "attitude", hari };
}

/* =========================
   SPARTA katalog & progress
   ========================= */
const SPARTA_CATALOG_KEY = "sitrep-sparta-catalog-v3";
type SpartaCatalogItem = {
  id: string;
  title: string;
  steps: string[];
  deadline: string;
  targetRole: "admin" | "sales" | "gudang";
};
function defaultSpartaCatalog(): SpartaCatalogItem[] {
  return [
    {
      id: "udi",
      title: "Penyelesaian Klaim UDI",
      steps: [
        "Rekap Data 2025",
        "Rekap Data 2024",
        "Rekap Data 2023",
        "Rekap Data 2022",
      ],
      deadline: "",
      targetRole: "admin",
    },
  ];
}
function readSpartaCatalog(): SpartaCatalogItem[] {
  if (typeof window === "undefined") return defaultSpartaCatalog();
  try {
    const raw = localStorage.getItem(SPARTA_CATALOG_KEY);
    if (raw)
      return (JSON.parse(raw) as any[]).map((p) => ({
        targetRole: "admin",
        steps: [],
        deadline: "",
        id: "",
        title: "",
        ...p,
      })) as SpartaCatalogItem[];
    const rawV2 = localStorage.getItem("sitrep-sparta-catalog-v2");
    if (rawV2)
      return (JSON.parse(rawV2) as any[]).map((p) => ({
        targetRole: (p.targetRole ?? "admin") as any,
        steps: [],
        deadline: "",
        id: "",
        title: "",
        ...p,
      })) as SpartaCatalogItem[];
    const rawV1 = localStorage.getItem("sitrep-sparta-catalog-v1");
    if (rawV1)
      return (JSON.parse(rawV1) as any[]).map((p) => ({
        ...p,
        targetRole: "admin",
      })) as SpartaCatalogItem[];
    return defaultSpartaCatalog();
  } catch {
    return defaultSpartaCatalog();
  }
}
function clampBools(arr: boolean[] | undefined, len: number): boolean[] {
  const a = Array.isArray(arr) ? arr.slice(0, len) : [];
  while (a.length < len) a.push(false);
  return a;
}
function daysLeftFromStr(deadline?: string) {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (Number.isNaN(+d)) return null;
  const today = new Date();
  const base = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  ).getTime();
  return Math.ceil((d.getTime() - base) / 86400000);
}

type SpartaProgress = {
  steps: boolean[];
  progressText: string;
  nextAction: string;
  kendala: string;
};
type SpartaStateLike = { projectsProgress?: Record<string, SpartaProgress> };
function extractProjectsFromSparta(
  sparta: SpartaStateLike | undefined,
  userRole: string | undefined
) {
  const catalog = readSpartaCatalog();
  const role = (userRole || "admin") as
    | "admin"
    | "sales"
    | "gudang"
    | "superadmin";
  const visible =
    role === "superadmin"
      ? catalog
      : catalog.filter((p) => p.targetRole === role);
  const progressMap = (sparta?.projectsProgress || {}) as Record<
    string,
    SpartaProgress
  >;
  return visible.map((p) => {
    const prog = progressMap[p.id] || {
      steps: [],
      progressText: "",
      nextAction: "",
      kendala: "",
    };
    const steps = clampBools(prog.steps, p.steps.length).map((done, i) => ({
      label: `${i + 1}. ${p.steps[i]}`,
      done,
    }));
    const percent = Math.round(
      (steps.filter((s) => s.done).length / Math.max(1, steps.length)) * 100
    );
    return {
      name: p.title,
      ownerRole: role === "superadmin" ? "superadmin" : role,
      deadline: p.deadline || "",
      daysLeft: daysLeftFromStr(p.deadline || undefined),
      steps,
      percent,
      nextAction: prog.nextAction || "",
      kendala: prog.kendala || "",
    };
  });
}

/* =========================
   Target extractor
   ========================= */
type TargetView =
  | { type: "empty" }
  | { type: "kpi"; rows: Array<Record<string, unknown>> }
  | { type: "table"; cols: string[]; rows: Array<Record<string, unknown>> }
  | { type: "kv"; kv: Record<string, unknown> };
function extractTarget(target: unknown): TargetView {
  if (!target || !isRecord(target)) return { type: "empty" };
  const list =
    (target as any)["goals"] ??
    (target as any)["items"] ??
    (target as any)["rows"] ??
    (target as any)["list"];
  if (Array.isArray(list) && list.length) {
    const rows = list.filter(isRecord) as Array<Record<string, unknown>>;
    const pick = (r: Record<string, unknown>, keys: string[]) =>
      keys.map((k) => r[k]).find((v) => v !== undefined);
    const looksLikeKPI =
      rows.some((r) => {
        const hasName = !!(pick(r, ["title", "name", "kpi"]) as
          | string
          | undefined);
        const hasTgt = pick(r, ["target", "plan"]) !== undefined;
        const hasAct =
          pick(r, ["actual", "real", "realisasi", "achieved"]) !== undefined;
        const hasPct =
          pick(r, ["percent", "persen", "achievement"]) !== undefined;
        return hasName || hasTgt || hasAct || hasPct;
      }) || false;
    if (looksLikeKPI) return { type: "kpi", rows };
    const cols = Array.from(
      rows.reduce<Set<string>>((s, r) => {
        Object.keys(r || {}).forEach((k) => s.add(k));
        return s;
      }, new Set())
    );
    return { type: "table", cols, rows };
  }
  if (Object.keys(target).length)
    return { type: "kv", kv: target as Record<string, unknown> };
  return { type: "empty" };
}

/* =========================
   Komponen
   ========================= */
type AppLike = AppState &
  Partial<{
    evaluasi: Evaluasi;
    sparta: SpartaStateLike;
    target: unknown;
    agenda: {
      entries: Array<{
        date: string;
        updatedAt?: string;
        plan?: string[];
        realisasi?: string[];
        planSubmitted?: boolean;
        realSubmitted?: boolean;
      }>;
    };
  }>;

export default function Lampiran({ data }: { data: AppState }) {
  const { user } = useAuth();
  const [sigDataUrl, setSigDataUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<PdfEntry[]>([]);
  const [searchDate, setSearchDate] = useState<string>("");
  const [working, setWorking] = useState(false);
  const printRef = useRef<HTMLDivElement | null>(null);

  const refreshRiwayatFromSupabase = useCallback(
    async (dateOnly?: string) => {
      try {
        const u = (user ?? {}) as AnyUser;
        const userId = u.id || u.email || u.name || "unknown";
        const role = u.role || "admin";

        const qs = new URLSearchParams({
          userId: String(userId),
          role: String(role),
          _ts: String(Date.now()),
        });
        if (dateOnly) qs.set("date", dateOnly);

        const res = await fetch(`/api/lampiran/list?${qs.toString()}`, {
          cache: "no-store",
        });

        if (!res.ok) return false;
        const json = (await res.json()) as {
          items: Array<{
            filename: string;
            dateISO: string;
            url?: string;
            downloadUrl?: string;
            key: string;
            submittedAt?: string;
          }>;
        };
        if (!json?.items) return false;

        const mapped: PdfEntry[] = json.items.map((it) => ({
          id: it.key,
          filename: it.filename,
          dateISO: it.dateISO,
          submittedAt: it.submittedAt || new Date().toISOString(),
          name: u.name || "-",
          role: role || "-",
          pdfDataUrl: it.downloadUrl ?? it.url ?? "#",
          storage: "remote",
          key: it.key,
        }));

        const local = loadHistory();
        const merged = mergeHistoryLists(mapped, local);
        setHistory(merged);
        saveHistory(merged);
        return true;
      } catch {
        return false;
      }
    },
    [user]
  );

  useEffect(() => {
    (async () => {
      const ok = await refreshRiwayatFromSupabase(searchDate || undefined);
      if (!ok) setHistory(loadHistory());
    })();
  }, [refreshRiwayatFromSupabase, searchDate]);

  const filtered = useMemo(
    () => (searchDate ? history.filter((h) => h.dateISO === searchDate) : []),
    [history, searchDate]
  );

  const evalData = ((data as unknown as AppLike).evaluasi ?? {}) as Evaluasi;
  const { theme } = resolveTheme(evalData);
  const themeLabel = THEME_LABEL[theme];

  /* --------- ISOLATED IFRAME + Layout PDF --------- */
  function createIsolatedIframe() {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-10000px";
    iframe.style.top = "0";
    iframe.style.width = "820px";
    iframe.style.height = "1200px";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(
      `<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>`
    );
    doc.close();

    const base = doc.createElement("style");
    base.textContent = `*,*::before,*::after{box-sizing:border-box} html,body{margin:0;padding:0;background:#fff;color:#0f172a}
      body{font-family:Inter, Arial, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size:14px;line-height:1.55}`;
    doc.head.appendChild(base);

    return { doc, iframe, cleanup: () => iframe.remove() };
  }

  const buildPrintLayout = (doc: Document) => {
    const root = doc.createElement("div");
    root.id = "pdf-print-root";
    (root.style as any).all = "initial";
    root.style.display = "block";
    root.style.width = "794px";
    root.style.background = "#fff";
    root.style.color = "#0f172a";
    root.style.fontFamily =
      'Inter, Arial, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    root.style.fontSize = "14px";
    root.style.lineHeight = "1.55";

    const st = doc.createElement("style");
    st.textContent = `
  .page{width:794px;min-height:1123px;box-sizing:border-box;padding:24px;}
  .section{margin-top:18px;}
  .title{font-weight:800;color:#0f172a;margin-bottom:10px;letter-spacing:.2px;font-size:18px;}
  .muted{color:#64748b;}
  .page-break-avoid{break-inside:avoid;page-break-inside:avoid;}
  .table, .table *, thead, tbody, tr, th, td { break-inside: avoid; page-break-inside: avoid; }

  :root{
    --brand-color:#0b122b;  /* SAMAKAN dengan warna utama logo */
    --brand-fg:#ffffff;
    --accent:#ffffff;

    --good-bg:#ecfdf5; --good-fg:#065f46;
    --due-bg:#eff6ff;  --due-fg:#1d4ed8; --due-bd:#93c5fd;
    --bad-bg:#fef2f2;  --bad-fg:#7f1d1d;
    --neu-bg:#f1f5f9;  --neu-fg:#475569;
  }

  /* === HEADER: flat, warna = brand, logo transparan === */
  .banner{
    position: relative !important;
    color: var(--brand-fg) !important;
    border: 0 !important;
    padding: 22px 20px !important;
    border-radius: 18px !important;
    box-shadow: 0 1px 0 rgba(16,24,40,.03) !important;
    background: var(--brand-color) !important;   /* flat, no image */
    background-image: none !important;
  }
  .banner::before, .banner::after{ content:none !important; }

  .hdr-stack{
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center
  }
  .logoImgCenter{
    width:84px;height:84px;border-radius:16px;object-fit:contain;
    background: transparent !important; border:0 !important; padding:0;
    box-shadow:none !important;
  }
  .title-main, .title-second{font-weight:900; letter-spacing:.2px; font-size:18px; line-height:1.15;}
  .title-second{opacity:.98;}
  .tag-sub{font-size:12px;opacity:.95;}

  .info-grid{display:flex;gap:12px;margin-top:12px;}
  .card{border:1px solid #e6e8f0;border-radius:12px;padding:10px 12px;flex:1;background:#fff;}
  .card .label{color:#6b7280;font-size:13px;}

  .table{width:100%;border-collapse:separate;border-spacing:0;}
  .table th,.table td{border:1px solid #e9edf3;padding:8px 10px;vertical-align:middle;}
  .table th{background:#f8fafc;color:#475569;text-align:left;font-weight:700;border-top:none;border-bottom:2px solid #cbd5e1;font-size:16px;}
  .table td{font-size:14px;}
  .table.striped tbody tr:nth-child(even){background:#fbfdff;}
  .table.checklist{border:2px solid #cbd5e1;border-radius:12px;overflow:hidden;box-shadow:0 1px 0 rgba(16,24,40,.03);background:#fff;}
  .table.checklist td:first-child{font-weight:700;color:#0f172a;}

  .subhead{font-weight:800;margin:6px 0 8px;color:#0f172a;text-transform:uppercase;letter-spacing:.2px;border-left:5px solid #0f172a;padding-left:10px;font-size:16px;}
  .pill{display:inline-block;padding:2px 8px;border-radius:999px;background:#eef2ff;color:#3730a3;font-size:11px;font-weight:700;}
  .chip{display:inline-flex;align-items:center;justify-content:center;height:22px;padding:0 10px;border-radius:999px;border:1px solid #e5e7eb;background:#fff;font-size:11px;font-weight:700;line-height:1;}
  .chip.ok{background:#ecfdf5;border-color:#86efac;color:#065f46;}
  .chip.due{background:var(--due-bg);border-color:var(--due-bd);color:var(--due-fg);}
  .chip.over{background:#fef2f2;border-color:#fca5a5;color:#7f1d1d;}

  .status-badge{display:inline-block;padding:2px 0;background:transparent;color:#0f172a;font-size:14px;font-weight:400}

  .sigwrap{page-break-inside:avoid;margin-top:18px;}
  .sigtitle{text-align:right;margin:0 0 6px 0;}
  .sigrow{display:flex;justify-content:flex-end;}
  .sigbox{position:relative;width:360px;margin-top:6px;border:1px dashed #cbd5e1;border-radius:12px;padding:12px;height:140px;display:flex;align-items:center;justify-content:center;background:#fcfdff;}
  .sigbox img{max-height:96px;display:block;margin:auto;object-fit:contain;}
  .sigline{position:absolute;left:12px;right:12px;bottom:12px;height:2px;background:#0f172a;opacity:.85;}
  .foot{margin-top:6px;color:#64748b;font-size:11px;text-align:right;}

  .grid{display:grid;grid-template-columns:1.15fr .85fr;gap:16px;}
  .pro-card{border:1px solid #e6e8f0;border-radius:16px;background:#fff;padding:14px;box-shadow:0 1px 0 rgba(16,24,40,.02);}
  .pro-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}
  .pro-title{font-weight:800;color:#0f172a;font-size:16px;}
  .steps-panel{border:1px solid #eef2f7;border-radius:12px;background:#fcfdff;padding:10px 12px;}
  .progress{height:10px;background:#eff3fb;border-radius:999px;overflow:hidden}
  .progress>div{height:100%;background:#2563eb;transition:width .2s ease}
  .chk{list-style:none;margin:0;padding:0}
  .step{display:flex;gap:8px;align-items:center;margin:6px 0}
  .icon{display:inline-block;width:14px;height:14px;border-radius:999px;border:2px solid #cbd5e1;background:#fff;box-sizing:border-box}
  .done .icon{background:#2563eb;border-color:#2563eb}
  .label{line-height:1.35}
  .done .label{text-decoration:line-through;color:#6b7280}

  .cbx{display:inline-block;width:14px;height:14px;border-radius:999px;border:2px solid #cbd5e1;background:#fff;vertical-align:middle}
  .cbx.on{background:#2563eb;border-color:#2563eb}

  .ul-kv{margin:0;padding-left:18px}
  .ul-kv li{margin:0;padding:0}
`;
    root.appendChild(st);

    doc.body.appendChild(root);

    const PAGE_MAX_PX = 1123;
    const makePage = () => {
      const p = doc.createElement("div");
      p.className = "page";
      root.appendChild(p);
      return p;
    };
    let page = makePage();

    function splitTableSection(sectionEl: HTMLElement) {
      const titleEl = sectionEl.querySelector(".subhead");
      const titleText = titleEl?.textContent || "";
      const table = sectionEl.querySelector("table");
      if (!table) {
        appendBlock(sectionEl);
        return;
      }

      const thead = table
        .querySelector("thead")
        ?.cloneNode(true) as HTMLElement | null;
      const rows = Array.from(table.querySelectorAll("tbody > tr"));
      let idx = 0;
      let first = true;

      while (idx < rows.length) {
        const sec = doc.createElement("div");
        sec.className = "section page-break-avoid";
        if (titleText) {
          const h = doc.createElement("div");
          h.className = "subhead";
          h.textContent = first ? titleText : `${titleText} (lanjutan)`;
          sec.appendChild(h);
        }
        const t = doc.createElement("table");
        t.className = table.className;
        if (thead) t.appendChild(thead.cloneNode(true));
        const tb = doc.createElement("tbody");
        t.appendChild(tb);
        sec.appendChild(t);

        while (idx < rows.length) {
          tb.appendChild(rows[idx].cloneNode(true));
          page.appendChild(sec);
          if (page.scrollHeight > PAGE_MAX_PX) {
            tb.removeChild(tb.lastElementChild!);
            page.removeChild(sec);
            page = makePage();
            break;
          } else {
            page.removeChild(sec);
            idx++;
          }
        }

        appendBlock(sec);
        first = false;
      }
    }

    const appendBlock = (el: HTMLElement) => {
      page.appendChild(el);

      if (page.scrollHeight > PAGE_MAX_PX) {
        if (el.querySelector("table")) {
          page.removeChild(el);
          splitTableSection(el);
          return;
        }

        page.removeChild(el);
        page = makePage();
        page.appendChild(el);

        if (page.scrollHeight > PAGE_MAX_PX) {
          page.removeChild(el);

          if (el.querySelector("table")) {
            splitTableSection(el);
          } else {
            const children = Array.from(el.children) as HTMLElement[];
            if (!children.length) {
              appendBlock(doc.createElement("div"));
              return;
            }
            const newContainer = doc.createElement("div");
            newContainer.className = el.className;
            let i = 0;
            while (i < children.length) {
              const part = children[i].cloneNode(true) as HTMLElement;
              newContainer.appendChild(part);
              page.appendChild(newContainer);
              if (page.scrollHeight > PAGE_MAX_PX) {
                newContainer.removeChild(part);
                page.removeChild(newContainer);
                if (newContainer.childElementCount) appendBlock(newContainer);
                page = makePage();
                const nc = doc.createElement("div");
                nc.className = el.className;
                newContainer.replaceWith(nc);
                (newContainer as unknown as { ref?: HTMLElement }).ref = nc;
              } else {
                page.removeChild(newContainer);
                i++;
              }
            }
            if (newContainer.childElementCount) appendBlock(newContainer);
          }
        }
      }
    };

    // ==== Header (centered stack, logo transparan, flat brand color)
    const header = doc.createElement("div");
    header.className = "banner";
    const uName = (user as AnyUser | undefined)?.name || "";
    const uRole = (user as AnyUser | undefined)?.role || "";
    const depoName = "TULUNGAGUNG";

    // PNG transparan + cache buster
    const logoSrc = "/sitrep-logo.png?v=2";

    header.innerHTML = `
      <div class="hdr-stack">
        <img class="logoImgCenter" src="${logoSrc}" alt="Logo" />
        <div class="title-main">LEADER MONITORING DAILY</div>
        <div class="title-second">SITREP — Situation Report Harian</div>
        <div class="tag-sub">Powered by ${escapeHtml(
          uName
        )} <span>( ${escapeHtml(uRole)} )</span> • Depo ${escapeHtml(
      depoName
    )}</div>
        <div class="tag-sub">Tanggal: ${todayISO()}</div>
      </div>`;
    appendBlock(header);

    const classifyStatus = (
      raw: unknown
    ): "good" | "warn" | "bad" | "neutral" => {
      if (raw == null) return "neutral";
      const s = String(raw).trim().toLowerCase();
      if (!s) return "neutral";
      if (["ya", "yes", "y", "true", "ok", "oke", "on", "selesai"].includes(s))
        return "good";
      if (["tidak", "no", "n", "false", "off"].includes(s)) return "bad";
      if (/\d+(\.\d+)?\s*%$/.test(s)) {
        const v = parseFloat(s);
        if (v >= 80) return "good";
        if (v >= 50) return "warn";
        return "bad";
      }
      const n = Number(s);
      if (!Number.isNaN(n)) return n >= 4 ? "good" : n >= 3 ? "warn" : "bad";
      if (["pending", "proses", "kurang"].some((w) => s.includes(w)))
        return "warn";
      if (["gagal", "lewat", "rusak"].some((w) => s.includes(w))) return "bad";
      if (["baik", "aman", "sesuai"].some((w) => s.includes(w))) return "good";
      return "neutral";
    };

    // Identitas
    const info = doc.createElement("div");
    info.className = "info-grid";
    info.innerHTML = `
      <div class="card"><div class="label">Nama</div><div style="font-weight:700">${
        (user as AnyUser | undefined)?.name || ""
      }</div></div>
      <div class="card"><div class="label">Role</div><div style="font-weight:700">${
        (user as AnyUser | undefined)?.role || ""
      }</div></div>
      <div class="card"><div class="label">Depo</div><div style="font-weight:700">TULUNGAGUNG</div></div>`;
    appendBlock(info);

    /* ========= Rangkuman Checklist ========= */
    {
      const head = doc.createElement("div");
      head.className = "section";
      head.innerHTML = `<div class="title">Rangkuman Checklist</div>`;
      appendBlock(head);

      const checklistBlocks = renderChecklist((data as any).checklist || {});
      checklistBlocks.forEach((sec) => {
        const secEl = doc.createElement("div");
        secEl.className = "section page-break-avoid";
        secEl.innerHTML = `<div class="subhead">${sec.section.toUpperCase()}</div>`;
        const tbl = doc.createElement("table");
        tbl.className = "table striped checklist";
        tbl.innerHTML = `<colgroup><col style="width:26%"><col style="width:18%"><col style="width:56%"></colgroup>
          <thead><tr><th>Area</th><th>Status</th><th>Catatan</th></tr></thead>`;
        const tb = doc.createElement("tbody");
        sec.rows.forEach((r) => {
          const cls = classifyStatus(r.value);
          const valueHtml = `<span class="status-badge ${cls}">${escapeHtml(
            String(r.value || "")
          )}</span>`;
          tb.insertAdjacentHTML(
            "beforeend",
            `<tr><td>${toTitleCase(
              r.label || ""
            )}</td><td>${valueHtml}</td><td>${noteToHTML(r.note)}</td></tr>`
          );
        });
        tbl.appendChild(tb);
        secEl.appendChild(tbl);
        appendBlock(secEl);
      });
    }

    /* ========= Evaluasi ========= */
    {
      const titleMap: Record<Theme, string> = {
        attitude: "Evaluasi Tim · Attitude (HEBAT)",
        kompetensi: "Evaluasi Tim · Kompetensi",
        prestasi: "Evaluasi Tim · Prestasi",
        kepatuhan: "Evaluasi Tim · Kepatuhan SOP",
        kosong: "Evaluasi Tim",
      };
      const head = doc.createElement("div");
      head.className = "section";
      head.innerHTML = `<div class="title">${titleMap[theme]}</div>`;
      appendBlock(head);

      const readPersonPayload = (t: Theme, p: Person) => {
        const keys = THEME_KEY_ALIASES[t];
        for (const key of keys) {
          const found =
            (evalData as any)[`${key}_${p}`] ??
            (evalData as any)[key]?.[p] ??
            (evalData as any)[p]?.[key];
          if (found)
            return found as any as {
              scores?: Record<string, unknown>;
              notes?: Record<string, string>;
            };
        }
        return {} as {
          scores?: Record<string, unknown>;
          notes?: Record<string, string>;
        };
      };

      if (theme === "attitude") {
        const raw = (evalData?.attitude ??
          (evalData as any).attitude ??
          {}) as any;

        const useNestedPerPerson = PERSONS.some(
          (p) => raw?.[p]?.scores || raw?.[p]?.notes
        );

        if (useNestedPerPerson) {
          PERSONS.forEach((p) => {
            const scores = (raw?.[p]?.scores ?? {}) as Record<string, unknown>;
            const notes = (raw?.[p]?.notes ?? {}) as Record<string, string>;
            const block = doc.createElement("div");
            block.className = "section";
            block.innerHTML = `<div class="subhead">${PERSON_LABEL[p]}</div>`;
            const tbl = doc.createElement("table");
            tbl.className = "table striped";
            tbl.innerHTML = `<colgroup><col style="width:50%"><col style="width:14%"><col style="width:36%"></colgroup>
              <thead><tr><th>Aspek</th><th>Skor</th><th>Catatan</th></tr></thead>`;
            const tb = doc.createElement("tbody");
            HEBAT_ITEMS.forEach((i) =>
              tb.insertAdjacentHTML(
                "beforeend",
                `<tr><td>[${i.code}] ${i.title}</td><td><b>${
                  (scores as any)[i.code] ?? ""
                }</b></td><td>${(notes as any)[i.code] || ""}</td></tr>`
              )
            );
            tbl.appendChild(tb);
            block.appendChild(tbl);
            appendBlock(block);
          });
        } else {
          const rawScores = (raw?.scores ?? {}) as Record<string, unknown>;
          const rawNotes = (raw?.notes ?? {}) as Record<string, string>;

          const hasPerPersonInline = PERSONS.some((p) =>
            HEBAT_ITEMS.some(
              (i) =>
                rawScores[`${p}::${i.code}`] !== undefined ||
                (rawNotes[`${p}::${i.code}`] || "").trim() !== ""
            )
          );
          if (hasPerPersonInline) {
            PERSONS.forEach((p) => {
              const block = doc.createElement("div");
              block.className = "section";
              block.innerHTML = `<div class="subhead">${PERSON_LABEL[p]}</div>`;
              const tbl = doc.createElement("table");
              tbl.className = "table striped";
              tbl.innerHTML = `<colgroup><col style="width:50%"><col style="width:14%"><col style="width:36%"></colgroup>
                <thead><tr><th>Aspek</th><th>Skor</th><th>Catatan</th></tr></thead>`;
              const tb = doc.createElement("tbody");
              HEBAT_ITEMS.forEach((i) =>
                tb.insertAdjacentHTML(
                  "beforeend",
                  `<tr><td>[${i.code}] ${i.title}</td><td><b>${
                    (rawScores as any)[`${p}::${i.code}`] ?? ""
                  }</b></td><td>${
                    (rawNotes as any)[`${p}::${i.code}`] || ""
                  }</td></tr>`
                )
              );
              tbl.appendChild(tb);
              block.appendChild(tbl);
              appendBlock(block);
            });
          } else {
            const wrap = doc.createElement("div");
            wrap.className = "section page-break-avoid";
            const tbl = doc.createElement("table");
            tbl.className = "table striped";
            tbl.innerHTML = `<colgroup><col style="width:50%"><col style="width:14%"><col style="width:36%"></colgroup>
              <thead><tr><th>Aspek</th><th>Skor</th><th>Catatan</th></tr></thead>`;
            const tb = doc.createElement("tbody");
            HEBAT_ITEMS.forEach((i) =>
              tb.insertAdjacentHTML(
                "beforeend",
                `<tr><td>[${i.code}] ${i.title}</td><td><b>${
                  (rawScores as any)[i.code] ?? ""
                }</b></td><td>${(rawNotes as any)[i.code] || ""}</td></tr>`
              )
            );
            tbl.appendChild(tb);
            wrap.appendChild(tbl);
            appendBlock(wrap);
          }
        }
      } else {
        const ITEMS =
          theme === "kompetensi"
            ? KOMPETENSI_ITEMS
            : theme === "prestasi"
            ? PRESTASI_ITEMS
            : SOP_ITEMS;

        PERSONS.forEach((p) => {
          const payload = readPersonPayload(theme, p);
          const scores = (payload?.scores ?? {}) as Record<string, unknown>;
          const notes = (payload?.notes ?? {}) as Record<string, string>;
          const block = doc.createElement("div");
          block.className = "section page-break-avoid";
          block.innerHTML = `<div class="subhead">${PERSON_LABEL[p]}</div>`;
          const tbl = doc.createElement("table");
          tbl.className = "table striped";
          tbl.innerHTML = `<colgroup><col style="width:50%"><col style="width:14%"><col style="width:36%"></colgroup>
            <thead><tr><th>Aspek</th><th>Skor</th><th>Catatan</th></tr></thead>`;
          const tb = doc.createElement("tbody");
          ITEMS.forEach((i) =>
            tb.insertAdjacentHTML(
              "beforeend",
              `<tr><td>${i.title}</td><td><b>${
                (scores as any)[i.key] ?? ""
              }</b></td><td>${(notes as any)[i.key] || ""}</td></tr>`
            )
          );
          tbl.appendChild(tb);
          block.appendChild(tbl);
          appendBlock(block);
        });
      }
    }

    /* ========= Target & Achievement (UI-aware) ========= */
    {
      const head = doc.createElement("div");
      head.className = "section";
      head.innerHTML = `<div class="title">Target & Achievement</div>`;
      appendBlock(head);

      const rawTarget =
        ((data as any).target ??
          (data as any).targets ??
          (data as any).kpi ??
          (data as any).achievement ??
          (data as any).achievements) ||
        {};

      const pick = (obj: any, keys: string[]) => {
        if (!obj) return undefined;
        for (const k of keys) {
          if (obj[k] !== undefined) return obj[k];
          const alt = Object.keys(obj).find(
            (x) => x.toLowerCase() === k.toLowerCase()
          );
          if (alt) return obj[alt];
        }
        return undefined;
      };
      const toBool = (v: any) =>
        typeof v === "boolean"
          ? v
          : typeof v === "number"
          ? v !== 0
          : typeof v === "string"
          ? ["true", "1", "ya", "yes", "y", "selesai"].includes(
              v.trim().toLowerCase()
            )
          : !!v;
      const toWeeks = (v: any): boolean[] => {
        if (Array.isArray(v)) return clampBools(v.map(toBool), 4);
        if (isRecord(v)) {
          const a = [
            pick(v, ["w1", "1"]),
            pick(v, ["w2", "2"]),
            pick(v, ["w3", "3"]),
            pick(v, ["w4", "4"]),
          ].map(toBool);
          return clampBools(a, 4);
        }
        return [false, false, false, false];
      };
      const fmtDate = (d: any) => {
        if (!d) return "";
        if (typeof d === "string") return d;
        try {
          const x = new Date(d);
          return Number.isNaN(+x) ? String(d) : x.toISOString().slice(0, 10);
        } catch {
          return String(d);
        }
      };

      const klaimSrc =
        pick(rawTarget, ["klaimSelesai"]) ||
        pick(rawTarget, [
          "klaimBulanan",
          "klaim",
          "penyelesaianKlaim",
          "claims",
        ]);
      const laporanSrc =
        pick(rawTarget, ["weekly"]) ||
        pick(rawTarget, [
          "laporanMingguan",
          "laporanPrinsipal",
          "weeklyReports",
        ]);
      const tgtBulananSrc =
        pick(rawTarget, ["targetSelesai"]) ||
        pick(rawTarget, [
          "klaimBulananTarget",
          "targetBulanan",
          "targetSelesaiBulanIni",
        ]);
      const deadlinesSrc = pick(rawTarget, ["deadlines", "deadline", "dues"]);

      const looksLikeUI =
        isRecord(klaimSrc) ||
        isRecord(laporanSrc) ||
        tgtBulananSrc !== undefined ||
        (rawTarget as any)?.target !== undefined ||
        (rawTarget as any)?.deadline !== undefined;

      if (looksLikeUI) {
        // ===== Klaim bulanan (Deadline → Selesai) =====
        const klaimBlock = doc.createElement("div");
        klaimBlock.className = "section page-break-avoid";
        klaimBlock.innerHTML = `<div class="subhead">Penyelesaian Klaim Bulan Ini <span class="muted" style="font-weight:600;font-size:11px">(reset setiap awal bulan)</span></div>`;
        const klaimTable = doc.createElement("table");
        klaimTable.className = "table striped";
        klaimTable.innerHTML = `<thead><tr><th>Jenis</th><th style="width:30%">Deadline</th><th style="width:18%">Selesai</th></tr></thead>`;
        const kbody = doc.createElement("tbody");
        (["FRI", "SPJ", "APA", "WPL"] as const).forEach((p) => {
          const row =
            (klaimSrc && (klaimSrc[p] ?? (klaimSrc as any)[p.toLowerCase()])) ??
            {};
          const selesai = toBool(
            isRecord(row)
              ? (["selesai", "done", "value", "checked"] as const)
                  .map((k) => (row as any)[k])
                  .find((v) => v !== undefined)
              : row
          );
          const rowDeadline =
            (isRecord(row) &&
              (["deadline", "due", "tanggal"] as const)
                .map((k) => (row as any)[k])
                .find((v) => v !== undefined)) ||
            (isRecord(deadlinesSrc) &&
              isRecord((deadlinesSrc as any).klaim) &&
              ((deadlinesSrc as any).klaim[p] ??
                (deadlinesSrc as any).klaim[p.toLowerCase()])) ||
            (isRecord(deadlinesSrc) && (deadlinesSrc as any).klaim);
          const deadline = fmtDate(rowDeadline);
          kbody.insertAdjacentHTML(
            "beforeend",
            `<tr><td>${p}</td><td>${escapeHtml(
              deadline
            )}</td><td><span class="cbx ${
              selesai ? "on" : ""
            }"></span> <span class="muted" style="font-weight:600;font-size:11px">Selesai</span></td></tr>`
          );
        });
        klaimTable.appendChild(kbody);
        klaimBlock.appendChild(klaimTable);
        appendBlock(klaimBlock);

        // Target selesai (tetap)
        const targetCount =
          (isRecord(tgtBulananSrc)
            ? (["targetCount", "jumlah", "count", "value"] as const)
                .map((k) => (tgtBulananSrc as any)[k])
                .find((v) => v !== undefined)
            : tgtBulananSrc) ??
          (rawTarget as any)?.target ??
          "";
        const targetDeadline = fmtDate(
          (isRecord(tgtBulananSrc) &&
            (["deadline", "due"] as const)
              .map((k) => (tgtBulananSrc as any)[k])
              .find((v) => v !== undefined)) ||
            (isRecord(deadlinesSrc) && (deadlinesSrc as any).targetSelesai) ||
            (rawTarget as any)?.deadline
        );
        const targetTblWrap = doc.createElement("div");
        targetTblWrap.className = "section page-break-avoid";
        const targetTbl = doc.createElement("table");
        targetTbl.className = "table";
        targetTbl.innerHTML = `<colgroup><col style="width:40%"><col style="width:60%"></colgroup>
          <tbody><tr><th>Target Selesai (bulan ini)</th><td>${escapeHtml(
            String(targetCount ?? "")
          )} <span class="muted" style="font-size:11px">mis. 10</span></td></tr>
                 <tr><th>Deadline</th><td>${escapeHtml(
                   targetDeadline
                 )}</td></tr></tbody>`;
        targetTblWrap.appendChild(targetTbl);
        appendBlock(targetTblWrap);

        // ===== Laporan mingguan =====
        const reportBlock = doc.createElement("div");
        reportBlock.className = "section page-break-avoid";
        reportBlock.innerHTML = `<div class="subhead">Laporan Penjualan ke Prinsipal Mingguan</div>`;
        const repTbl = doc.createElement("table");
        repTbl.className = "table striped";
        repTbl.innerHTML = `<thead><tr><th>Prinsipal</th><th>Minggu 1</th><th>Minggu 2</th><th>Minggu 3</th><th>Minggu 4</th></tr></thead>`;
        const rbody = doc.createElement("tbody");
        (["FRI", "SPJ", "APA", "WPL"] as const).forEach((p) => {
          const row =
            (laporanSrc &&
              (laporanSrc[p] ?? (laporanSrc as any)[p.toLowerCase()])) ??
            {};
          const weeks = toWeeks(row);
          rbody.insertAdjacentHTML(
            "beforeend",
            `<tr><td>${p}</td>${weeks
              .map((w) => `<td><span class="cbx ${w ? "on" : ""}"></span></td>`)
              .join("")}</tr>`
          );
        });
        repTbl.appendChild(rbody);
        reportBlock.appendChild(repTbl);
        appendBlock(reportBlock);
      } else {
        // ---- Fallback generic
        const tv = extractTarget(rawTarget);

        const valueToHTML = (v: unknown): string => {
          if (v == null || v === "") return "";
          if (typeof v === "boolean") return v ? "Ya" : "–";
          if (typeof v === "number") return String(v);
          if (typeof v === "string") return escapeHtml(v);
          if (Array.isArray(v)) {
            if (isBoolArray(v)) {
              const t = v.filter(Boolean).length;
              return `${t}/${v.length} ✓`;
            }
            return escapeHtml(
              v
                .map((x) =>
                  isPrimitive(x)
                    ? String(x)
                    : isRecord(x)
                    ? JSON.stringify(x)
                    : String(x)
                )
                .join(", ")
            );
          }
          if (isRecord(v)) {
            const rows = Object.entries(v)
              .map(([k, val]) => {
                if (isBoolArray(val)) {
                  const t = val.filter(Boolean).length;
                  return `<li>${escapeHtml(k)}: ${t}/${val.length} ✓</li>`;
                }
                if (typeof val === "boolean")
                  return `<li>${escapeHtml(k)}: ${val ? "✓" : "–"}</li>`;
                return `<li>${escapeHtml(k)}: ${escapeHtml(
                  isPrimitive(val) ? String(val) : JSON.stringify(val)
                )}</li>`;
              })
              .join("");
            return `<ul class="ul-kv">${rows}</ul>`;
          }
          return escapeHtml(String(v));
        };

        if (tv.type === "empty") {
          const tblWrap = doc.createElement("div");
          tblWrap.className = "section page-break-avoid";
          const tbl = doc.createElement("table");
          tbl.className = "table striped";
          tbl.innerHTML = `<thead><tr><th>Field</th><th>Nilai</th><th>Status</th></tr></thead><tbody><tr><td></td><td></td><td>${labelStatusChip(
            false
          )}</td></tr></tbody>`;
          tblWrap.appendChild(tbl);
          appendBlock(tblWrap);
        } else if (tv.type === "kpi") {
          const tblWrap = doc.createElement("div");
          tblWrap.className = "section page-break-avoid";
          const tbl = doc.createElement("table");
          tbl.className = "table striped";
          tbl.innerHTML = `<thead><tr><th>KPI</th><th>Target</th><th>Realisasi</th><th>%</th><th>Catatan</th><th>Status</th></tr></thead>`;
          const tb = doc.createElement("tbody");
          tv.rows.forEach((r) => {
            const filled =
              hasAnyTruthy(r["target"]) ||
              hasAnyTruthy(r["plan"]) ||
              hasAnyTruthy(
                r["actual"] ?? r["real"] ?? r["realisasi"] ?? r["achieved"]
              ) ||
              hasAnyTruthy(r["percent"] ?? r["persen"] ?? r["achievement"]) ||
              hasAnyTruthy(r["notes"] ?? r["catatan"]);
            tb.insertAdjacentHTML(
              "beforeend",
              `<tr><td>${escapeHtml(
                String(r["title"] ?? r["name"] ?? r["kpi"] ?? "")
              )}</td>
                   <td>${valueToHTML(r["target"] ?? r["plan"])}</td>
                   <td>${valueToHTML(
                     r["actual"] ?? r["real"] ?? r["realisasi"] ?? r["achieved"]
                   )}</td>
                   <td>${valueToHTML(
                     r["percent"] ?? r["persen"] ?? r["achievement"]
                   )}</td>
                   <td>${escapeHtml(
                     String(r["notes"] ?? r["catatan"] ?? "")
                   )}</td>
                   <td>${labelStatusChip(filled)}</td></tr>`
            );
          });
          tbl.appendChild(tb);
          tblWrap.appendChild(tbl);
          appendBlock(tblWrap);
        } else if (tv.type === "table") {
          const cols = tv.cols;
          const tblWrap = doc.createElement("div");
          tblWrap.className = "section page-break-avoid";
          const tbl = doc.createElement("table");
          tbl.className = "table striped";
          const thead = doc.createElement("thead");
          thead.innerHTML = `<tr>${cols
            .map((c) => `<th>${c}</th>`)
            .join("")}<th>Status</th></tr>`;
          tbl.appendChild(thead);
          const tb = doc.createElement("tbody");
          tv.rows.forEach((row) => {
            const filled = hasAnyTruthy(row);
            tb.insertAdjacentHTML(
              "beforeend",
              `<tr>${cols
                .map((c) => `<td>${valueToHTML((row as any)[c])}</td>`)
                .join("")}<td>${labelStatusChip(filled)}</td></tr>`
            );
          });
          tbl.appendChild(tb);
          tblWrap.appendChild(tbl);
          appendBlock(tblWrap);
        } else if (tv.type === "kv") {
          const kv = tv.kv;
          const tblWrap = doc.createElement("div");
          tblWrap.className = "section page-break-avoid";
          const tbl = doc.createElement("table");
          tbl.className = "table striped";
          tbl.innerHTML = `<colgroup><col style="width:35%"><col style="width:45%"><col style="width:20%"></colgroup>
            <thead><tr><th>Field</th><th>Nilai</th><th>Status</th></tr></thead>`;
          const tb = doc.createElement("tbody");
          const entries = Object.entries(kv);
          if (entries.length === 0) {
            tb.insertAdjacentHTML(
              "beforeend",
              `<tr><td></td><td></td><td>${labelStatusChip(false)}</td></tr>`
            );
          } else
            entries.forEach(([k, v]) => {
              const filled = hasAnyTruthy(v);
              tb.insertAdjacentHTML(
                "beforeend",
                `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(
                  isPrimitive(v) ? String(v) : JSON.stringify(v)
                )}</td><td>${labelStatusChip(filled)}</td></tr>`
              );
            });
          tbl.appendChild(tb);
          tblWrap.appendChild(tbl);
          appendBlock(tblWrap);
        }
      }
    }

    /* ========= Project Tracking ========= */
    {
      const head = doc.createElement("div");
      head.className = "section";
      head.innerHTML = `<div class="title">Project Tracking (SPARTA)</div>`;
      appendBlock(head);

      const projectList = extractProjectsFromSparta(
        (data as any).sparta,
        (user as AnyUser | undefined)?.role
      );

      const renderCard = (
        p: {
          name: string;
          ownerRole: string;
          deadline: string;
          daysLeft: number | null;
          steps: Array<{ label: string; done?: boolean }>;
          percent: number;
          nextAction?: string;
          kendala?: string;
        },
        idx: number
      ) => {
        const card = doc.createElement("div");
        card.className = "pro-card page-break-avoid";
        let chip = "";
        if (p.daysLeft !== null && p.deadline) {
          const cls = p.daysLeft < 0 ? "over" : p.daysLeft <= 3 ? "due" : "ok";
          const text =
            p.daysLeft < 0
              ? `Lewat ${Math.abs(p.daysLeft)} hari`
              : `Kurang ${p.daysLeft} hari`;
          chip = `<span class="chip ${cls}">${text}</span>`;
        } else if (p.deadline) chip = `<span class="chip">${p.deadline}</span>`;
        card.insertAdjacentHTML(
          "beforeend",
          `<div class="pro-head"><div class="pro-title">${idx + 1}. ${
            p.name || ""
          }</div><div>${chip}</div></div>`
        );
        const grid = doc.createElement("div");
        grid.className = "grid";
        const left = doc.createElement("div");
        left.innerHTML = `
          <table class="table" style="border-radius:12px;overflow:hidden"><tbody>
            <tr><th style="width:30%">Owner/Role</th><td>${
              p.ownerRole || ""
            }</td></tr>
            <tr><th>Deadline</th><td>${p.deadline || ""}</td></tr>
            <tr><th>Progress</th><td>
              <div class="progress"><div style="width:${Math.max(
                0,
                Math.min(100, p.percent || 0)
              )}%"></div></div>
              <div class="muted" style="margin-top:4px;font-weight:700">${
                p.percent ?? 0
              }%</div>
            </td></tr>
            <tr><th>Next Action</th><td>${p.nextAction || ""}</td></tr>
            <tr><th>Kendala</th><td>${p.kendala || ""}</td></tr>
          </tbody></table>`;
        const right = doc.createElement("div");
        const box = doc.createElement("div");
        box.className = "steps-panel";
        box.innerHTML = `<div class="subhead" style="margin:0 0 6px">Langkah</div>`;
        const steps =
          p.steps && p.steps.length ? p.steps : [{ label: "" }, { label: "" }];
        const ul = doc.createElement("ul");
        ul.className = "chk";
        steps.forEach((s) =>
          ul.insertAdjacentHTML(
            "beforeend",
            `<li class="step ${
              s.done ? "done" : ""
            }"><span class="icon"></span><span class="label">${
              s.label || ""
            }</span></li>`
          )
        );
        box.appendChild(ul);
        right.appendChild(box);
        grid.appendChild(left);
        grid.appendChild(right);
        card.appendChild(grid);
        return card;
      };

      if (!projectList.length) {
        const wrap = doc.createElement("div");
        wrap.className = "section";
        wrap.appendChild(
          renderCard(
            {
              name: "",
              ownerRole: "",
              deadline: "",
              daysLeft: null,
              percent: 0,
              steps: [{ label: "" }],
            },
            0
          )
        );
        appendBlock(wrap);
      } else {
        projectList.forEach((p, idx) => {
          const wrap = doc.createElement("div");
          wrap.className = "section";
          wrap.appendChild(renderCard(p, idx));
          appendBlock(wrap);
        });
      }
    }

    /* ========= Agenda ========= */
    {
      const head = doc.createElement("div");
      head.className = "section";
      head.innerHTML = `<div class="title">Agenda & Jadwal</div>`;
      appendBlock(head);

      const agenda = (((data as unknown as AppLike).agenda?.entries ?? []) ||
        []) as AppLike["agenda"]["entries"];
      if (agenda.length) {
        const sorted = [...agenda].sort((a, b) =>
          a.date === b.date
            ? a.updatedAt && b.updatedAt
              ? a.updatedAt < b.updatedAt
                ? 1
                : -1
              : 0
            : a.date < b.date
            ? 1
            : -1
        );
        type AgendaEntry = NonNullable<AppLike["agenda"]>["entries"][number];
        const groups: Record<string, AgendaEntry[]> = {};
        for (const e of sorted as AgendaEntry[])
          (groups[e.date] ||= []).push(e);

        Object.entries(groups).forEach(([tgl, items]) => {
          const block = doc.createElement("div");
          block.className = "section page-break-avoid";
          block.innerHTML = `<div class="subhead">${tgl}</div>`;
          items.forEach((e, i) => {
            const tbl = doc.createElement("table");
            tbl.className = "table striped";
            const planHtml = (e.plan ?? [])
              .map((x) => `<li>${escapeHtml(x)}</li>`)
              .join("");
            const realHtml = (e.realisasi ?? [])
              .map((x) => `<li>${escapeHtml(x)}</li>`)
              .join("");
            tbl.innerHTML = `<colgroup><col style="width:20%"><col style="width:80%"></colgroup>
              <tbody>
                <tr><th>Plan ${i + 1}</th><td>${
              planHtml ? `<ul class="ul-kv">${planHtml}</ul>` : ""
            }</td></tr>
                <tr><th>Realisasi ${i + 1}</th><td>${
              realHtml ? `<ul class="ul-kv">${realHtml}</ul>` : ""
            }</td></tr>
                <tr><th>Status</th><td><span class="pill">${
                  e.planSubmitted ? "Plan terkunci" : "Plan draft"
                }</span>&nbsp;<span class="pill">${
              e.realSubmitted ? "Realisasi terkunci" : "Realisasi draft"
            }</span></td></tr>
              </tbody>`;
            block.appendChild(tbl);
          });
          appendBlock(block);
        });
      }
    }

    // ========= Tanda Tangan =========
    {
      const sigWrap = doc.createElement("div");
      sigWrap.className = "section sigwrap page-break-inside-avoid";
      const sigTitle = doc.createElement("div");
      sigTitle.className = "title sigtitle";
      sigTitle.textContent = "Tanda Tangan";
      const sigRow = doc.createElement("div");
      sigRow.className = "sigrow";
      const sigBox = doc.createElement("div");
      sigBox.className = "sigbox";
      if (sigDataUrl) {
        const img = doc.createElement("img");
        img.src = sigDataUrl;
        sigBox.appendChild(img);
      } else sigBox.appendChild(doc.createTextNode(" "));
      const line = doc.createElement("div");
      line.className = "sigline";
      sigBox.appendChild(line);
      sigRow.appendChild(sigBox);
      sigWrap.appendChild(sigTitle);
      sigWrap.appendChild(sigRow);
      const foot = doc.createElement("div");
      foot.className = "foot";
      foot.textContent = `Ditandatangani oleh ${
        (user as AnyUser | undefined)?.name || ""
      } (${
        (user as AnyUser | undefined)?.role || ""
      }) • ${new Date().toLocaleString()}`;
      sigWrap.appendChild(foot);
      appendBlock(sigWrap);
    }

    return root;
  };

  /* -------- Export PDF + Upload -------- */
  const submitAndGenerate = async () => {
    if (!sigDataUrl) {
      alert("Mohon tanda tangan terlebih dahulu.");
      return;
    }
    setWorking(true);
    try {
      const { html2canvas, jsPDF } = await loadPdfLibs();
      const { doc: isoDoc, cleanup } = createIsolatedIframe();
      buildPrintLayout(isoDoc);

      const pages = Array.from(isoDoc.querySelectorAll<HTMLElement>(".page"));
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < pages.length; i++) {
        const el = pages[i];
        const canvas: HTMLCanvasElement = await html2canvas(el, {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
          allowTaint: true,
          foreignObjectRendering: false,
          width: el.scrollWidth,
          height: el.scrollHeight,
          windowWidth: el.scrollWidth,
          windowHeight: el.scrollHeight,
        });
        const imgData = canvas.toDataURL("image/jpeg", 0.92);
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, 0, pageW, pageH, undefined, "FAST");
      }

      cleanup();

      const date = todayISO();
      const filename = `${date}.pdf`;

      try {
        const arrayBuffer = pdf.output("arraybuffer") as ArrayBuffer;
        const u = (user ?? {}) as AnyUser;
        const userId = u.id || u.email || u.name || "unknown";
        const role = u.role || "admin";
        const res = await fetch(
          `/api/lampiran/upload?userId=${encodeURIComponent(
            userId
          )}&role=${encodeURIComponent(role)}&date=${encodeURIComponent(
            date
          )}` as string,
          {
            method: "POST",
            headers: { "content-type": "application/pdf" },
            body: arrayBuffer,
          }
        );
        if (res.ok) await refreshRiwayatFromSupabase();
      } catch (e) {
        console.warn("Upload error:", e);
      }

      const pdfDataUrl = pdf.output("datauristring") as string;
      const entry: PdfEntry = {
        id: uuid(),
        filename,
        dateISO: date,
        submittedAt: new Date().toISOString(),
        name: (user as AnyUser | undefined)?.name || "-",
        role: (user as AnyUser | undefined)?.role || "-",
        pdfDataUrl,
        storage: "local",
      };
      const next = mergeHistoryLists([entry], history, loadHistory());
      setHistory(next);
      saveHistory(next);
      pdf.save(filename);
    } catch (e) {
      console.error("PDF error:", e);
      alert((e as Error)?.message || String(e));
    } finally {
      setWorking(false);
    }
  };

  // Hapus riwayat
  const removeEntry = async (id: string) => {
    const entry = history.find((h) => h.id === id);
    if (!entry) return;
    const yes = confirm(
      entry.storage === "remote"
        ? "Hapus file dari cloud (Supabase) dan daftar riwayat?"
        : "Hapus item dari riwayat lokal (browser)?"
    );
    if (!yes) return;
    try {
      if (entry.storage === "remote" && entry.key) {
        const res = await fetch(
          `/api/lampiran/delete?key=${encodeURIComponent(entry.key)}`,
          { method: "POST" }
        );
        if (!res.ok) {
          const msg = await res.json().catch(() => ({} as { error?: string }));
          alert(`Gagal hapus cloud: ${msg.error || res.statusText}`);
        } else {
          const cur = loadHistory();
          const pruned = cur.filter(
            (e) => !(e.storage === "remote" && e.key === entry.key)
          );
          saveHistory(pruned);
        }
        await refreshRiwayatFromSupabase(searchDate || undefined);
      } else {
        const next = history.filter((h) => h.id !== id);
        setHistory(next);
        saveHistory(next);
      }
    } catch (e) {
      console.error(e);
      alert("Terjadi kesalahan saat menghapus.");
    }
  };

  return (
    <div className="space-y-6">
      <div
        ref={printRef}
        style={{
          position: "fixed",
          left: -99999,
          top: -99999,
          width: 794,
          pointerEvents: "none",
          zIndex: -1,
        }}
      />
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-3 sm:px-6 py-4 border-b bg-slate-50 flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-slate-800">Lampiran</h3>
        </div>

        <div className="p-3 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="rounded-xl border p-4">
              <div className="text-sm text-slate-600">
                PDF berisi Identitas, Rangkuman Checklist,{" "}
                <b>Evaluasi (tema: {themeLabel})</b>, Target & Achievement,
                Project Tracking (SPARTA), dan Agenda & Jadwal.
              </div>
              <div className="mt-3 text-xs text-slate-500">
                *Auto pagination: tidak kepotong, tidak mengecil.
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="space-y-4">
              <SignaturePad onChange={setSigDataUrl} />
              <button
                type="button"
                onClick={submitAndGenerate}
                disabled={working}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2.5 font-medium hover:bg-blue-700 disabled:opacity-60"
                title="Submit inputan dan buat PDF"
              >
                <FileText className="h-5 w-5" />
                {working ? "Memproses..." : "Submit & Generate PDF"}
              </button>
              <div className="text-xs text-slate-500">
                File PDF tersimpan di riwayat (nama{" "}
                <span className="font-mono">YYYY-MM-DD.pdf</span>).
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Riwayat */}
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-3 sm:px-6 py-4 border-b bg-slate-50 flex items-center justify-between gap-3">
          <div className="font-semibold text-slate-800">Riwayat PDF</div>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="date"
              value={searchDate}
              onChange={(e) => setSearchDate(e.target.value)}
              className="rounded-lg border-slate-300 text-sm"
            />
            {searchDate && (
              <button
                onClick={() => setSearchDate("")}
                className="text-xs px-2 py-1 rounded-md border hover:bg-slate-50"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="p-3 sm:p-6">
          {filtered.length === 0 ? (
            <div className="text-sm text-slate-600">
              Belum ada riwayat atau tidak ada hasil untuk tanggal tersebut.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left py-2 px-2">Tanggal</th>
                    <th className="text-left py-2 px-2">Nama</th>
                    <th className="text-left py-2 px-2">Role</th>
                    <th className="text-left py-2 px-2">File</th>
                    <th className="text-left py-2 px-2">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((h) => (
                    <tr key={h.id}>
                      <td className="py-2 px-2 font-medium text-slate-800">
                        {h.dateISO}
                      </td>
                      <td className="py-2 px-2">{h.name}</td>
                      <td className="py-2 px-2">{h.role}</td>
                      <td className="py-2 px-2">
                        <a
                          href={h.pdfDataUrl}
                          download={h.filename}
                          target={h.storage === "remote" ? "_blank" : undefined}
                          className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                        >
                          <Download className="h-4 w-4" /> {h.filename}
                          {h.storage === "remote" ? " (cloud)" : ""}
                        </a>
                      </td>
                      <td className="py-2 px-2">
                        <button
                          onClick={() => removeEntry(h.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50"
                          title={
                            h.storage === "remote"
                              ? "Hapus dari cloud"
                              : "Hapus dari riwayat (localStorage)"
                          }
                        >
                          <Trash2 className="h-4 w-4" /> Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
