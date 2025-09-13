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
function safeSeg(s: string) {
  return String(s)
    .trim()
    .replace(/[\/%:?&#<>\s]+/g, "_"); // aman untuk path
}

type LampiranRow = {
  id: string;
  user_id: string;
  role: string;
  date_iso: string;
  filename: string;
  storage_key: string;
  submitted_at: string;
};

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = safeSeg(searchParams.get("userId") || "unknown");
    const role = safeSeg(searchParams.get("role") || "admin");
    const date = safeSeg(searchParams.get("date") || "");
    if (!date)
      return NextResponse.json({ error: "Missing ?date=" }, { status: 400 });

    const filename = `${date}.pdf`;
    const storage_key = `${userId}/${role}/${filename}`; // ← raw, tidak di-encode

    const pdfArrayBuf = await req.arrayBuffer();

    // upload PDF (upsert supaya bisa overwrite di hari yang sama)
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storage_key, pdfArrayBuf, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (upErr)
      return NextResponse.json({ error: upErr.message }, { status: 500 });

    // Bersihkan row lama (jika ada) lalu insert
    await supabase
      .from("lampiran_history")
      .delete()
      .eq("user_id", userId)
      .eq("role", role)
      .eq("date_iso", date);

    const row: Omit<LampiranRow, "id"> = {
      user_id: userId,
      role,
      date_iso: date,
      filename,
      storage_key,
      submitted_at: new Date().toISOString(),
    };
    const { error: insErr } = await supabase
      .from("lampiran_history")
      .insert(row);
    if (insErr)
      return NextResponse.json({ error: insErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, key: storage_key });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
