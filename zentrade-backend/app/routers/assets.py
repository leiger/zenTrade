from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.database import get_db
from app.models import AssetDetail, AssetSummary, PortfolioDashboard
from app.portfolio_utils import build_asset_detail, build_dashboard, list_asset_holdings, summarize_assets


router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("/dashboard", response_model=PortfolioDashboard)
async def get_dashboard():
    db = await get_db()
    try:
        return await build_dashboard(db)
    finally:
        await db.close()


@router.get("", response_model=list[AssetSummary])
async def get_assets():
    db = await get_db()
    try:
        holdings = await list_asset_holdings(db)
        return summarize_assets(holdings)
    finally:
        await db.close()


@router.get("/{category}/{symbol}", response_model=AssetDetail)
async def get_asset_detail(category: str, symbol: str):
    db = await get_db()
    try:
        detail = await build_asset_detail(db, category, symbol)
        if not detail:
            raise HTTPException(404, "Asset not found")
        return detail
    finally:
        await db.close()
