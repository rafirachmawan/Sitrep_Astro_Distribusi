import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { UserOptions } from "jspdf-autotable";
import type { AppState, RowValue, Principal } from "./types";
import { PRINCIPALS } from "./types";

/* ====== Tipe util ====== */
type Kind<K extends RowValue["kind"]> = Extract<RowValue, { kind: K }>;
type AutoTableDoc = jsPDF & { lastAutoTable?: { finalY: number } };

// didDrawPage expects an arg; kita definisikan tipenya supaya aman tanpa any
type DidDraw = NonNullable<UserOptions["didDrawPage"]>;
type DidDrawArg = Parameters<DidDraw>[0];

/* ====== Main ====== */
export function generatePdf(
  archive: { date: string; state: AppState; signatureDataUrl?: string },
  autoDownload = true
) {
  const { date, state, signatureDataUrl } = archive;
  const doc: jsPDF = new jsPDF({ unit: "pt", format: "a4" });
  const BLUE: [number, number, number] = [29, 78, 216];
  const SLATE: [number, number, number] = [71, 85, 105];
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Header + footer (didDrawPage) — parameternya tidak kita gunakan
  const headerFooter: DidDraw = () => {
    doc.setFillColor(...BLUE);
    doc.rect(40, 20, pageW - 80, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("LEADER MONITORING DAILY", 50, 39);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(date, pageW - 50, 39, { align: "right" });

    doc.setTextColor(120);
    doc.setFontSize(9);
    const pageStr = `Hal. ${doc.getNumberOfPages()}`;
    doc.text(pageStr, pageW - 50, pageH - 16, { align: "right" });
    doc.text(`${state.header.leader} • ${state.header.depo}`, 50, pageH - 16);
  };

  // Wrapper agar bisa dipanggil tanpa argumen, tetap tanpa any
  const drawHeaderFooter = () => headerFooter({} as unknown as DidDrawArg);

  const commonTableOpts: Partial<UserOptions> = {
    theme: "grid",
    headStyles: {
      fillColor: BLUE,
      textColor: 255,
      fontStyle: "bold",
      halign: "left",
    },
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 5,
      textColor: SLATE,
    },
    alternateRowStyles: {
      fillColor: [246, 248, 252] as [number, number, number],
    },
    margin: { left: 40, right: 40 },
    didDrawPage: headerFooter,
  };

  const getFinalY = (d: jsPDF) =>
    (d as AutoTableDoc).lastAutoTable?.finalY ?? 0;

  doc.setTextColor(...SLATE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Leader: ${state.header.leader}`, 50, 78);
  doc.text(`Target: ${state.header.target}`, 50, 96);
  doc.text(`Depo: ${state.header.depo}`, 50, 114);

  let y = 132;
  const sectionTitle = (title: string) => {
    doc.setDrawColor(...BLUE);
    doc.setLineWidth(2);
    doc.line(40, y, 180, y);
    doc.setTextColor(...SLATE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title, 40, y + 18);
    y += 28;
  };

  const valToString = (v?: RowValue): string => {
    if (!v) return "-";
    switch (v.kind) {
      case "options":
        return v.value ?? "-";
      case "number":
        return String((v as Kind<"number">).value ?? "-");
      case "score":
        return String((v as Kind<"score">).value ?? "-");
      case "compound": {
        const c = v as Kind<"compound">;
        const extras = [c.extras?.text, c.extras?.currency]
          .filter(Boolean)
          .join(" • ");
        return [c.value || "-", extras].filter(Boolean).join(" | ");
      }
    }
  };

  // CHECKLIST
  sectionTitle("Checklist Area");
  const pushSection = (title: string, sec: Record<string, RowValue>) => {
    const keys = Object.keys(sec);
    if (keys.length === 0) return;
    autoTable(doc, {
      ...commonTableOpts,
      startY: y,
      head: [[title, "Status / Isian", "Catatan"]], // <- FIX: hapus bracket ekstra
      body: keys.map((k) => {
        const rv = sec[k];
        const label = k.replace(/-/g, " ");
        return [label, valToString(rv), rv?.note || ""];
      }),
      columnStyles: {
        0: { cellWidth: 220 },
        1: { cellWidth: 170 },
        2: { cellWidth: "auto" },
      },
    });
    y = getFinalY(doc) + 16;
  };
  pushSection("Kas Kecil", state.checklist.kas);
  pushSection("Buku Penunjang", state.checklist.buku);
  pushSection("AR", state.checklist.ar);

  // EVALUASI
  sectionTitle("Evaluasi Tim");
  const attScores: Record<string, number> =
    state.evaluasi.attitude.scores || {};
  const attAvg =
    Object.keys(attScores).length > 0
      ? Math.round(
          (Object.values(attScores).reduce((a, b) => a + b, 0) /
            Object.keys(attScores).length) *
            10
        ) / 10
      : "-";
  autoTable(doc, {
    ...commonTableOpts,
    startY: y,
    head: [["Attitude (HEBAT)", "Skor", "Catatan"]],
    body: Object.entries(attScores).map(([k, v]) => [
      k,
      String(v),
      state.evaluasi.attitude.notes?.[k] || "",
    ]),
    columnStyles: {
      0: { cellWidth: 250 },
      1: { cellWidth: 70, halign: "center" },
      2: { cellWidth: "auto" },
    },
    foot: [["Rata-rata", String(attAvg), ""]],
    footStyles: {
      fillColor: [234, 240, 255],
      textColor: SLATE,
      fontStyle: "bold",
    },
  });
  y = getFinalY(doc) + 16;

  const komScores: Record<string, number> =
    state.evaluasi.kompetensi.scores || {};
  autoTable(doc, {
    ...commonTableOpts,
    startY: y,
    head: [["Kompetensi", "Skor", "Catatan"]],
    body: Object.entries(komScores).map(([k, v]) => [
      k.replace(/([A-Z])/g, " $1").trim(),
      String(v),
      state.evaluasi.kompetensi.notes?.[k] || "",
    ]),
    columnStyles: {
      0: { cellWidth: 250 },
      1: { cellWidth: 70, halign: "center" },
      2: { cellWidth: "auto" },
    },
  });
  y = getFinalY(doc) + 10;

  if (state.evaluasi.kompetensi.kesalahanMingguIni) {
    doc.setFont("helvetica", "bold");
    doc.text("Kesalahan Minggu Ini", 40, y + 12);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(
      state.evaluasi.kompetensi.kesalahanMingguIni,
      pageW - 80
    );
    doc.text(lines, 40, y + 30);
    y = y + 30 + lines.length * 12 + 10;
  }

  // TARGET
  sectionTitle("Target & Achievement");
  autoTable(doc, {
    ...commonTableOpts,
    startY: y,
    head: [["Penyelesaian Klaim Bulan Ini", "Selesai?"]],
    body: PRINCIPALS.map((p) => [
      p,
      state.target.klaimSelesai[p as Principal] ? "✓" : "—",
    ]),
    columnStyles: {
      0: { cellWidth: 240 },
      1: { cellWidth: 80, halign: "center" },
    },
  });
  y = getFinalY(doc) + 10;

  doc.setFont("helvetica", "normal");
  doc.text(
    `Target selesai bulan ini: ${state.target.targetSelesai || "-"}`,
    40,
    y + 12
  );
  doc.text(
    `Ketepatan Input Fodks: ${state.target.ketepatanFodks ? "Ya" : "Tidak"}`,
    40,
    y + 28
  );
  y += 40;

  autoTable(doc, {
    ...commonTableOpts,
    startY: y,
    head: [["Prinsipal", "M1", "M2", "M3", "M4"]],
    body: PRINCIPALS.map((p) => [
      p,
      state.target.weekly[p][0] ? "✓" : "—",
      state.target.weekly[p][1] ? "✓" : "—",
      state.target.weekly[p][2] ? "✓" : "—",
      state.target.weekly[p][3] ? "✓" : "—",
    ]),
    columnStyles: {
      0: { cellWidth: 180 },
      1: { halign: "center" },
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "center" },
    },
  });
  y = getFinalY(doc) + 16;

  // SPARTA
  sectionTitle("SPARTA Project Tracking");
  const steps: boolean[] = state.sparta.steps || [];
  const percent = Math.round((steps.filter(Boolean).length / 4) * 100);
  doc.text(`Deadline: ${state.sparta.deadline || "-"}`, 40, y + 12);
  doc.text(`Progress: ${percent}%`, pageW - 40, y + 12, { align: "right" });
  y += 20;

  autoTable(doc, {
    ...commonTableOpts,
    startY: y,
    head: [["Langkah", "Status"]],
    body: [
      ["1. menyelesaikan Q3 2024", steps[0] ? "✓" : "—"],
      ["2. menyelesaikan Q4 2024", steps[1] ? "✓" : "—"],
      ["3. Q1 2025 termasuk reward Q1 2025", steps[2] ? "✓" : "—"],
      ["4. Q2 2025 + reward proporsional Q2 2025", steps[3] ? "✓" : "—"],
    ],
    columnStyles: { 0: { cellWidth: 360 }, 1: { halign: "center" } },
  });
  y = getFinalY(doc) + 12;

  if (state.sparta.progressText) {
    doc.setFont("helvetica", "bold");
    doc.text("Uraian Progress", 40, y + 12);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(state.sparta.progressText, pageW - 80);
    doc.text(lines, 40, y + 30);
    y = y + 30 + lines.length * 12 + 10;
  }
  if (state.sparta.nextAction) {
    doc.setFont("helvetica", "bold");
    doc.text("Next Action", 40, y + 12);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(state.sparta.nextAction, pageW - 80);
    doc.text(lines, 40, y + 30);
    y = y + 30 + lines.length * 12 + 10;
  }

  // AGENDA HARI INI
  sectionTitle("Agenda & Jadwal (hari ini)");
  const todays = state.agenda?.entries?.filter((e) => e.date === date) ?? [];
  if (todays.length) {
    autoTable(doc, {
      ...commonTableOpts,
      startY: y,
      head: [["Plan", "Realisasi"]],
      body: todays.map((e) => [
        e.plan.length ? "• " + e.plan.join("\n• ") : "—",
        e.realisasi.length ? "• " + e.realisasi.join("\n• ") : "—",
      ]),
      columnStyles: { 0: { cellWidth: 260 }, 1: { cellWidth: "auto" } },
    });
    y = getFinalY(doc) + 16;
  } else {
    doc.setFont("helvetica", "normal");
    doc.text("(Tidak ada agenda yang dicatat untuk hari ini)", 40, y + 12);
    y += 28;
  }

  // TTD
  if (y > pageH - 160) doc.addPage();
  drawHeaderFooter(); // panggil wrapper bebas-any

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Persetujuan & Tanda Tangan", 40, y + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    "Dengan ini saya menyatakan laporan di atas benar dan dapat dipertanggungjawabkan.",
    40,
    y + 36
  );
  const boxY = y + 50;
  doc.setDrawColor(200);
  doc.rect(pageW - 260, boxY, 200, 100);
  if (signatureDataUrl) {
    doc.addImage(signatureDataUrl, "PNG", pageW - 255, boxY + 10, 190, 60);
  } else {
    doc.setTextColor(150);
    doc.text("(tanda tangan belum tersedia)", pageW - 160, boxY + 60, {
      align: "center",
    });
    doc.setTextColor(...SLATE);
  }
  doc.text(
    state.header.leader || "__________________",
    pageW - 160,
    boxY + 120,
    { align: "center" }
  );

  const filename = `SITREP-${date}`;
  if (autoDownload) doc.save(`${filename}.pdf`);
  return doc;
}
