// app/api/target/overrides/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/** ==== Types (selaras dengan komponen Target) ==== */
type TargetOverrides = {
  copy?: {
    klaimTitle?: string;
    targetSelesaiLabel?: string;
    weeklyTitle?: string;
    fodksTitle?: string;
    fodksCheckboxLabel?: string;
    deadlineLabel?: string;
  };
  principals?: Record<string, { label?: string }>;
  extraPrincipals?: Record<string, { label: string }>;
};

/** ==== Utils ==== */
function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}
function pickOverrides(x: unknown): TargetOverrides {
  if (isRecord(x) && isRecord(x.overrides)) {
    return x.overrides as TargetOverrides;
  }
  return {};
}

/** ==== Supabase server client ==== */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  // gunakan SERVICE ROLE di server
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TABLE = "app_overrides";
const FEATURE = "target"; // bedakan feature lain (mis. 'checklist')

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const role = (searchParams.get("role") || "admin").toLowerCase();

    const { data, error } = await supabase
      .from(TABLE)
      .select("overrides")
      .eq("feature", FEATURE)
      .eq("role", role)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const overrides = (data?.overrides ?? {}) as TargetOverrides;
    return NextResponse.json({ overrides });
  } catch (err: unknown) {
    return NextResponse.json({ error: toErrorMessage(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const role = (searchParams.get("role") || "admin").toLowerCase();

    const bodyUnknown = (await req.json().catch(() => ({}))) as unknown;
    const overrides = pickOverrides(bodyUnknown);

    // TODO (opsional): validasi superadmin di sini jika ada sesi user.

    const row = {
      feature: FEATURE,
      role,
      overrides,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from(TABLE)
      .upsert([row], { onConflict: "feature,role" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: toErrorMessage(err) }, { status: 500 });
  }
}
