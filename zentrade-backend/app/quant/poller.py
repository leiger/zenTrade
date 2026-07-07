"""Musk Quant background poller: 定时抓取市场并落价格快照。"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any

from app.database import get_db
from app.quant import clients, engine
from app.quant.database import (
    mark_alert_sent,
    prune_alert_log,
    save_alert,
    save_price_snapshot,
    was_alert_sent,
)
from app.xmonitor import push
from app.xmonitor.clients import xtracker_get_posts
from app.xmonitor.database import list_push_subscriptions

logger = logging.getLogger("quant.poller")

SNAPSHOT_INTERVAL = 300  # 5 分钟一次价格快照 + 预警评估


class QuantPoller:
    def __init__(self):
        self._task: asyncio.Task | None = None
        self._running = False

        # gamma events 内存缓存（/api/quant/markets 用，快照循环顺带刷新）
        self.cached_events: list[dict[str, Any]] = []
        self.cached_at: float = 0.0
        self.last_snapshot_at: datetime | None = None

    def start(self):
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())
        logger.info("Quant poller started")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
        await clients.close_client()
        logger.info("Quant poller stopped")

    async def _loop(self):
        while self._running:
            try:
                await self.snapshot_once()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.exception("Quant snapshot error: %s", e)
            try:
                await self.evaluate_alerts_once()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.exception("Quant alert error: %s", e)
            await asyncio.sleep(SNAPSHOT_INTERVAL)

    async def snapshot_once(self):
        events = await clients.fetch_quant_events()
        if events:
            self.cached_events = events
            self.cached_at = time.time()

        now = datetime.now(timezone.utc)
        ts = now.isoformat()
        db = await get_db()
        try:
            total = 0
            for e in events:
                slug = e.get("slug", "")
                if not slug:
                    continue
                buckets = clients.parse_event_buckets(e)
                if buckets:
                    total += await save_price_snapshot(db, ts, slug, buckets)
            self.last_snapshot_at = now
            logger.info("Quant snapshot saved: %d events, %d bucket rows", len(events), total)
        finally:
            await db.close()

    # ── 预警评估 ──────────────────────────────────────────

    def _current_event(self) -> dict[str, Any] | None:
        """已开始计数、最先到期的活跃市场（当前交易周期）。"""
        now = datetime.now(timezone.utc)
        candidates = []
        for e in self.cached_events:
            end_str = e.get("endDate")
            start_str = e.get("startTime") or e.get("startDate")
            if not end_str or not start_str:
                continue
            try:
                end = datetime.fromisoformat(end_str.replace("Z", "+00:00"))
                start = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
            except ValueError:
                continue
            if start <= now < end:
                candidates.append((end, start, e))
        if not candidates:
            return None
        candidates.sort(key=lambda c: c[0])
        return {"event": candidates[0][2], "start": candidates[0][1], "end": candidates[0][0]}

    async def evaluate_alerts_once(self):
        cur = self._current_event()
        if not cur:
            return
        event, start, end = cur["event"], cur["start"], cur["end"]
        slug = event.get("slug", "")
        now = datetime.now(timezone.utc)

        # 推文计数：xtracker 按窗口过滤（与结算口径一致）
        posts = await xtracker_get_posts("elonmusk", start.isoformat(), end.isoformat())
        current = len(posts)
        if current == 0:
            return  # 无数据时不评估，避免基于错误计数的假信号

        elapsed_days = max(1 / 24, (now - start).total_seconds() / 86400)
        pace = current / elapsed_days
        remaining_hours = max(0.0, (end - now).total_seconds() / 3600)

        # 今日（BJ）各小时计数：BJ 零点 = UTC 前一日 16:00
        bj_midnight_utc = engine.bj_now(now).replace(hour=0, minute=0, second=0, microsecond=0) - engine.BJ_OFFSET
        today_by_hour = [0] * 24
        for p in posts:
            created = p.get("createdAt")
            if not created:
                continue
            dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
            if dt >= bj_midnight_utc:
                today_by_hour[engine.bj_hour(dt)] += 1
        today_count = sum(today_by_hour)

        buckets = clients.parse_event_buckets(event)
        candidates = engine.build_alerts(
            buckets=buckets,
            current=current,
            today_count=today_count,
            pace=pace,
            remaining_hours=remaining_hours,
            event_slug=slug,
            now=now,
            today_by_hour=today_by_hour,
        )
        if not candidates:
            return

        db = await get_db()
        try:
            await prune_alert_log(db, engine.DEDUP_WINDOW_SECONDS * 2)
            subs = await list_push_subscriptions(db)
            for c in candidates:
                if await was_alert_sent(db, c.key, engine.DEDUP_WINDOW_SECONDS):
                    continue
                alert = await save_alert(db, c.key, c.level, c.title, c.detail, c.event_slug)
                await mark_alert_sent(db, c.key)
                logger.info("Quant alert [%s] %s", c.key, c.title)
                if subs:
                    await push.send_push_notification(
                        subs,
                        alert_id=alert["id"],
                        strategy_type="quant",
                        strategy_name=c.title,
                        message=c.detail,
                        polymarket_url=f"https://polymarket.com/event/{slug}" if slug else "",
                    )
        finally:
            await db.close()

    async def get_events(self, max_age_seconds: float = 60.0) -> list[dict[str, Any]]:
        """给 /api/quant/markets 用：缓存新鲜直接返回，否则现拉（失败回退旧缓存）。"""
        if self.cached_events and time.time() - self.cached_at < max_age_seconds:
            return self.cached_events
        try:
            events = await clients.fetch_quant_events()
            if events:
                self.cached_events = events
                self.cached_at = time.time()
            return events
        except Exception as e:
            logger.warning("gamma fetch failed, serving stale cache: %s", e)
            if self.cached_events:
                return self.cached_events
            raise


# Singleton instance
poller = QuantPoller()
