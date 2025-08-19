// src/lib/roleContent.ts
import type { Role } from "@/components/AuthProvider";
import type { TabDef } from "@/lib/types";

export type RoleContentMap = {
  [K in Role]?: Partial<Record<TabDef, string>>;
};

const KEY = "sitrep-role-content";

export function readRoleContent(): RoleContentMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RoleContentMap) : {};
  } catch {
    return {};
  }
}

export function writeRoleContent(data: RoleContentMap) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function getRoleTabContent(role: Role, tab: TabDef): string {
  const all = readRoleContent();
  return all[role]?.[tab] ?? "";
}

export function setRoleTabContent(role: Role, tab: TabDef, content: string) {
  const all = readRoleContent();
  const next: RoleContentMap = {
    ...all,
    [role]: { ...(all[role] ?? {}), [tab]: content },
  };
  writeRoleContent(next);
}
