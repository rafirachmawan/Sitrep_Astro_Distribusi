// src/app/api/target/checks/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type SavedChecks = {
  klaimSelesai: Record<string, boolean>;
  weekly: Record<string, boolean[]>;
  fodksList: Array<{
    id: string;
    name: string;
    note: string;
    createdBy?: string;
    createdAt?: string;
  }>;
};

function emptyPayload(): SavedChecks {
  return { klaimSelesai: {}, weekly: {}, fodksList: [] };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId") || "";
    const altId = searchParams.get("altId") || "";
    const period = searchParams.get("period") || "";

    if (!accountId || !period) {
      return NextResponse.json(
        { error: "Missing accountId/period" },
        { status: 400 }
      );
    }

    const supa = getSupabaseAdmin();

    // coba primary accountId
    let { data, error } = await supa
      .from("sitrep_checks")
      .select("payload")
      .eq("account_id", accountId)
      .eq("period", period)
      .maybeSingle();

    // kalau kosong & ada altId → fallback
    if (!data && altId) {
      const res2 = await supa
        .from("sitrep_checks")
        .select("payload")
        .eq("account_id", altId)
        .eq("period", period)
        .maybeSingle();
      data = res2.data;
      error = res2.error;
    }

    if (error) throw error;

    const payload = (data?.payload as unknown) ?? emptyPayload();
    return NextResponse.json(payload);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("GET /api/target/checks", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId") || "";
    const period = searchParams.get("period") || "";

    if (!accountId || !period) {
      return NextResponse.json(
        { error: "Missing accountId/period" },
        { status: 400 }
      );
    }

    const body = (await req.json()) as SavedChecks;
    const supa = getSupabaseAdmin();

    const { error } = await supa.from("sitrep_checks").upsert(
      {
        account_id: accountId,
        period,
        payload: body,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "account_id,period" }
    );

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("PUT /api/target/checks", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
