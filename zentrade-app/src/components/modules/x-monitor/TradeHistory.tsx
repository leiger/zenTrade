'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Clock,
  DollarSign,
  Settings,
  History,
  X,
  Percent,
  Hash,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import * as api from '@/lib/xmonitor-api';
import type { TradeTag, TradeRecord } from '@/types/xmonitor';

// 预设的标签颜色，类似 Notion 的多选颜色
const TAG_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#6366f1', // indigo
];

// 根据颜色生成带透明度的背景色
function tagStyle(color: string) {
  return {
    backgroundColor: `${color}18`,
    color: color,
    borderColor: `${color}30`,
  };
}

/** Clamp to [0, 100] and round to 2 decimal places (matches backend). */
function parseTradePrice(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === '') return 0;
  const n = Number.parseFloat(trimmed);
  if (Number.isNaN(n)) return 0;
  const clamped = Math.min(100, Math.max(0, n));
  return Math.round(clamped * 100) / 100;
}

function formatPriceInput(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === '') return '';
  const n = parseTradePrice(trimmed);
  return n.toFixed(2);
}

/** Positive integer; invalid or empty coerces to 1 (matches API default). */
function parseRemainInput(raw: string): number {
  const n = Math.floor(Number.parseFloat(raw.trim()));
  if (Number.isNaN(n) || n < 1) return 1;
  return n;
}

