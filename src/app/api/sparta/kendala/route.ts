import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

/** === Types === */
type KendalaRow = {
  id: string; // uuid
  account_id: string;
  project_id: string;
  note: string;
  created_at: string; // ISO
};

/** Helper format error */
function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

/** GET ?accountId=...&projectId=... : daftar kendala milik akun tsb untuk satu project */
export async function GET(req: Request) {
  const sb = getSupabaseServer();
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId") || "";
  const projectId = searchParams.get("projectId") || "";

  if (!accountId || !projectId) {
    return NextResponse.json(
      { error: "accountId dan projectId wajib diisi" },
      { status: 400 }
    );
  }

  const { data, error } = await sb
    .from("sparta_kendala_logs")
    .select("*")
    .eq("account_id", accountId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = (data ?? []) as KendalaRow[];
  return NextResponse.json({ items });
}

/** POST {accountId, projectId, note} : tambah catatan kendala */
export async function POST(req: Request) {
  const sb = getSupabaseServer();

  try {
    const body = (await req.json()) as {
      accountId?: string;
      projectId?: string;
      note?: string;
    };

    const accountId = (body.accountId || "").trim();
    const projectId = (body.projectId || "").trim();
    const note = (body.note || "").trim();

    if (!accountId || !projectId || !note) {
      return NextResponse.json(
        { error: "accountId, projectId, dan note wajib diisi" },
        { status: 400 }
      );
    }

    const { error } = await sb.from("sparta_kendala_logs").insert({
      account_id: accountId,
      project_id: projectId,
      note,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

/** DELETE ?id=...&accountId=... : hapus satu catatan kendala milik accountId tsb */
export async function DELETE(req: Request) {
  const sb = getSupabaseServer();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") || "";
  const accountId = searchParams.get("accountId") || "";

  if (!id || !accountId) {
    return NextResponse.json(
      { error: "id dan accountId wajib diisi" },
      { status: 400 }
    );
  }

  // Safety: pastikan row memang milik accountId tsb
  const { data: row, error: selErr } = await sb
    .from("sparta_kendala_logs")
    .select("id, account_id")
    .eq("id", id)
    .single();

  if (selErr) {
    return NextResponse.json({ error: selErr.message }, { status: 500 });
  }
  if (!row || row.account_id !== accountId) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  }

  const { error: delErr } = await sb
    .from("sparta_kendala_logs")
    .delete()
    .eq("id", id);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
