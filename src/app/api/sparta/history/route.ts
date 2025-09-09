import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

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

function iso(v?: string | null, fb?: string) {
  if (!v) return fb ?? new Date(0).toISOString();
  const d = new Date(v);
  return isNaN(+d) ? fb ?? new Date(0).toISOString() : d.toISOString();
}

export async function GET(req: NextRequest) {
  try {
    const u = new URL(req.url);
    const from = u.searchParams.get("from");
    const to = u.searchParams.get("to");
    const accountId = u.searchParams.get("accountId");

    const startIso = iso(from, new Date(0).toISOString());
    const endIso = iso(to, new Date().toISOString());

    let q = supabaseAdmin
      .from("sparta_history")
      .select("id,account_id,period,payload,created_at")
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .order("created_at", { ascending: false });

    if (accountId) q = q.eq("account_id", accountId);

    const { data, error } = await q.returns<DBHistoryRow[]>();
    if (error) throw error;

    return NextResponse.json({ items: data }, { status: 200 });
  } catch (e) {
    console.error("GET /api/sparta/history", e);
    return NextResponse.json(
      { error: "failed_to_fetch_history" },
      { status: 500 }
    );
  }
}
