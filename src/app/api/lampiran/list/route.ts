import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

const BUCKET = process.env.SUPABASE_BUCKET ?? "Lampiran";

// minimal shape yang kita pakai dari hasil list()
type FileRow = { name: string; created_at?: string | null };

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") ?? "unknown";
    const role = searchParams.get("role") ?? "admin";
    const prefix = `${role}/${encodeURIComponent(userId)}/`;

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: 100, sortBy: { column: "name", order: "desc" } });

    if (error) throw error;

    const files: FileRow[] = Array.isArray(data) ? (data as FileRow[]) : [];

    const items = files
      .filter(
        (o) =>
          typeof o.name === "string" && o.name.toLowerCase().endsWith(".pdf")
      )
      .map((o) => {
        const dateISO = o.name.replace(/\.pdf$/i, "");
        const key = `${prefix}${o.name}`;
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(key);
        const publicUrl = pub?.publicUrl ?? "";
        return {
          filename: o.name,
          dateISO,
          key,
          url: publicUrl,
          submittedAt: o.created_at ?? undefined,
        };
      });

    return NextResponse.json({ items });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
