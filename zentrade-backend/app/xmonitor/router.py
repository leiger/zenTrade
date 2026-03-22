"""REST API and WebSocket routes for X Monitor."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect

from app.database import get_db
from app.xmonitor import database as xdb
from app.xmonitor.models import (
    AlertFeedback,
    MonitorAlert,
    PushSubscriptionCreate,
    StrategyInstance,
    StrategyInstanceCreate,
    StrategyInstanceUpdate,
)
from app.xmonitor.poller import poller
from app.xmonitor.push import get_vapid_public_key

logger = logging.getLogger("xmonitor.router")

router = APIRouter(prefix="/xmonitor", tags=["xmonitor"])


# ── Monitor Status ────────────────────────────────────────

@router.get("/status")
async def get_status():
    """Current monitoring status including post count, timing, API health."""
    return poller._build_status_data()


@router.post("/refresh", status_code=200)
async def manual_refresh():
    """Manually trigger an immediate data refresh."""
    await poller.manual_refresh()
    return poller._build_status_data()

@router.get("/trackings/history")
async def get_historical_trackings_api():
    """Get past trackings that have associated alerts."""
    from app.xmonitor.database import get_historical_trackings
    db = await get_db()
    try:
        return await get_historical_trackings(db)
    finally:
        await db.close()


@router.get("/posts")
async def get_posts(tracking_id: Optional[str] = Query(None)):
    """Recent posts from the tracked user for a specific tracking period."""
    if tracking_id and tracking_id in poller.tracking_posts:
        return poller.tracking_posts[tracking_id]
    soonest = poller._get_soonest_tracking()
    if soonest:
        return poller.tracking_posts.get(soonest.get("id", ""), [])
    return []


@router.get("/markets")
async def get_markets():
    """Active market events with bracket prices."""
    return poller.market_data


@router.get("/tracking/{tracking_id}")
async def get_tracking(tracking_id: str):
    """Detailed stats for a specific tracking period."""
    from app.xmonitor.clients import xtracker_get_tracking
    try:
        data = await xtracker_get_tracking(tracking_id)
        return data
    except Exception as e:
        raise HTTPException(502, f"Failed to fetch tracking: {e}")


# ── Strategy CRUD ─────────────────────────────────────────

@router.get("/strategies", response_model=list[StrategyInstance])
async def list_strategies():
    db = await get_db()
    try:
        return await xdb.list_strategies(db)
    finally:
        await db.close()


@router.post("/strategies", response_model=StrategyInstance, status_code=201)
async def create_strategy(body: StrategyInstanceCreate):
    db = await get_db()
    try:
        return await xdb.create_strategy(db, body.strategy_type, body.name, body.enabled, body.params)
    finally:
        await db.close()


@router.put("/strategies/{strategy_id}", response_model=StrategyInstance)
async def update_strategy(strategy_id: str, body: StrategyInstanceUpdate):
    db = await get_db()
    try:
        result = await xdb.update_strategy(db, strategy_id, body.name, body.enabled, body.params)
        if not result:
            raise HTTPException(404, "Strategy not found")
        if body.enabled is False:
            poller.engine.reset_all_for_strategy(strategy_id)
        return result
    finally:
        await db.close()


@router.delete("/strategies/{strategy_id}", status_code=204)
async def delete_strategy(strategy_id: str):
    db = await get_db()
    try:
        deleted = await xdb.delete_strategy(db, strategy_id)
        if not deleted:
            raise HTTPException(404, "Strategy not found")
        poller.engine.reset_all_for_strategy(strategy_id)
    finally:
        await db.close()


# ── Alerts ────────────────────────────────────────────────

@router.get("/alerts", response_model=list[MonitorAlert])
async def get_alerts(
    strategy_type: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
):
    db = await get_db()
    try:
        return await xdb.list_alerts(db, strategy_type=strategy_type, limit=limit, offset=offset)
    finally:
        await db.close()


@router.post("/alerts/{alert_id}/feedback", response_model=MonitorAlert)
async def post_alert_feedback(alert_id: str, body: AlertFeedback):
    db = await get_db()
    try:
        result = await xdb.update_alert_feedback(db, alert_id, body.feedback, body.feedback_note)
        if not result:
            raise HTTPException(404, "Alert not found")
        return result
    finally:
        await db.close()


# ── Push Subscriptions ────────────────────────────────────

@router.get("/push/vapid-key")
async def get_vapid_key():
    key = get_vapid_public_key()
    if not key:
        raise HTTPException(503, "VAPID key not configured")
    return {"public_key": key}


@router.post("/push/subscribe", status_code=201)
async def subscribe_push(body: PushSubscriptionCreate):
    db = await get_db()
    try:
        return await xdb.save_push_subscription(db, body.endpoint, body.p256dh, body.auth)
    finally:
        await db.close()


@router.delete("/push/subscribe", status_code=204)
async def unsubscribe_push(endpoint: str = Query(...)):
    db = await get_db()
    try:
        deleted = await xdb.delete_push_subscription(db, endpoint)
        if not deleted:
            raise HTTPException(404, "Subscription not found")
    finally:
        await db.close()


# ── WebSocket ─────────────────────────────────────────────

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    poller.register_ws(websocket)
    logger.info("WebSocket client connected")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        poller.unregister_ws(websocket)
        logger.info("WebSocket client disconnected")
