// app/api/target/checks/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function ok<T>(data: T, init?: number) {
  return NextResponse.json(data, { status: init ?? 200 });
}
function bad(msg: string, code = 400) {
  return NextResponse.json({ error: msg }, { status: code });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const accountId = url.searchParams.get("accountId");
  const period = url.searchParams.get("period");
  const altId = url.searchParams.get("altId");

  if (!accountId || !period) return bad("Missing accountId/period");

  const supa = getSupabaseAdmin();

  // Cari dengan accountId utama dulu, fallback ke altId jika ada
  const { data, error } = await supa
    .from("target_checks")
    .select("data")
    .eq("account_id", accountId)
    .eq("period", period)
    .maybeSingle();

  if (error) return bad(error.message, 500);

  if (!data && altId) {
    const { data: altData, error: err2 } = await supa
      .from("target_checks")
      .select("data")
      .eq("account_id", altId)
      .eq("period", period)
      .maybeSingle();
    if (err2) return bad(err2.message, 500);
    return ok(altData ?? { data: {} });
  }

  return ok(data ?? { data: {} });
}

export async function PUT(req: Request) {
  const url = new URL(req.url);
  const accountId = url.searchParams.get("accountId");
  const period = url.searchParams.get("period");
  if (!accountId || !period) return bad("Missing accountId/period");

  const body = await req.json().catch(() => ({}));
  const payload = {
    klaimSelesai: body?.klaimSelesai ?? {},
    weekly: body?.weekly ?? {},
    fodksList: body?.fodksList ?? [],
  };

  const supa = getSupabaseAdmin();
  const { error } = await supa.from("target_checks").upsert(
    {
      account_id: accountId,
      period,
      data: payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "account_id,period" }
  );
  if (error) return bad(error.message, 500);
  return ok({ ok: true });
}
