import type { Metadata } from "next";
import "./globals.css"; // kalau kamu pakai globals.css
import AuthProvider from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "SITREP Daily",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="bg-gray-100 text-gray-900">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
