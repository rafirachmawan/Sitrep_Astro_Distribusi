import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE! // server-side key
);

const BUCKET = process.env.SUPABASE_BUCKET ?? "Lampiran";

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") ?? "unknown";
    const role = searchParams.get("role") ?? "admin";
    const date =
      searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

    // body -> Uint8Array
    const bytes = new Uint8Array(await req.arrayBuffer());

    // path: role/<encoded userId>/<YYYY-MM-DD>.pdf
    const key = `${role}/${encodeURIComponent(userId)}/${date}.pdf`;

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(key, bytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr) throw uploadErr;

    // public URL
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(key);
    const publicUrl: string = pub?.publicUrl ?? "";

    return NextResponse.json({
      ok: true,
      key,
      url: publicUrl,
      filename: `${date}.pdf`,
      dateISO: date,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
