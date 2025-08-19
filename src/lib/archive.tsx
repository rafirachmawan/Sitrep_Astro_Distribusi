import type { AppState } from "./types";
export type Archive = {
  date: string;
  state: AppState;
  signatureDataUrl?: string;
};

const ARCHIVE_KEY = "sitrep-archives";
export function readArchives(): Archive[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    return raw ? (JSON.parse(raw) as Archive[]) : [];
  } catch {
    return [];
  }
}
export function writeArchives(arr: Archive[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(arr));
}
export { ARCHIVE_KEY };
