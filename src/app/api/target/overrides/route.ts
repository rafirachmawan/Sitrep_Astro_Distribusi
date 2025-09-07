// src/app/api/target/overrides/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

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

    const overrides = (data?.overrides as unknown) ?? {};
    return NextResponse.json({ overrides });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("GET /api/target/overrides", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const role = (searchParams.get("role") || "admin").toLowerCase();
    const body = (await req.json()) as { overrides?: unknown };
    const overrides = body?.overrides ?? {};

    const supa = getSupabaseAdmin();
    const { error } = await supa
      .from("sitrep_overrides")
      .upsert(
        { role, overrides, updated_at: new Date().toISOString() },
        { onConflict: "role" }
      );

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("PUT /api/target/overrides", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
