import type { Metadata } from 'next';
import './globals.css';
import { AppSidebar } from '@/components/shared/Sidebar';
import { DynamicBreadcrumb } from '@/components/shared/DynamicBreadcrumb';
import { ThemeProvider } from '@/components/theme-provider';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
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
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <DynamicBreadcrumb />
              </header>
              <main className="flex-1 overflow-auto bg-background p-4 sm:p-6 md:p-8">
                {children}
              </main>
            </SidebarInset>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
