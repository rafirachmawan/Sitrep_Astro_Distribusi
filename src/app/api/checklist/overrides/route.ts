import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

const TABLE = "sitrep_checklist_overrides";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const role = (searchParams.get("role") || "").trim();
    if (!role) {
      return NextResponse.json({ error: "Missing role" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .select("overrides, updated_at")
      .eq("role", role)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      role,
      overrides: data?.overrides ?? {},
      updatedAt: data?.updated_at ?? null,
    });
  } catch (e) {
    console.error("GET /api/checklist/overrides", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const role = (searchParams.get("role") || "").trim();
    if (!role) {
      return NextResponse.json({ error: "Missing role" }, { status: 400 });
    }

    // Proteksi: hanya superadmin yang boleh edit via UI
    const editorRole = (req.headers.get("x-user-role") || "").toLowerCase();
    if (editorRole !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const overrides = body?.overrides ?? {};

    const { error } = await supabaseAdmin.from(TABLE).upsert(
      {
        role,
        overrides,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "role" }
    );

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PUT /api/checklist/overrides", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
