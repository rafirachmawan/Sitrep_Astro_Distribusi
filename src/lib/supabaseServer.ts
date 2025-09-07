// lib/supabaseServer.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _server: SupabaseClient | null = null;

/** Server-only client (pakai Service Role) */
export function getSupabaseServer(): SupabaseClient {
  if (_server) return _server;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  // ✅ sesuai ENV kamu:
  const service = process.env.SUPABASE_SERVICE_ROLE!;

  if (!url || !service) {
    throw new Error(
      "[supabaseServer] ENV kurang. Perlu NEXT_PUBLIC_SUPABASE_URL & SUPABASE_SERVICE_ROLE"
    );
  }

  _server = createClient(url, service, {
    auth: { persistSession: false },
    global: { headers: { "x-client-ctx": "server" } },
  });

  return _server;
}
