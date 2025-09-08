// src/app/api/checklist/overrides/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

const TABLE = "sitrep_checklist_overrides";

/** JSON union aman (tanpa any) */
type Json =
  | Record<string, unknown>
  | unknown[]
  | string
  | number
  | boolean
  | null;

/** GET /api/checklist/overrides?role=sales */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role");
    if (!role) {
      return NextResponse.json({ error: "Missing role" } as const, {
        status: 400,
      });
    }

    const supa = getSupabaseServer();
    const { data, error } = await supa
      .from(TABLE)
      .select("data")
      .eq("role", role)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      overrides: (data?.data ?? {}) as Json,
    } as const);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message } as const, { status: 500 });
  }
}

/** PUT /api/checklist/overrides?role=sales
 *  body: { overrides: {...} }
 */
export async function PUT(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role");
    if (!role) {
      return NextResponse.json({ error: "Missing role" } as const, {
        status: 400,
      });
    }

    const body = (await req.json()) as { overrides?: Json };
    const overrides: Json = body?.overrides ?? {};

    const supa = getSupabaseServer();
    const { data, error } = await supa
      .from(TABLE)
      .upsert({ role, data: overrides }, { onConflict: "role" })
      .select("data")
      .single();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      overrides: (data as { data: Json }).data,
    } as const);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message } as const, { status: 500 });
  }
}
