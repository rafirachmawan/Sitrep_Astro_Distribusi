// src/lib/supabaseServer.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/** SERVICE-ROLE (admin). JANGAN expose ke browser. */
type SClient = SupabaseClient;

let _serviceClient: SClient | null = null;

export function getSupabaseServer(): SClient {
  if (_serviceClient) return _serviceClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE envs. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE."
    );
  }

  _serviceClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as SClient;

  return _serviceClient;
}

/** Alias back-compat */
export const supabaseAdmin: SClient = getSupabaseServer();

/**
 * SSR client berbasis cookies (ANON KEY).
 * Dibuat async agar aman untuk Next 14 (sync) **dan** Next 15 (async).
 * (await pada non-Promise juga aman di JS)
 */
export async function supabaseServer(): Promise<SClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Missing SUPABASE envs. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  // Next 14: cookies() sync, Next 15: Promise — keduanya aman dengan await
  const store = await cookies();

  const client = createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return store.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        store.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        store.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  }) as unknown as SClient;

  return client;
}
