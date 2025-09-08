// app/api/sparta/progress/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

/** JSON aman */
type Json =
  | Record<string, unknown>
  | unknown[]
  | string
  | number
  | boolean
  | null;

type ProgressRow = {
  account_id: string;
  period: string; // "YYYY-MM"
  data: Json; // projectsProgress
  updated_at?: string;
};

// GET /api/sparta/progress?accountId=...&period=YYYY-MM&altId=optional
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");
    const period = searchParams.get("period");
    const altId = searchParams.get("altId");

    if (!accountId || !period) {
      return NextResponse.json({ error: "Missing accountId/period" } as const, {
        status: 400,
      });
    }

    const supa = getSupabaseServer();

    // coba primary accountId
    const { data: rowMain, error: errMain } = await supa
      .from("sparta_progress")
      .select("*")
      .eq("account_id", accountId)
      .eq("period", period)
      .maybeSingle<ProgressRow>();

    if (errMain) throw errMain;
    if (rowMain) {
      return NextResponse.json({
        projectsProgress: rowMain.data ?? {},
      } as const);
    }

    // fallback ke altId (untuk kompatibel struktur lama)
    if (altId) {
      const { data: rowAlt, error: errAlt } = await supa
        .from("sparta_progress")
        .select("*")
        .eq("account_id", altId)
        .eq("period", period)
        .maybeSingle<ProgressRow>();

      if (errAlt) throw errAlt;
      if (rowAlt) {
        return NextResponse.json({
          projectsProgress: rowAlt.data ?? {},
        } as const);
      }
    }

    return NextResponse.json({ projectsProgress: {} } as const);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg } as const, { status: 500 });
  }
}

// PUT /api/sparta/progress?accountId=...&period=YYYY-MM
// body: { projectsProgress: {...} }
export async function PUT(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");
    const period = searchParams.get("period");
    if (!accountId || !period) {
      return NextResponse.json({ error: "Missing accountId/period" } as const, {
        status: 400,
      });
    }

    const body = await req.json();
    const projectsProgress: Json = body?.projectsProgress ?? {};

    const supa = getSupabaseServer();

    // upsert progress utama (satu row per akun & periode)
    const { error: upErr } = await supa
      .from("sparta_progress")
      .upsert(
        { account_id: accountId, period, data: projectsProgress },
        { onConflict: "account_id,period" }
      );
    if (upErr) throw upErr;

    // simpan riwayat setiap kali simpan
    const { error: histErr } = await supa.from("sparta_history").insert({
      account_id: accountId,
      period,
      payload: { projectsProgress },
    });
    if (histErr) throw histErr;

    return NextResponse.json({ ok: true } as const);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg } as const, { status: 500 });
  }
}
