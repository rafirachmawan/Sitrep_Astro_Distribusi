"use client";

import DashboardClient from "@/components/DashboardClient";
import AuthGuard from "@/components/AuthGuard";

export default function Page() {
  return (
    <AuthGuard>
      <DashboardClient />
    </AuthGuard>
  );
}
