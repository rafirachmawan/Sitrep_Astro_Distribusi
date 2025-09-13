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

const sanitizeSegment = (s: string) => s.replace(/[/\\]/g, "-");

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userIdRaw = searchParams.get("userId") || "unknown";
    const roleRaw = searchParams.get("role") || "admin";
    const dateISO =
      searchParams.get("date") || new Date().toISOString().slice(0, 10);

    const userId = sanitizeSegment(userIdRaw);
    const role = sanitizeSegment(roleRaw);
    const filename = `${dateISO}.pdf`;
    const key = `${userId}/${role}/${filename}`; // JANGAN di-encode; biarkan apa adanya

    const pdfBuffer = await req.arrayBuffer();
    if (!pdfBuffer || pdfBuffer.byteLength === 0) {
      return NextResponse.json(
        { error: "Empty body" },
        { status: 400, headers: noStoreHeaders }
      );
    }

    // Upload ke storage (overwrite jika sudah ada)
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(key, pdfBuffer, { contentType: "application/pdf", upsert: true });

    if (upErr) {
      return NextResponse.json(
        { error: upErr.message },
        { status: 500, headers: noStoreHeaders }
      );
    }

    // Simpan/Upsert ke tabel history
    const submittedAt = new Date().toISOString();
    const payload = {
      user_id: userIdRaw, // simpan original (tanpa sanitize) untuk query .eq('user_id', ...)
      role: roleRaw,
      date_iso: dateISO,
      filename,
      storage_key: key,
      submitted_at: submittedAt,
    };

    const { error: dbErr } = await supabase
      .from("lampiran_history")
      .upsert(payload, { onConflict: "storage_key" });

    if (dbErr) {
      return NextResponse.json(
        { error: dbErr.message },
        { status: 500, headers: noStoreHeaders }
      );
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(key);

    return NextResponse.json(
      { ok: true, key, url: pub.publicUrl, submittedAt },
      { headers: noStoreHeaders }
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { error: errMsg(e) },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
