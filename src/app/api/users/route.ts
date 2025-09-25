// src/app/api/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { supabaseServer } from "@/lib/supabaseServer";

type Role = "superadmin" | "admin" | "sales" | "gudang";

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

async function assertSuperadmin() {
  const s = await supabaseServer(); // ⬅️ penting: await
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) return null;

  const { data: prof } = await s
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return prof?.role === "superadmin" ? user.id : null;
}

export async function GET() {
  const ok = await assertSuperadmin();
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, display_name, role, created_at")
    .order("created_at", { ascending: false });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}

export async function POST(req: NextRequest) {
  const ok = await assertSuperadmin();
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

  // 1) buat user auth
  const created = await supabaseAdmin.auth.admin.createUser({
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
  const { error: perr } = await supabaseAdmin
    .from("profiles")
    .insert({ id: userId, display_name: displayName, role });

  if (perr) {
    // rollback kalau gagal bikin profile
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: perr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: userId });
}
