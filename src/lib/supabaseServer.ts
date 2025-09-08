// src/lib/supabaseServer.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase berbasis service-role untuk server (Next.js API routes / server actions).
 * Jangan pernah expose SERVICE_ROLE ke client/browser.
 */
let _serverClient: SupabaseClient | null = null;

export function getSupabaseServer(): SupabaseClient {
  if (_serverClient) return _serverClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE envs. Pastikan NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE terisi."
    );
  }

  _serverClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _serverClient;
}

/**
 * Alias kompatibel untuk kode lama yang mengimpor { supabaseAdmin } sebagai instance client.
 * Boleh dipakai langsung: supabaseAdmin.from("table")...
 */
export const supabaseAdmin: SupabaseClient = getSupabaseServer();
