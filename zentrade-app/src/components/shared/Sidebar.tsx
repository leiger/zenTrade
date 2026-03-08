'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, BrainCircuit, Shield, BarChart3, Settings } from 'lucide-react';
import { ModeToggle } from '@/components/shared/ModeToggle';
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
      { name: 'Thesis Tracker', href: '/thesis', icon: BrainCircuit, disabled: false },
      { name: 'Decision Firewall', href: '/firewall', icon: Shield, disabled: true },
      { name: 'Analytics', href: '/analytics', icon: BarChart3, disabled: true },
    ],
  },
  {
    label: '系统',
    items: [{ name: 'Settings', href: '/settings', icon: Settings, disabled: true }],
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
            Z
          </div>
          <div className="flex flex-col gap-0.5 leading-none">
            <span className="font-semibold text-sm">ZenTrade</span>
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
                      <Link href={item.disabled ? '#' : item.href}>
                        <Icon />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.disabled && <SidebarMenuBadge>Soon</SidebarMenuBadge>}
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
