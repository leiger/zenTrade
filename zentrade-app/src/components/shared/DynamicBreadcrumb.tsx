'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useThesisStore } from '@/lib/store';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

const routeLabels: Record<string, string> = {
  '/assets': 'Assets',
  '/thesis': 'Thesis Tracker',
  '/review': 'Review Inbox',
  '/firewall': 'Decision Firewall',
  '/analytics': 'Analytics',
  '/settings': 'Settings',
};

export function DynamicBreadcrumb() {
  const pathname = usePathname();
  const theses = useThesisStore((s) => s.theses);

  const segments = pathname.split('/').filter(Boolean);
  const crumbs: { label: string; href?: string }[] = [];

  if (segments.length > 0) {
    const basePath = `/${segments[0]}`;
    const baseLabel = routeLabels[basePath] ?? segments[0];

    if (segments.length > 1) {
      crumbs.push({ label: baseLabel, href: basePath });

      if (segments[0] === 'assets' && segments[2]) {
        crumbs.push({ label: segments[2] });
      }

      if (segments[0] === 'thesis' && segments[1]) {
        const thesis = theses.find((t) => t.id === segments[1]);
        crumbs.push({ label: thesis?.name ?? '详情' });
      }
    } else {
      crumbs.push({ label: baseLabel });
    }
  }

  return (
    <Breadcrumb>
      <BreadcrumbList className="font-oswald tracking-wide">
        <BreadcrumbItem className="hidden md:block">
          <BreadcrumbLink asChild>
            <Link href="/thesis">ZenTrade</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {crumbs.map((crumb, index) => (
          <Fragment key={index}>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              {crumb.href ? (
                <BreadcrumbLink asChild>
                  <Link href={crumb.href}>{crumb.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
