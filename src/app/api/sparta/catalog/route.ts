// src/app/api/sparta/catalog/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

/** === Types === */
type TargetRole = "admin" | "sales" | "gudang";

type ProjectDef = {
  id: string;
  title: string;
  steps: string[];
  deadline: string; // "YYYY-MM-DD" atau "" (kosong)
  targetRole: TargetRole;
  position?: number;
};

/** Bentuk row di Supabase */
type SpartaCatalogRow = {
  id: string;
  title: string;
  steps: unknown; // jsonb
  deadline: string | null; // DATE
  target_role: TargetRole;
  position: number | null;
  updated_by: string | null;
  updated_at: string; // timestamptz (ISO)
};

/** Helper aman untuk konversi row -> ProjectDef */
function rowToProject(r: SpartaCatalogRow, fallbackIndex = 0): ProjectDef {
  const stepsArr = Array.isArray(r.steps) ? (r.steps as unknown[]) : [];
  const steps = stepsArr.map((s) => String(s));
  return {
    id: r.id,
    title: r.title,
    steps,
    deadline: r.deadline ?? "",
    targetRole: r.target_role,
    position: r.position ?? fallbackIndex,
  };
}

/** Helper aman untuk format error unknown */
function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/** GET: Mengambil semua catalog project dari Supabase */
export async function GET() {
  const sb = getSupabaseServer();

  const { data, error } = await sb
    .from("sparta_catalog_projects")
    .select("*")
    .order("position", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as SpartaCatalogRow[];
  const items: ProjectDef[] = rows.map((r, i) => rowToProject(r, i));

  return NextResponse.json({ items });
}

/** PUT: Simpan perubahan catalog (dipanggil dari UI superadmin) */
export async function PUT(req: Request) {
  const sb = getSupabaseServer();

  try {
    const body = (await req.json()) as {
      items?: ProjectDef[];
      updatedBy?: string | null;
    };

    const incoming: ProjectDef[] = Array.isArray(body.items) ? body.items : [];
    const updatedBy = body.updatedBy ?? null;

    // Ambil data existing -> cari ID yang harus dihapus
    const { data: existing, error: selErr } = await sb
      .from("sparta_catalog_projects")
      .select("id");

    if (selErr) {
      return NextResponse.json({ error: selErr.message }, { status: 500 });
    }

    const existingIds = (existing ?? []).map((r) => r.id as string);
    const incomingIds = new Set(incoming.map((x) => x.id));
    const toDelete = existingIds.filter((id) => !incomingIds.has(id));

    // Upsert semua incoming (posisi diambil dari field position atau index)
    if (incoming.length > 0) {
      const rows = incoming.map((p, idx) => ({
        id: p.id,
        title: p.title?.trim() || "Proyek",
        steps: p.steps ?? [],
        deadline: p.deadline ? p.deadline : null,
        target_role: p.targetRole,
        position: typeof p.position === "number" ? p.position : idx,
        updated_by: updatedBy,
      }));

      const { error: upErr } = await sb
        .from("sparta_catalog_projects")
        .upsert(rows, { onConflict: "id" });

      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }
    }

    // Hapus row yang tidak ada di incoming
    if (toDelete.length > 0) {
      const { error: delErr } = await sb
        .from("sparta_catalog_projects")
        .delete()
        .in("id", toDelete);
      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
