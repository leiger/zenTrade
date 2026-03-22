"""Background poller: periodically fetches data from XTracker/Polymarket and runs strategy evaluation."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from app.database import get_db
from app.xmonitor import clients, push
from app.xmonitor.database import (
    create_alert,
    list_push_subscriptions,
    list_strategies,
    upsert_tracking,
)
from app.xmonitor.models import ApiHealthStatus
from app.xmonitor.strategy import StrategyEngine

logger = logging.getLogger("xmonitor.poller")

POLL_INTERVAL = 150  # 2.5 minutes
MARKET_POLL_INTERVAL = 300  # 5 minutes


class XMonitorPoller:
    """Singleton background poller that drives the monitoring loop."""

    def __init__(self):
        self.engine = StrategyEngine()
        self.api_health = ApiHealthStatus()
        self._ws_connections: list[Any] = []
        self._task: asyncio.Task | None = None
        self._market_task: asyncio.Task | None = None
        self._running = False

        # Cached state — per-tracking
        self.active_trackings: list[dict] = []
        self.tracking_posts: dict[str, list[dict]] = {}  # tracking_id -> posts
        self.tracking_post_count: dict[str, int] = {}
        self.tracking_last_post_at: dict[str, datetime | None] = {}
        self.market_data: dict[str, dict] = {}  # tracking_id -> market event
        self.last_polled_at: datetime | None = None
        self._refreshing = False

    def register_ws(self, ws):
        self._ws_connections.append(ws)

    def unregister_ws(self, ws):
        self._ws_connections = [w for w in self._ws_connections if w is not ws]

    async def _broadcast_ws(self, msg_type: str, data: dict):
        import json
        payload = json.dumps({"type": msg_type, "data": data})
        dead = []
        for ws in self._ws_connections:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.unregister_ws(ws)

    def start(self):
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._poll_loop())
        self._market_task = asyncio.create_task(self._market_poll_loop())
        logger.info("XMonitor poller started")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
        if self._market_task:
            self._market_task.cancel()
        await clients.close_client()
        logger.info("XMonitor poller stopped")

    def _get_soonest_tracking(self) -> dict | None:
        """Return the tracking whose endDate is closest to now (but still in the future or just ended)."""
        now = datetime.now(timezone.utc)
        best = None
        best_delta = None
        for t in self.active_trackings:
            end_str = t.get("endDate", "")
            if not end_str:
                continue
            try:
                end_dt = datetime.fromisoformat(end_str.replace("Z", "+00:00"))
            except ValueError:
                continue
            delta = abs((end_dt - now).total_seconds())
            if best_delta is None or delta < best_delta:
                best_delta = delta
                best = t
        return best

    async def manual_refresh(self):
        """Trigger an immediate poll cycle (called from API endpoint)."""
        if self._refreshing:
            return
        self._refreshing = True
        try:
            await self._poll_xtracker()
            await self._poll_polymarket()
            await self._run_strategies()
        finally:
            self._refreshing = False

    # ── Main Poll Loop ────────────────────────────────────

    async def _poll_loop(self):
        while self._running:
            try:
                await self._poll_xtracker()
                await self._run_strategies()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.exception("Poll loop error: %s", e)
            await asyncio.sleep(POLL_INTERVAL)

    async def _market_poll_loop(self):
        while self._running:
            try:
                await self._poll_polymarket()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.exception("Market poll error: %s", e)
            await asyncio.sleep(MARKET_POLL_INTERVAL)

    # ── XTracker Polling ──────────────────────────────────

    async def _poll_xtracker(self):
        prev_status = self.api_health.xtracker
        try:
            self.active_trackings = await clients.xtracker_get_active_trackings("elonmusk")
            self.api_health.xtracker = "ok"
            self.api_health.xtracker_error = None
            self.api_health.xtracker_last_success = datetime.now(timezone.utc).isoformat()

            # Fetch posts and stats for EACH tracking
            db = await get_db()
            try:
                for t in self.active_trackings:
                    tid = t.get("id", "")
                    start_date = t.get("startDate", "")
                    end_date = t.get("endDate", "")

                    await upsert_tracking(
                        db,
                        tracking_id=tid,
                        title=t.get("title", ""),
                        start_date=start_date,
                        end_date=end_date,
                        market_link=t.get("marketLink"),
                        is_active=t.get("isActive", True)
                    )

                    try:
                        posts = await clients.xtracker_get_posts("elonmusk", start_date, end_date)
                        self.tracking_posts[tid] = posts
                        self.tracking_post_count[tid] = len(posts)

                        if posts:
                            latest = max(posts, key=lambda p: p.get("createdAt", ""))
                            self.tracking_last_post_at[tid] = datetime.fromisoformat(
                                latest["createdAt"].replace("Z", "+00:00")
                            )
                        else:
                            self.tracking_last_post_at[tid] = None
                    except Exception as e:
                        logger.warning("Failed to fetch posts for tracking %s: %s", tid, e)

                    try:
                        stats = await clients.xtracker_get_tracking(tid)
                        t["_stats"] = stats.get("stats", {})
                    except Exception:
                        pass
            finally:
                await db.close()

            self.last_polled_at = datetime.now(timezone.utc)

            if prev_status == "error" and self.api_health.xtracker == "ok":
                await self._notify_api_recovery("xtracker")

            await self._broadcast_ws("status_update", self._build_status_data())

        except Exception as e:
            self.api_health.xtracker = "error"
            self.api_health.xtracker_error = str(e)
            if prev_status == "ok":
                await self._notify_api_down("xtracker", str(e))
            await self._broadcast_ws("api_health_change", {
                "api": "xtracker",
                "status": "error",
                "error": str(e),
            })

    # ── Polymarket Polling ────────────────────────────────

    async def _poll_polymarket(self):
        prev_status = self.api_health.polymarket
        try:
            for t in self.active_trackings:
                tid = t.get("id", "")
                market_link = t.get("marketLink", "")
                if not market_link:
                    continue
                try:
                    market = await clients.fetch_market_for_tracking(t)
                    if market:
                        self.market_data[tid] = market
                except Exception as e:
                    logger.warning("Failed to fetch market for tracking %s: %s", tid, e)

            self.api_health.polymarket = "ok"
            self.api_health.polymarket_error = None
            self.api_health.polymarket_last_success = datetime.now(timezone.utc).isoformat()

            if prev_status == "error":
                await self._notify_api_recovery("polymarket")

            await self._broadcast_ws("market_update", {"markets": {k: v for k, v in self.market_data.items()}})

        except Exception as e:
            self.api_health.polymarket = "error"
            self.api_health.polymarket_error = str(e)
            if prev_status == "ok":
                await self._notify_api_down("polymarket", str(e))

    # ── Strategy Evaluation ───────────────────────────────

    async def _run_strategies(self):
        if not self.active_trackings:
            return

        db = await get_db()
        try:
            strategies = await list_strategies(db)
            subs = await list_push_subscriptions(db)

            for tracking in self.active_trackings:
                tid = tracking.get("id", "")
                end_date_str = tracking.get("endDate", "")
                if end_date_str:
                    end_dt = datetime.fromisoformat(end_date_str.replace("Z", "+00:00"))
                    remaining = max(0, (end_dt - datetime.now(timezone.utc)).total_seconds())
                else:
                    remaining = 0

                post_count = self.tracking_post_count.get(tid, 0)
                last_post_at = self.tracking_last_post_at.get(tid)

                brackets = []
                market = self.market_data.get(tid)
                market_url = ""
                if market:
                    brackets = market.get("brackets", [])
                    market_url = market.get("polymarket_url", "")

                candidates = self.engine.evaluate(
                    strategies=strategies,
                    tracking_id=tid,
                    post_count=post_count,
                    last_post_at=last_post_at,
                    remaining_seconds=remaining,
                    brackets=brackets,
                    market_url=market_url,
                )

                for c in candidates:
                    alert = await create_alert(
                        db,
                        strategy_instance_id=c.strategy_instance_id,
                        strategy_type=c.strategy_type,
                        tracking_id=c.tracking_id,
                        message=c.message,
                        trigger_data=c.trigger_data,
                        bracket=c.bracket,
                        polymarket_url=c.polymarket_url,
                        push_sent=bool(subs),
                    )

                    if subs:
                        strat = next((s for s in strategies if s["id"] == c.strategy_instance_id), {})
                        await push.send_push_notification(
                            subs,
                            alert_id=alert["id"],
                            strategy_type=c.strategy_type,
                            strategy_name=strat.get("name", c.strategy_type),
                            message=c.message,
                            polymarket_url=c.polymarket_url,
                        )

                    await self._broadcast_ws("new_alert", alert)
        finally:
            await db.close()

    # ── API Health Notifications ──────────────────────────

    async def _notify_api_down(self, api_name: str, error: str):
        db = await get_db()
        try:
            subs = await list_push_subscriptions(db)
            if subs:
                msg = f"[API DOWN] {api_name} unavailable — bots may be offline, price mispricing possible"
                await push.send_api_health_push(subs, api_name, "error", msg)
        finally:
            await db.close()

    async def _notify_api_recovery(self, api_name: str):
        db = await get_db()
        try:
            subs = await list_push_subscriptions(db)
            if subs:
                msg = f"[API RECOVERED] {api_name} is back online"
                await push.send_api_health_push(subs, api_name, "ok", msg)
        finally:
            await db.close()

    # ── Data Builders ─────────────────────────────────────

    def _build_status_data(self) -> dict:
        now = datetime.now(timezone.utc)

        # Sort trackings: soonest endDate first
        sorted_trackings = sorted(
            self.active_trackings,
            key=lambda t: abs(
                (datetime.fromisoformat(t.get("endDate", "2099-01-01T00:00:00+00:00").replace("Z", "+00:00")) - now).total_seconds()
            ),
        )

        # Use soonest tracking for the headline stats
        soonest = sorted_trackings[0] if sorted_trackings else None
        soonest_tid = soonest.get("id", "") if soonest else ""
        post_count = self.tracking_post_count.get(soonest_tid, 0)
        last_post_at = self.tracking_last_post_at.get(soonest_tid)

        secs_since_last = None
        if last_post_at:
            secs_since_last = (now - last_post_at).total_seconds()

        trackings_out = []
        for t in sorted_trackings:
            tid = t.get("id", "")
            stats = t.get("_stats", {})
            trackings_out.append({
                "id": tid,
                "title": t.get("title", ""),
                "start_date": t.get("startDate", ""),
                "end_date": t.get("endDate", ""),
                "market_link": t.get("marketLink"),
                "is_active": t.get("isActive", True),
                "total_posts": self.tracking_post_count.get(tid, stats.get("total", 0)),
                "pace": stats.get("pace", 0),
                "daily_average": stats.get("dailyAverage", 0),
            })

        return {
            "user_handle": "elonmusk",
            "api_health": self.api_health.model_dump(),
            "active_trackings": trackings_out,
            "current_post_count": post_count,
            "last_post_at": last_post_at.isoformat() if last_post_at else None,
            "seconds_since_last_post": secs_since_last,
            "last_polled_at": self.last_polled_at.isoformat() if self.last_polled_at else None,
        }


# Singleton instance
poller = XMonitorPoller()
