import type { Thesis, Snapshot, FollowUp, ThesisTag, Verdict, ThesisStatus } from '@/types/thesis';
import type {
  Account,
  Adjustment,
  AdjustmentCreateInput,
  AssetDetail,
  AssetHolding,
  AssetQuote,
  AssetSummary,
  HoldingCreateInput,
  HistoryPoint,
  PortfolioAsset,
  PortfolioDashboard,
} from '@/types/portfolio';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE}${path}`;
  console.log('[API] Request:', url, init?.method || 'GET');
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  console.log('[API] Response:', res.status, res.statusText);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[API] Error response:', text);
    throw new Error(`API ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json();
  console.log('[API] Response data:', data);
  return data;
}

// ── snake_case → camelCase mappers ──────────────────

function mapTag(raw: Record<string, string>): ThesisTag {
  return { id: raw.id, label: raw.label, category: raw.category as ThesisTag['category'] };
}

function mapFollowUp(raw: Record<string, string> | null): FollowUp | undefined {
  if (!raw) return undefined;
  return {
    id: raw.id,
    snapshotId: raw.snapshot_id,
    comment: raw.comment,
    verdict: raw.verdict as Verdict,
    createdAt: raw.created_at,
  };
}

function mapSnapshot(raw: Record<string, unknown>): Snapshot {
  return {
    id: raw.id as string,
    thesisId: raw.thesis_id as string,
    content: raw.content as string,
    aiAnalysis: (raw.ai_analysis as string) || '',
    tags: ((raw.tags as Record<string, string>[]) || []).map(mapTag),
    timeline: raw.timeline as Snapshot['timeline'],
    expectedReviewDate: raw.expected_review_date as string,
    createdAt: raw.created_at as string,
    updatedAt: (raw.updated_at as string) || '',
    links: (raw.links as string[]) || [],
    influencedBy: (raw.influenced_by as string[]) || [],
    followUp: mapFollowUp(raw.follow_up as Record<string, string> | null),
  };
}

function mapThesis(raw: Record<string, unknown>): Thesis {
  return {
    id: raw.id as string,
    name: raw.name as string,
    category: raw.category as Thesis['category'],
    asset: raw.asset as string,
    status: (raw.status as ThesisStatus) || 'active',
    description: raw.description as string,
    tags: ((raw.tags as Record<string, string>[]) || []).map(mapTag),
    snapshots: ((raw.snapshots as Record<string, unknown>[]) || []).map(mapSnapshot),
    createdAt: raw.created_at as string,
    updatedAt: raw.updated_at as string,
  };
}

function mapAccount(raw: Record<string, unknown>): Account {
  return {
    id: raw.id as string,
    name: raw.name as string,
    type: raw.type as Account['type'],
    brokerOrPlatform: (raw.broker_or_platform as string) || '',
    baseCurrency: (raw.base_currency as string) || 'USD',
    notes: (raw.notes as string) || '',
    createdAt: raw.created_at as string,
    updatedAt: raw.updated_at as string,
  };
}

function mapPortfolioAsset(raw: Record<string, unknown>): PortfolioAsset {
  return {
    id: raw.id as string,
    symbol: raw.symbol as string,
    name: raw.name as string,
    category: raw.category as PortfolioAsset['category'],
    market: (raw.market as string) || '',
    quoteCurrency: (raw.quote_currency as string) || 'USD',
    priceSource: (raw.price_source as PortfolioAsset['priceSource']) || 'manual',
    metadataJson: (raw.metadata_json as string) || '',
    createdAt: raw.created_at as string,
    updatedAt: raw.updated_at as string,
  };
}

function mapHistoryPoint(raw: Record<string, unknown>): HistoryPoint {
  return {
    timestamp: raw.timestamp as string,
    value: Number(raw.value || 0),
  };
}

function mapAssetQuote(raw: Record<string, unknown>): AssetQuote {
  return {
    symbol: raw.symbol as string,
    market: raw.market as string,
    price: Number(raw.price || 0),
    currency: (raw.currency as string) || 'USD',
    asOf: raw.as_of as string,
    source: (raw.source as AssetQuote['source']) || 'manual',
  };
}

