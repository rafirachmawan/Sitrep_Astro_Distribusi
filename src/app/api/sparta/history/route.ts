// src/app/api/sparta/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DBHistoryRow = {
  id: string;
  account_id: string;
  period: string;
  payload: {
    projectsProgress?: Record<
      string,
      { steps?: boolean[]; progressText?: string; nextAction?: string }
    >;
  } | null;
  created_at: string;
};

// normalisasi to ISO start-of-day
function toIsoStart(v: string | null): string {
  if (!v) return new Date(0).toISOString();
  const d = new Date(v);
  if (isNaN(+d)) return new Date(0).toISOString();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// normalisasi to ISO end-of-day
function toIsoEnd(v: string | null): string {
  if (!v) return new Date(8640000000000000).toISOString(); // far future
  const d = new Date(v);
  if (isNaN(+d)) return new Date(8640000000000000).toISOString();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export async function GET(req: NextRequest) {
  try {
    const u = new URL(req.url);
    const from = toIsoStart(u.searchParams.get("from"));
    const to = toIsoEnd(u.searchParams.get("to"));
    const accountId = u.searchParams.get("accountId");

    // NOTE: jangan panggil `.returns()` di sini
    const base = supabaseAdmin
      .from("sparta_history")
      .select("id,account_id,period,payload,created_at")
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: false });

    const q = accountId ? base.eq("account_id", accountId) : base;

    // pasang `.returns<...>()` saat eksekusi terakhir
    const { data, error } = await q.returns<DBHistoryRow[]>();
    if (error) throw error;

    return NextResponse.json({ items: data ?? [] }, { status: 200 });
  } catch (e) {
    console.error("GET /api/sparta/history", e);
    return NextResponse.json(
      { error: "failed_to_fetch_history" },
      { status: 500 }
    );
  }
}
