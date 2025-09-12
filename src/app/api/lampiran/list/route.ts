import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BUCKET = process.env.SUPABASE_BUCKET || "Lampiran";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: false },
});

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
      .order("submitted_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const items =
      (data || []).map((row) => {
        // Untuk bucket public:
        const { data: pub } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(row.storage_key);
        return {
          filename: row.filename as string,
          dateISO: row.date_iso as string,
          key: row.storage_key as string,
          url: pub.publicUrl as string,
          submittedAt: row.submitted_at as string,
        };
      }) || [];

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "List failed" },
      { status: 500 }
    );
  }
}
