import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AppSidebar } from '@/components/shared/Sidebar';
import { DynamicBreadcrumb } from '@/components/shared/DynamicBreadcrumb';
import { ReminderBell } from '@/components/shared/ReminderBell';
import { ThemeProvider } from '@/components/theme-provider';
import { ActiveThemeProvider } from '@/components/themes/active-theme';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});


export const metadata: Metadata = {
  title: 'ZenTrade — 认知交易系统',
  description: '通过数据透明化与决策逻辑化，利用 AI 辅助阻断情绪干扰的个人资产管理工具。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning data-theme="mono">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ActiveThemeProvider>
            <SidebarProvider>
              <AppSidebar />
              <SidebarInset className="overflow-visible">
                <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
                  <SidebarTrigger className="-ml-1" />
                  <Separator orientation="vertical" className="mr-2 h-4" />
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                    <DynamicBreadcrumb />
                    <ReminderBell />
                  </div>
                </header>
                <main className="flex-1 bg-background p-4 sm:p-6 md:p-8">
                  {children}
                </main>
              </SidebarInset>
            </SidebarProvider>
          </ActiveThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
