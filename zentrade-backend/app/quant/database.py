"""Musk Quant database tables and queries.

价格快照 + 预警去重日志。推文流水复用 xmonitor_historical_posts（xmonitor 轮询器持续写入）。
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import aiosqlite

from app.database import get_db, fetchall

QUANT_SCHEMA = """
CREATE TABLE IF NOT EXISTS quant_price_snapshots (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ts          TEXT NOT NULL,
    event_slug  TEXT NOT NULL,
    market_id   TEXT NOT NULL,
    label       TEXT NOT NULL,
    lower_bound INTEGER NOT NULL DEFAULT 0,
    upper_bound INTEGER,
    best_bid    REAL,
    best_ask    REAL,
    last_trade  REAL,
    volume      REAL
);

CREATE INDEX IF NOT EXISTS idx_quant_snap_slug_ts ON quant_price_snapshots(event_slug, ts);

CREATE TABLE IF NOT EXISTS quant_alert_log (
    key     TEXT PRIMARY KEY,
    sent_at TEXT NOT NULL
);
"""


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def init_quant_db():
    db = await get_db()
    try:
        await db.executescript(QUANT_SCHEMA)
        await db.commit()
    finally:
        await db.close()


# ── Price Snapshots ───────────────────────────────────────

async def save_price_snapshot(
    db: aiosqlite.Connection,
    ts: str,
    event_slug: str,
    buckets: list[dict],
) -> int:
    for b in buckets:
        await db.execute(
            """INSERT INTO quant_price_snapshots
            (ts, event_slug, market_id, label, lower_bound, upper_bound, best_bid, best_ask, last_trade, volume)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                ts,
                event_slug,
                b.get("market_id", ""),
                b.get("label", ""),
                b.get("lower_bound", 0),
                b.get("upper_bound"),
                b.get("best_bid"),
                b.get("best_ask"),
                b.get("last_trade"),
                b.get("volume"),
            ),
        )
    await db.commit()
    return len(buckets)


async def get_price_snapshots(
    db: aiosqlite.Connection,
    event_slug: str,
    since: str | None = None,
    until: str | None = None,
    limit: int = 5000,
) -> list[dict]:
    where = ["event_slug = ?"]
    params: list = [event_slug]
    if since:
        where.append("ts >= ?")
        params.append(since)
    if until:
        where.append("ts < ?")
        params.append(until)
    sql = f"""
        SELECT ts, market_id, label, lower_bound, upper_bound, best_bid, best_ask, last_trade, volume
        FROM quant_price_snapshots
        WHERE {' AND '.join(where)}
        ORDER BY ts ASC
        LIMIT ?
    """
    params.append(limit)
    rows = await fetchall(db, sql, tuple(params))
    return [
        {
            "ts": r["ts"],
            "marketId": r["market_id"],
            "label": r["label"],
            "min": r["lower_bound"],
            "max": r["upper_bound"],
            "bestBid": r["best_bid"],
            "bestAsk": r["best_ask"],
            "lastTrade": r["last_trade"],
            "volume": r["volume"],
        }
        for r in rows
    ]


async def list_snapshot_slugs(db: aiosqlite.Connection) -> list[dict]:
    rows = await fetchall(
        db,
        """SELECT event_slug, COUNT(DISTINCT ts) AS snapshots, MIN(ts) AS first_ts, MAX(ts) AS last_ts
        FROM quant_price_snapshots GROUP BY event_slug ORDER BY last_ts DESC""",
    )
    return [
        {
            "slug": r["event_slug"],
            "snapshots": r["snapshots"],
            "firstTs": r["first_ts"],
            "lastTs": r["last_ts"],
        }
        for r in rows
    ]


# ── Hourly Tweet Counts（源：xmonitor_historical_posts）───

async def get_hourly_counts(db: aiosqlite.Connection, days: int = 90) -> list[dict]:
    """近 N 天每 (UTC 日期, UTC 小时) 的推文计数。时区换算由调用方处理。"""
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    rows = await fetchall(
        db,
        """SELECT strftime('%Y-%m-%d', created_at) AS date,
                  CAST(strftime('%H', created_at) AS INTEGER) AS hour,
                  COUNT(*) AS count
        FROM xmonitor_historical_posts
        WHERE created_at >= ?
        GROUP BY date, hour
        ORDER BY date, hour""",
        (since,),
    )
    return [{"date": r["date"], "hour": r["hour"], "count": r["count"]} for r in rows]


# ── Alert Dedup Log ───────────────────────────────────────

async def was_alert_sent(db: aiosqlite.Connection, key: str, window_seconds: int) -> bool:
    rows = await fetchall(db, "SELECT sent_at FROM quant_alert_log WHERE key = ?", (key,))
    if not rows:
        return False
    sent_at = datetime.fromisoformat(rows[0]["sent_at"])
    return (datetime.now(timezone.utc) - sent_at).total_seconds() < window_seconds


async def mark_alert_sent(db: aiosqlite.Connection, key: str) -> None:
    await db.execute(
        "INSERT INTO quant_alert_log (key, sent_at) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET sent_at = excluded.sent_at",
        (key, _now_iso()),
    )
    await db.commit()


async def prune_alert_log(db: aiosqlite.Connection, older_than_seconds: int) -> None:
    cutoff = (datetime.now(timezone.utc) - timedelta(seconds=older_than_seconds)).isoformat()
    await db.execute("DELETE FROM quant_alert_log WHERE sent_at < ?", (cutoff,))
    await db.commit()
