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

// ── normalisasi segmen path supaya aman (tanpa spasi, tanpa ':' dll)
function safeSegment(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "_") // ganti karakter asing dengan _
    .slice(0, 120); // jaga agar tidak terlalu panjang
}

function buildKey(userId: string, role: string, dateISO: string): string {
  return `${safeSegment(userId)}/${safeSegment(role)}/${dateISO}.pdf`;
}

type LampiranRowInsert = {
  user_id: string;
  role: string;
  date_iso: string;
  filename: string;
  storage_key: string;
  submitted_at?: string;
};

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = (searchParams.get("userId") || "unknown").trim();
    const role = (searchParams.get("role") || "admin").trim();
    const date = (searchParams.get("date") || "").trim(); // YYYY-MM-DD

    if (!date) {
      return NextResponse.json(
        { error: "Missing ?date=YYYY-MM-DD" },
        { status: 400 }
      );
    }

    const key = buildKey(userId, role, date);
    const filename = `${date}.pdf`;

    const body = await req.arrayBuffer();

    // Upload (tidak di-encode manual, langsung pakai key aman)
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(key, body, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    // Simpan/Upsert ke tabel riwayat
    const row: LampiranRowInsert = {
      user_id: userId,
      role,
      date_iso: date,
      filename,
      storage_key: key,
      submitted_at: new Date().toISOString(),
    };

    // Jika Anda punya constraint unik (user_id, role, date_iso), ini akan menimpa
    const { error: dbErr } = await supabase
      .from("lampiran_history")
      .upsert(row, { onConflict: "user_id,role,date_iso" });

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(key);

    return NextResponse.json({ ok: true, key, url: pub.publicUrl });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
