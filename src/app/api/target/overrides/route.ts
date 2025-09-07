import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

// GET /api/target/overrides?role=sales
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role");
    if (!role)
      return NextResponse.json({ error: "Missing role" }, { status: 400 });

    const supa = getSupabaseServer();
    const { data, error } = await supa
      .from("target_overrides")
      .select("data")
      .eq("role", role)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ overrides: data?.data ?? {} });
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500 }
    );
  }
}

// PUT /api/target/overrides?role=sales
// body: { overrides: {...} }
export async function PUT(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role");
    if (!role)
      return NextResponse.json({ error: "Missing role" }, { status: 400 });

    const body = await req.json();
    const overrides = body?.overrides ?? {};
    const supa = getSupabaseServer();

    const { data, error } = await supa
      .from("target_overrides")
      .upsert({ role, data: overrides }, { onConflict: "role" })
      .select("data")
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, overrides: data.data });
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
