"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { CopyMap, TabCopy } from "@/lib/copy";
import { getEffectiveCopy, setCopy as persistSetCopy } from "@/lib/copy";
import type { Role } from "@/components/AuthProvider";
import type { TabDef } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";

type CopyCtx = {
  copy: CopyMap;
  refresh: () => void;
  setCopy: (role: Role, tab: TabDef, patch: Partial<TabCopy>) => void;
};

const CopyContext = createContext<CopyCtx | undefined>(undefined);

export function CopyProvider({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  const [tick, setTick] = useState(0); // untuk re-render setelah save

  const value = useMemo<CopyCtx>(
    () => ({
      copy: getEffectiveCopy(role ?? null),
      refresh: () => setTick((x) => x + 1),
      setCopy: (r, tab, patch) => {
        persistSetCopy(r, tab, patch);
        setTick((x) => x + 1);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [role, tick]
  );

  return <CopyContext.Provider value={value}>{children}</CopyContext.Provider>;
}

export function useCopy() {
  const ctx = useContext(CopyContext);
  if (!ctx) throw new Error("useCopy harus dipakai di dalam <CopyProvider />");
  return ctx;
}

/** Ambil teks satu tab: {title, instruction} */
export function useTabCopy(tab: TabDef) {
  const { copy } = useCopy();
  return copy[tab] ?? {};
}
