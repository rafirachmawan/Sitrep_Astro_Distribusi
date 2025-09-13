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
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** GET /api/lampiran/file?key=...&filename=optional */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get("key");
    const filename = searchParams.get("filename") || "lampiran.pdf";
    if (!raw)
      return NextResponse.json({ error: "Missing ?key=" }, { status: 400 });

    // Coba beberapa kandidat (untuk data lama yang sudah ter-encode)
    const candidates = Array.from(new Set([raw, safeDecode(raw)]));

    for (const key of candidates) {
      const { data, error } = await supabase.storage.from(BUCKET).download(key);
      if (!error && data) {
        return new NextResponse(data, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="${filename}"`,
          },
        });
      }
    }
    return NextResponse.json(
      { error: "File not found for provided key" },
      { status: 404 }
    );
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
