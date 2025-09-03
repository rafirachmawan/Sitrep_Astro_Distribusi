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
  // bisa jsonb (object) atau text (string JSON), jadi pakai unknown
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

// Coercer: kalau string JSON → parse, kalau sudah object/array → kembalikan apa adanya
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

function errorMessage(err: unknown): string {
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
    const period = searchParams.get("period") || currentPeriod();

    if (!accountId) {
      return NextResponse.json({ error: "Missing accountId" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("sitrep_target_checks")
      .select("*")
      .eq("account_id", accountId)
      .eq("period", period)
      .maybeSingle<ChecksRow>();

    if (error) throw error;

    if (!data) {
      return NextResponse.json({
        accountId,
        period,
        klaimSelesai: {},
        weekly: {},
        fodksList: [],
      });
    }

    // 🔧 Kunci: paksa konversi ke bentuk yang UI butuhkan
    const klaimSelesai = toObject<Record<string, boolean>>(
      data.klaim_selesai,
      {}
    );
    const weekly = toObject<Record<string, boolean[]>>(data.weekly, {});
    const fodksList = toArray<FodksItem>(data.fodks_list, []);

    return NextResponse.json({
      accountId: data.account_id,
      period: data.period,
      klaimSelesai,
      weekly,
      fodksList,
      updatedAt: data.updated_at ?? null,
    });
  } catch (err: unknown) {
    console.error("GET /api/target/checks", err);
    return NextResponse.json(
      { error: errorMessage(err) || "Server error" },
      { status: 500 }
    );
  }
}

/* ============ PUT ============ */
export async function PUT(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");
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

    const { error } = await supabaseAdmin.from("sitrep_target_checks").upsert(
      {
        account_id: accountId,
        period,
        // Supabase menerima object/array ini baik untuk kolom jsonb maupun text (akan di-cast)
        klaim_selesai: klaimSelesai,
        weekly,
        fodks_list: fodksList,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "account_id,period" }
    );

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("PUT /api/target/checks", err);
    return NextResponse.json(
      { error: errorMessage(err) || "Server error" },
      { status: 500 }
    );
  }
}
