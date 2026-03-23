export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Full-bleed pages (e.g. login-02 grid); avoid flex center that breaks two-column layout
  return <div className="min-h-svh w-full bg-background">{children}</div>;
}
