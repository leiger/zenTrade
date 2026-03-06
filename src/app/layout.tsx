import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/shared/Sidebar';

export const metadata: Metadata = {
  title: 'ZenTrade — 认知交易系统',
  description: '通过数据透明化与决策逻辑化，利用 AI 辅助阻断情绪干扰的个人资产管理工具。',
};

import { ThemeProvider } from '@/components/theme-provider';

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
          <Sidebar />
          <main className="ml-[240px] min-h-screen">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
