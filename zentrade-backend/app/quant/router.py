"""Musk Quant API routes.

生产环境 nginx 将 /api/ 转发到 FastAPI，因此 /api/quant/* 必须由后端提供
（前端 Next.js 的同名 Route Handler 仅在本地 dev 时生效，响应形状保持一致）。
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query

from app.database import get_db
from app.quant import clients
from app.quant.database import (
    get_hourly_counts,
    get_price_snapshots,
    list_alerts,
    list_snapshot_slugs,
)
from app.quant.poller import poller

logger = logging.getLogger("quant.router")

router = APIRouter(prefix="/quant", tags=["quant"])


@router.get("/markets")
async def quant_markets():
    """gamma elon-tweets 活跃市场（原始 JSON 透传，带内存缓存）。"""
    try:
        return await poller.get_events()
    except Exception as e:
        raise HTTPException(502, f"gamma API failed: {e}")


@router.get("/posts")
async def quant_posts(limit: int = Query(100, ge=1, le=200), offset: int = Query(0, ge=0)):
    """xtracker 推文流水透传。"""
    try:
        return await clients.fetch_posts(limit=limit, offset=offset)
    except Exception as e:
        raise HTTPException(502, f"xtracker API failed: {e}")


@router.get("/price-history")
async def quant_price_history(tokenId: str = Query(..., min_length=1)):
    """CLOB 单区间 YES token 近 50h 小时级价格。"""
    try:
        return await clients.fetch_price_history(tokenId)
    except Exception as e:
        raise HTTPException(502, f"clob API failed: {e}")


@router.get("/snapshots")
async def quant_snapshots(
    slug: str = Query(..., min_length=1),
    since: str | None = None,
    until: str | None = None,
    limit: int = Query(5000, ge=1, le=50000),
):
    """落库的区间价格快照（回测 / 复盘用）。"""
    db = await get_db()
    try:
        rows = await get_price_snapshots(db, slug, since=since, until=until, limit=limit)
        return {"slug": slug, "count": len(rows), "snapshots": rows}
    finally:
        await db.close()


@router.get("/snapshot-slugs")
async def quant_snapshot_slugs():
    """已落库的市场列表及快照覆盖范围。"""
    db = await get_db()
    try:
        return await list_snapshot_slugs(db)
    finally:
        await db.close()


@router.get("/alerts")
async def quant_alerts(limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    """后端预警历史（已推送记录）。"""
    db = await get_db()
    try:
        return await list_alerts(db, limit=limit, offset=offset)
    finally:
        await db.close()


@router.get("/constants")
async def quant_constants():
    """预测模型常量：近 90 天滚动重估，样本不足回退 206 天冻结默认值。

    sessions 元素：[name, bjHours, freq, avgTweets, medTweets, strongThreshold, weakThreshold, expectedContrib]
    """
    c = await poller.get_constants()
    return {
        "source": c.source,
        "daysUsed": c.days_used,
        "dailyBaseline": c.daily_baseline,
        "hourlyFraction": c.hourly_fraction,
        "sessions": [
            {
                "name": s[0], "bjHours": s[1], "freq": s[2], "avgTweets": s[3],
                "medTweets": s[4], "strongThreshold": s[5], "weakThreshold": s[6],
                "expectedContrib": s[7],
            }
            for s in c.sessions
        ],
    }


@router.get("/remaining-samples")
async def quant_remaining_samples(remainingHours: float = Query(..., ge=0, le=200)):
    """剩余时段发推数的 bootstrap 样本（形状用，前端均值对齐 λ 后算区间概率）。

    数据不足 21 完整天时 source=insufficient，前端回退泊松。
    """
    from datetime import datetime, timezone

    await poller.get_constants()  # 确保日向量已加载
    samples = poller.remaining_samples(remainingHours, datetime.now(timezone.utc), n=500)
    return {
        "source": "live" if samples else "insufficient",
        "daysUsed": len(poller._day_vectors),
        "samples": samples,
    }


@router.get("/hourly-counts")
async def quant_hourly_counts(days: int = Query(90, ge=1, le=365)):
    """近 N 天每 (UTC 日期, 小时) 推文计数，滚动常量重估的数据源。"""
    db = await get_db()
    try:
        rows = await get_hourly_counts(db, days=days)
        return {"days": days, "counts": rows}
    finally:
        await db.close()
