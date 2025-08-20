// Layout grup auth (cukup passtrough saja)
// Jangan pakai <html>/<body> di layout non-root
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
