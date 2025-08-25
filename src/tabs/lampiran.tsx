/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  pdfDataUrl: string; // data:URL (local) atau http(s) (cloud)
  storage?: "local" | "remote";
  key?: string;
};

/** Helper longgar untuk akses id/email/name/role tanpa error tipe */
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
function loadHistory(): PdfEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as unknown as PdfEntry[]) : [];
  } catch {
    return [];
  }
}
function saveHistory(items: PdfEntry[]) {
  localStorage.setItem(STORE_KEY, JSON.stringify(items));
}

/* =========================
   Loader aman untuk html2canvas & jsPDF (ESM)
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
   Signature Pad (fixed)
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
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    drawingRef.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    e.preventDefault();
  };
  const move = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
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
      if (v.kind === "options") value = String(v.value ?? "");
      else if (v.kind === "number")
        value = [v.value ?? "", v.suffix ?? ""].filter(Boolean).join(" ");
      else if (v.kind === "score") value = String(v.value ?? "");
      else if (v.kind === "compound") {
        value = [
          v.value ?? "",
          v.extras?.text ? `(${v.extras.text})` : "",
          v.extras?.currency ? `Rp ${v.extras.currency}` : "",
        ]
          .filter(Boolean)
          .join(" ");
      }
      lineItems.push({ label: key.replace(/[-_]/g, " "), value, note: v.note });
    }
    if (lineItems.length === 0) {
      lineItems.push({ label: "", value: "", note: "" });
    }
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
   Helpers (type-safe)
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

/* =========================
   Evaluasi types + helpers
   ========================= */
type ScoreValue = string | number;
type PersonEval = {
  scores?: Record<string, ScoreValue>;
  notes?: Record<string, string>;
};
type PersonSection = Partial<Record<Person, PersonEval>> & {
  byPerson?: Partial<Record<Person, PersonEval>>;
};

type Evaluasi = {
  hari?: 1 | 2 | 3 | 4 | 5 | 6;
  attitude?: {
    hari?: 1 | 2 | 3 | 4 | 5 | 6;
    scores?: Record<string, ScoreValue>;
    notes?: Record<string, string>;
  };
  kompetensi?: PersonSection;
  prestasi?: PersonSection;
  kepatuhan?: PersonSection;
};

function getTheme(evaluasi: Evaluasi): Theme {
  const hari =
    evaluasi.attitude?.hari ??
    (evaluasi as { hari?: 1 | 2 | 3 | 4 | 5 | 6 }).hari ??
    1;
  return DAY_THEME[hari as 1 | 2 | 3 | 4 | 5 | 6] ?? "attitude";
}

function getByPerson(
  evaluasi: Evaluasi,
  kind: "kompetensi" | "prestasi" | "kepatuhan",
  person: Person
): PersonEval {
  const sec = evaluasi[kind];
  if (!sec) return {};
  const by =
    (sec.byPerson as Partial<Record<Person, PersonEval>> | undefined) ??
    (sec as Partial<Record<Person, PersonEval>>);
  return (by?.[person] ?? {}) as PersonEval;
}

/* =========================
   SPARTA: Catalog v3 + progress per-user
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
    if (raw) {
      const arr = JSON.parse(raw) as unknown as Array<
        Partial<SpartaCatalogItem>
      >;
      return arr.map((p) => ({
        targetRole: "admin",
        steps: [],
        deadline: "",
        id: "",
        title: "",
        ...p,
      })) as SpartaCatalogItem[];
    }
    const rawV2 = localStorage.getItem("sitrep-sparta-catalog-v2");
    if (rawV2) {
      const arr = JSON.parse(rawV2) as unknown as Array<
        Partial<SpartaCatalogItem>
      >;
      return arr.map((p) => ({
        targetRole: (p.targetRole ?? "admin") as "admin" | "sales" | "gudang",
        steps: [],
        deadline: "",
        id: "",
        title: "",
        ...p,
      })) as SpartaCatalogItem[];
    }
    const rawV1 = localStorage.getItem("sitrep-sparta-catalog-v1");
    if (rawV1) {
      const arr = JSON.parse(rawV1) as unknown as Array<
        Omit<SpartaCatalogItem, "targetRole">
      >;
      return arr.map((p) => ({
        ...p,
        targetRole: "admin",
      })) as SpartaCatalogItem[];
    }
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
      progressText: prog.progressText || "",
      nextAction: prog.nextAction || "",
      kendala: prog.kendala || "",
    };
  });
}

/* =========================
   Target & Achievement – extractor
   ========================= */
