from pydantic import BaseModel
from typing import Literal, Optional


# ── Tag ──────────────────────────────────────────────

TagCategory = Literal["buy", "sell"]


class Tag(BaseModel):
    id: str
    label: str
    category: TagCategory


class TagCreate(BaseModel):
    label: str
    category: TagCategory


# ── FollowUp ─────────────────────────────────────────

Verdict = Literal["correct", "wrong", "neutral"]


class FollowUpCreate(BaseModel):
    comment: str
    verdict: Verdict


class FollowUp(BaseModel):
    id: str
    snapshot_id: str
    comment: str
    verdict: Verdict
    created_at: str


# ── Snapshot ─────────────────────────────────────────

TimelineOption = Literal["1D", "1W", "1M", "1Q", "custom"]


class SnapshotCreate(BaseModel):
    content: str
    ai_analysis: str = ""
    tags: list[str]  # tag ids
    timeline: TimelineOption
    expected_review_date: str
    links: list[str] = []
    influenced_by: list[str] = []


class SnapshotUpdate(BaseModel):
    content: Optional[str] = None
    ai_analysis: Optional[str] = None
    tags: Optional[list[str]] = None
    timeline: Optional[TimelineOption] = None
    expected_review_date: Optional[str] = None
    links: Optional[list[str]] = None
    influenced_by: Optional[list[str]] = None


class Snapshot(BaseModel):
    id: str
    thesis_id: str
    content: str
    ai_analysis: str = ""
    tags: list[Tag] = []
    timeline: TimelineOption
    expected_review_date: str
    created_at: str
    updated_at: str = ""
    links: list[str] = []
    influenced_by: list[str] = []
    follow_up: Optional[FollowUp] = None


# ── Thesis ───────────────────────────────────────────

AssetCategory = Literal["crypto", "us-stock", "a-stock", "hk-stock", "bond", "commodity"]
ThesisStatus = Literal["active", "paused", "archived", "invalidated"]


class ThesisCreate(BaseModel):
    name: str
    category: AssetCategory
    asset: str = ""
    status: ThesisStatus = "active"


class ThesisUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[list[str]] = None  # tag ids
    status: Optional[ThesisStatus] = None


class ThesisReorder(BaseModel):
    ordered_ids: list[str]


class Thesis(BaseModel):
    id: str
    name: str
    category: AssetCategory
    asset: str
    status: ThesisStatus = "active"
    description: str
    tags: list[Tag] = []
    snapshots: list[Snapshot] = []
    created_at: str
    updated_at: str


# ── Portfolio / Assets ───────────────────────────────

AccountType = Literal["wallet", "exchange", "broker", "bank", "manual"]
HoldingStatus = Literal["open", "closed", "archived"]
AdjustmentType = Literal[
    "buy",
    "sell",
    "transfer_in",
    "transfer_out",
    "airdrop",
    "dividend_reinvest",
    "manual_add",
    "manual_reduce",
]
PriceSource = Literal["coingecko", "twelve_data", "manual", "derived"]
SnapshotScopeType = Literal["holding", "portfolio"]


class AccountCreate(BaseModel):
    name: str
    type: AccountType
    broker_or_platform: str = ""
    base_currency: str = "USD"
    notes: str = ""


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[AccountType] = None
    broker_or_platform: Optional[str] = None
    base_currency: Optional[str] = None
    notes: Optional[str] = None


class Account(BaseModel):
    id: str
    name: str
    type: AccountType
    broker_or_platform: str = ""
    base_currency: str = "USD"
    notes: str = ""
    created_at: str
    updated_at: str


class AssetCreate(BaseModel):
    symbol: str
    name: str
    category: AssetCategory
    market: str = ""
    quote_currency: str = "USD"
    price_source: PriceSource = "manual"
    metadata_json: str = ""


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    market: Optional[str] = None
    quote_currency: Optional[str] = None
    price_source: Optional[PriceSource] = None
    metadata_json: Optional[str] = None


