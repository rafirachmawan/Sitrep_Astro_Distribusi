import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type ProjectProgress = {
  steps: boolean[];
  progressText: string;
  nextAction: string;
  kendala: string;
};

type SavedPayload = {
  projectsProgress: Record<string, ProjectProgress>;
};

const TABLE = "sitrep_sparta_progress";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");
    const altId = searchParams.get("altId");
    const period = searchParams.get("period") || currentPeriod();

    if (!accountId) {
      return NextResponse.json({ error: "Missing accountId" }, { status: 400 });
    }

    const ids = [accountId, altId].filter(Boolean) as string[];

    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .select("*")
      .in("account_id", ids)
      .eq("period", period)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json({
        accountId,
        period,
        projectsProgress: {},
      });
    }

    return NextResponse.json({
      accountId: data.account_id,
      period: data.period,
      projectsProgress: data.projects_progress ?? {},
      updatedAt: data.updated_at,
    });
  } catch (e: unknown) {
    console.error("GET /api/sparta/progress", e);
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");
    const altId = searchParams.get("altId");
    const period = searchParams.get("period") || currentPeriod();

    if (!accountId) {
      return NextResponse.json({ error: "Missing accountId" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as Partial<SavedPayload>;
    const projectsProgress = body?.projectsProgress ?? {};

    // Optional: bersihkan row lama yang masih pakai altId supaya 1 akun = 1 row
    if (altId && altId !== accountId) {
      await supabaseAdmin
        .from(TABLE)
        .delete()
        .eq("account_id", altId)
        .eq("period", period);
    }

    const { error } = await supabaseAdmin.from(TABLE).upsert(
      {
        account_id: accountId,
        period,
        projects_progress: projectsProgress,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "account_id,period" }
    );

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error("PUT /api/sparta/progress", e);
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
