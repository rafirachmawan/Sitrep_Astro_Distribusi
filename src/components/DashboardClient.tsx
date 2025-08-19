"use client";

import { useState } from "react";
import type { AppState, TabDef } from "@/lib/types";
import { initAppState } from "@/lib/init";

import UserTopBar from "@/components/UserTopBar";
import Header from "@/components/Header";
import RoleTabs from "@/components/RoleTabs";

import ChecklistArea from "@/tabs/checklist";
import EvaluasiTim from "@/tabs/evaluasi";
import TargetAchievement from "@/tabs/target";
import SpartaTracking from "@/tabs/sparta";
import AgendaJadwal from "@/tabs/agenda";
import Lampiran from "@/tabs/lampiran";
// import Achievement from "@/tabs/achievement";

import { useAuth } from "@/components/AuthProvider";
import { CopyProvider } from "@/components/CopyProvider";
import CopyManager from "@/components/CopyManager";

export default function DashboardClient() {
  const [active, setActive] = useState<TabDef>("checklist");
  const [state, setState] = useState<AppState>(() => initAppState());
  const { role } = useAuth();
  const isSuper = role === "superadmin";

  const update = <K extends keyof AppState>(k: K, v: AppState[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  return (
    <div className="min-h-screen bg-slate-100">
      <UserTopBar />

      <CopyProvider>
        <Header
          header={state.header}
          onHeaderChange={(h) => update("header", h)}
        />

        <main className="max-w-6xl mx-auto px-3 sm:px-4 pb-16">
          {/* Panel edit teks per-role untuk superadmin */}
          {isSuper && <CopyManager />}

          <RoleTabs active={active} onChange={setActive} />

          <section className="mt-6">
            {active === "checklist" && (
              <ChecklistArea
                data={state.checklist}
                onChange={(v) => update("checklist", v)}
              />
            )}

            {active === "evaluasi" && (
              <EvaluasiTim
                data={state.evaluasi}
                onChange={(v) => update("evaluasi", v)}
              />
            )}

            {active === "target" && (
              <TargetAchievement
                data={state.target}
                onChange={(v) => update("target", v)}
              />
            )}

            {active === "sparta" && (
              <SpartaTracking
                data={state.sparta}
                onChange={(v) => update("sparta", v)}
              />
            )}

            {active === "agenda" && (
              <AgendaJadwal
                data={state.agenda}
                onChange={(v) => update("agenda", v)}
              />
            )}

            {active === "lampiran" && <Lampiran data={state} />}

            {/* {active === "achievement" && <Achievement />} */}
          </section>
        </main>
      </CopyProvider>
    </div>
  );
}
