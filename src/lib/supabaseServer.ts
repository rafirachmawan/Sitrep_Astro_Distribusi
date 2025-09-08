// lib/supabaseServer.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _server: SupabaseClient | null = null;

/** HANYA dipakai di server/API route. Aman: pakai SERVICE ROLE */
export function getSupabaseServer(): SupabaseClient {
  if (_server) return _server;

  // (Opsional) cegah dipanggil di browser
  // if (typeof window !== "undefined") {
  //   throw new Error("getSupabaseServer() hanya untuk server/API route.");
  // }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE!;

  _server = createClient(url, service, {
    auth: { persistSession: false },
  });

  return _server;
}
