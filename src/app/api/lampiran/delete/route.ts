import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;
const BUCKET = process.env.SUPABASE_BUCKET || "Lampiran";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false },
});

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    if (!key)
      return NextResponse.json({ error: "Missing key" }, { status: 400 });

    // Hapus file di Storage
    const { error: delStorageErr } = await supabase.storage
      .from(BUCKET)
      .remove([key]);
    if (delStorageErr) {
      return NextResponse.json(
        { error: delStorageErr.message },
        { status: 500 }
      );
    }

    // Hapus baris di DB
    const { error: delDbErr } = await supabase
      .from("lampiran_history")
      .delete()
      .eq("storage_key", key);
    if (delDbErr) {
      return NextResponse.json({ error: delDbErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Delete failed" },
      { status: 500 }
    );
  }
}
