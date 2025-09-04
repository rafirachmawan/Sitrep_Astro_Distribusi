// app/api/target/overrides/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  // penting: pakai SERVICE ROLE di server
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TABLE = "app_overrides";
const FEATURE = "target"; // bedakan dengan 'checklist' dll

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const role = (searchParams.get("role") || "admin").toLowerCase();

    const { data, error } = await supabase
      .from(TABLE)
      .select("overrides")
      .eq("feature", FEATURE)
      .eq("role", role)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ overrides: data?.overrides ?? {} });
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const role = (searchParams.get("role") || "admin").toLowerCase();

    const body = await req.json();
    const overrides = body?.overrides ?? {};

    // TODO (opsional): validasi superadmin di sini jika kamu punya sesi/identitas user.
    // misalnya baca header/cookie lalu cek ke database / middleware kamu.

    const { error } = await supabase.from(TABLE).upsert(
      [
        {
          feature: FEATURE,
          role,
          overrides,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "feature,role" }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
