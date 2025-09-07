import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

// GET /api/target/checks?accountId=a@b.com&period=2025-09&altId=uidOptional
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");
    const period = searchParams.get("period");
    const altId = searchParams.get("altId");

    if (!accountId || !period) {
      return NextResponse.json(
        { error: "Missing accountId/period" },
        { status: 400 }
      );
    }

    const supa = getSupabaseServer();

    const { data: rowMain, error: errMain } = await supa
      .from("target_checks")
      .select("*")
      .eq("account_id", accountId)
      .eq("period", period)
      .maybeSingle();

    if (errMain) throw errMain;

    if (rowMain) {
      return NextResponse.json({
        klaimSelesai: rowMain.klaim_selesai ?? {},
        weekly: rowMain.weekly ?? {},
        fodksList: rowMain.fodks_list ?? [],
      });
    }

    if (altId) {
      const { data: rowAlt, error: errAlt } = await supa
        .from("target_checks")
        .select("*")
        .eq("account_id", altId)
        .eq("period", period)
        .maybeSingle();

      if (errAlt) throw errAlt;

      if (rowAlt) {
        return NextResponse.json({
          klaimSelesai: rowAlt.klaim_selesai ?? {},
          weekly: rowAlt.weekly ?? {},
          fodksList: rowAlt.fodks_list ?? [],
        });
      }
    }

    return NextResponse.json({ klaimSelesai: {}, weekly: {}, fodksList: [] });
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500 }
    );
  }
}

// PUT /api/target/checks?accountId=a@b.com&period=2025-09
// body: { klaimSelesai, weekly, fodksList }
export async function PUT(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");
    const period = searchParams.get("period");
    if (!accountId || !period) {
      return NextResponse.json(
        { error: "Missing accountId/period" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const klaimSelesai = body?.klaimSelesai ?? {};
    const weekly = body?.weekly ?? {};
    const fodksList = body?.fodksList ?? [];

    const supa = getSupabaseServer();
    const { error } = await supa.from("target_checks").upsert(
      {
        account_id: accountId,
        period,
        klaim_selesai: klaimSelesai,
        weekly,
        fodks_list: fodksList,
      },
      { onConflict: "account_id,period" }
    );

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
