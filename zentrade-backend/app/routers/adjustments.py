from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.database import get_db, fetchall
from app.models import Adjustment, AdjustmentCreate
from app.portfolio_utils import apply_adjustment, list_adjustments


router = APIRouter(prefix="/holdings/{holding_id}/adjustments", tags=["adjustments"])


@router.get("", response_model=list[Adjustment])
async def get_adjustments(holding_id: str):
    db = await get_db()
    try:
        rows = await fetchall(db, "SELECT id FROM holdings WHERE id = ?", (holding_id,))
        if not rows:
            raise HTTPException(404, "Holding not found")
        return await list_adjustments(db, holding_id=holding_id)
    finally:
        await db.close()


@router.post("", response_model=Adjustment, status_code=201)
async def create_adjustment(holding_id: str, body: AdjustmentCreate):
    db = await get_db()
    try:
        rows = await fetchall(db, "SELECT id FROM holdings WHERE id = ?", (holding_id,))
        if not rows:
            raise HTTPException(404, "Holding not found")
        return await apply_adjustment(db, holding_id, body)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    finally:
        await db.close()