function mapAssetHolding(raw: Record<string, unknown>): AssetHolding {
  return {
    id: raw.id as string,
    accountId: raw.account_id as string,
    assetId: raw.asset_id as string,
    quantity: Number(raw.quantity || 0),
    avgCost: Number(raw.avg_cost || 0),
    costCurrency: (raw.cost_currency as string) || 'USD',
    status: raw.status as AssetHolding['status'],
    openedAt: raw.opened_at as string,
    closedAt: (raw.closed_at as string) || '',
    notes: (raw.notes as string) || '',
    createdAt: raw.created_at as string,
    updatedAt: raw.updated_at as string,
    account: mapAccount(raw.account as Record<string, unknown>),
    asset: mapPortfolioAsset(raw.asset as Record<string, unknown>),
    marketPrice: Number(raw.market_price || 0),
    marketPriceCurrency: (raw.market_price_currency as string) || 'USD',
    marketValueUsd: Number(raw.market_value_usd || 0),
    costBasisUsd: Number(raw.cost_basis_usd || 0),
    unrealizedPnlUsd: Number(raw.unrealized_pnl_usd || 0),
    unrealizedPnlPct: Number(raw.unrealized_pnl_pct || 0),
  };
}

function mapAssetSummary(raw: Record<string, unknown>): AssetSummary {
  return {
    ...mapPortfolioAsset(raw),
    totalQuantity: Number(raw.total_quantity || 0),
    accountsCount: Number(raw.accounts_count || 0),
    holdingsCount: Number(raw.holdings_count || 0),
    marketPrice: Number(raw.market_price || 0),
    marketPriceCurrency: (raw.market_price_currency as string) || 'USD',
    marketValueUsd: Number(raw.market_value_usd || 0),
    costBasisUsd: Number(raw.cost_basis_usd || 0),
    unrealizedPnlUsd: Number(raw.unrealized_pnl_usd || 0),
    unrealizedPnlPct: Number(raw.unrealized_pnl_pct || 0),
    asOf: (raw.as_of as string) || '',
  };
}

function mapAdjustment(raw: Record<string, unknown>): Adjustment {
  return {
    id: raw.id as string,
    holdingId: raw.holding_id as string,
    accountId: raw.account_id as string,
    assetId: raw.asset_id as string,
    type: raw.type as Adjustment['type'],
    quantityDelta: Number(raw.quantity_delta || 0),
    unitPrice: Number(raw.unit_price || 0),
    fee: Number(raw.fee || 0),
    feeCurrency: (raw.fee_currency as string) || 'USD',
    executedAt: raw.executed_at as string,
    notes: (raw.notes as string) || '',
    relatedThesisId: (raw.related_thesis_id as string) || null,
    createdAt: raw.created_at as string,
  };
}

function mapPortfolioDashboard(raw: Record<string, unknown>): PortfolioDashboard {
  return {
    summary: {
      totalValueUsd: Number((raw.summary as Record<string, unknown>)?.total_value_usd || 0),
      totalCostBasisUsd: Number((raw.summary as Record<string, unknown>)?.total_cost_basis_usd || 0),
      unrealizedPnlUsd: Number((raw.summary as Record<string, unknown>)?.unrealized_pnl_usd || 0),
      unrealizedPnlPct: Number((raw.summary as Record<string, unknown>)?.unrealized_pnl_pct || 0),
      holdingsCount: Number((raw.summary as Record<string, unknown>)?.holdings_count || 0),
      accountsCount: Number((raw.summary as Record<string, unknown>)?.accounts_count || 0),
    },
    categoryAllocation: ((raw.category_allocation as Record<string, unknown>[]) || []).map((item) => ({
      id: item.id as string,
      label: item.label as string,
      valueUsd: Number(item.value_usd || 0),
      percentage: Number(item.percentage || 0),
    })),
    accountAllocation: ((raw.account_allocation as Record<string, unknown>[]) || []).map((item) => ({
      id: item.id as string,
      label: item.label as string,
      valueUsd: Number(item.value_usd || 0),
      percentage: Number(item.percentage || 0),
    })),
    topHoldings: ((raw.top_holdings as Record<string, unknown>[]) || []).map(mapAssetSummary),
    holdings: ((raw.holdings as Record<string, unknown>[]) || []).map(mapAssetHolding),
    history: ((raw.history as Record<string, unknown>[]) || []).map(mapHistoryPoint),
    accounts: ((raw.accounts as Record<string, unknown>[]) || []).map(mapAccount),
  };
}

