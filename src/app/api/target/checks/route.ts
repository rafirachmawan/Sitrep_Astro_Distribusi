import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

/* ============ Types ============ */
type FodksItem = {
  id: string;
  name: string;
  note?: string;
  createdBy?: string;
  createdAt?: string;
};

type ChecksPayload = {
  klaimSelesai: Record<string, boolean>;
  weekly: Record<string, boolean[]>;
  fodksList: FodksItem[];
};

type ChecksRow = {
  id: string;
  account_id: string;
  period: string; // YYYY-MM
  klaim_selesai: unknown;
  weekly: unknown;
  fodks_list: unknown;
  updated_at: string | null;
};

/* ============ Helpers ============ */
function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function toObject<T extends object>(v: unknown, fallback: T): T {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as T;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as T;
      }
    } catch {}
  }
  return fallback;
}
function toArray<T>(v: unknown, fallback: T[]): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed as T[];
    } catch {}
  }
  return fallback;
}
function emsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/* ============ GET ============ */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");
    const altId = searchParams.get("altId") || undefined;
    const period = searchParams.get("period") || currentPeriod();

    if (!accountId) {
      return NextResponse.json({ error: "Missing accountId" }, { status: 400 });
    }

    const ids = altId && altId !== accountId ? [accountId, altId] : [accountId];

    const { data, error } = await supabaseAdmin
      .from("sitrep_target_checks")
      .select("*")
      .eq("period", period)
      .in("account_id", ids)
      .returns<ChecksRow[]>();

    if (error) throw error;

    if (!data || data.length === 0) {
      return NextResponse.json({
        accountId,
        period,
        klaimSelesai: {},
        weekly: {},
        fodksList: [],
      });
    }

    // Prioritaskan row yang match accountId utama
    const row = data.find((r) => r.account_id === accountId) ?? data[0];

    const klaimSelesai = toObject<Record<string, boolean>>(
      row.klaim_selesai,
      {}
    );
    const weekly = toObject<Record<string, boolean[]>>(row.weekly, {});
    const fodksList = toArray<FodksItem>(row.fodks_list, []);

    return NextResponse.json({
      accountId: row.account_id,
      period: row.period,
      klaimSelesai,
      weekly,
      fodksList,
      updatedAt: row.updated_at ?? null,
    });
  } catch (err: unknown) {
    console.error("GET /api/target/checks", err);
    return NextResponse.json(
      { error: emsg(err) || "Server error" },
      { status: 500 }
    );
  }
}

/* ============ PUT ============ */
export async function PUT(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");
    const altId = searchParams.get("altId") || undefined;
    const period = searchParams.get("period") || currentPeriod();

    if (!accountId) {
      return NextResponse.json({ error: "Missing accountId" }, { status: 400 });
    }

    const raw = await req.json().catch(() => null);
    const body: Partial<ChecksPayload> | null =
      raw && typeof raw === "object" ? (raw as ChecksPayload) : null;

    const klaimSelesai = body?.klaimSelesai ?? {};
    const weekly = body?.weekly ?? {};
    const fodksList = body?.fodksList ?? [];
    const nowIso = new Date().toISOString();

    // Cek apakah sudah ada row utk accountId utama & altId
    const ids = altId && altId !== accountId ? [accountId, altId] : [accountId];
    const { data: existing, error: qErr } = await supabaseAdmin
      .from("sitrep_target_checks")
      .select("id, account_id")
      .eq("period", period)
      .in("account_id", ids);
    if (qErr) throw qErr;

    const primary = existing?.find((r) => r.account_id === accountId);
    const alt = existing?.find((r) => r.account_id !== accountId);

    if (!primary && alt) {
      // MIGRASI: ada data lama di altId, pindahkan ke accountId utama
      const { error: upErr } = await supabaseAdmin
        .from("sitrep_target_checks")
        .update({
          account_id: accountId,
          klaim_selesai: klaimSelesai,
          weekly,
          fodks_list: fodksList,
          updated_at: nowIso,
        })
        .eq("id", alt.id);
      if (upErr) throw upErr;

      return NextResponse.json({ ok: true, migrated: true });
    }

    // Normal upsert utk accountId utama
    const { error } = await supabaseAdmin.from("sitrep_target_checks").upsert(
      {
        account_id: accountId,
        period,
        klaim_selesai: klaimSelesai,
        weekly,
        fodks_list: fodksList,
        updated_at: nowIso,
      },
      { onConflict: "account_id,period" }
    );

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("PUT /api/target/checks", err);
    return NextResponse.json(
      { error: emsg(err) || "Server error" },
      { status: 500 }
    );
  }
}
