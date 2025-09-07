// app/api/target/overrides/route.ts
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
  const role = url.searchParams.get("role");
  if (!role) return bad("Missing role");

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from("target_overrides")
    .select("overrides")
    .eq("role", role)
    .maybeSingle();

  if (error) return bad(error.message, 500);
  return ok({ overrides: data?.overrides ?? {} });
}

export async function PUT(req: Request) {
  const url = new URL(req.url);
  const role = url.searchParams.get("role");
  if (!role) return bad("Missing role");

  // Sederhana: validasi role dari header buatan sendiri
  const xrole = req.headers.get("x-role")?.toLowerCase();
  const allowed =
    xrole === "superadmin" || xrole === "owner" || xrole === "root";
  if (!allowed) return bad("Forbidden: only superadmin can write", 403);

  const body = await req.json().catch(() => ({}));
  const overrides = body?.overrides ?? {};
  if (typeof overrides !== "object") return bad("Invalid overrides");

  const supa = getSupabaseAdmin();
  const { error } = await supa.from("target_overrides").upsert(
    {
      role,
      overrides,
      updated_by: xrole || "unknown",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "role" }
  );
  if (error) return bad(error.message, 500);
  return ok({ ok: true });
}
