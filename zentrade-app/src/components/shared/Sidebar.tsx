'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrainCircuit, BarChart3, Inbox, LogOut, Wallet, Radio, ScanSearch } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ModeToggle } from '@/components/shared/ModeToggle';
import { ThemeSwitcher } from '@/components/themes/theme-switcher';
import { useThesisStore } from '@/lib/store';
import { getReminderSummary } from '@/lib/thesis-tracker';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
} from '@/components/ui/sidebar';

const navigation = [
  {
    label: 'Polymarket',
    items: [
      { name: 'X Monitor', href: '/x-monitor', icon: Radio, disabled: false },
      { name: 'Wallet Tracker', href: '/wallet-tracker', icon: ScanSearch, disabled: false },
    ],
  },
  {
    label: 'Core',
    items: [
      { name: 'Assets', href: '/assets', icon: Wallet, disabled: false },
      { name: 'Analytics', href: '/analytics', icon: BarChart3, disabled: false },
    ],
  },
  {
    label: 'Review',
    items: [
      { name: 'Thesis Tracker', href: '/thesis', icon: BrainCircuit, disabled: false },
      { name: 'Review Inbox', href: '/review', icon: Inbox, disabled: false },
    ],
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter();
  const pathname = usePathname();
  const theses = useThesisStore((state) => state.theses);
  const fetchTheses = useThesisStore((state) => state.fetchTheses);
  const pendingReviewCount = React.useMemo(
    () => getReminderSummary(theses).pending.length,
    [theses]
  );

  React.useEffect(() => {
    if (theses.length === 0) {
      fetchTheses();
    }
  }, [fetchTheses, theses.length]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-semibold">
            Z
          </div>
          <div className="flex flex-col gap-0.5 leading-none">
            <span className="text-base font-semibold tracking-wide">ZenTrade</span>
            <span className="text-[10px] text-muted-foreground">Cognitive trading</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navigation.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.name}
                      disabled={item.disabled}
                    >
                      <Link href={item.disabled ? '#' : item.href} className="tracking-wide">
                        <Icon />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.name === 'Review Inbox' && pendingReviewCount > 0 ? (
                      <SidebarMenuBadge>{pendingReviewCount}</SidebarMenuBadge>
                    ) : item.disabled ? (
                      <SidebarMenuBadge>Soon</SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex flex-col gap-2 px-2 pt-2 border-t w-full">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton type="button" onClick={handleLogout} tooltip="Log out">
                <LogOut />
                <span>Log out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <div className="flex items-center justify-between w-full">
            <span className="text-[10px] text-muted-foreground font-medium">ZenTrade v1.0</span>
            <div className="flex items-center gap-0.5">
              <ThemeSwitcher />
              <ModeToggle />
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
