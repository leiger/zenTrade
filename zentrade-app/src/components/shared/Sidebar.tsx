'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, BrainCircuit, Shield, BarChart3, Settings, Inbox, Wallet, Radio } from 'lucide-react';
import { ModeToggle } from '@/components/shared/ModeToggle';
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
    label: '总览',
    items: [{ name: 'Dashboard', href: '/', icon: LayoutDashboard, disabled: true }],
  },
  {
    label: '核心功能',
    items: [
      { name: 'Assets', href: '/assets', icon: Wallet, disabled: false },
      { name: 'X Monitor', href: '/x-monitor', icon: Radio, disabled: false },
      { name: 'Thesis Tracker', href: '/thesis', icon: BrainCircuit, disabled: false },
      { name: 'Review Inbox', href: '/review', icon: Inbox, disabled: false },
      { name: 'Decision Firewall', href: '/firewall', icon: Shield, disabled: true },
      { name: 'Analytics', href: '/analytics', icon: BarChart3, disabled: false },
    ],
  },
  {
    label: '系统',
    items: [{ name: 'Settings', href: '/settings', icon: Settings, disabled: true }],
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
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

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-bebas-neue text-sm">
            Z
          </div>
          <div className="flex flex-col gap-0.5 leading-none">
            <span className="font-bebas-neue text-base tracking-wide">ZenTrade</span>
            <span className="text-[10px] text-muted-foreground">认知交易系统</span>
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
                      <Link href={item.disabled ? '#' : item.href} className="font-oswald tracking-wide">
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
        <div className="flex items-center justify-between px-2 pt-2 border-t w-full">
          <span className="text-[10px] text-muted-foreground font-medium">ZenTrade v1.0</span>
          <ModeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
