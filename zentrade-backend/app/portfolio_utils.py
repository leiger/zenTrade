from __future__ import annotations

import asyncio
import uuid
from collections import defaultdict
from datetime import datetime, timezone

from app.database import fetchall
from app.models import (
    Account,
    AdjustmentCreate,
    Adjustment,
    AdjustmentType,
    AllocationSlice,
    Asset,
    AssetDetail,
    AssetHolding,
    AssetSummary,
    DashboardMetric,
    HistoryPoint,
    HoldingBase,
    PortfolioDashboard,
    Thesis,
    ValuationSnapshot,
)
from app.price_providers.router import get_history, get_quote


FX_RATES_TO_USD = {
    "USD": 1.0,
    "USDT": 1.0,
    "USDC": 1.0,
    "HKD": 0.128,
    "CNY": 0.139,
}
POSITIVE_ADJUSTMENT_TYPES: set[AdjustmentType] = {
    "buy",
    "transfer_in",
    "airdrop",
    "dividend_reinvest",
    "manual_add",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def infer_market(category: str, symbol: str) -> str:
    if category == "crypto":
        return "CRYPTO"
    if category == "us-stock":
        return "NASDAQ" if symbol.upper() in {"AAPL", "MSFT", "NVDA", "META", "GOOGL", "AMZN", "TSLA", "AMD", "NFLX", "QQQ"} else "NYSE"
    if category == "hk-stock":
        return "HKEX"
    if category == "a-stock":
        return "SSE" if symbol.startswith(("5", "6", "9")) else "SZSE"
    if category == "bond":
        return "BOND"
    if category == "commodity":
        return "COMMODITY"
    return category.upper()


def infer_quote_currency(category: str) -> str:
    if category == "hk-stock":
        return "HKD"
    if category == "a-stock":
        return "CNY"
    return "USD"


def infer_price_source(category: str) -> str:
    return "coingecko" if category == "crypto" else "twelve_data"


def compute_quantity_delta(adjustment_type: AdjustmentType, quantity: float) -> float:
    if quantity <= 0:
        raise ValueError("Quantity must be positive")
    return quantity if adjustment_type in POSITIVE_ADJUSTMENT_TYPES else -quantity


def convert_to_usd(amount: float, currency: str) -> tuple[float, float]:
    fx = FX_RATES_TO_USD.get(currency.upper(), 1.0)
    return amount * fx, fx


def account_from_row(row) -> Account:
    return Account(
        id=row["id"],
        name=row["name"],
        type=row["type"],
        broker_or_platform=row["broker_or_platform"],
        base_currency=row["base_currency"],
        notes=row["notes"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def asset_from_row(row) -> Asset:
    return Asset(
        id=row["id"],
        symbol=row["symbol"],
        name=row["name"],
        category=row["category"],
        market=row["market"],
        quote_currency=row["quote_currency"],
        price_source=row["price_source"],
        metadata_json=row["metadata_json"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def adjustment_from_row(row) -> Adjustment:
    return Adjustment(
        id=row["id"],
        holding_id=row["holding_id"],
        account_id=row["account_id"],
        asset_id=row["asset_id"],
        type=row["type"],
        quantity_delta=row["quantity_delta"],
        unit_price=row["unit_price"],
        fee=row["fee"],
        fee_currency=row["fee_currency"],
        executed_at=row["executed_at"],
        notes=row["notes"],
        related_thesis_id=row["related_thesis_id"],
        created_at=row["created_at"],
    )


def valuation_snapshot_from_row(row) -> ValuationSnapshot:
    return ValuationSnapshot(
        id=row["id"],
        scope_type=row["scope_type"],
        scope_id=row["scope_id"],
        quantity=row["quantity"],
        market_price=row["market_price"],
        market_value_usd=row["market_value_usd"],
        fx_rate_to_usd=row["fx_rate_to_usd"],
        source=row["source"],
        as_of=row["as_of"],
        created_at=row["created_at"],
    )


async def ensure_asset(
    db,
    *,
    symbol: str,
    name: str,
    category: str,
    market: str = "",
    quote_currency: str = "",
    price_source: str = "",
) -> Asset:
    rows = await fetchall(
        db,
        "SELECT * FROM assets WHERE symbol = ? AND category = ?",
        (symbol.upper(), category),
    )
    if rows:
        return asset_from_row(rows[0])

    asset_id = str(uuid.uuid4())
    timestamp = now_iso()
    await db.execute(
        "INSERT INTO assets (id, symbol, name, category, market, quote_currency, price_source, metadata_json, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, ?)",
        (
            asset_id,
            symbol.upper(),
            name,
            category,
            market or infer_market(category, symbol.upper()),
            quote_currency or infer_quote_currency(category),
            price_source or infer_price_source(category),
            timestamp,
            timestamp,
        ),
    )
    row = await fetchall(db, "SELECT * FROM assets WHERE id = ?", (asset_id,))
    return asset_from_row(row[0])


async def list_accounts(db) -> list[Account]:
    rows = await fetchall(db, "SELECT * FROM accounts ORDER BY created_at")
    return [account_from_row(row) for row in rows]


async def list_assets(db) -> list[Asset]:
    rows = await fetchall(db, "SELECT * FROM assets ORDER BY category, symbol")
    return [asset_from_row(row) for row in rows]


async def get_asset_by_category_symbol(db, category: str, symbol: str) -> Asset | None:
    rows = await fetchall(
        db,
        "SELECT * FROM assets WHERE category = ? AND symbol = ?",
        (category, symbol.upper()),
    )
    if not rows:
        return None
    return asset_from_row(rows[0])


async def list_adjustments(db, *, holding_id: str | None = None, asset_id: str | None = None) -> list[Adjustment]:
    clauses = []
    params: list[str] = []
    if holding_id:
        clauses.append("holding_id = ?")
        params.append(holding_id)
    if asset_id:
        clauses.append("asset_id = ?")
        params.append(asset_id)

    where_clause = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    rows = await fetchall(
        db,
        f"SELECT * FROM adjustments {where_clause} ORDER BY executed_at DESC, created_at DESC",
        tuple(params),
    )
    return [adjustment_from_row(row) for row in rows]


async def list_asset_holdings(
    db,
    *,
    category: str | None = None,
    symbol: str | None = None,
    include_closed: bool = False,
) -> list[AssetHolding]:
    clauses = []
    params: list[str] = []
    if not include_closed:
        clauses.append("h.status != 'archived'")
    if category:
        clauses.append("s.category = ?")
        params.append(category)
    if symbol:
        clauses.append("s.symbol = ?")
        params.append(symbol.upper())

    where_clause = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    rows = await fetchall(
        db,
        "SELECT h.*, "
        "a.id AS account_id_join, a.name AS account_name, a.type AS account_type, a.broker_or_platform, a.base_currency, a.notes AS account_notes, a.created_at AS account_created_at, a.updated_at AS account_updated_at, "
        "s.id AS asset_id_join, s.symbol, s.name AS asset_name, s.category, s.market, s.quote_currency, s.price_source, s.metadata_json, s.created_at AS asset_created_at, s.updated_at AS asset_updated_at "
        "FROM holdings h "
        "JOIN accounts a ON a.id = h.account_id "
        "JOIN assets s ON s.id = h.asset_id "
        f"{where_clause} "
        "ORDER BY s.category, s.symbol, a.name",
        tuple(params),
    )
    if not rows:
        return []

    asset_pairs = {(row["category"], row["symbol"]) for row in rows}
    quote_results = await asyncio.gather(
        *[get_quote(category_key, symbol_key) for category_key, symbol_key in asset_pairs]
    )
    quote_map = {
        (quote["market"], quote["symbol"]): quote
        for quote in quote_results
    }

    holdings: list[AssetHolding] = []
    for row in rows:
        account = Account(
            id=row["account_id_join"],
            name=row["account_name"],
            type=row["account_type"],
            broker_or_platform=row["broker_or_platform"],
            base_currency=row["base_currency"],
            notes=row["account_notes"],
            created_at=row["account_created_at"],
            updated_at=row["account_updated_at"],
        )
        asset = Asset(
            id=row["asset_id_join"],
            symbol=row["symbol"],
            name=row["asset_name"],
            category=row["category"],
            market=row["market"],
            quote_currency=row["quote_currency"],
            price_source=row["price_source"],
            metadata_json=row["metadata_json"],
            created_at=row["asset_created_at"],
            updated_at=row["asset_updated_at"],
        )
        quote = quote_map.get((asset.category, asset.symbol)) or {
            "price": 0,
            "currency": asset.quote_currency,
            "source": asset.price_source,
            "as_of": now_iso(),
        }
        market_value_usd, _ = convert_to_usd(row["quantity"] * quote["price"], quote["currency"])
        cost_basis_usd, _ = convert_to_usd(row["quantity"] * row["avg_cost"], row["cost_currency"])
        unrealized_pnl_usd = market_value_usd - cost_basis_usd
        unrealized_pnl_pct = (unrealized_pnl_usd / cost_basis_usd * 100) if cost_basis_usd > 0 else 0

        holdings.append(
            AssetHolding(
                id=row["id"],
                account_id=row["account_id"],
                asset_id=row["asset_id"],
                quantity=row["quantity"],
                avg_cost=row["avg_cost"],
                cost_currency=row["cost_currency"],
                status=row["status"],
                opened_at=row["opened_at"],
                closed_at=row["closed_at"],
                notes=row["notes"],
                created_at=row["created_at"],
                updated_at=row["updated_at"],
                account=account,
                asset=asset,
                market_price=quote["price"],
                market_price_currency=quote["currency"],
                market_value_usd=market_value_usd,
                cost_basis_usd=cost_basis_usd,
                unrealized_pnl_usd=unrealized_pnl_usd,
                unrealized_pnl_pct=unrealized_pnl_pct,
            )
        )

    return holdings


def summarize_assets(holdings: list[AssetHolding]) -> list[AssetSummary]:
    groups: dict[str, list[AssetHolding]] = defaultdict(list)
    for holding in holdings:
        groups[holding.asset.id].append(holding)

    summaries: list[AssetSummary] = []
    for group in groups.values():
        first = group[0]
        total_quantity = sum(holding.quantity for holding in group)
        market_value_usd = sum(holding.market_value_usd for holding in group)
        cost_basis_usd = sum(holding.cost_basis_usd for holding in group)
        unrealized_pnl_usd = market_value_usd - cost_basis_usd
        unrealized_pnl_pct = (unrealized_pnl_usd / cost_basis_usd * 100) if cost_basis_usd > 0 else 0
        summaries.append(
            AssetSummary(
                **first.asset.model_dump(),
                total_quantity=total_quantity,
                accounts_count=len({holding.account.id for holding in group}),
                holdings_count=len(group),
                market_price=first.market_price,
                market_price_currency=first.market_price_currency,
                market_value_usd=market_value_usd,
                cost_basis_usd=cost_basis_usd,
                unrealized_pnl_usd=unrealized_pnl_usd,
                unrealized_pnl_pct=unrealized_pnl_pct,
                as_of=first.updated_at,
            )
        )

    return sorted(summaries, key=lambda asset: asset.market_value_usd, reverse=True)


def build_allocation_slices(items: dict[str, float]) -> list[AllocationSlice]:
    total_value = sum(items.values()) or 1
    return [
        AllocationSlice(
            id=key,
            label=key,
            value_usd=value,
            percentage=round(value / total_value * 100, 2),
        )
        for key, value in sorted(items.items(), key=lambda entry: entry[1], reverse=True)
        if value > 0
    ]


async def list_portfolio_history(db) -> list[HistoryPoint]:
    rows = await fetchall(
        db,
        "SELECT * FROM valuation_snapshots WHERE scope_type = 'portfolio' ORDER BY as_of",
    )
    return [HistoryPoint(timestamp=row["as_of"], value=row["market_value_usd"]) for row in rows]


async def list_asset_valuation_history(db, asset_id: str) -> list[HistoryPoint]:
    rows = await fetchall(
        db,
        "SELECT vs.as_of, SUM(vs.market_value_usd) AS total_value "
        "FROM valuation_snapshots vs "
        "JOIN holdings h ON h.id = vs.scope_id "
        "WHERE vs.scope_type = 'holding' AND h.asset_id = ? "
        "GROUP BY vs.as_of "
        "ORDER BY vs.as_of",
        (asset_id,),
    )
    return [HistoryPoint(timestamp=row["as_of"], value=row["total_value"] or 0) for row in rows]


async def create_valuation_snapshot(
    db,
    *,
    scope_type: str,
    scope_id: str,
    quantity: float,
    market_price: float,
    market_value_usd: float,
    fx_rate_to_usd: float,
    source: str,
    as_of: str,
):
    timestamp = now_iso()
    await db.execute(
        "INSERT INTO valuation_snapshots (id, scope_type, scope_id, quantity, market_price, market_value_usd, fx_rate_to_usd, source, as_of, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            str(uuid.uuid4()),
            scope_type,
            scope_id,
            quantity,
            market_price,
            market_value_usd,
            fx_rate_to_usd,
            source,
            as_of,
            timestamp,
        ),
    )


async def refresh_holding_snapshot(db, holding_id: str, as_of: str | None = None):
    holdings = await list_asset_holdings(db, include_closed=True)
    target = next((holding for holding in holdings if holding.id == holding_id), None)
    if not target:
        return
    _, fx_rate = convert_to_usd(1, target.market_price_currency)
    await create_valuation_snapshot(
        db,
        scope_type="holding",
        scope_id=target.id,
        quantity=target.quantity,
        market_price=target.market_price,
        market_value_usd=target.market_value_usd,
        fx_rate_to_usd=fx_rate,
        source=target.asset.price_source if target.asset.price_source != "manual" else "derived",
        as_of=as_of or now_iso(),
    )


async def refresh_portfolio_snapshot(db, as_of: str | None = None):
    holdings = await list_asset_holdings(db)
    total_value = sum(holding.market_value_usd for holding in holdings)
    await create_valuation_snapshot(
        db,
        scope_type="portfolio",
        scope_id="global",
        quantity=len(holdings),
        market_price=total_value,
        market_value_usd=total_value,
        fx_rate_to_usd=1,
        source="derived",
        as_of=as_of or now_iso(),
    )


async def build_dashboard(db) -> PortfolioDashboard:
    accounts = await list_accounts(db)
    holdings = [holding for holding in await list_asset_holdings(db) if holding.status != "closed" or holding.quantity > 0]
    summaries = summarize_assets(holdings)
    total_value = sum(holding.market_value_usd for holding in holdings)
    total_cost = sum(holding.cost_basis_usd for holding in holdings)
    unrealized_pnl = total_value - total_cost
    account_totals: dict[str, float] = defaultdict(float)
    category_totals: dict[str, float] = defaultdict(float)
    for holding in holdings:
        account_totals[holding.account.name] += holding.market_value_usd
        category_totals[holding.asset.category] += holding.market_value_usd

    history = await list_portfolio_history(db)
    if not history and holdings:
        await refresh_portfolio_snapshot(db)
        history = await list_portfolio_history(db)

    return PortfolioDashboard(
        summary=DashboardMetric(
            total_value_usd=total_value,
            total_cost_basis_usd=total_cost,
            unrealized_pnl_usd=unrealized_pnl,
            unrealized_pnl_pct=(unrealized_pnl / total_cost * 100) if total_cost > 0 else 0,
            holdings_count=len(holdings),
            accounts_count=len(accounts),
        ),
        category_allocation=build_allocation_slices(category_totals),
        account_allocation=build_allocation_slices(account_totals),
        top_holdings=summaries[:5],
        holdings=holdings,
        history=history,
        accounts=accounts,
    )


async def build_asset_detail(db, category: str, symbol: str) -> AssetDetail | None:
    asset = await get_asset_by_category_symbol(db, category, symbol)
    if not asset:
        return None

    holdings = await list_asset_holdings(db, category=category, symbol=symbol, include_closed=True)
    summaries = summarize_assets(holdings)
    summary = summaries[0] if summaries else AssetSummary(**asset.model_dump())
    adjustments = await list_adjustments(db, asset_id=asset.id)
    price_history = [
        HistoryPoint(timestamp=point["timestamp"], value=point["value"])
        for point in await get_history(category, symbol.upper(), "3M")
    ]
    valuation_history = await list_asset_valuation_history(db, asset.id)

    from app.routers.theses import _build_thesis  # local import to avoid circular dependency

    thesis_rows = await fetchall(
        db,
        "SELECT * FROM theses WHERE category = ? AND asset = ? ORDER BY updated_at DESC",
        (category, symbol.upper()),
    )
    related_theses: list[Thesis] = [await _build_thesis(db, row) for row in thesis_rows]

    return AssetDetail(
        asset=summary,
        holdings=holdings,
        adjustments=adjustments,
        price_history=price_history,
        valuation_history=valuation_history,
        related_theses=related_theses,
    )


async def apply_adjustment(db, holding_id: str, body: AdjustmentCreate) -> Adjustment:
    rows = await fetchall(
        db,
        "SELECT h.*, s.category, s.symbol, s.quote_currency "
        "FROM holdings h JOIN assets s ON s.id = h.asset_id WHERE h.id = ?",
        (holding_id,),
    )
    if not rows:
        raise ValueError("Holding not found")

    row = rows[0]
    quantity_delta = compute_quantity_delta(body.type, body.quantity)
    next_quantity = row["quantity"] + quantity_delta
    if next_quantity < -1e-9:
        raise ValueError("Adjustment would make holding quantity negative")

    current_qty = float(row["quantity"])
    current_avg_cost = float(row["avg_cost"])
    incoming_price = body.unit_price or current_avg_cost
    next_avg_cost = current_avg_cost
    if quantity_delta > 0:
        total_cost = current_qty * current_avg_cost + quantity_delta * incoming_price
        next_avg_cost = total_cost / next_quantity if next_quantity > 0 else 0
    elif next_quantity == 0:
        next_avg_cost = 0

    holding_status = "closed" if next_quantity == 0 else row["status"]
    closed_at = body.executed_at if next_quantity == 0 else row["closed_at"]
    timestamp = now_iso()

    adjustment_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO adjustments (id, holding_id, account_id, asset_id, type, quantity_delta, unit_price, fee, fee_currency, executed_at, notes, related_thesis_id, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            adjustment_id,
            holding_id,
            row["account_id"],
            row["asset_id"],
            body.type,
            quantity_delta,
            body.unit_price,
            body.fee,
            body.fee_currency,
            body.executed_at,
            body.notes,
            body.related_thesis_id,
            timestamp,
        ),
    )
    await db.execute(
        "UPDATE holdings SET quantity = ?, avg_cost = ?, status = ?, closed_at = ?, updated_at = ? WHERE id = ?",
        (next_quantity, next_avg_cost, holding_status, closed_at, timestamp, holding_id),
    )

    quote = await get_quote(row["category"], row["symbol"])
    market_value_usd, fx_rate = convert_to_usd(next_quantity * quote["price"], quote["currency"])
    await create_valuation_snapshot(
        db,
        scope_type="holding",
        scope_id=holding_id,
        quantity=next_quantity,
        market_price=quote["price"],
        market_value_usd=market_value_usd,
        fx_rate_to_usd=fx_rate,
        source=quote["source"],
        as_of=body.executed_at,
    )

    await db.commit()
    await refresh_portfolio_snapshot(db, body.executed_at)
    await db.commit()

    adjustment_rows = await fetchall(db, "SELECT * FROM adjustments WHERE id = ?", (adjustment_id,))
    return adjustment_from_row(adjustment_rows[0])
