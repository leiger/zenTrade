'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import type { AssetCategory } from '@/types/thesis';
import type {
  Account,
  AdjustmentCreateInput,
  AssetHolding,
  HoldingCreateInput,
} from '@/types/portfolio';
import { ASSET_CATEGORIES, getCategoryConfig } from '@/constants/assets';
import { ADJUSTMENT_TYPE_OPTIONS } from '@/lib/assets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface HoldingAdjustmentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  holding?: AssetHolding;
  defaultCategory?: AssetCategory;
  defaultSymbol?: string;
  defaultName?: string;
  onCreateHolding: (data: HoldingCreateInput) => Promise<void>;
  onCreateAdjustment: (holdingId: string, data: AdjustmentCreateInput) => Promise<void>;
}

export function HoldingAdjustmentSheet({
  open,
  onOpenChange,
  accounts,
  holding,
  defaultCategory = 'crypto',
  defaultSymbol = '',
  defaultName = '',
  onCreateHolding,
  onCreateAdjustment,
}: HoldingAdjustmentSheetProps) {
  const isCreateMode = !holding;
  const [accountId, setAccountId] = useState('');
  const [category, setCategory] = useState<AssetCategory>(defaultCategory);
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [name, setName] = useState(defaultName);
  const [adjustmentType, setAdjustmentType] = useState<'buy' | 'sell' | 'transfer_in' | 'transfer_out' | 'airdrop' | 'dividend_reinvest' | 'manual_add' | 'manual_reduce'>('buy');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [fee, setFee] = useState('');
  const [notes, setNotes] = useState('');
  const [executedAt, setExecutedAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const categoryConfig = useMemo(() => getCategoryConfig(category), [category]);

  useEffect(() => {
    const defaultTime = format(new Date(), "yyyy-MM-dd'T'HH:mm");
    if (holding) {
      setAccountId(holding.accountId);
      setCategory(holding.asset.category);
      setSymbol(holding.asset.symbol);
      setName(holding.asset.name);
      setAdjustmentType('buy');
      setQuantity('');
      setUnitPrice(holding.marketPrice ? String(holding.marketPrice) : '');
      setFee('');
      setNotes('');
      setExecutedAt(defaultTime);
      return;
    }

    setAccountId(accounts[0]?.id ?? '');
    setCategory(defaultCategory);
    setSymbol(defaultSymbol);
    setName(defaultName);
    setAdjustmentType('buy');
    setQuantity('');
    setUnitPrice('');
    setFee('');
    setNotes('');
    setExecutedAt(defaultTime);
  }, [accounts, defaultCategory, defaultName, defaultSymbol, holding, open]);

  const handlePresetSelect = (selectedSymbol: string) => {
    setSymbol(selectedSymbol);
    const asset = categoryConfig?.assets.find((item) => item.symbol === selectedSymbol);
    if (asset) {
      setName(asset.name);
    }
  };

  const handleSubmit = async () => {
    if (!quantity || !executedAt) return;
    setSubmitting(true);
    try {
      if (isCreateMode) {
        if (!accountId || !symbol.trim() || !name.trim()) return;
        await onCreateHolding({
          accountId,
          category,
          symbol: symbol.trim().toUpperCase(),
          name: name.trim(),
          initialQuantity: Number(quantity),
          initialUnitPrice: Number(unitPrice || 0),
          costCurrency: category === 'hk-stock' ? 'HKD' : category === 'a-stock' ? 'CNY' : 'USD',
          adjustmentType,
          executedAt: new Date(executedAt).toISOString(),
          notes: notes.trim(),
          market: categoryConfig?.label ?? category,
          quoteCurrency: category === 'hk-stock' ? 'HKD' : category === 'a-stock' ? 'CNY' : 'USD',
          priceSource: category === 'crypto' ? 'coingecko' : 'twelve_data',
        });
      } else if (holding) {
        await onCreateAdjustment(holding.id, {
          type: adjustmentType,
          quantity: Number(quantity),
          unitPrice: Number(unitPrice || 0),
          fee: Number(fee || 0),
          feeCurrency: holding.asset.quoteCurrency || 'USD',
          executedAt: new Date(executedAt).toISOString(),
          notes: notes.trim(),
        });
      }
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{isCreateMode ? '新增持仓' : '调整持仓'}</SheetTitle>
          <SheetDescription>
            {isCreateMode ? '按数量录入持仓，系统会根据行情计算当前价值。' : '记录一次持仓变化，保留完整 adjustment 轨迹。'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
          {isCreateMode && (
            <>
              <div className="space-y-2">
                <Label htmlFor="account-id">账户</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger id="account-id" className="w-full" aria-label="选择账户">
                    <SelectValue placeholder="选择账户" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">资产类别</Label>
                <Select value={category} onValueChange={(value) => setCategory(value as AssetCategory)}>
                  <SelectTrigger id="category" className="w-full" aria-label="选择资产类别">
                    <SelectValue placeholder="选择资产类别" />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_CATEGORIES.map((item) => (
                      <SelectItem key={item.key} value={item.key}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="preset-symbol">预设资产</Label>
                <Select value={symbol} onValueChange={handlePresetSelect}>
                  <SelectTrigger id="preset-symbol" className="w-full" aria-label="选择预设资产">
                    <SelectValue placeholder="可选：从预设资产中选择" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryConfig?.assets.map((item) => (
                      <SelectItem key={item.symbol} value={item.symbol}>
                        {item.name} ({item.symbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="symbol">Symbol</Label>
                  <Input
                    id="symbol"
                    value={symbol}
                    onChange={(event) => setSymbol(event.target.value)}
                    placeholder="BTC / AAPL / 0700"
                    name="symbol"
                    autoComplete="off"
                    aria-label="资产代码"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Bitcoin / Apple / 腾讯控股"
                    name="name"
                    autoComplete="off"
                    aria-label="资产名称"
                  />
                </div>
              </div>
            </>
          )}

          {!isCreateMode && holding && (
            <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
              <p className="font-medium">{holding.asset.name} ({holding.asset.symbol})</p>
              <p className="text-xs text-muted-foreground">
                当前数量 {holding.quantity} / 账户 {holding.account.name}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="adjustment-type">Adjustment 类型</Label>
            <Select value={adjustmentType} onValueChange={(value) => setAdjustmentType(value as typeof adjustmentType)}>
              <SelectTrigger id="adjustment-type" className="w-full" aria-label="选择 adjustment 类型">
                <SelectValue placeholder="选择 adjustment 类型" />
              </SelectTrigger>
              <SelectContent>
                {ADJUSTMENT_TYPE_OPTIONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="quantity">数量</Label>
              <Input
                id="quantity"
                type="number"
                inputMode="decimal"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="输入数量…"
                name="quantity"
                autoComplete="off"
                aria-label="数量"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit-price">成交单价</Label>
              <Input
                id="unit-price"
                type="number"
                inputMode="decimal"
                value={unitPrice}
                onChange={(event) => setUnitPrice(event.target.value)}
                placeholder="可选，输入单价…"
                name="unit-price"
                autoComplete="off"
                aria-label="成交单价"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fee">手续费</Label>
              <Input
                id="fee"
                type="number"
                inputMode="decimal"
                value={fee}
                onChange={(event) => setFee(event.target.value)}
                placeholder="可选，输入手续费…"
                name="fee"
                autoComplete="off"
                aria-label="手续费"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="executed-at">执行时间</Label>
              <Input
                id="executed-at"
                type="datetime-local"
                value={executedAt}
                onChange={(event) => setExecutedAt(event.target.value)}
                name="executed-at"
                aria-label="执行时间"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">备注</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              placeholder="记录这次变动的原因、上下文或执行备注…"
              name="notes"
              aria-label="备注"
            />
          </div>
        </div>

        <SheetFooter className="border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !quantity || !executedAt}>
            {isCreateMode ? '创建持仓' : '提交调整'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
