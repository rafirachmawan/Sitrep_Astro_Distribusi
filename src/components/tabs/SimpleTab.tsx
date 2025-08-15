"use client";
export default function SimpleTab({
  title,
  role,
}: {
  title: string;
  role: any;
}) {
  return (
    <div className="space-y-2">
      <div className="text-lg font-semibold">{title}</div>
      <p className="text-sm text-gray-600">
        Role saat ini: <b className="uppercase">{role ?? "-"}</b>. Silakan
        kembangkan formulir khusus untuk tab ini. Struktur dan autosave bisa
        meniru tab "Checklist Area".
      </p>
    </div>
  );
}
