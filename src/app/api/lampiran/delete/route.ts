import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);
const BUCKET = process.env.SUPABASE_BUCKET || "Lampiran";

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    if (!key)
      return NextResponse.json({ error: "Missing key" }, { status: 400 });

    const { error } = await supabase.storage.from(BUCKET).remove([key]);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
