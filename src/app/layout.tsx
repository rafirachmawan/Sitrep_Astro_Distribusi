import "./globals.css";
// import { AppStateProvider } from "@/lib/appState"; // kalau ada
import AuthProvider from "@/components/AuthProvider"; // <-- TANPA kurung kurawal

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>
        <AuthProvider>
          {/* <AppStateProvider> kalau kamu pakai context tambahan */}
          {children}
          {/* </AppStateProvider> */}
        </AuthProvider>
      </body>
    </html>
  );
}
