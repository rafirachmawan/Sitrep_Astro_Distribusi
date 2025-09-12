import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BUCKET = process.env.SUPABASE_BUCKET || "Lampiran";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: false },
});

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "Unknown error";
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawKey = searchParams.get("key");
    if (!rawKey) {
      return NextResponse.json({ error: "Missing ?key=" }, { status: 400 });
    }

    // hapus dua kemungkinan: key mentah & yang sudah ter-decode
    const candidates = Array.from(
      new Set([rawKey, decodeURIComponent(rawKey)])
    );

    await supabase.storage.from(BUCKET).remove(candidates);

    // bersihkan dari tabel
    const { error } = await supabase
      .from("lampiran_history")
      .delete()
      .in("storage_key", candidates);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
