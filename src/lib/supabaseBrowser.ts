// lib/supabaseBrowser.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Browser client – JANGAN taruh service role di sini */
let _client: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  _client = createClient(url, anon);
  return _client;
}
