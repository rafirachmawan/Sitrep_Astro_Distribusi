import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BUCKET = process.env.SUPABASE_BUCKET || "Lampiran";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStoreHeaders = {
  "Cache-Control":
    "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
};

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

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get("key");
    if (!raw) {
      return NextResponse.json(
        { error: "Missing ?key=" },
        { status: 400, headers: noStoreHeaders }
      );
    }

    // hapus 2 versi: apa adanya & versi decoded
    const candidates = Array.from(new Set([raw, safeDecode(raw)]));

    // Hapus file di storage (API menerima string[])
    await supabase.storage.from(BUCKET).remove(candidates);

    // Hapus row DB yang cocok
    for (const k of candidates) {
      await supabase.from("lampiran_history").delete().eq("storage_key", k);
    }

    return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: errMsg(e) },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
