import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Payload = {
  projectsProgress?: Record<
    string,
    {
      steps?: boolean[];
      progressText?: string;
      nextAction?: string;
      kendala?: string;
    }
  >;
};

type DBHistoryRow = {
  id: string;
  account_id: string;
  period: string;
  payload: Payload | null;
  created_at: string;
};

export async function GET(req: NextRequest) {
  try {
    const u = new URL(req.url);
    const accountId = u.searchParams.get("accountId");
    const altId = u.searchParams.get("altId");
    const period = u.searchParams.get("period");
    if (!accountId || !period) {
      return NextResponse.json({ error: "missing_params" }, { status: 400 });
    }
    const acc = accountId as string;

    // Build query dulu
    let q = supabaseAdmin
      .from("sparta_history")
      .select("id,account_id,period,payload,created_at")
      .eq("period", period)
      .order("created_at", { ascending: false })
      .limit(1);

    // filter account_id: pakai .in kalau ada altId
    q = altId ? q.in("account_id", [acc, altId]) : q.eq("account_id", acc);

    // returns DIPANGGIL TERAKHIR
    const { data, error } = await q.returns<DBHistoryRow[]>();
    if (error) throw error;

    const latest = data?.[0];
    return NextResponse.json(latest?.payload ?? {}, { status: 200 });
  } catch (e) {
    console.error("GET /api/sparta/progress", e);
    return NextResponse.json(
      { error: "failed_to_fetch_progress" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const u = new URL(req.url);
    const accountId = u.searchParams.get("accountId");
    const period = u.searchParams.get("period");
    if (!accountId || !period) {
      return NextResponse.json({ error: "missing_params" }, { status: 400 });
    }

    const body = (await req.json()) as Payload;
    const payload: Payload = { projectsProgress: body.projectsProgress ?? {} };

    const { error } = await supabaseAdmin
      .from("sparta_history")
      .insert([{ account_id: accountId as string, period, payload }]);

    if (error) throw error;
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("PUT /api/sparta/progress", e);
    return NextResponse.json(
      { error: "failed_to_save_progress" },
      { status: 500 }
    );
  }
}
