// src/app/(app)/page.tsx
import DashboardClient from "@/components/DashboardClient";
import AuthGuard from "@/components/AuthGuard";

export default function Page() {
  return (
    // Jangan batasi role di sini. Cukup pastikan user sudah login.
    <AuthGuard>
      <DashboardClient />
    </AuthGuard>
  );
}
