// src/app/api/sparta/export/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

/** ====== Types ====== */
type ProjectProgressEntry = {
  steps?: boolean[];
  progressText?: string;
  nextAction?: string;
};
type ProjectProgressPayload = {
  projectsProgress?: Record<string, ProjectProgressEntry>;
};

type DBHistoryRow = {
  id: string;
  account_id: string;
  period: string;
  payload: ProjectProgressPayload | null;
  created_at: string;
};

type DBKendalaRow = {
  id: string;
  account_id: string;
  project_id: string;
  note: string;
  created_at: string;
};

type ExportRequest = {
  from?: string;
  to?: string;
  accountId?: string;
};

type ProgressRow = {
  Waktu: string;
  Akun: string;
  Period: string;
  ProjectID: string;
  Selesai: number;
  Total: number;
  Steps: string;
  Progress: string;
  NextAction: string;
};

type KendalaExportRow = {
  Waktu: string;
  Akun: string;
  ProjectID: string;
  Kendala: string;
};

/** ====== Helpers ====== */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function pickStr(o: Record<string, unknown>, k: keyof ExportRequest) {
  const v = o[k];
  return typeof v === "string" ? v : undefined;
}
function isoOrFallback(v?: string, fb?: string) {
  if (v) return new Date(v).toISOString();
  return fb ?? new Date(0).toISOString();
}

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);

    // ambil body aman (tanpa any)
    const isJson = req.headers
      .get("content-type")
      ?.includes("application/json");
    const parsed = isJson ? await req.json().catch(() => ({})) : {};
    const bodyObj = isRecord(parsed) ? parsed : {};

    const from = url.searchParams.get("from") ?? pickStr(bodyObj, "from");
    const to = url.searchParams.get("to") ?? pickStr(bodyObj, "to");
    const accountId =
      url.searchParams.get("accountId") ?? pickStr(bodyObj, "accountId");

    const startIso = isoOrFallback(from, new Date(0).toISOString());
    const endIso = isoOrFallback(to, new Date().toISOString());

    /** ========= HISTORY ========= */
    let hq = supabaseAdmin
      .from("sparta_history")
      .select("id,account_id,period,payload,created_at")
      .gte("created_at", startIso)
      .lte("created_at", endIso);

    if (accountId) hq = hq.eq("account_id", accountId);

    const { data: history, error: he } = await hq
      .order("created_at", { ascending: true })
      .returns<DBHistoryRow[]>();
    if (he) throw he;

    /** ========= KENDALA ========= */
    let kq = supabaseAdmin
      .from("sparta_kendala")
      .select("id,account_id,project_id,note,created_at")
      .gte("created_at", startIso)
      .lte("created_at", endIso);

    if (accountId) kq = kq.eq("account_id", accountId);

    const { data: kendala, error: ke } = await kq
      .order("created_at", { ascending: true })
      .returns<DBKendalaRow[]>();
    if (ke) throw ke;

    /** ========= Susun workbook ========= */
    const progressRows: ProgressRow[] = [];
    (history ?? []).forEach((h) => {
      const pp = (h.payload?.projectsProgress ?? {}) as NonNullable<
        ProjectProgressPayload["projectsProgress"]
      >;

      Object.entries(pp).forEach(([projectId, prog]) => {
        const steps = Array.isArray(prog.steps) ? prog.steps : [];
        const total = steps.length;
        const done = steps.filter(Boolean).length;
        const stepsText = steps
          .map((d, i) => `${i + 1}:${d ? "✔" : "✗"}`)
          .join(" ");

        progressRows.push({
          Waktu: new Date(h.created_at).toLocaleString("id-ID"),
          Akun: h.account_id,
          Period: h.period,
          ProjectID: projectId,
          Selesai: done,
          Total: total,
          Steps: stepsText,
          Progress: prog.progressText ?? "",
          NextAction: prog.nextAction ?? "",
        });
      });
    });

    const kendalaRows: KendalaExportRow[] = (kendala ?? []).map((k) => ({
      Waktu: new Date(k.created_at).toLocaleString("id-ID"),
      Akun: k.account_id,
      ProjectID: k.project_id,
      Kendala: k.note,
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(progressRows),
      "Progress"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(kendalaRows),
      "Kendala"
    );

    // 🔧 KUNCI PERBAIKAN: minta ArrayBuffer (BUKAN Buffer)
    const array = XLSX.write(wb, {
      type: "array",
      bookType: "xlsx",
    }) as ArrayBuffer;

    const fileName = `sparta_export_${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;

    // kirim langsung ArrayBuffer sebagai body
    return new NextResponse(array, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: unknown) {
    const message =
      (isRecord(e) && typeof e.message === "string" && e.message) ||
      "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
