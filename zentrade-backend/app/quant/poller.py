"""Musk Quant background poller: 定时抓取市场并落价格快照。"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any

from app.database import get_db
from app.quant import clients
from app.quant.database import save_price_snapshot

logger = logging.getLogger("quant.poller")

SNAPSHOT_INTERVAL = 300  # 5 分钟一次价格快照


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
