// "use client";
// import { useEffect, useMemo, useState } from "react";
// import { db } from "@/lib/firebase";
// import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";

// const statusOptions = ["Completed", "In Progress", "Not Started"] as const;

// function todayId() {
//   const d = new Date();
//   const m = String(d.getMonth() + 1).padStart(2, "0");
//   const day = String(d.getDate()).padStart(2, "0");
//   return `${d.getFullYear()}${m}${day}`; // 20250815
// }

// export default function ChecklistArea({
//   role,
// }: {
//   role: "salesman" | "admin" | "gudang" | null;
// }) {
//   const [rows, setRows] = useState<
//     { area: string; status: string; score: number; note: string }[]
//   >([]);
//   const [loading, setLoading] = useState(true);

//   // Template berbeda per role (bisa kamu ubah sesuai kebutuhan)
//   const template = useMemo(() => {
//     if (role === "salesman")
//       return [
//         "Kunjungan Toko",
//         "Follow-up Order",
//         "Update SPARTA",
//         "Laporan Pembayaran",
//       ];
//     if (role === "gudang")
//       return [
//         "Receiving Barang",
//         "Putaway & Staging",
//         "Picking & Packing",
//         "Dispatch & Loading",
//       ];
//     return [
//       "Kebersihan Area",
//       "Proses Klaim",
//       "Rekap Admin Harian",
//       "Dokumen Pengiriman",
//     ]; // admin default
//   }, [role]);

//   // Inisialisasi rows jika kosong
//   useEffect(() => {
//     if (rows.length === 0 && template.length) {
//       setRows(
//         template.map((a) => ({
//           area: a,
//           status: statusOptions[2],
//           score: 1,
//           note: "",
//         }))
//       );
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [template]);

//   // Load & autosync draft
//   const uid =
//     typeof window !== "undefined" ? localStorage.getItem("_uid") : null;
//   useEffect(() => {
//     // uid diset di Header setelah login; agar komponen tahu dokumen siapa
//     const u = uid;
//     if (!u) {
//       setLoading(false);
//       return;
//     }
//     const ref = doc(db, "drafts", u, "daily", todayId());
//     const unsub = onSnapshot(ref, (snap) => {
//       const data = snap.data() as any;
//       if (data?.rows) setRows(data.rows);
//       setLoading(false);
//     });
//     return () => unsub();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [uid]);

//   // Autosave (debounce 700ms)
//   useEffect(() => {
//     const u = uid;
//     if (!u) return;
//     const save = setTimeout(async () => {
//       const ref = doc(db, "drafts", u, "daily", todayId());
//       await setDoc(
//         ref,
//         { rows, role, updatedAt: serverTimestamp(), tab: "checklist" },
//         { merge: true }
//       );
//     }, 700);
//     return () => clearTimeout(save);
//   }, [rows, role, uid]);

//   if (loading) return <div>Loading...</div>;

//   return (
//     <div>
//       <div className="mb-3 p-3 rounded-xl bg-blue-50 text-sm text-blue-900">
//         <b>Instruksi:</b> berikan score 1–5 untuk setiap area. Data tersimpan
//         otomatis (autosave).
//       </div>
//       <div className="overflow-x-auto">
//         <table className="min-w-full text-sm">
//           <thead>
//             <tr className="bg-gray-50">
//               <th className="text-left p-2">#</th>
//               <th className="text-left p-2">Area Tanggung Jawab</th>
//               <th className="text-left p-2">Status</th>
//               <th className="text-left p-2">Score (1-5)</th>
//               <th className="text-left p-2">Catatan</th>
//             </tr>
//           </thead>
//           <tbody>
//             {rows.map((r, i) => (
//               <tr key={i} className="border-t">
//                 <td className="p-2">{i + 1}</td>
//                 <td className="p-2">{r.area}</td>
//                 <td className="p-2">
//                   <select
//                     className="border rounded-lg px-2 py-1"
//                     value={r.status}
//                     onChange={(e) => {
//                       const v = e.target.value;
//                       setRows((prev) =>
//                         prev.map((x, idx) =>
//                           idx === i ? { ...x, status: v } : x
//                         )
//                       );
//                     }}
//                   >
//                     {statusOptions.map((s) => (
//                       <option key={s} value={s}>
//                         {s}
//                       </option>
//                     ))}
//                   </select>
//                 </td>
//                 <td className="p-2">
//                   <input
//                     type="number"
//                     min={1}
//                     max={5}
//                     className="w-20 border rounded-lg px-2 py-1"
//                     value={r.score}
//                     onChange={(e) => {
//                       const n = Number(e.target.value || 1);
//                       setRows((prev) =>
//                         prev.map((x, idx) =>
//                           idx === i
//                             ? { ...x, score: Math.min(5, Math.max(1, n)) }
//                             : x
//                         )
//                       );
//                     }}
//                   />
//                 </td>
//                 <td className="p-2">
//                   <input
//                     className="w-full border rounded-lg px-2 py-1"
//                     value={r.note}
//                     onChange={(e) => {
//                       const v = e.target.value;
//                       setRows((prev) =>
//                         prev.map((x, idx) =>
//                           idx === i ? { ...x, note: v } : x
//                         )
//                       );
//                     }}
//                   />
//                 </td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       </div>
//     </div>
//   );
// }
