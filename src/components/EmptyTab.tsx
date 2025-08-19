"use client";

export default function EmptyTab({ title }: { title: string }) {
  return (
    <div className="bg-white border rounded-2xl shadow-sm p-6">
      <h3 className="text-lg font-semibold text-slate-800 mb-2">{title}</h3>
      <div className="border rounded-xl p-4 text-center text-slate-600 bg-slate-50">
        Konten {title.toLowerCase()} menyusul. Role non-admin tidak memiliki
        akses ke formulir ini. Perubahan/isi akan diatur oleh{" "}
        <span className="font-medium">superadmin</span>.
      </div>
    </div>
  );
}