type TargetView =
  | { type: "empty" }
  | { type: "kpi"; rows: Array<Record<string, unknown>> }
  | { type: "table"; cols: string[]; rows: Array<Record<string, unknown>> }
  | { type: "kv"; kv: Record<string, unknown> };

function extractTarget(target: unknown): TargetView {
  if (!target || !isRecord(target)) return { type: "empty" };

  const list =
    (target as Record<string, unknown>)["goals"] ??
    (target as Record<string, unknown>)["items"] ??
    (target as Record<string, unknown>)["rows"] ??
    (target as Record<string, unknown>)["list"];

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

  if (Object.keys(target).length) {
    return { type: "kv", kv: target as Record<string, unknown> };
  }

  return { type: "empty" };
}

/* =========================
   Komponen Utama
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

  // tidak lagi dipakai untuk render (kita pakai iframe), tapi biarkan ada
  const printRef = useRef<HTMLDivElement | null>(null);

  // Ambil dari Supabase; kalau gagal, fallback local
  useEffect(() => {
    (async () => {
      const ok = await refreshRiwayatFromSupabase();
      if (!ok) setHistory(loadHistory());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(
    () =>
      searchDate ? history.filter((h) => h.dateISO === searchDate) : history,
    [history, searchDate]
  );

  const checklistBlocks = useMemo(
    () => renderChecklist((data as AppLike).checklist as ChecklistState),
    [data]
  );

  // Evaluasi
  const theme = getTheme((data as unknown as AppLike).evaluasi ?? {});
  const evalData = ((data as unknown as AppLike).evaluasi ?? {}) as Evaluasi;

  // Project & Target
  const projectList = useMemo(
    () =>
      extractProjectsFromSparta(
        (data as unknown as AppLike).sparta,
        (user as AnyUser | undefined)?.role
      ),
    [data, (user as AnyUser | undefined)?.role]
  );
  const targetView = useMemo(
    () => extractTarget((data as unknown as AppLike).target),
    [data]
  );

  // ------- Helper: refresh riwayat dari API list -------
  async function refreshRiwayatFromSupabase() {
    try {
      const u = (user ?? {}) as AnyUser;
      const userId = u.id || u.email || u.name || "unknown";
      const role = u.role || "admin";

      const res = await fetch(
        `/api/lampiran/list?userId=${encodeURIComponent(
          userId
        )}&role=${encodeURIComponent(role)}`
      );
      if (!res.ok) return false;
      const json = (await res.json()) as {
        items: Array<{
          filename: string;
          dateISO: string;
          url: string;
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
        pdfDataUrl: it.url,
        storage: "remote",
        key: it.key,
      }));
      setHistory(mapped);
      return true;
    } catch {
      return false;
    }
  }

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

    // Hard reset & base style (tanpa oklch)
    const base = doc.createElement("style");
    base.textContent = `
      *,*::before,*::after{box-sizing:border-box}
      html,body{margin:0;padding:0;background:#fff;color:#0f172a}
      body{font-family:Inter, Arial, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size:12px;line-height:1.5}
    `;
    doc.head.appendChild(base);

    // return util
    return {
      doc,
      iframe,
      cleanup: () => iframe.remove(),
    };
  }

  // now build layout but in a specific Document
  const buildPrintLayout = (doc: Document) => {
    const root = doc.createElement("div");
    root.id = "pdf-print-root";
    // keep things explicit — no inheritance from app
    (root.style as any).all = "initial";
    root.style.display = "block";
    root.style.width = "794px";
    root.style.background = "#fff";
    root.style.color = "#0f172a";
    root.style.fontFamily =
      'Inter, Arial, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    root.style.fontSize = "12px";
    root.style.lineHeight = "1.5";

    const st = doc.createElement("style");
    st.textContent = `
      .page{width:794px;min-height:1123px;box-sizing:border-box;padding:24px;}
      .section{margin-top:18px;}
      .title{font-weight:800;color:#0f172a;margin-bottom:10px;letter-spacing:.2px;}
      .muted{color:#64748b;}
      .banner{background:#dbeafe;color:#1e3a8a;padding:14px 16px;border-radius:14px;}
      .info-grid{display:flex;gap:12px;margin-top:12px;}
      .card{border:1px solid #e6e8f0;border-radius:12px;padding:10px 12px;flex:1;background:#fff;}
      .card .label{color:#6b7280;font-size:12px;}
      .table{width:100%;border-collapse:separate;border-spacing:0;}
      .table th,.table td{border:1px solid #e9edf3;padding:7px 9px;vertical-align:top;}
      .table th{background:#f8fafc;color:#475569;text-align:left;font-weight:700;}
      .table.striped tbody tr:nth-child(even){background:#fbfdff;}
      .subhead{font-weight:700;margin:6px 0 8px;color:#0f172a;}
      .mb8{margin-bottom:8px;}
      .pill{display:inline-block;padding:2px 8px;border-radius:999px;background:#eef2ff;color:#3730a3;font-size:11px;font-weight:700;}
      .chip{display:inline-flex;align-items:center;justify-content:center;height:22px;padding:0 10px;border-radius:999px;border:1px solid #e5e7eb;background:#fff;font-size:11px;font-weight:700;line-height:1;}
      .chip.ok{background:#ecfdf5;border-color:#86efac;color:#065f46;}
      .chip.warn{background:#fffbeb;border-color:#fde68a;color:#92400e;}
      .chip.over{background:#fef2f2;border-color:#fca5a5;color:#7f1d1d;}
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
      .pro-title{font-weight:800;color:#0f172a;}
      .steps-panel{border:1px solid #eef2f7;border-radius:12px;background:#fcfdff;padding:10px 12px;}
      .progress{height:10px;background:#eff3fb;border-radius:999px;overflow:hidden}
      .progress>div{height:100%;background:#2563eb;transition:width .2s ease}
      .chk{list-style:none;margin:0;padding:0}
      .step{display:flex;gap:8px;align-items:center;margin:6px 0}
      .icon{box-sizing:border-box;display:inline-flex;width:16px;height:16px;border-radius:4px;border:1px solid #cbd5e1;align-items:center;justify-content:center;font-size:11px;line-height:1;color:#94a3b8;background:#fff;}
      .done .icon{background:#10b981;border-color:#10b981;color:#fff}
      .label{line-height:1.35}
      .done .label{text-decoration:line-through;color:#6b7280}
      .kpi th:nth-child(1){width:28%}
      .kpi th:nth-child(2),.kpi th:nth-child(3),.kpi th:nth-child(4){width:16%}
      .kpi th:nth-child(5){width:24%}
      .ul-kv{margin:0;padding-left:18px}
    `;
    root.appendChild(st);

    const page = doc.createElement("div");
    page.className = "page";
    root.appendChild(page);

    const header = doc.createElement("div");
    header.className = "banner";
    header.innerHTML = `
      <div style="font-weight:800;font-size:14px;letter-spacing:.3px;">LEADER MONITORING DAILY</div>
      <div class="muted" style="margin-top:2px;">Laporan Harian</div>
      <div class="muted">Tanggal: ${todayISO()}</div>`;
    page.appendChild(header);

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
    page.appendChild(info);

    const ck = doc.createElement("div");
    ck.className = "section";
    ck.innerHTML = `<div class="title">Rangkuman Checklist</div>`;
    checklistBlocks.forEach((sec) => {
      const secEl = doc.createElement("div");
      secEl.className = "mb8";
      secEl.innerHTML = `<div class="subhead">${sec.section.toUpperCase()}</div>`;
      const tbl = doc.createElement("table");
      tbl.className = "table striped";
      tbl.innerHTML = `<colgroup><col style="width:40%"><col style="width:30%"><col style="width:30%"></colgroup>
        <thead><tr><th>Area</th><th>Status / Nilai</th><th>Catatan</th></tr></thead>`;
      const tb = doc.createElement("tbody");
      sec.rows.forEach((r) => {
        tb.insertAdjacentHTML(
          "beforeend",
          `<tr><td>${r.label || ""}</td><td><b>${r.value || ""}</b></td><td>${
            r.note || ""
          }</td></tr>`
        );
      });
      tbl.appendChild(tb);
      secEl.appendChild(tbl);
      ck.appendChild(secEl);
    });
    page.appendChild(ck);

    const evalSec = doc.createElement("div");
    evalSec.className = "section";
    const titleMap: Record<Theme, string> = {
      attitude: "Evaluasi Tim · Attitude (HEBAT)",
      kompetensi: "Evaluasi Tim · Kompetensi",
      prestasi: "Evaluasi Tim · Prestasi",
      kepatuhan: "Evaluasi Tim · Kepatuhan SOP",
      kosong: "Evaluasi Tim",
    };
    evalSec.innerHTML = `<div class="title">${titleMap[theme]}</div>`;

    if (theme === "attitude") {
      const scores = evalData?.attitude?.scores || {};
      const notes = evalData?.attitude?.notes || {};
      const tbl = doc.createElement("table");
      tbl.className = "table striped";
      tbl.innerHTML = `<colgroup><col style="width:55%"><col style="width:15%"><col style="width:30%"></colgroup>
        <thead><tr><th>Aspek</th><th>Skor</th><th>Catatan</th></tr></thead>`;
      const tb = doc.createElement("tbody");
      HEBAT_ITEMS.forEach((i) => {
        tb.insertAdjacentHTML(
          "beforeend",
          `<tr><td>[${i.code}] ${i.title}</td><td><b>${
            (scores as Record<string, unknown>)[i.code] ?? ""
          }</b></td><td>${
            (notes as Record<string, string | undefined>)[i.code] || ""
          }</td></tr>`
        );
      });
      tbl.appendChild(tb);
      evalSec.appendChild(tbl);
    } else if (theme === "kompetensi") {
      PERSONS.forEach((p) => {
        const d = getByPerson(evalData, "kompetensi", p) || {};
        const scores = d?.scores || {};
        const notes = d?.notes || {};
        const block = doc.createElement("div");
        block.className = "mb8";
        block.innerHTML = `<div class="subhead">${PERSON_LABEL[p]}</div>`;
        const tbl = doc.createElement("table");
        tbl.className = "table striped";
        tbl.innerHTML = `<colgroup><col style="width:55%"><col style="width:15%"><col style="width:30%"></colgroup>
          <thead><tr><th>Aspek</th><th>Skor</th><th>Catatan</th></tr></thead>`;
        const tb = doc.createElement("tbody");
        KOMPETENSI_ITEMS.forEach((i) => {
          tb.insertAdjacentHTML(
            "beforeend",
            `<tr><td>${i.title}</td><td><b>${
              (scores as Record<string, unknown>)[i.key] ?? ""
            }</b></td><td>${
              (notes as Record<string, string | undefined>)[i.key] || ""
            }</td></tr>`
          );
        });
        tbl.appendChild(tb);
        block.appendChild(tbl);
        evalSec.appendChild(block);
      });
    } else if (theme === "prestasi" || theme === "kepatuhan") {
      const ITEMS = theme === "prestasi" ? PRESTASI_ITEMS : SOP_ITEMS;
      PERSONS.forEach((p) => {
        const d = getByPerson(evalData, theme, p) || {};
        const scores = d?.scores || {};
        const notes = d?.notes || {};
        const block = doc.createElement("div");
        block.className = "mb8";
        block.innerHTML = `<div class="subhead">${PERSON_LABEL[p]}</div>`;
        const tbl = doc.createElement("table");
        tbl.className = "table striped";
        tbl.innerHTML = `<colgroup><col style="width:55%"><col style="width:15%"><col style="width:30%"></colgroup>
          <thead><tr><th>Aspek</th><th>Skor</th><th>Catatan</th></tr></thead>`;
        const tb = doc.createElement("tbody");
        ITEMS.forEach((i) => {
          tb.insertAdjacentHTML(
            "beforeend",
            `<tr><td>${i.title}</td><td><b>${
              (scores as Record<string, unknown>)[i.key] ?? ""
            }</b></td><td>${
              (notes as Record<string, string | undefined>)[i.key] || ""
            }</td></tr>`
          );
        });
        tbl.appendChild(tb);
        block.appendChild(tbl);
        evalSec.appendChild(block);
      });
    }
    page.appendChild(evalSec);

    // TARGET & ACHIEVEMENT
    const tgtSec = doc.createElement("div");
    tgtSec.className = "section";
    tgtSec.innerHTML = `<div class="title">Target & Achievement</div>`;

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
        const entries = Object.entries(v);
        const rows = entries
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

    if (targetView.type === "empty") {
      const tbl = doc.createElement("table");
      tbl.className = "table striped kpi";
      tbl.innerHTML = `<thead><tr><th>Field</th><th>Nilai</th><th>Status</th></tr></thead>`;
      tbl.insertAdjacentHTML(
        "beforeend",
        `<tbody><tr><td></td><td></td><td>${labelStatusChip(
          false
        )}</td></tr></tbody>`
      );
      tgtSec.appendChild(tbl);
    } else if (targetView.type === "kpi") {
      const tbl = doc.createElement("table");
      tbl.className = "table striped kpi";
      tbl.innerHTML = `<thead><tr><th>KPI</th><th>Target</th><th>Realisasi</th><th>%</th><th>Catatan</th><th>Status</th></tr></thead>`;
      const tb = doc.createElement("tbody");
      targetView.rows.forEach((r) => {
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
          `<tr>
            <td>${escapeHtml(
              String(r["title"] ?? r["name"] ?? r["kpi"] ?? "")
            )}</td>
            <td>${valueToHTML(r["target"] ?? r["plan"])}</td>
            <td>${valueToHTML(
              r["actual"] ?? r["real"] ?? r["realisasi"] ?? r["achieved"]
            )}</td>
            <td>${valueToHTML(
              r["percent"] ?? r["persen"] ?? r["achievement"]
            )}</td>
            <td>${escapeHtml(String(r["notes"] ?? r["catatan"] ?? ""))}</td>
            <td>${labelStatusChip(filled)}</td>
          </tr>`
        );
      });
      tbl.appendChild(tb);
      tgtSec.appendChild(tbl);
    } else if (targetView.type === "table") {
      const cols = targetView.cols;
      const tbl = doc.createElement("table");
      tbl.className = "table striped";
      const thead = doc.createElement("thead");
      thead.innerHTML = `<tr>${cols
        .map((c) => `<th>${c}</th>`)
        .join("")}<th>Status</th></tr>`;
      tbl.appendChild(thead);
      const tb = doc.createElement("tbody");
      targetView.rows.forEach((row) => {
        const filled = hasAnyTruthy(row);
        tb.insertAdjacentHTML(
          "beforeend",
          `<tr>${cols
            .map((c) => `<td>${valueToHTML(row[c])}</td>`)
            .join("")}<td>${labelStatusChip(filled)}</td></tr>`
        );
      });
      tbl.appendChild(tb);
      tgtSec.appendChild(tbl);
    } else if (targetView.type === "kv") {
      const kv = targetView.kv;
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
      } else {
        entries.forEach(([k, v]) => {
          const filled = hasAnyTruthy(v);
          tb.insertAdjacentHTML(
            "beforeend",
            `<tr><td>${escapeHtml(k)}</td><td>${valueToHTML(
              v
            )}</td><td>${labelStatusChip(filled)}</td></tr>`
          );
        });
      }
      tbl.appendChild(tb);
      tgtSec.appendChild(tbl);
    }
    page.appendChild(tgtSec);

    // PROJECT TRACKING (SPARTA)
    const spSec = doc.createElement("div");
    spSec.className = "section";
    spSec.innerHTML = `<div class="title">Project Tracking (SPARTA)</div>`;
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
      card.className = "pro-card";
      let chip = "";
      if (p.daysLeft !== null && p.deadline) {
        const cls = p.daysLeft < 0 ? "over" : p.daysLeft <= 3 ? "warn" : "ok";
        const text =
          p.daysLeft < 0
            ? `Lewat ${Math.abs(p.daysLeft)} hari`
            : `Kurang ${p.daysLeft} hari`;
        chip = `<span class="chip ${cls}">${text}</span>`;
      } else if (p.deadline) {
        chip = `<span class="chip">${p.deadline}</span>`;
      }
      card.insertAdjacentHTML(
        "beforeend",
        `<div class="pro-head">
           <div class="pro-title">${idx + 1}. ${p.name || ""}</div>
           <div>${chip}</div>
         </div>`
      );
      const grid = doc.createElement("div");
      grid.className = "grid";
      const left = doc.createElement("div");
      left.innerHTML = `
        <table class="table" style="border-radius:12px;overflow:hidden">
          <tbody>
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
          </tbody>
        </table>
      `;
      const right = doc.createElement("div");
      const box = doc.createElement("div");
      box.className = "steps-panel";
      box.innerHTML = `<div class="subhead" style="margin:0 0 6px">Langkah</div>`;
      const steps =
        p.steps && p.steps.length ? p.steps : [{ label: "" }, { label: "" }];
      const ul = doc.createElement("ul");
      ul.className = "chk";
      steps.forEach((s) => {
        ul.insertAdjacentHTML(
          "beforeend",
          `<li class="step ${s.done ? "done" : ""}">
             <span class="icon">${s.done ? "✓" : ""}</span>
             <span class="label">${s.label || ""}</span>
           </li>`
        );
      });
      box.appendChild(ul);
      right.appendChild(box);
      grid.appendChild(left);
      grid.appendChild(right);
      card.appendChild(grid);
      return card;
    };
    if (!projectList.length) {
      spSec.appendChild(
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
    } else {
      projectList.forEach((p, idx) => spSec.appendChild(renderCard(p, idx)));
    }
    page.appendChild(spSec);

    // AGENDA & JADWAL
    const agSec = doc.createElement("div");
    agSec.className = "section";
    agSec.innerHTML = `<div class="title">Agenda & Jadwal</div>`;

    const agenda = ((data as unknown as AppLike).agenda?.entries ??
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
      for (const e of sorted as AgendaEntry[]) {
        (groups[e.date] ||= []).push(e);
      }

      Object.entries(groups).forEach(([tgl, items]) => {
        const block = doc.createElement("div");
        block.className = "mb8";
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
          <tr><th>Status</th><td>
            <span class="pill">${
              e.planSubmitted ? "Plan terkunci" : "Plan draft"
            }</span>
            &nbsp;
            <span class="pill">${
              e.realSubmitted ? "Realisasi terkunci" : "Realisasi draft"
            }</span>
          </td></tr>
        </tbody>`;
          block.appendChild(tbl);
        });

        agSec.appendChild(block);
      });
    }
    page.appendChild(agSec);

    // TTD
    const sigWrap = doc.createElement("div");
    sigWrap.className = "section sigwrap";
    const sigTitle = doc.createElement("div");
    sigTitle.className = "title sigtitle";
    sigTitle.textContent = "Tanda Tangan";
    sigWrap.appendChild(sigTitle);
    const sigRow = doc.createElement("div");
    sigRow.className = "sigrow";
    const sigBox = doc.createElement("div");
    sigBox.className = "sigbox";
    if (sigDataUrl) {
      const img = doc.createElement("img");
      img.src = sigDataUrl;
      sigBox.appendChild(img);
    } else {
      sigBox.appendChild(doc.createTextNode(" "));
    }
    const line = doc.createElement("div");
    line.className = "sigline";
    sigBox.appendChild(line);
    sigRow.appendChild(sigBox);
    sigWrap.appendChild(sigRow);
    const foot = doc.createElement("div");
    foot.className = "foot";
    foot.textContent = `Ditandatangani oleh ${
      (user as AnyUser | undefined)?.name || ""
    } (${
      (user as AnyUser | undefined)?.role || ""
    }) • ${new Date().toLocaleString()}`;
    sigWrap.appendChild(foot);
    page.appendChild(sigWrap);

    doc.body.appendChild(root);
    return root;
  };

  /* -------- Export PDF + Upload ke Supabase (ISOLATED IFRAME) -------- */
  const submitAndGenerate = async () => {
    if (!sigDataUrl) {
      alert("Mohon tanda tangan terlebih dahulu.");
      return;
    }
    setWorking(true);
    try {
      const { html2canvas, jsPDF } = await loadPdfLibs();

      // 1) buat iframe isolasi
      const { doc: isoDoc, cleanup } = createIsolatedIframe();

      // 2) build layout di dokumen isolasi
      const root = buildPrintLayout(isoDoc);

      // 3) tunggu satu frame supaya layout settle
      await new Promise((r) => setTimeout(r, 30));

      // 4) ukur dimensi
      const width = Math.ceil(root.scrollWidth || 794);
      const height = Math.ceil(root.scrollHeight || 1123);

      // 5) render ke canvas (di konteks iframe)
      const canvas: HTMLCanvasElement = await html2canvas(root, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        allowTaint: true,
        foreignObjectRendering: false,
        width,
        height,
        windowWidth: width,
        windowHeight: height,
      });

      // 6) bersihkan iframe (sudah tidak diperlukan)
      cleanup();

      if (!canvas.width || !canvas.height) {
        throw new Error("Render canvas 0px — elemen tidak terukur");
        // fallback tidak diperlukan; bila ingin, bisa pakai root.getBoundingClientRect()
      }

      // 7) slicing canvas -> PDF A4
      const imgW = canvas.width;
      const imgH = canvas.height;

      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const usableW = pageW - margin * 2;
      const usableH = pageH - margin * 2;
      const pageHeightPx = Math.floor((imgW * usableH) / usableW);

      let sY = 0;
      while (sY < imgH) {
        const sHeight = Math.min(pageHeightPx, imgH - sY);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = imgW;
        pageCanvas.height = sHeight;
        const ctx = pageCanvas.getContext("2d")!;
        ctx.drawImage(canvas, 0, sY, imgW, sHeight, 0, 0, imgW, sHeight);

        const imgData = pageCanvas.toDataURL("image/jpeg", 0.92);
        const drawH = (sHeight / imgW) * usableW;
        pdf.addImage(
          imgData,
          "JPEG",
          margin,
          margin,
          usableW,
          drawH,
          undefined,
          "FAST"
        );

        sY += sHeight;
        if (sY < imgH) pdf.addPage();
      }

      const date = todayISO();
      const filename = `${date}.pdf`;

      // 8) upload ke API
      try {
        const arrayBuffer = pdf.output("arraybuffer") as ArrayBuffer;
        const u = (user ?? {}) as AnyUser;
        const userId = u.id || u.email || u.name || "unknown";
        const role = u.role || "admin";
        const res = await fetch(
          `/api/lampiran/upload?userId=${encodeURIComponent(
            userId
          )}&role=${encodeURIComponent(role)}&date=${encodeURIComponent(date)}`,
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

      // 9) simpan lokal + download
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
      const next = [entry, ...history];
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

  // Hapus riwayat (local / cloud)
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
          {
            method: "POST",
          }
        );
        if (!res.ok) {
          const msg = await res.json().catch(() => ({} as { error?: string }));
          alert(`Gagal hapus cloud: ${msg.error || res.statusText}`);
        }
        await refreshRiwayatFromSupabase();
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
      {/* container lama (tidak dipakai), biarkan exist */}
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

      {/* Header UI */}
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
                <b>Evaluasi (tema hari {theme})</b>, Target & Achievement,
                Project Tracking (SPARTA), dan Agenda & Jadwal.
              </div>
              <div className="mt-3 text-xs text-slate-500">
                *Layout khusus agar rapi & konsisten.
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
