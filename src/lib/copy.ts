// src/lib/copy.ts
import type { Role } from "@/components/AuthProvider";
import type { TabDef } from "@/lib/types";

/** Teks yang bisa dioverride per tab */
export type TabCopy = {
  title?: string;
  instruction?: string;
};

/** Peta teks per role */
export type CopyMap = Partial<Record<TabDef, TabCopy>>;
export type RoleCopyMap = Partial<Record<Role, CopyMap>>;

const KEY = "sitrep-copy";

/** Default: dianggap sebagai "teks admin" */
export const defaultCopy: CopyMap = {
  checklist: {
    title: "Checklist Area",
    instruction:
      "Gunakan sub-tab di bawah. Semua isian akan masuk ke Lampiran.",
  },
  evaluasi: { title: "Evaluasi Tim", instruction: "" },
  target: { title: "Target & Achievement", instruction: "" },
  sparta: { title: "Project Tracking (SPARTA)", instruction: "" },
  agenda: { title: "Agenda & Jadwal", instruction: "" },
  lampiran: { title: "Lampiran & Rekapan PDF", instruction: "" },
  achievement: { title: "Achievement", instruction: "" },
};

export function readCopy(): RoleCopyMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RoleCopyMap) : {};
  } catch {
    return {};
  }
}

export function writeCopy(data: RoleCopyMap) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(data));
}

/** Merge default (admin) + override role */
export function getEffectiveCopy(role: Role | null): CopyMap {
  const base = defaultCopy;
  const all = readCopy();
  if (!role) return base;
  // superadmin tidak menimpa default; yang dioverride khusus sales/gudang
  const roleOverrides = all[role] ?? {};
  const merged: CopyMap = {};
  const allTabs = new Set<TabDef>([
    "checklist",
    "evaluasi",
    "target",
    "sparta",
    "agenda",
    "lampiran",
    "achievement",
  ] as TabDef[]);
  for (const t of allTabs) {
    merged[t] = { ...(base[t] ?? {}), ...(roleOverrides[t] ?? {}) };
  }
  return merged;
}

/** Simpan patch teks utk role+tab */
export function setCopy(role: Role, tab: TabDef, patch: Partial<TabCopy>) {
  const all = readCopy();
  const current = all[role] ?? {};
  const nextTab: TabCopy = { ...(current[tab] ?? {}), ...patch };
  const next: RoleCopyMap = { ...all, [role]: { ...current, [tab]: nextTab } };
  writeCopy(next);
}
