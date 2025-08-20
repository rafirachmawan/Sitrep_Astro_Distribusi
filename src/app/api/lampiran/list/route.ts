import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);
const BUCKET = process.env.SUPABASE_BUCKET || "Lampiran";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || "unknown";
    const role = searchParams.get("role") || "admin";
    const prefix = `${role}/${encodeURIComponent(userId)}/`;

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: 100, sortBy: { column: "name", order: "desc" } });
    if (error) throw error;

    const items = (data || [])
      .filter((o) => o.name.endsWith(".pdf"))
      .map((o) => {
        const dateISO = o.name.replace(/\.pdf$/, "");
        const key = `${prefix}${o.name}`;
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(key);
        return {
          filename: o.name,
          dateISO,
          key,
          url: pub.publicUrl,
          submittedAt: o.created_at,
        };
      });

    return NextResponse.json({ items });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
