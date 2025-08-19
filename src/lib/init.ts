import type { AppState } from "./types";

export function initAppState(): AppState {
  return {
    header: { leader: "", target: "", depo: "" }, // <— kosong; akan diisi dari auth
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
