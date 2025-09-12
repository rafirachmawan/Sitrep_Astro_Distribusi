import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;
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

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || "unknown";
    const role = searchParams.get("role") || "admin";
    const date = searchParams.get("date"); // YYYY-MM-DD

    if (!date) {
      return NextResponse.json({ error: "Missing date" }, { status: 400 });
    }

    const filename = `${date}.pdf`;
    const storageKey = `${encodeURIComponent(userId)}/${encodeURIComponent(
      role
    )}/${filename}`;

    const contentType = req.headers.get("content-type");
    if (contentType !== "application/pdf") {
      return NextResponse.json(
        { error: "Content-Type must be application/pdf" },
        { status: 400 }
      );
    }

    const body = await req.arrayBuffer();

    // Upload ke Storage
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storageKey, body, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr) {
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    // URL publik (kalau bucket private, ganti jadi signed URL)
    const { data: pub } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(storageKey);
    const publicUrl = pub.publicUrl;

    // Upsert history (dedupe by storage_key)
    type LampiranRowInsert = {
      user_id: string;
      role: string;
      date_iso: string;
      filename: string;
      storage_key: string;
      submitted_at?: string;
    };

    const { error: dbErr } = await supabase.from("lampiran_history").upsert(
      {
        user_id: userId,
        role,
        date_iso: date,
        filename,
        storage_key: storageKey,
        submitted_at: new Date().toISOString(),
      } satisfies LampiranRowInsert,
      { onConflict: "storage_key" }
    );

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, url: publicUrl, key: storageKey });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
