import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE! // server-side key
);
const BUCKET = process.env.SUPABASE_BUCKET || "Lampiran";

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || "unknown";
    const role = searchParams.get("role") || "admin";
    const date =
      searchParams.get("date") || new Date().toISOString().slice(0, 10);

    const bytes = new Uint8Array(await req.arrayBuffer());
    const key = `${role}/${encodeURIComponent(userId)}/${date}.pdf`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(key, bytes, { contentType: "application/pdf", upsert: true });
    if (error) throw error;

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(key);
    return NextResponse.json({
      ok: true,
      key,
      url: pub.publicUrl,
      filename: `${date}.pdf`,
      dateISO: date,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
