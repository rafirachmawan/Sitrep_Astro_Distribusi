"use client";
import { useState } from "react";
import type { ReactNode } from "react";

export type TabKey =
  | "checklist"
  | "evaluasi"
  | "target"
  | "sparta"
  | "agenda"
  | "achievement"
  | "lampiran";

const tabs: { key: TabKey; label: string }[] = [
  { key: "checklist", label: "Checklist Area" },
  { key: "evaluasi", label: "Evaluasi Tim" },
  { key: "target", label: "Target & Achievement" },
  { key: "sparta", label: "Project Tracking (SPARTA)" },
  { key: "agenda", label: "Agenda & Jadwal" },
  { key: "achievement", label: "Achievement" },
  { key: "lampiran", label: "Lampiran" },
];

export default function RoleTabs({
  views,
}: {
  views: Record<TabKey, ReactNode>;
}) {
  const [active, setActive] = useState<TabKey>("checklist");
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full border ${
              active === t.key
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white hover:bg-gray-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-4 bg-white border rounded-2xl p-4 shadow-sm">
        {views[active]}
      </div>
    </div>
  );
}
