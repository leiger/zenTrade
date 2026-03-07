'use client';

import { useState } from 'react';
import type { AssetCategory } from '@/types/thesis';
import { ASSET_CATEGORIES, type AssetCategoryConfig } from '@/constants/assets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useThesisStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Check, ChevronRight, Plus, Sparkles } from 'lucide-react';

interface ThesisFormProps {
  onSuccess?: () => void;
}

export function ThesisForm({ onSuccess }: ThesisFormProps) {
  const addThesis = useThesisStore((s) => s.addThesis);

  // Selection state
  const [hoveredCategory, setHoveredCategory] = useState<AssetCategoryConfig | null>(
    ASSET_CATEGORIES[0] ?? null
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [selectedAssetName, setSelectedAssetName] = useState<string | null>(null);

  // Custom asset input state
  const [customSymbol, setCustomSymbol] = useState('');
  const [customName, setCustomName] = useState('');

  // Derived: what's showing in the right panel
  const activeCategory = hoveredCategory;

  const handleCategoryClick = (config: AssetCategoryConfig) => {
    if (selectedCategory === config.key) {
      // Deselect
      setSelectedCategory(null);
      setSelectedAsset(null);
      setSelectedAssetName(null);
    } else {
      setSelectedCategory(config.key);
      setSelectedAsset(null);
      setSelectedAssetName(null);
    }
  };

  const handleAssetClick = (symbol: string, name: string) => {
    if (selectedAsset === symbol && selectedCategory === activeCategory?.key) {
      setSelectedAsset(null);
      setSelectedAssetName(null);
    } else {
      // Ensure category is also selected
      if (selectedCategory !== activeCategory?.key) {
        setSelectedCategory(activeCategory!.key);
      }
      setSelectedAsset(symbol);
      setSelectedAssetName(name);
      setCustomSymbol('');
      setCustomName('');
    }
  };

  const handleCustomAssetAdd = () => {
    const symbol = customSymbol.trim();
    const name = customName.trim();
    if (!symbol || !activeCategory) return;

    // Select the category if not already
    if (selectedCategory !== activeCategory.key) {
      setSelectedCategory(activeCategory.key);
    }
    setSelectedAsset(symbol);
    setSelectedAssetName(name || symbol);
    setCustomSymbol('');
    setCustomName('');
  };

  const handleSubmit = () => {
    if (!selectedCategory) return;

    const catConfig = ASSET_CATEGORIES.find((c) => c.key === selectedCategory);
    let name: string;

    if (selectedAsset && selectedAssetName) {
      name = selectedAssetName;
    } else if (selectedAsset) {
      const assetInfo = catConfig?.assets.find((a) => a.symbol === selectedAsset);
      name = assetInfo ? assetInfo.name : selectedAsset;
    } else {
      name = catConfig ? catConfig.label : selectedCategory;
    }

    addThesis({
      name,
      category: selectedCategory as AssetCategory,
      asset: selectedAsset ?? '',
    });

    // Reset
    setSelectedCategory(null);
    setSelectedAsset(null);
    setSelectedAssetName(null);
    setCustomSymbol('');
    setCustomName('');
    setHoveredCategory(ASSET_CATEGORIES[0] ?? null);
    onSuccess?.();
  };

  return (
    <div className="space-y-4">
      {/* Cascade panel */}
      <div className="flex rounded-xl border overflow-hidden bg-background" style={{ height: 360 }}>
        {/* Left: Category List */}
        <div className="w-[170px] border-r bg-muted/30 flex flex-col">
          <div className="px-3 py-2">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">投资大类</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {ASSET_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.key;
              const isHovered = hoveredCategory?.key === cat.key;
              return (
                <button
                  key={cat.key}
                  onMouseEnter={() => setHoveredCategory(cat)}
                  onClick={() => handleCategoryClick(cat)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2.5 text-sm transition-colors cursor-pointer',
                    'hover:bg-accent/50',
                    isHovered && !isSelected && 'bg-accent/30',
                    isSelected && 'bg-primary/10 text-primary font-medium'
                  )}
                >
                  <span className="text-base">{cat.icon}</span>
                  <span className="flex-1 text-left truncate">{cat.label}</span>
                  {isSelected ? (
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Asset List */}
        <div className="flex-1 flex flex-col">
          {activeCategory && (
            <>
              <div className="px-3 py-2 flex items-center gap-2">
                <span className="text-base">{activeCategory.icon}</span>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {activeCategory.label} — 资产
                </p>
              </div>
              <div className="flex-1 overflow-y-auto px-1">
                {activeCategory.assets.map((asset) => {
                  const isSelected =
                    selectedCategory === activeCategory.key && selectedAsset === asset.symbol;
                  return (
                    <button
                      key={asset.symbol}
                      onClick={() => handleAssetClick(asset.symbol, asset.name)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm',
                        'transition-colors cursor-pointer',
                        'hover:bg-accent/50',
                        isSelected && 'bg-primary/10'
                      )}
                    >
                      <Badge
                        variant="secondary"
                        className={cn(
                          'font-mono text-[11px] px-1.5 py-0 min-w-[52px] justify-center',
                          isSelected && 'bg-primary/20 text-primary'
                        )}
                      >
                        {asset.symbol}
                      </Badge>
                      <span className={cn('flex-1 text-left text-sm', isSelected && 'font-medium text-primary')}>
                        {asset.name}
                      </span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Custom asset input — symbol + name */}
              <div className="border-t p-2 space-y-1.5">
                <p className="text-[10px] text-muted-foreground px-1">添加自定义资产</p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleCustomAssetAdd();
                  }}
                  className="flex items-center gap-1.5"
                >
                  <Input
                    placeholder="代码"
                    value={customSymbol}
                    onChange={(e) => setCustomSymbol(e.target.value)}
                    className="h-7 text-xs bg-background w-[72px] font-mono shrink-0"
                  />
                  <Input
                    placeholder="名称"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="h-7 text-xs bg-background flex-1"
                  />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    disabled={!customSymbol.trim()}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Selection summary + submit */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground min-h-[28px]">
          {selectedCategory ? (
            <>
              <span className="text-xs">已选择：</span>
              <Badge variant="outline" className="text-xs gap-1 font-normal">
                {ASSET_CATEGORIES.find((c) => c.key === selectedCategory)?.icon}
                {ASSET_CATEGORIES.find((c) => c.key === selectedCategory)?.label}
              </Badge>
              {selectedAsset && (
                <>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                  <Badge variant="secondary" className="text-xs font-mono font-normal">
                    {selectedAsset}
                  </Badge>
                </>
              )}
            </>
          ) : (
            <span className="text-xs text-muted-foreground/50">请选择投资大类</span>
          )}
        </div>

        <Button onClick={handleSubmit} disabled={!selectedCategory} className="gap-2">
          <Sparkles className="h-4 w-4" />
          创建看法
        </Button>
      </div>
    </div>
  );
}
