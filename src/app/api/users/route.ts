// src/app/api/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer, supabaseServer } from "@/lib/supabaseServer";

type Role = "superadmin" | "admin" | "sales" | "gudang";

// Pastikan route ini selalu dinamis (jangan diprerender saat build)
export const dynamic = "force-dynamic";

/** Normalisasi email internal dari username */
function toEmail(input: string) {
  const s = input.trim();
  if (s.includes("@")) return s.toLowerCase();
  const slug =
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 40) || "user";
  return `${slug}@app.local`;
}

/**
 * Cek superadmin:
 * 1) Cabang utama: pakai session Supabase (SSR client) + profiles.role.
 * 2) Fallback (mode demo): baca cookie yang diset AuthProvider (sitrep-role, sitrep-userid).
 */
async function assertSuperadmin(req?: NextRequest): Promise<string | null> {
  // 1) Coba sesi Supabase dulu (logika asli tidak diubah)
  try {
    const s = await supabaseServer();
    const {
      data: { user },
    } = await s.auth.getUser();

    if (user) {
      const { data: prof } = await s
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (prof?.role === "superadmin") return user.id;
    }
  } catch {
    // diam: lanjut fallback cookie
  }

  // 2) Fallback cookie (mode demo): AuthProvider akan set cookie ini saat signIn
  if (req) {
    const role = (req.cookies.get("sitrep-role")?.value || "").toLowerCase();
    if (role === "superadmin") {
      const id = req.cookies.get("sitrep-userid")?.value || "demo:superadmin";
      return id;
    }
  }

  return null;
}

/* ========================= HANDLERS ========================= */

export async function GET(req: NextRequest) {
  const ok = await assertSuperadmin(req);
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // SERVICE client dibuat saat handler dipanggil (bukan di module scope)
  const admin = getSupabaseServer();

  const { data, error } = await admin
    .from("profiles")
    .select("id, display_name, role, created_at")
    .order("created_at", { ascending: false });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}

export async function POST(req: NextRequest) {
  const ok = await assertSuperadmin(req);
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const username: string = body?.username || "";
  const password: string = body?.password || "";
  const displayName: string = body?.displayName || username;
  const role: Role = body?.role;

  if (!username || !password) {
    return NextResponse.json(
      { error: "username & password wajib" },
      { status: 400 }
    );
  }
  if (!["superadmin", "admin", "sales", "gudang"].includes(role)) {
    return NextResponse.json({ error: "role tidak valid" }, { status: 400 });
  }

  const email = toEmail(username);
  const admin = getSupabaseServer();

  // 1) buat user auth
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (created.error) {
    return NextResponse.json({ error: created.error.message }, { status: 400 });
  }

  const userId = created.data.user!.id;

  // 2) insert profile
  const { error: perr } = await admin
    .from("profiles")
    .insert({ id: userId, display_name: displayName, role });

  if (perr) {
    // rollback kalau profile gagal
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: perr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: userId });
}