function mapAssetDetail(raw: Record<string, unknown>): AssetDetail {
  return {
    asset: mapAssetSummary(raw.asset as Record<string, unknown>),
    holdings: ((raw.holdings as Record<string, unknown>[]) || []).map(mapAssetHolding),
    adjustments: ((raw.adjustments as Record<string, unknown>[]) || []).map(mapAdjustment),
    priceHistory: ((raw.price_history as Record<string, unknown>[]) || []).map(mapHistoryPoint),
    valuationHistory: ((raw.valuation_history as Record<string, unknown>[]) || []).map(mapHistoryPoint),
    relatedTheses: ((raw.related_theses as Record<string, unknown>[]) || []).map(mapThesis),
  };
}

// ── API functions ───────────────────────────────────

export async function fetchTheses(): Promise<Thesis[]> {
  const raw = await request<Record<string, unknown>[]>('/theses');
  return raw.map(mapThesis);
}

export async function fetchThesis(id: string): Promise<Thesis> {
  const raw = await request<Record<string, unknown>>(`/theses/${id}`);
  return mapThesis(raw);
}

export async function createThesis(data: { name: string; category: string; asset: string; status?: ThesisStatus }): Promise<Thesis> {
  const raw = await request<Record<string, unknown>>('/theses', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return mapThesis(raw);
}

export async function updateThesis(
  id: string,
  updates: { name?: string; description?: string; tags?: string[]; status?: ThesisStatus }
): Promise<Thesis> {
  const raw = await request<Record<string, unknown>>(`/theses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return mapThesis(raw);
}

export async function deleteThesis(id: string): Promise<void> {
  await request<void>(`/theses/${id}`, { method: 'DELETE' });
}

export async function reorderTheses(orderedIds: string[]): Promise<Thesis[]> {
  const raw = await request<Record<string, unknown>[]>('/theses/reorder', {
    method: 'PUT',
    body: JSON.stringify({ ordered_ids: orderedIds }),
  });
  return raw.map(mapThesis);
}

export async function createSnapshot(
  thesisId: string,
  data: {
    content: string;
    aiAnalysis: string;
    tags: string[];
    timeline: string;
    expectedReviewDate: string;
    links: string[];
    influencedBy: string[];
  }
): Promise<Snapshot> {
  const raw = await request<Record<string, unknown>>(`/theses/${thesisId}/snapshots`, {
    method: 'POST',
    body: JSON.stringify({
      content: data.content,
      ai_analysis: data.aiAnalysis,
      tags: data.tags,
      timeline: data.timeline,
      expected_review_date: data.expectedReviewDate,
      links: data.links,
      influenced_by: data.influencedBy,
    }),
  });
  return mapSnapshot(raw);
}

export async function updateSnapshot(
  thesisId: string,
  snapshotId: string,
  data: {
    content?: string;
    aiAnalysis?: string;
    tags?: string[];
    timeline?: string;
    expectedReviewDate?: string;
    links?: string[];
    influencedBy?: string[];
  }
): Promise<Snapshot> {
  const payload: Record<string, unknown> = {};
  if (data.content !== undefined) payload.content = data.content;
  if (data.aiAnalysis !== undefined) payload.ai_analysis = data.aiAnalysis;
  if (data.tags !== undefined) payload.tags = data.tags;
  if (data.timeline !== undefined) payload.timeline = data.timeline;
  if (data.expectedReviewDate !== undefined) payload.expected_review_date = data.expectedReviewDate;
  if (data.links !== undefined) payload.links = data.links;
  if (data.influencedBy !== undefined) payload.influenced_by = data.influencedBy;

  const raw = await request<Record<string, unknown>>(
    `/theses/${thesisId}/snapshots/${snapshotId}`,
    { method: 'PATCH', body: JSON.stringify(payload) }
  );
  return mapSnapshot(raw);
}

export async function deleteSnapshot(thesisId: string, snapshotId: string): Promise<void> {
  await request<void>(`/theses/${thesisId}/snapshots/${snapshotId}`, { method: 'DELETE' });
}

// ── Tags ────────────────────────────────────────────

export async function fetchTags(): Promise<ThesisTag[]> {
  const raw = await request<Record<string, string>[]>('/tags');
  return raw.map(mapTag);
}

export async function createTag(data: { label: string; category: string }): Promise<ThesisTag> {
  const raw = await request<Record<string, string>>('/tags', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return mapTag(raw);
}

export async function deleteTag(tagId: string): Promise<void> {
  await request<void>(`/tags/${tagId}`, { method: 'DELETE' });
}

export async function upsertFollowUp(
  thesisId: string,
  snapshotId: string,
  data: { comment: string; verdict: string }
): Promise<FollowUp> {
  const raw = await request<Record<string, string>>(
    `/theses/${thesisId}/snapshots/${snapshotId}/follow-up`,
    { method: 'PUT', body: JSON.stringify(data) }
  );
  return mapFollowUp(raw)!;
}

export async function deleteFollowUp(thesisId: string, snapshotId: string): Promise<void> {
  await request<void>(
    `/theses/${thesisId}/snapshots/${snapshotId}/follow-up`,
    { method: 'DELETE' }
  );
}

// ── Portfolio / Assets ───────────────────────────────

export async function fetchAssetDashboard(): Promise<PortfolioDashboard> {
  const raw = await request<Record<string, unknown>>('/assets/dashboard');
  return mapPortfolioDashboard(raw);
}

export async function fetchAssets(): Promise<AssetSummary[]> {
  const raw = await request<Record<string, unknown>[]>('/assets');
  return raw.map(mapAssetSummary);
}

export async function fetchAssetDetail(category: string, symbol: string): Promise<AssetDetail> {
  const raw = await request<Record<string, unknown>>(`/assets/${category}/${symbol}`);
  return mapAssetDetail(raw);
}

export async function fetchAccounts(): Promise<Account[]> {
  const raw = await request<Record<string, unknown>[]>('/accounts');
  return raw.map(mapAccount);
}

export async function createHolding(data: HoldingCreateInput): Promise<AssetHolding> {
  const raw = await request<Record<string, unknown>>('/holdings', {
    method: 'POST',
    body: JSON.stringify({
      account_id: data.accountId,
      symbol: data.symbol,
      name: data.name,
      category: data.category,
      market: data.market,
      quote_currency: data.quoteCurrency,
      price_source: data.priceSource,
      initial_quantity: data.initialQuantity,
      initial_unit_price: data.initialUnitPrice,
      cost_currency: data.costCurrency,
      adjustment_type: data.adjustmentType,
      executed_at: data.executedAt,
      notes: data.notes,
    }),
  });
  return mapAssetHolding(raw);
}

export async function updateHolding(
  holdingId: string,
  updates: { status?: string; notes?: string }
): Promise<AssetHolding> {
  const raw = await request<Record<string, unknown>>(`/holdings/${holdingId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return mapAssetHolding(raw);
}

export async function createAdjustment(
  holdingId: string,
  data: AdjustmentCreateInput
): Promise<Adjustment> {
  const raw = await request<Record<string, unknown>>(`/holdings/${holdingId}/adjustments`, {
    method: 'POST',
    body: JSON.stringify({
      type: data.type,
      quantity: data.quantity,
      unit_price: data.unitPrice,
      fee: data.fee,
      fee_currency: data.feeCurrency,
      executed_at: data.executedAt,
      notes: data.notes,
      related_thesis_id: data.relatedThesisId,
    }),
  });
  return mapAdjustment(raw);
}

export async function fetchMarketQuote(category: string, symbol: string): Promise<AssetQuote> {
  const raw = await request<Record<string, unknown>>(
    `/market-data/quote?category=${encodeURIComponent(category)}&symbol=${encodeURIComponent(symbol)}`
  );
  return mapAssetQuote(raw);
}

export async function fetchMarketHistory(
  category: string,
  symbol: string,
  rangeKey: string
): Promise<HistoryPoint[]> {
  const raw = await request<Record<string, unknown>[]>(
    `/market-data/history?category=${encodeURIComponent(category)}&symbol=${encodeURIComponent(symbol)}&range_key=${encodeURIComponent(rangeKey)}`
  );
  return raw.map(mapHistoryPoint);
}
