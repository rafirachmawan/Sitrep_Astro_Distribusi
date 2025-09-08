import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

/** JSON aman tanpa any */
type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

type ProjectProgress = {
  steps: boolean[];
  progressText: string;
  nextAction: string;
  kendala: string;
};

type BodyShape = {
  projectsProgress?: Record<string, ProjectProgress>;
  meta?: {
    period: string;
    accountId: string;
    role?: string | null;
    savedBy?: string | null;
  };
};

// GET /api/sparta/progress?accountId=...&period=...&altId=...
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

    const { data: rowMain, error: errMain } = await supa
      .from("sparta_progress")
      .select("*")
      .eq("account_id", accountId)
      .eq("period", period)
      .maybeSingle();

    if (errMain) throw errMain;

    if (rowMain) {
      return NextResponse.json({
        projectsProgress: rowMain.data as Json as BodyShape["projectsProgress"],
      } as const);
    }

    if (altId) {
      const { data: rowAlt, error: errAlt } = await supa
        .from("sparta_progress")
        .select("*")
        .eq("account_id", altId)
        .eq("period", period)
        .maybeSingle();
      if (errAlt) throw errAlt;

      if (rowAlt) {
        return NextResponse.json({
          projectsProgress:
            rowAlt.data as Json as BodyShape["projectsProgress"],
        } as const);
      }
    }

    return NextResponse.json({ projectsProgress: {} } as const);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message } as const, { status: 500 });
  }
}

// PUT /api/sparta/progress?accountId=...&period=...
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

    const body = (await req.json()) as BodyShape;
    const projectsProgress: Record<string, ProjectProgress> =
      body?.projectsProgress ?? {};
    const meta = body?.meta;

    const supa = getSupabaseServer();

    // Upsert progress sekarang
    const { error: upErr } = await supa.from("sparta_progress").upsert(
      {
        account_id: accountId,
        period,
        data: projectsProgress as unknown as Json,
      },
      { onConflict: "account_id,period" }
    );
    if (upErr) throw upErr;

    // Snapshot ke history (riwayat)
    const payload = {
      period,
      accountId,
      role: meta?.role ?? null,
      savedBy: meta?.savedBy ?? null,
      projectsProgress,
    };
    const { error: histErr } = await supa.from("sparta_history").insert({
      account_id: accountId,
      role: meta?.role ?? null,
      period,
      payload: payload as unknown as Json,
    });
    if (histErr) throw histErr;

    return NextResponse.json({ ok: true } as const);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message } as const, { status: 500 });
  }
}
