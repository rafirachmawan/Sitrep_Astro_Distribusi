// app/api/target/overrides/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/** =========================================
 * Wajib env ini terpasang:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY  (service_role key)
 * ========================================= */
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

type AppOverridesRow = {
  feature: string;
  role: string;
  overrides: TargetOverrides;
  updated_at: string;
};

const TABLE = "app_overrides";
const FEATURE = "target";

function json(data: unknown, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

function getAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, serviceRole);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const role = (searchParams.get("role") || "admin").toLowerCase();

    const supabase = getAdminClient();

    // Tanpa generic pada `.from()`, tiping di hasil saja:
    const { data, error } = await supabase
      .from(TABLE)
      .select("overrides")
      .eq("feature", FEATURE)
      .eq("role", role)
      .maybeSingle();

    if (error) return json({ error: error.message }, 500);

    const overrides = (data?.overrides ?? {}) as TargetOverrides;
    return json({ overrides });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const role = (searchParams.get("role") || "admin").toLowerCase();

    const body = (await req.json()) as { overrides?: TargetOverrides };
    const overrides: TargetOverrides = body?.overrides ?? {};

    const row: AppOverridesRow = {
      feature: FEATURE,
      role,
      overrides,
      updated_at: new Date().toISOString(),
    };

    const supabase = getAdminClient();

    // Juga tanpa generic di sini:
    const { error } = await supabase
      .from(TABLE)
      .upsert([row], { onConflict: "feature,role" });

    if (error) return json({ error: error.message }, 500);

    return json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
}
