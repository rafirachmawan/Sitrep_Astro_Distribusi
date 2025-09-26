// src/app/api/users/[id]/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer, supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

/** Cookie parser kecil (fallback mode demo) */
function parseCookie(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("=") || "");
  }
  return out;
}

/** Cek superadmin via Supabase; fallback ke cookie demo */
async function assertSuperadmin(request?: Request): Promise<string | null> {
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
    /* ignore */
  }

  if (request) {
    const ck = parseCookie(request.headers.get("cookie"));
    if ((ck["sitrep-role"] || "").toLowerCase() === "superadmin") {
      return ck["sitrep-userid"] || "demo:superadmin";
    }
  }
  return null;
}

/** Bentuk context supaya tidak pakai any */
type CtxShape = { params?: { id?: string } };

export async function DELETE(request: Request, ctx: unknown) {
  const { params } = (ctx ?? {}) as CtxShape;
  const id = params?.id;

  const requesterId = await assertSuperadmin(request);
  if (!requesterId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!id) {
    return NextResponse.json({ error: "id wajib" }, { status: 400 });
  }
  if (id === requesterId) {
    return NextResponse.json(
      { error: "Tidak boleh menghapus akun diri sendiri." },
      { status: 400 }
    );
  }

  const admin = getSupabaseServer();

  // 1) Hapus profile (abaikan 'no rows' = PGRST116)
  const { error: perr } = await admin.from("profiles").delete().eq("id", id);
  if (perr && perr.code !== "PGRST116") {
    return NextResponse.json({ error: perr.message }, { status: 500 });
  }

  // 2) Hapus auth user
  const del = await admin.auth.admin.deleteUser(id);
  if (del.error) {
    return NextResponse.json({ error: del.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
