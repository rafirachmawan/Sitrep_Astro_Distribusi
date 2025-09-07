import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

/** JSON shape aman (tanpa any) */
type Json =
  | Record<string, unknown>
  | unknown[]
  | string
  | number
  | boolean
  | null;

// GET /api/target/overrides?role=sales
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
      .from("target_overrides")
      .select("data")
      .eq("role", role)
      .maybeSingle();

    if (error) throw error;

    // data?.data bertipe JSON bebas; kembalikan apa adanya sebagai Json
    return NextResponse.json({
      overrides: (data?.data ?? {}) as Json,
    } as const);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message } as const, { status: 500 });
  }
}

// PUT /api/target/overrides?role=sales
// body: { overrides: {...} }
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
      .from("target_overrides")
      .upsert({ role, data: overrides }, { onConflict: "role" })
      .select("data")
      .single();

    if (error) throw error;

    // data.data juga JSON bebas
    return NextResponse.json({
      ok: true,
      overrides: (data as { data: Json }).data,
    } as const);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message } as const, { status: 500 });
  }
}
