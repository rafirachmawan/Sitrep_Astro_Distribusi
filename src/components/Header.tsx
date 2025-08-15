"use client";
import { useAuth } from "@/components/AuthProvider";

export default function Header() {
  const { user, role, signOutApp } = useAuth();
  return (
    <header className="sticky top-0 z-10 bg-white border-b">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="font-semibold">LEADER MONITORING DAILY</div>
        <div className="text-sm flex items-center gap-3">
          <span className="hidden sm:inline text-gray-600">
            {user?.email} · <b className="uppercase">{role ?? "-"}</b>
          </span>
          <button
            onClick={signOutApp}
            className="px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
