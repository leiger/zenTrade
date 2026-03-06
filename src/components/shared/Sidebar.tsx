'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    BrainCircuit,
    Shield,
    BarChart3,
    Settings,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { ModeToggle } from '@/components/shared/ModeToggle';

const navigation = [
    {
        label: '总览',
        items: [
            { name: 'Dashboard', href: '/', icon: LayoutDashboard, disabled: true },
        ],
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
        items: [
            { name: 'Settings', href: '/settings', icon: Settings, disabled: true },
        ],
    },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="fixed left-0 top-0 z-40 h-screen w-[240px] border-r border-border bg-sidebar flex flex-col">
            {/* Logo */}
            <div className="flex h-14 items-center gap-2.5 px-5 border-b border-border">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
                    Z
                </div>
                <div>
                    <h1 className="text-sm font-semibold text-sidebar-foreground">ZenTrade</h1>
                    <p className="text-[10px] text-muted-foreground leading-none">认知交易系统</p>
                </div>
            </div>

            {/* 导航 */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
                {navigation.map((group) => (
                    <div key={group.label} className="space-y-1">
                        <p className="px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                            {group.label}
                        </p>
                        {group.items.map((item) => {
                            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                            const Icon = item.icon;

                            return (
                                <Link
                                    key={item.name}
                                    href={item.disabled ? '#' : item.href}
                                    className={cn(
                                        'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                                        isActive
                                            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                                            : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                                        item.disabled && 'opacity-40 pointer-events-none'
                                    )}
                                >
                                    <Icon className="h-4 w-4 flex-shrink-0" />
                                    <span>{item.name}</span>
                                    {item.disabled && (
                                        <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                            Soon
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                ))}
            </nav>

            {/* 底部 */}
            <div className="p-3 border-t border-border flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground">
                    ZenTrade v1.0 · Prototype
                </p>
                <ModeToggle />
            </div>
        </aside>
    );
}