export function TradeHistory() {
  const [tags, setTags] = useState<TradeTag[]>([]);
  const [records, setRecords] = useState<TradeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTagId, setFilterTagId] = useState<string | null>(null);

  // 记录表单弹窗
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<TradeRecord | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [remainingTime, setRemainingTime] = useState('');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [remain, setRemain] = useState('1');
  const [saving, setSaving] = useState(false);

  // 标签管理弹窗
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [savingTag, setSavingTag] = useState(false);

  const nextColorRef = useRef(0);

  // ── 数据加载 ──────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      const [tagsData, recordsData] = await Promise.all([
        api.fetchTradeTags(),
        api.fetchTradeRecords(),
      ]);
      setTags(tagsData);
      setRecords(recordsData);
    } catch (e) {
      console.error('[TradeHistory] Failed to fetch:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── 筛选后的记录 ──────────────────────────────────────

  const filteredRecords = filterTagId
    ? records.filter((r) => r.tags.some((t) => t.id === filterTagId))
    : records;

  // ── 标签管理 ──────────────────────────────────────────

  const handleAddTag = useCallback(async () => {
    if (!newTagName.trim()) return;
    setSavingTag(true);
    try {
      const created = await api.createTradeTag(newTagName.trim(), newTagColor);
      setTags((prev) => [...prev, created]);
      setNewTagName('');
      // 自动轮换下一个颜色
      nextColorRef.current = (nextColorRef.current + 1) % TAG_COLORS.length;
      setNewTagColor(TAG_COLORS[nextColorRef.current]);
    } catch (e) {
      console.error('[TradeHistory] Failed to create tag:', e);
    } finally {
      setSavingTag(false);
    }
  }, [newTagName, newTagColor]);

  const handleDeleteTag = useCallback(async (tagId: string) => {
    try {
      await api.deleteTradeTag(tagId);
      setTags((prev) => prev.filter((t) => t.id !== tagId));
      // 同步更新记录中的标签引用
      setRecords((prev) =>
        prev.map((r) => ({
          ...r,
          tags: r.tags.filter((t) => t.id !== tagId),
        })),
      );
      setFilterTagId((prev) => (prev === tagId ? null : prev));
    } catch (e) {
      console.error('[TradeHistory] Failed to delete tag:', e);
    }
  }, []);

  // ── 记录 CRUD ─────────────────────────────────────────

  const openAddRecord = useCallback(() => {
    setEditingRecord(null);
    setSelectedTagIds([]);
    setRemainingTime('');
    setAmount('');
    setPrice('');
    setRemain('1');
    setRecordDialogOpen(true);
  }, []);

  const openEditRecord = useCallback((record: TradeRecord) => {
    setEditingRecord(record);
    setSelectedTagIds(record.tags.map((t) => t.id));
    setRemainingTime(record.remainingTime);
    setAmount(String(record.amount));
    setPrice(record.price.toFixed(2));
    setRemain(String(record.remain));
    setRecordDialogOpen(true);
  }, []);

  const handleSaveRecord = useCallback(async () => {
    setSaving(true);
    try {
      const amountNum = parseFloat(amount) || 0;
      const priceNum = parseTradePrice(price);
      const remainNum = parseRemainInput(remain);
      if (editingRecord) {
        const updated = await api.updateTradeRecord(editingRecord.id, {
          tagIds: selectedTagIds,
          remainingTime,
          amount: amountNum,
          price: priceNum,
          remain: remainNum,
        });
        setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      } else {
        const created = await api.createTradeRecord(
          selectedTagIds,
          remainingTime,
          amountNum,
          priceNum,
          remainNum,
        );
        setRecords((prev) => [created, ...prev]);
      }
      setRecordDialogOpen(false);
    } catch (e) {
      console.error('[TradeHistory] Failed to save record:', e);
    } finally {
      setSaving(false);
    }
  }, [editingRecord, selectedTagIds, remainingTime, amount, price, remain]);

  const handleDeleteRecord = useCallback(async (id: string) => {
    try {
      await api.deleteTradeRecord(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.error('[TradeHistory] Failed to delete record:', e);
    }
  }, []);

  // ── 标签选择 toggle ────────────────────────────────────

  const toggleTagSelection = useCallback((tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  }, []);

  // ── Loading state ──────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h2 className="text-lg font-semibold">Trade History</h2>
          <p className="text-xs text-muted-foreground">
            Record your trading decisions and rationale.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setTagDialogOpen(true)}
          >
            <Settings className="h-3.5 w-3.5" />
            Manage Tags
          </Button>
          <Button size="sm" className="gap-1.5" onClick={openAddRecord}>
            <Plus className="h-3.5 w-3.5" />
            Add Record
          </Button>
        </div>
      </div>

      {/* 标签筛选栏 */}
      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
              filterTagId === null
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border bg-background text-muted-foreground hover:bg-accent'
            }`}
            onClick={() => setFilterTagId(null)}
          >
            All
          </button>
          {tags.map((tag) => (
            <button
              key={tag.id}
              className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors"
              style={
                filterTagId === tag.id
                  ? tagStyle(tag.color)
                  : { borderColor: 'var(--border)', color: 'var(--muted-foreground)' }
              }
              onClick={() => setFilterTagId(filterTagId === tag.id ? null : tag.id)}
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}

      {/* 记录卡片列表 */}
      {filteredRecords.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-muted-foreground">
          <History className="mb-3 h-10 w-10 opacity-40" />
          <p className="text-sm font-medium">No records yet</p>
          <p className="text-xs">Click &quot;Add Record&quot; to create your first trade record.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {filteredRecords.map((record) => (
            <div
              key={record.id}
              className="group flex flex-col rounded-lg border bg-card p-3 transition-colors hover:bg-accent/30"
            >
              {/* 标签（标题位置）+ hover 操作按钮 */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap gap-1 min-w-0">
                  {record.tags.length > 0 ? (
                    record.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium"
                        style={tagStyle(tag.color)}
                      >
                        {tag.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs italic text-muted-foreground/50">No tags</span>
                  )}
                </div>
                <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                    onClick={() => openEditRecord(record)}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleDeleteRecord(record.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* 分隔线 */}
              <div className="my-2 border-t border-border/60" />

              {/* 内容 */}
              <div className="flex-1 space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 shrink-0 opacity-60" />
                  <span>{record.remainingTime || <span className="italic opacity-50">-</span>}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <DollarSign className="h-3 w-3 shrink-0 opacity-60" />
                  <span>${record.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Percent className="h-3 w-3 shrink-0 opacity-60" />
                  <span>
                    {record.price.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Hash className="h-3 w-3 shrink-0 opacity-60" />
                  <span>{record.remain}</span>
                </div>
              </div>

              {/* 底部日期 */}
              <span className="mt-2 block text-[10px] text-muted-foreground/60">
                {new Date(record.createdAt).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── 新增/编辑记录弹窗 ──────────────────────────── */}
      <Dialog open={recordDialogOpen} onOpenChange={setRecordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRecord ? 'Edit Record' : 'New Record'}</DialogTitle>
            <DialogDescription>
              {editingRecord
                ? 'Update your trade record details.'
                : 'Create a new trade record with reasons, time, amount, price and remain.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 选择理由标签 */}
            <div className="space-y-1.5">
              <Label className="text-xs">Reasons (Tags)</Label>
              {tags.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No tags available. Create tags in &quot;Manage Tags&quot; first.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => {
                    const selected = selectedTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                          selected ? 'ring-1' : 'opacity-50 hover:opacity-80'
                        }`}
                        style={{
                          ...tagStyle(tag.color),
                          ...(selected ? { ringColor: tag.color } : {}),
                        }}
                        onClick={() => toggleTagSelection(tag.id)}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 剩余时间 */}
            <div className="space-y-1.5">
              <Label className="text-xs">Remaining Time</Label>
              <Input
                value={remainingTime}
                onChange={(e) => setRemainingTime(e.target.value)}
                placeholder="e.g. 2h 30m, 3 days"
                className="bg-background"
              />
            </div>

            {/* 购买金额 */}
            <div className="space-y-1.5">
              <Label className="text-xs">Amount ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 500"
                className="bg-background"
              />
            </div>

            {/* Price 0–100, two decimals */}
            <div className="space-y-1.5">
              <Label className="text-xs">Price (0–100)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                onBlur={() => setPrice((p) => (p.trim() === '' ? '' : formatPriceInput(p)))}
                placeholder="e.g. 45.50"
                className="bg-background"
              />
              <p className="text-[10px] text-muted-foreground">
                Clamped to 0–100; blur formats to 2 decimals.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Remain</Label>
              <Input
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={remain}
                onChange={(e) => setRemain(e.target.value)}
                onBlur={() => setRemain(String(parseRemainInput(remain)))}
                placeholder="e.g. 3"
                className="bg-background"
              />
              <p className="text-[10px] text-muted-foreground">Integer greater than 0.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setRecordDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveRecord} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              {editingRecord ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 标签管理弹窗 ──────────────────────────────── */}
      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Tags</DialogTitle>
            <DialogDescription>
              Create and manage your global reason tags for trade records.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 新增标签 */}
            <div className="space-y-1.5">
              <Label className="text-xs">New Tag</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Enter tag name..."
                  className="flex-1 bg-background"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddTag();
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddTag}
                  disabled={!newTagName.trim() || savingTag}
                >
                  {savingTag ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>

            {/* 颜色选择 */}
            <div className="space-y-1.5">
              <Label className="text-xs">Tag Color</Label>
              <div className="flex flex-wrap gap-1.5">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                      newTagColor === c ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setNewTagColor(c)}
                  />
                ))}
              </div>
            </div>

            {/* 已有标签列表 */}
            <div className="space-y-1.5">
              <Label className="text-xs">Existing Tags ({tags.length})</Label>
              {tags.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No tags created yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium"
                      style={tagStyle(tag.color)}
                    >
                      {tag.name}
                      <button
                        type="button"
                        className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                        onClick={() => handleDeleteTag(tag.id)}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setTagDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
