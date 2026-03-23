import { AppSidebar } from '@/components/shared/Sidebar';
import { DynamicBreadcrumb } from '@/components/shared/DynamicBreadcrumb';
import { ReminderBell } from '@/components/shared/ReminderBell';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
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
        <main className="flex-1 bg-background p-4 sm:p-6 md:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
