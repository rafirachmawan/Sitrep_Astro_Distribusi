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

type LampiranRow = {
  id: string;
  user_id: string;
  role: string;
  date_iso: string;
  filename: string;
  storage_key: string;
  submitted_at: string;
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || "unknown";
    const role = searchParams.get("role") || "admin";

    const { data, error } = await supabase
      .from("lampiran_history")
      .select("*")
      .eq("user_id", userId)
      .eq("role", role)
      .order("date_iso", { ascending: false })
      .order("submitted_at", { ascending: false })
      .returns<LampiranRow[]>();

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    const items = (data ?? []).map((row) => {
      // URL aman (same-origin) pakai proxy
      const downloadUrl = `/api/lampiran/file?key=${encodeURIComponent(
        row.storage_key
      )}&filename=${encodeURIComponent(row.filename)}`;
      return {
        filename: row.filename,
        dateISO: row.date_iso,
        key: row.storage_key,
        // publicUrl tidak dipakai untuk klik, tapi boleh dikirim kalau perlu referensi
        url: "",
        downloadUrl,
        submittedAt: row.submitted_at,
      };
    });

    return NextResponse.json({ items });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
