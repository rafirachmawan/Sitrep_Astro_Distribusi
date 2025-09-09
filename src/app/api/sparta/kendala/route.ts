import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DBKendalaRow = {
  id: string;
  account_id: string;
  project_id: string;
  note: string;
  created_at: string;
};

function toIsoStart(v: string | null): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(+d)) return null;
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function toIsoEnd(v: string | null): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(+d)) return null;
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

// GET — list by (accountId+projectId) ATAU by date range (opsional accountId)
export async function GET(req: NextRequest) {
  try {
    const u = new URL(req.url);
    const accountId = u.searchParams.get("accountId");
    const projectId = u.searchParams.get("projectId");
    const fromIso = toIsoStart(u.searchParams.get("from"));
    const toIso = toIsoEnd(u.searchParams.get("to"));

    const base = supabaseAdmin
      .from("sparta_kendala")
      .select("id,account_id,project_id,note,created_at")
      .order("created_at", { ascending: false });

    let q = base;

    if (projectId && accountId) {
      q = q.eq("project_id", projectId).eq("account_id", accountId);
    } else {
      if (fromIso) q = q.gte("created_at", fromIso);
      if (toIso) q = q.lte("created_at", toIso);
      if (accountId) q = q.eq("account_id", accountId);
    }

    // <- PANGGIL returns DI AKHIR
    const { data, error } = await q.returns<DBKendalaRow[]>();
    if (error) throw error;

    return NextResponse.json({ items: data ?? [] }, { status: 200 });
  } catch (e) {
    console.error("GET /api/sparta/kendala", e);
    return NextResponse.json(
      { error: "failed_to_fetch_kendala" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      accountId?: string;
      projectId?: string;
      note?: string;
    };
    if (!body.accountId || !body.projectId || !body.note?.trim()) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("sparta_kendala")
      .insert([
        {
          account_id: body.accountId,
          project_id: body.projectId,
          note: body.note.trim(),
        },
      ])
      .select("id,account_id,project_id,note,created_at")
      .single()
      .returns<DBKendalaRow>();

    if (error) throw error;
    return NextResponse.json({ item: data }, { status: 201 });
  } catch (e) {
    console.error("POST /api/sparta/kendala", e);
    return NextResponse.json(
      { error: "failed_to_insert_kendala" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const u = new URL(req.url);
    const id = u.searchParams.get("id");
    const accountId = u.searchParams.get("accountId");
    if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

    let q = supabaseAdmin.from("sparta_kendala").delete().eq("id", id);
    if (accountId) q = q.eq("account_id", accountId);

    const { error } = await q;
    if (error) throw error;

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("DELETE /api/sparta/kendala", e);
    return NextResponse.json(
      { error: "failed_to_delete_kendala" },
      { status: 500 }
    );
  }
}
