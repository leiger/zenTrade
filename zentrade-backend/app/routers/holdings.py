from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException

from app.database import get_db, fetchall
from app.models import AdjustmentCreate, AssetHolding, HoldingCreate, HoldingUpdate
from app.portfolio_utils import apply_adjustment, ensure_asset, list_asset_holdings, now_iso


router = APIRouter(prefix="/holdings", tags=["holdings"])


@router.get("", response_model=list[AssetHolding])
async def get_holdings():
    db = await get_db()
    try:
        return await list_asset_holdings(db, include_closed=True)
    finally:
        await db.close()


@router.post("", response_model=AssetHolding, status_code=201)
async def create_holding(body: HoldingCreate):
    db = await get_db()
    try:
        account_rows = await fetchall(db, "SELECT id FROM accounts WHERE id = ?", (body.account_id,))
        if not account_rows:
            raise HTTPException(404, "Account not found")

        asset = await ensure_asset(
            db,
            symbol=body.symbol,
            name=body.name,
            category=body.category,
            market=body.market,
            quote_currency=body.quote_currency,
            price_source=body.price_source,
        )

        holding_id = str(uuid.uuid4())
        timestamp = now_iso()
        await db.execute(
            "INSERT INTO holdings (id, account_id, asset_id, quantity, avg_cost, cost_currency, status, opened_at, closed_at, notes, created_at, updated_at) "
            "VALUES (?, ?, ?, 0, 0, ?, 'open', ?, '', ?, ?, ?)",
            (
                holding_id,
                body.account_id,
                asset.id,
                body.cost_currency.upper() or "USD",
                body.executed_at,
                body.notes.strip(),
                timestamp,
                timestamp,
            ),
        )
        await db.commit()

        await apply_adjustment(
            db,
            holding_id,
            AdjustmentCreate(
                type=body.adjustment_type,
                quantity=body.initial_quantity,
                unit_price=body.initial_unit_price,
                fee=0,
                fee_currency=body.cost_currency.upper() or "USD",
                executed_at=body.executed_at,
                notes=body.notes,
            ),
        )

        holdings = await list_asset_holdings(db, include_closed=True)
        target = next((holding for holding in holdings if holding.id == holding_id), None)
        if not target:
            raise HTTPException(500, "Failed to load created holding")
        return target
    finally:
        await db.close()


@router.patch("/{holding_id}", response_model=AssetHolding)
async def update_holding(holding_id: str, body: HoldingUpdate):
    db = await get_db()
    try:
        rows = await fetchall(db, "SELECT * FROM holdings WHERE id = ?", (holding_id,))
        if not rows:
            raise HTTPException(404, "Holding not found")

        current = rows[0]
        timestamp = now_iso()
        await db.execute(
            "UPDATE holdings SET status = ?, notes = ?, updated_at = ? WHERE id = ?",
            (
                body.status or current["status"],
                body.notes if body.notes is not None else current["notes"],
                timestamp,
                holding_id,
            ),
        )
        await db.commit()

        holdings = await list_asset_holdings(db, include_closed=True)
        target = next((holding for holding in holdings if holding.id == holding_id), None)
        if not target:
            raise HTTPException(500, "Failed to load updated holding")
        return target
    finally:
        await db.close()
