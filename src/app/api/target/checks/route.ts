import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

/** JSON aman (tanpa any) */
type Json =
  | Record<string, unknown>
  | unknown[]
  | string
  | number
  | boolean
  | null;

/** Bentuk item FODKS */
type FodksItem = {
  id: string;
  name: string;
  note: string;
  createdBy?: string;
  createdAt?: string;
};

/** Payload yang diterima/di-return untuk checks */
type SavedChecks = {
  klaimSelesai: Record<string, boolean>;
  weekly: Record<string, boolean[]>;
  fodksList: FodksItem[];
};

// GET /api/target/checks?accountId=a@b.com&period=2025-09&altId=uidOptional
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");
    const period = searchParams.get("period");
    const altId = searchParams.get("altId");

    if (!accountId || !period) {
      return NextResponse.json({ error: "Missing accountId/period" } as const, {
        status: 400,
      });
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
        klaimSelesai: (rowMain as { klaim_selesai?: Json }).klaim_selesai ?? {},
        weekly: (rowMain as { weekly?: Json }).weekly ?? {},
        fodksList: (rowMain as { fodks_list?: Json }).fodks_list ?? [],
      } as SavedChecks);
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
          klaimSelesai:
            (rowAlt as { klaim_selesai?: Json }).klaim_selesai ?? {},
          weekly: (rowAlt as { weekly?: Json }).weekly ?? {},
          fodksList: (rowAlt as { fodks_list?: Json }).fodks_list ?? [],
        } as SavedChecks);
      }
    }

    return NextResponse.json({
      klaimSelesai: {},
      weekly: {},
      fodksList: [],
    } as SavedChecks);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message } as const, { status: 500 });
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
      return NextResponse.json({ error: "Missing accountId/period" } as const, {
        status: 400,
      });
    }

    const body = (await req.json()) as Partial<SavedChecks> | null;

    const klaimSelesai =
      (body?.klaimSelesai as Record<string, boolean> | undefined) ?? {};
    const weekly =
      (body?.weekly as Record<string, boolean[]> | undefined) ?? {};
    const fodksList = (body?.fodksList as FodksItem[] | undefined) ?? [];

    const supa = getSupabaseServer();
    const { error } = await supa.from("target_checks").upsert(
      {
        account_id: accountId,
        period,
        klaim_selesai: klaimSelesai as Json,
        weekly: weekly as Json,
        fodks_list: fodksList as Json,
      },
      { onConflict: "account_id,period" }
    );

    if (error) throw error;

    return NextResponse.json({ ok: true } as const);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message } as const, { status: 500 });
  }
}
