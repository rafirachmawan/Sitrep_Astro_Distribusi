// src/lib/types.ts
export type TabDef =
  | "checklist"
  | "evaluasi"
  | "target"
  | "sparta"
  | "agenda"
  | "lampiran"
  | "achievement";

export type SectionKey =
  | "kas"
  | "buku"
  | "ar"
  | "klaim"
  | "pengiriman"
  | "setoran"
  | "pembelian"
  | "faktur"
  | "retur"
  | "marketing";

export type RowValue =
  | { kind: "options"; value: string | null; note?: string }
  | { kind: "number"; value: string; suffix?: string; note?: string }
  | { kind: "score"; value: number; note?: string }
  | {
      kind: "compound";
      value: string | null;
      note?: string;
      extras?: {
        text?: string;
        currency?: string;
        /** tambahan agar input angka di compound valid secara tipe */
        number?: string;
      };
    };

export type ChecklistState = Record<
  SectionKey,
  {
    [rowKey: string]: RowValue;
  }
>;

export type EvaluasiAttitude = {
  hari: 1 | 2 | 3 | 4 | 5 | 6;
  scores: Record<string, number>;
  notes: Record<string, string>;
};

export type EvaluasiKompetensi = {
  namaKasir: string;
  namaSalesAdmin: string;
  kesalahanMingguIni: string;
  scores: Record<string, number>;
  notes: Record<string, string>;
};

export const PRINCIPALS = ["FRI", "SPJ", "APA", "WPL"] as const;
export type Principal = (typeof PRINCIPALS)[number];

export type TargetState = {
  targetSelesai: string;
  klaimSelesai: Record<Principal, boolean>;
  weekly: Record<Principal, boolean[]>; // 4 minggu
  ketepatanFodks: boolean;
};

export type SpartaState = {
  deadline: string;
  steps: boolean[]; // 4 langkah UDI
  progressText: string;
  nextAction: string;
};

export type AgendaEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  plan: string[];
  realisasi: string[];
  planSubmitted?: boolean;
  realSubmitted?: boolean;
  createdAt: string;
  updatedAt: string;
};
export type AgendaState = { entries: AgendaEntry[] };

export type AppState = {
  header: { leader: string; target: string; depo: string };
  checklist: ChecklistState;
  evaluasi: { attitude: EvaluasiAttitude; kompetensi: EvaluasiKompetensi };
  target: TargetState;
  sparta: SpartaState;
  agenda: AgendaState;
};

// --- AUTH TYPES ---
export type UserRole = "superadmin" | "admin" | "sales" | "gudang";

export type AuthUser = {
  id: string;
  name: string;
  role: UserRole;
};

export type AuthState = {
  user: AuthUser | null;
};

// src/lib/types.ts

// ...ekspor/tipe lain

export type TabKey =
  | "checklist"
  | "evaluasi"
  | "target"
  | "sparta"
  | "agenda"
  | "lampiran"
  | "achievement";
