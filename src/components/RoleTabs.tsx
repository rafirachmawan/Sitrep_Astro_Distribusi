"use client";

import {
  ClipboardList,
  Users2,
  Target as TargetIcon,
  ListChecks,
  CalendarCheck,
  Paperclip,
  Trophy,
} from "lucide-react";
import type { TabDef } from "@/lib/types";

const TOP_TABS: Array<{
  key: TabDef;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: "checklist", label: "Checklist Area", icon: ClipboardList },
  { key: "evaluasi", label: "Evaluasi Tim", icon: Users2 },
  { key: "target", label: "Target & Achievement", icon: TargetIcon },
  { key: "sparta", label: "Project Tracking (SPARTA)", icon: ListChecks },
  { key: "agenda", label: "Agenda & Jadwal", icon: CalendarCheck },
  { key: "lampiran", label: "Lampiran", icon: Paperclip },
  { key: "achievement", label: "Achievement", icon: Trophy },
];

export default function RoleTabs({
  active,
  onChange,
}: {
  active: TabDef;
  onChange: (key: TabDef) => void;
}) {
  return (
    <div className="bg-white border rounded-2xl shadow-sm p-2 flex flex-nowrap overflow-x-auto gap-2">
      {TOP_TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={
            "group inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm transition whitespace-nowrap " +
            (active === t.key
              ? "bg-blue-600 text-white shadow"
              : "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200")
          }
        >
          <t.icon className="h-4 w-4 opacity-90" />
          <span className="font-medium">{t.label}</span>
        </button>
      ))}
    </div>
  );
}
