// src/lib/supabaseServer.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using SERVICE ROLE key.
 * ❗ Never expose SERVICE_ROLE to the browser.
 *
 * If you have a generated Database type from Supabase, you can enable it:
 *   import type { Database } from "@/lib/types/supabase";
 *   type SClient = SupabaseClient<Database>;
 * Otherwise, this falls back to the untyped SupabaseClient.
 */
type SClient = SupabaseClient;

let _serverClient: SClient | null = null;

/**
 * Return a singleton Supabase service client for server environments
 * (Next.js Route Handlers / Server Actions).
 */
export function getSupabaseServer(): SClient {
  if (_serverClient) return _serverClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE envs. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE."
    );
  }

  _serverClient = createClient(url, serviceKey, {
    auth: {
      // This is a server-side client; no need to persist/refresh session.
      persistSession: false,
      autoRefreshToken: false,
    },
  }) as SClient;

  return _serverClient;
}

/**
 * Back-compat alias: some code may import { supabaseAdmin } directly.
 * Usage: supabaseAdmin.from("table")...
 */
export const supabaseAdmin: SClient = getSupabaseServer();
