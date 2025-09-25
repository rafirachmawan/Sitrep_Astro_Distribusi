// src/lib/supabaseServer.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/** SERVICE-ROLE client (jangan diexpose ke browser) */
type SClient = SupabaseClient;

let _serviceClient: SClient | null = null;

/** Singleton service client (pakai SERVICE_ROLE) */
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
  });

  return _serviceClient;
}

/** Alias lama (kompatibilitas) */
export const supabaseAdmin: SClient = getSupabaseServer();

/** Bentuk minimal API cookies() yang kita butuhkan */
type CookieStore = {
  get: (name: string) => { value: string } | undefined;
  set?: (opts: { name: string; value: string } & CookieOptions) => void;
};

/**
 * SSR client berbasis session/cookies (ANON KEY).
 * Dibuat async agar kompatibel Next 14 (sync) & Next 15 (async).
 *
 * Pemakaian:
 *   const s = await supabaseServer();
 *   const { data: { user } } = await s.auth.getUser();
 */
export async function supabaseServer(): Promise<SClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Missing SUPABASE envs. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  // Next 15: cookies() bisa Promise; Next 14: sync.
  // Casting via 'unknown' untuk menghindari 'any'.
  const store = (await (cookies() as unknown)) as CookieStore;

  const client = createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return store.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        // Pada environment read-only, 'set' bisa tidak tersedia (optional)
        store.set?.({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        store.set?.({ name, value: "", ...options, maxAge: 0 });
      },
    },
  }) as unknown as SClient;

  return client;
}
