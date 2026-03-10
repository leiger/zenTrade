import type { AssetCategory } from './thesis';

export type AccountType = 'wallet' | 'exchange' | 'broker' | 'bank' | 'manual';
export type HoldingStatus = 'open' | 'closed' | 'archived';
export type AdjustmentType =
  | 'buy'
  | 'sell'
  | 'transfer_in'
  | 'transfer_out'
  | 'airdrop'
  | 'dividend_reinvest'
  | 'manual_add'
  | 'manual_reduce';
export type PriceSource = 'coingecko' | 'twelve_data' | 'manual' | 'derived';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  brokerOrPlatform: string;
  baseCurrency: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioAsset {
  id: string;
  symbol: string;
  name: string;
  category: AssetCategory;
  market: string;
  quoteCurrency: string;
  priceSource: PriceSource;
  metadataJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetQuote {
  symbol: string;
  market: string;
  price: number;
  currency: string;
  asOf: string;
  source: PriceSource;
}

export interface HistoryPoint {
  timestamp: string;
  value: number;
}

export interface AssetHolding {
  id: string;
  accountId: string;
  assetId: string;
  quantity: number;
  avgCost: number;
  costCurrency: string;
  status: HoldingStatus;
  openedAt: string;
  closedAt: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  account: Account;
  asset: PortfolioAsset;
  marketPrice: number;
  marketPriceCurrency: string;
  marketValueUsd: number;
  costBasisUsd: number;
  unrealizedPnlUsd: number;
  unrealizedPnlPct: number;
}

export interface AssetSummary extends PortfolioAsset {
  totalQuantity: number;
  accountsCount: number;
  holdingsCount: number;
  marketPrice: number;
  marketPriceCurrency: string;
  marketValueUsd: number;
  costBasisUsd: number;
  unrealizedPnlUsd: number;
  unrealizedPnlPct: number;
  asOf: string;
}

export interface Adjustment {
  id: string;
  holdingId: string;
  accountId: string;
  assetId: string;
  type: AdjustmentType;
  quantityDelta: number;
  unitPrice: number;
  fee: number;
  feeCurrency: string;
  executedAt: string;
  notes: string;
  relatedThesisId?: string | null;
  createdAt: string;
}

export interface AllocationSlice {
  id: string;
  label: string;
  valueUsd: number;
  percentage: number;
}

export interface DashboardMetric {
  totalValueUsd: number;
  totalCostBasisUsd: number;
  unrealizedPnlUsd: number;
  unrealizedPnlPct: number;
  holdingsCount: number;
  accountsCount: number;
}

export interface PortfolioDashboard {
  summary: DashboardMetric;
  categoryAllocation: AllocationSlice[];
  accountAllocation: AllocationSlice[];
  topHoldings: AssetSummary[];
  holdings: AssetHolding[];
  history: HistoryPoint[];
  accounts: Account[];
}

export interface AssetDetail {
  asset: AssetSummary;
  holdings: AssetHolding[];
  adjustments: Adjustment[];
  priceHistory: HistoryPoint[];
  valuationHistory: HistoryPoint[];
  relatedTheses: Array<{
    id: string;
    name: string;
    category: AssetCategory;
    asset: string;
    description: string;
    status: string;
  }>;
}

export interface HoldingCreateInput {
  accountId: string;
  symbol: string;
  name: string;
  category: AssetCategory;
  market?: string;
  quoteCurrency?: string;
  priceSource?: PriceSource;
  initialQuantity: number;
  initialUnitPrice: number;
  costCurrency: string;
  adjustmentType: AdjustmentType;
  executedAt: string;
  notes: string;
}

export interface AdjustmentCreateInput {
  type: AdjustmentType;
  quantity: number;
  unitPrice: number;
  fee: number;
  feeCurrency: string;
  executedAt: string;
  notes: string;
  relatedThesisId?: string;
}
