import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

/** JSON aman tanpa any */
type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

type HistoryRow = {
  id: string;
  created_at: string;
  account_id: string;
  role: string | null;
  period: string | null;
  payload: Json;
};

// GET /api/sparta/history?from=YYYY-MM-DD&to=YYYY-MM-DD&accountId=... (user biasa)
// GET /api/sparta/history?from=...&to=...&scope=all[&role=sales] (super)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const scope = searchParams.get("scope"); // "all" jika super
    const role = searchParams.get("role"); // filter optional untuk super
    const accountId = searchParams.get("accountId"); // wajib jika bukan super

    if (!from || !to) {
      return NextResponse.json({ error: "Missing from/to date" } as const, {
        status: 400,
      });
    }

    // Normalisasi batas waktu (00:00 s/d 23:59:59)
    const fromISO = `${from}T00:00:00.000Z`;
    const toISO = `${to}T23:59:59.999Z`;

    const supa = getSupabaseServer();

    let q = supa
      .from("sparta_history")
      .select("id,created_at,account_id,role,period,payload")
      .gte("created_at", fromISO)
      .lte("created_at", toISO)
      .order("created_at", { ascending: false });

    if (scope !== "all") {
      if (!accountId) {
        return NextResponse.json(
          { error: "accountId required for non-super scope" } as const,
          { status: 400 }
        );
      }
      q = q.eq("account_id", accountId);
    } else if (role) {
      q = q.eq("role", role);
    }

    const { data, error } = await q.returns<HistoryRow[]>();
    if (error) throw error;

    return NextResponse.json({ items: (data || []) as HistoryRow[] } as const);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message } as const, { status: 500 });
  }
}
