'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import type { Account, AssetHolding } from '@/types/portfolio';
import { formatNumber, formatUsd, getPnlTone, sortHoldingsByValue } from '@/lib/assets';
import type { AdjustmentCreateInput, HoldingCreateInput } from '@/types/portfolio';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { HoldingAdjustmentSheet } from './HoldingAdjustmentSheet';

interface HoldingsTableProps {
  holdings: AssetHolding[];
  accounts: Account[];
  onCreateHolding: (data: HoldingCreateInput) => Promise<void>;
  onCreateAdjustment: (holdingId: string, data: AdjustmentCreateInput) => Promise<void>;
}

export function HoldingsTable({
  holdings,
  accounts,
  onCreateHolding,
  onCreateAdjustment,
}: HoldingsTableProps) {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | string>('all');
  const [accountFilter, setAccountFilter] = useState<'all' | string>('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<AssetHolding | undefined>();

  const categories = useMemo(
    () => Array.from(new Set(holdings.map((holding) => holding.asset.category))),
    [holdings]
  );

  const filteredHoldings = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return sortHoldingsByValue(holdings).filter((holding) => {
      if (categoryFilter !== 'all' && holding.asset.category !== categoryFilter) return false;
      if (accountFilter !== 'all' && holding.account.id !== accountFilter) return false;
      if (!keyword) return true;

      const haystack = [
        holding.asset.name,
        holding.asset.symbol,
        holding.account.name,
        holding.notes,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [accountFilter, categoryFilter, holdings, query]);

  const openCreate = () => {
    setSelectedHolding(undefined);
    setSheetOpen(true);
  };

  const openAdjust = (holding: AssetHolding) => {
    setSelectedHolding(holding);
    setSheetOpen(true);
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Holdings List</h2>
            <Badge variant="outline" className="text-[10px] font-normal">
              {filteredHoldings.length}/{holdings.length}
            </Badge>
          </div>
          <Button className="gap-1.5" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            新增持仓
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索资产、代码、账户…"
              className="pl-9"
              name="holdings-search"
              autoComplete="off"
              aria-label="搜索 holdings"
            />
          </div>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full" aria-label="按资产类型筛选">
              <SelectValue placeholder="资产类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部资产类型</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="w-full" aria-label="按账户筛选">
              <SelectValue placeholder="账户" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部账户</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>资产</TableHead>
                <TableHead>账户</TableHead>
                <TableHead className="text-right">数量</TableHead>
                <TableHead className="text-right">现值</TableHead>
                <TableHead className="text-right">盈亏</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHoldings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    暂无符合条件的 holdings
                  </TableCell>
                </TableRow>
              ) : (
                filteredHoldings.map((holding) => (
                  <TableRow key={holding.id}>
                    <TableCell>
                      <div className="min-w-0">
                        <Link
                          href={`/assets/${holding.asset.category}/${holding.asset.symbol}`}
                          className="font-medium hover:underline"
                        >
                          {holding.asset.name}
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge variant="secondary" className="text-[10px] font-mono font-normal">
                            {holding.asset.symbol}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {holding.asset.category}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{holding.account.name}</p>
                        <p className="text-xs text-muted-foreground">{holding.account.type}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(holding.quantity)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatUsd(holding.marketValueUsd)}</TableCell>
                    <TableCell className={`text-right tabular-nums ${getPnlTone(holding.unrealizedPnlUsd)}`}>
                      {formatUsd(holding.unrealizedPnlUsd)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => openAdjust(holding)}>
                        调整
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <HoldingAdjustmentSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        accounts={accounts}
        holding={selectedHolding}
        defaultCategory={selectedHolding?.asset.category}
        defaultSymbol={selectedHolding?.asset.symbol}
        defaultName={selectedHolding?.asset.name}
        onCreateHolding={onCreateHolding}
        onCreateAdjustment={onCreateAdjustment}
      />
    </>
  );
}
