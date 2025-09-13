// src/app/api/lampiran/delete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!; // gunakan server-side key
const BUCKET = process.env.SUPABASE_BUCKET || "Lampiran";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
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

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get("key");
    if (!raw)
      return NextResponse.json({ error: "Missing ?key=" }, { status: 400 });

    // siapkan kandidat path (raw + decoded), dedupe, semua bertipe string
    const candidates: string[] = Array.from(new Set([raw, safeDecode(raw)]));

    // Hapus file di storage (terima string[])
    const { error: removeErr } = await supabase.storage
      .from(BUCKET)
      .remove(candidates);
    if (removeErr) {
      // tidak fatal; tetap lanjut hapus row DB, tapi kirim info error
      console.warn("Storage remove error:", removeErr);
    }

    // Hapus row di DB sekaligus
    const { error: dbErr } = await supabase
      .from("lampiran_history")
      .delete()
      .in("storage_key", candidates);
    if (dbErr) {
      console.warn("DB delete error:", dbErr);
    }

    return NextResponse.json({
      ok: true,
      storageError: removeErr ? errMsg(removeErr) : undefined,
      dbError: dbErr ? errMsg(dbErr) : undefined,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
