import {
  ClipboardList,
  Users2,
  Target as TargetIcon,
  ListChecks,
  CalendarCheck,
  Paperclip,
  Trophy,
} from "lucide-react";
import type { TabKey } from "@/lib/types";

export const TABS: ReadonlyArray<{
  key: TabKey;
  label: string;
  icon: React.ElementType;
}> = [
  { key: "checklist", label: "Checklist Area", icon: ClipboardList },
  { key: "evaluasi", label: "Evaluasi Tim", icon: Users2 },
  { key: "target", label: "Target & Achievement", icon: TargetIcon },
  { key: "sparta", label: "Project Tracking (SPARTA)", icon: ListChecks },
  { key: "agenda", label: "Agenda & Jadwal", icon: CalendarCheck },
  { key: "lampiran", label: "Lampiran", icon: Paperclip },
  { key: "achievement", label: "Achievement", icon: Trophy },
] as const;
