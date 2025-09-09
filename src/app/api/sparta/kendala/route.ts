import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

type DBKendalaRow = {
  id: string;
  account_id: string;
  project_id: string;
  note: string;
  created_at: string;
};

function iso(v?: string | null, fb?: string) {
  if (!v) return fb ?? new Date(0).toISOString();
  const d = new Date(v);
  return isNaN(+d) ? fb ?? new Date(0).toISOString() : d.toISOString();
}

/** List kendala:
 * - Per proyek: ?accountId=...&projectId=...
 * - Riwayat rentang tanggal: ?from=yyyy-mm-dd&to=yyyy-mm-dd[&accountId=...]
 */
export async function GET(req: NextRequest) {
  try {
    const u = new URL(req.url);
    const accountId = u.searchParams.get("accountId");
    const projectId = u.searchParams.get("projectId");
    const from = u.searchParams.get("from");
    const to = u.searchParams.get("to");

    let q = supabaseAdmin
      .from("sparta_kendala")
      .select("id,account_id,project_id,note,created_at")
      .order("created_at", { ascending: false });

    if (projectId && accountId) {
      q = q.eq("project_id", projectId).eq("account_id", accountId);
    } else {
      // mode riwayat rentang
      const startIso = iso(from, new Date(0).toISOString());
      const endIso = iso(to, new Date().toISOString());
      q = q.gte("created_at", startIso).lte("created_at", endIso);
      if (accountId) q = q.eq("account_id", accountId);
    }

    const { data, error } = await q.returns<DBKendalaRow[]>();
    if (error) throw error;

    return NextResponse.json({ items: data }, { status: 200 });
  } catch (e) {
    console.error("GET /api/sparta/kendala", e);
    return NextResponse.json(
      { error: "failed_to_fetch_kendala" },
      { status: 500 }
    );
  }
}

/** Simpan catatan kendala: { accountId, projectId, note } */
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

/** Hapus catatan: ?id=... [&accountId=...]  (optional: batasi pemilik) */
export async function DELETE(req: NextRequest) {
  try {
    const u = new URL(req.url);
    const id = u.searchParams.get("id");
    const accountId = u.searchParams.get("accountId");
    if (!id) {
      return NextResponse.json({ error: "missing_id" }, { status: 400 });
    }

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
