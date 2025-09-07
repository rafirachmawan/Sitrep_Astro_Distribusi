// lib/supabaseBrowser.ts
import { createClient } from "@supabase/supabase-js";

let _client: ReturnType<typeof createClient<any, "public", any>> | null = null;

export function getSupabaseBrowser() {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  _client = createClient(url, anon);
  return _client;
}
