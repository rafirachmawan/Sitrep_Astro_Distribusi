import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function noStoreJson(body: any, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return res;
}

/**
 * Table: sitrep_checks
 * Unique constraint: (account_id, period)
 * Columns:
 *  - account_id text
 *  - period text (YYYY-MM)
 *  - klaim_selesai jsonb
 *  - weekly jsonb
 *  - fodks_list jsonb
 *  - updated_at timestamptz
 */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");
    const period = searchParams.get("period");
    const altId = searchParams.get("altId") || undefined;

    if (!accountId || !period) {
      return noStoreJson(
        { error: "Missing accountId/period" },
        { status: 400 }
      );
    }

    const supa = getSupabaseAdmin();

    // Prioritas: data dgn accountId; jika kosong & ada altId -> pakai altId
    const primary = await supa
      .from("sitrep_checks")
      .select("klaim_selesai, weekly, fodks_list")
      .eq("account_id", accountId)
      .eq("period", period)
      .maybeSingle();

    if (primary.error) throw primary.error;

    if (primary.data) {
      return noStoreJson({
        klaimSelesai: primary.data.klaim_selesai || {},
        weekly: primary.data.weekly || {},
        fodksList: primary.data.fodks_list || [],
      });
    }

    if (altId) {
      const alt = await supa
        .from("sitrep_checks")
        .select("klaim_selesai, weekly, fodks_list")
        .eq("account_id", altId)
        .eq("period", period)
        .maybeSingle();
      if (alt.error) throw alt.error;

      return noStoreJson({
        klaimSelesai: alt.data?.klaim_selesai || {},
        weekly: alt.data?.weekly || {},
        fodksList: alt.data?.fodks_list || [],
      });
    }

    return noStoreJson({ klaimSelesai: {}, weekly: {}, fodksList: [] });
  } catch (e: any) {
    console.error("GET /api/target/checks", e);
    return noStoreJson({ error: e?.message || "unknown" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");
    const period = searchParams.get("period");

    if (!accountId || !period) {
      return noStoreJson(
        { error: "Missing accountId/period" },
        { status: 400 }
      );
    }

    const body = (await req.json()) || {};
    const payload = {
      klaim_selesai: body.klaimSelesai || {},
      weekly: body.weekly || {},
      fodks_list: body.fodksList || [],
    };

    const supa = getSupabaseAdmin();
    const { error } = await supa.from("sitrep_checks").upsert(
      {
        account_id: accountId,
        period,
        ...payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "account_id,period" }
    );

    if (error) throw error;

    return noStoreJson({ ok: true });
  } catch (e: any) {
    console.error("PUT /api/target/checks", e);
    return noStoreJson({ error: e?.message || "unknown" }, { status: 500 });
  }
}
