import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function noStoreJson(body: any, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return res;
}

/**
 * Table: sitrep_overrides
 * Columns:
 * - role text primary key
 * - overrides jsonb
 * - updated_at timestamptz
 */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const role = (searchParams.get("role") || "admin").toLowerCase();

    const supa = getSupabaseAdmin();
    const { data, error } = await supa
      .from("sitrep_overrides")
      .select("overrides")
      .eq("role", role)
      .maybeSingle();

    if (error) throw error;

    return noStoreJson({ overrides: (data?.overrides as any) || {} });
  } catch (e: any) {
    console.error("GET /api/target/overrides", e);
    return noStoreJson({ error: e?.message || "unknown" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const role = (searchParams.get("role") || "admin").toLowerCase();
    const body = await req.json();
    const overrides = body?.overrides || {};

    const supa = getSupabaseAdmin();
    const { error } = await supa
      .from("sitrep_overrides")
      .upsert(
        { role, overrides, updated_at: new Date().toISOString() },
        { onConflict: "role" }
      );

    if (error) throw error;

    return noStoreJson({ ok: true });
  } catch (e: any) {
    console.error("PUT /api/target/overrides", e);
    return noStoreJson({ error: e?.message || "unknown" }, { status: 500 });
  }
}
