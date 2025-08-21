import type { AppState } from "./types";
import { PRINCIPALS, type Principal } from "./types"; // ⬅️ tambah import

// helpers untuk bikin record per-principal
const makeRecord = <T>(val: T) =>
  Object.fromEntries(PRINCIPALS.map((p) => [p, val])) as Record<Principal, T>;

const makeWeekRecord = () =>
  Object.fromEntries(
    PRINCIPALS.map((p) => [p, [false, false, false, false] as boolean[]])
  ) as Record<Principal, boolean[]>;

export function initAppState(): AppState {
  return {
    header: { leader: "", target: "", depo: "" },
    checklist: {
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
    },
    evaluasi: {
      attitude: { hari: 1, scores: {}, notes: {} },
      kompetensi: {
        namaKasir: "",
        namaSalesAdmin: "",
        kesalahanMingguIni: "",
        scores: {},
        notes: {},
      },
    },
    target: {
      targetSelesai: "",
      klaimSelesai: makeRecord(false),
      weekly: makeWeekRecord(),
      ketepatanFodks: false,

      // ⬇️ WAJIB: inisialisasi semua deadline
      deadlines: {
        klaim: makeRecord(""),
        weekly: makeRecord(""),
        targetSelesai: "",
        fodks: "",
      },
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
