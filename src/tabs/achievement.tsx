"use client";
export default function Achievement({ title }: { title: string }) {
  return (
    <div className="bg-white border rounded-2xl shadow-sm p-6 text-slate-700">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-slate-600">
        Konten untuk tab <span className="font-medium">{title}</span> akan
        diletakkan di sini.
      </p>
    </div>
  );
}
