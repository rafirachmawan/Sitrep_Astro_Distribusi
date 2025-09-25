import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer, supabaseServer } from "@/lib/supabaseServer";

type Role = "superadmin" | "admin" | "sales" | "gudang";

export const dynamic = "force-dynamic";

/** Sama seperti di /api/users/route.ts (disalin agar mandiri) */
async function assertSuperadmin(req?: NextRequest): Promise<string | null> {
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
    /* fallback di bawah */
  }

  if (req) {
    const role = (req.cookies.get("sitrep-role")?.value || "").toLowerCase();
    if (role === "superadmin") {
      const id = req.cookies.get("sitrep-userid")?.value || "demo:superadmin";
      return id;
    }
  }
  return null;
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: { id?: string } }
) {
  const requesterId = await assertSuperadmin(req);
  if (!requesterId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = ctx.params.id || "";
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // Cegah superadmin menghapus dirinya sendiri
  if (requesterId === id) {
    return NextResponse.json(
      { error: "Tidak bisa menghapus akun sendiri." },
      { status: 400 }
    );
  }

  const admin = getSupabaseServer();

  // 1) Hapus profile terlebih dahulu (abaikan jika tidak ada)
  const { error: perr } = await admin.from("profiles").delete().eq("id", id);
  if (perr && perr.code !== "PGRST116") {
    // PGRST116 = row not found → boleh diabaikan
    return NextResponse.json({ error: perr.message }, { status: 500 });
  }

  // 2) Hapus user di Auth
  const del = await admin.auth.admin.deleteUser(id);
  if (del.error) {
    return NextResponse.json({ error: del.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
