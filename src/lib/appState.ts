// bebas: /src/lib/appState.ts
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
  | { kind: "number"; value: string; note?: string; suffix?: string }
  | { kind: "score"; value: number; note?: string }
  | {
      kind: "compound";
      value: string | null;
      extras?: { text?: string; currency?: string };
      note?: string;
    };

export type ChecklistState = Record<SectionKey, { [rowKey: string]: RowValue }>;

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
  weekly: Record<Principal, boolean[]>;
  ketepatanFodks: boolean;
};

export type SpartaState = {
  deadline: string;
  steps: boolean[];
  progressText: string;
  nextAction: string;
};

export type AgendaEntry = {
  id: string;
  date: string;
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

export function initChecklist(): ChecklistState {
  return {
    kas: {},
    buku: {},
    ar: {},
    klaim: {},
    pengiriman: {},
    setoran: {},
    pembelian: {},
    faktur: {},
    retur: {},
    marketing: {},
  };
}

export function initEvaluasi(): AppState["evaluasi"] {
  return {
    attitude: { hari: 1, scores: {}, notes: {} },
    kompetensi: {
      namaKasir: "",
      namaSalesAdmin: "",
      kesalahanMingguIni: "",
      scores: {},
      notes: {},
    },
  };
}

export function createInitialAppState(): AppState {
  return {
    header: {
      leader: "(Auto-fill from user)",
      target: "(Auto-fill)",
      depo: "(Auto-fill)",
    },
    checklist: initChecklist(),
    evaluasi: initEvaluasi(),
    target: {
      targetSelesai: "",
      klaimSelesai: { FRI: false, SPJ: false, APA: false, WPL: false },
      weekly: {
        FRI: [false, false, false, false],
        SPJ: [false, false, false, false],
        APA: [false, false, false, false],
        WPL: [false, false, false, false],
      },
      ketepatanFodks: false,
    },
    sparta: {
      deadline: "",
      steps: [false, false, false, false],
      progressText: "",
      nextAction: "",
    },
    agenda: { entries: [] },
  };
}