class Asset(BaseModel):
    id: str
    symbol: str
    name: str
    category: AssetCategory
    market: str = ""
    quote_currency: str = "USD"
    price_source: PriceSource = "manual"
    metadata_json: str = ""
    created_at: str
    updated_at: str


class HoldingBase(BaseModel):
    id: str
    account_id: str
    asset_id: str
    quantity: float
    avg_cost: float = 0
    cost_currency: str = "USD"
    status: HoldingStatus = "open"
    opened_at: str
    closed_at: str = ""
    notes: str = ""
    created_at: str
    updated_at: str


class HoldingCreate(BaseModel):
    account_id: str
    symbol: str
    name: str
    category: AssetCategory
    market: str = ""
    quote_currency: str = "USD"
    price_source: PriceSource = "manual"
    initial_quantity: float
    initial_unit_price: float = 0
    cost_currency: str = "USD"
    adjustment_type: AdjustmentType = "buy"
    executed_at: str
    notes: str = ""


class HoldingUpdate(BaseModel):
    status: Optional[HoldingStatus] = None
    notes: Optional[str] = None


class AdjustmentCreate(BaseModel):
    type: AdjustmentType
    quantity: float
    unit_price: float = 0
    fee: float = 0
    fee_currency: str = "USD"
    executed_at: str
    notes: str = ""
    related_thesis_id: Optional[str] = None


class Adjustment(BaseModel):
    id: str
    holding_id: str
    account_id: str
    asset_id: str
    type: AdjustmentType
    quantity_delta: float
    unit_price: float = 0
    fee: float = 0
    fee_currency: str = "USD"
    executed_at: str
    notes: str = ""
    related_thesis_id: Optional[str] = None
    created_at: str


class ValuationSnapshot(BaseModel):
    id: str
    scope_type: SnapshotScopeType
    scope_id: str
    quantity: float = 0
    market_price: float = 0
    market_value_usd: float = 0
    fx_rate_to_usd: float = 1
    source: PriceSource = "derived"
    as_of: str
    created_at: str


class AssetQuote(BaseModel):
    symbol: str
    market: str
    price: float
    currency: str
    as_of: str
    source: PriceSource


class HistoryPoint(BaseModel):
    timestamp: str
    value: float


class AssetHolding(HoldingBase):
    account: Account
    asset: Asset
    market_price: float = 0
    market_price_currency: str = "USD"
    market_value_usd: float = 0
    cost_basis_usd: float = 0
    unrealized_pnl_usd: float = 0
    unrealized_pnl_pct: float = 0


class AssetSummary(Asset):
    total_quantity: float = 0
    accounts_count: int = 0
    holdings_count: int = 0
    market_price: float = 0
    market_price_currency: str = "USD"
    market_value_usd: float = 0
    cost_basis_usd: float = 0
    unrealized_pnl_usd: float = 0
    unrealized_pnl_pct: float = 0
    as_of: str = ""


class AllocationSlice(BaseModel):
    id: str
    label: str
    value_usd: float
    percentage: float


class DashboardMetric(BaseModel):
    total_value_usd: float
    total_cost_basis_usd: float
    unrealized_pnl_usd: float
    unrealized_pnl_pct: float
    holdings_count: int
    accounts_count: int


class PortfolioDashboard(BaseModel):
    summary: DashboardMetric
    category_allocation: list[AllocationSlice]
    account_allocation: list[AllocationSlice]
    top_holdings: list[AssetSummary]
    holdings: list[AssetHolding]
    history: list[HistoryPoint]
    accounts: list[Account]


class AssetDetail(BaseModel):
    asset: AssetSummary
    holdings: list[AssetHolding]
    adjustments: list[Adjustment]
    price_history: list[HistoryPoint]
    valuation_history: list[HistoryPoint]
    related_theses: list[Thesis] = []


# ── Auth ─────────────────────────────────────────────

class AuthLoginRequest(BaseModel):
    username: str
    password: str


class AuthLoginResponse(BaseModel):
    token: str


class AuthRegisterRequest(BaseModel):
    username: str
    password: str


class AuthRegisterResponse(BaseModel):
    token: str
