// app/api/target/overrides/route.ts
import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ===== Types selaras komponen Target =====
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

const TABLE = "app_overrides";
const FEATURE = "target";

// ===== Helpers =====
function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function getAdminClient() {
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url) throw new Error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceKey);
}

function ensureOverridesPayload(x: unknown): TargetOverrides {
  return x && typeof x === "object" ? (x as TargetOverrides) : {};
}

// ===== Handlers =====
export async function GET(req: NextRequest) {
  try {
    const supabase = getAdminClient();
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
    const supabase = getAdminClient();
    const { searchParams } = new URL(req.url);
    const role = (searchParams.get("role") || "admin").toLowerCase();

    const bodyUnknown = (await req.json().catch(() => ({}))) as unknown;
    const incoming = (bodyUnknown as { overrides?: unknown })?.overrides;
    const overrides = ensureOverridesPayload(incoming);

    const row = {
      feature: FEATURE,
      role,
      overrides,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from(TABLE)
      .upsert(row, { onConflict: "feature,role" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: toErrorMessage(err) }, { status: 500 });
  }
}
