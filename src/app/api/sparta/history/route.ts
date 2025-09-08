// app/api/sparta/history/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

/** Konversi "YYYY-MM-DD" -> Date (local) */
function parseYmd(ymd?: string | null): Date | null {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** GET /api/sparta/history?from=YYYY-MM-DD&to=YYYY-MM-DD&accountId=optional&limit=optional */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fromStr = searchParams.get("from"); // YYYY-MM-DD
    const toStr = searchParams.get("to"); // YYYY-MM-DD
    const accountId = searchParams.get("accountId"); // optional (superadmin bisa kosong=lihat semua)
    const limit = Number(searchParams.get("limit") || 200);

    const fromDate = parseYmd(fromStr);
    const toDateInc = (() => {
      const d = parseYmd(toStr);
      if (!d) return null;
      // inclusive-to: geser ke awal hari berikutnya untuk filter lt
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    })();

    const supa = getSupabaseServer();
    let q = supa
      .from("sparta_history")
      .select("id, account_id, period, payload, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (accountId) q = q.eq("account_id", accountId);
    if (fromDate) q = q.gte("created_at", fromDate.toISOString());
    if (toDateInc) q = q.lt("created_at", toDateInc.toISOString());

    const { data, error } = await q;
    if (error) throw error;

    return NextResponse.json({ items: data || [] } as const);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg } as const, { status: 500 });
  }
}
