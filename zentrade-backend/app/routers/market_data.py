from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.models import AssetQuote, HistoryPoint
from app.price_providers.router import get_history, get_quote


router = APIRouter(prefix="/market-data", tags=["market-data"])


@router.get("/quote", response_model=AssetQuote)
async def quote(category: str = Query(...), symbol: str = Query(...)):
    try:
        data = await get_quote(category, symbol.upper())
        return AssetQuote(
            symbol=data["symbol"],
            market=data["market"],
            price=data["price"],
            currency=data["currency"],
            as_of=data["as_of"],
            source=data["source"],
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.get("/history", response_model=list[HistoryPoint])
async def history(
    category: str = Query(...),
    symbol: str = Query(...),
    range_key: str = Query("1M"),
):
    try:
        series = await get_history(category, symbol.upper(), range_key)
        return [HistoryPoint(timestamp=point["timestamp"], value=point["value"]) for point in series]
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
