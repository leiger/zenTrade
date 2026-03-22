"""XMonitor database tables and queries."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

import aiosqlite

from app.database import get_db, fetchall

XMONITOR_SCHEMA = """
CREATE TABLE IF NOT EXISTS xmonitor_strategy_instances (
    id             TEXT PRIMARY KEY,
    strategy_type  TEXT NOT NULL CHECK(strategy_type IN ('silent_period','tail_sweep','settlement_no','panic_fade')),
    name           TEXT NOT NULL,
    enabled        INTEGER NOT NULL DEFAULT 1,
    params         TEXT NOT NULL DEFAULT '{}',
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS xmonitor_trackings (
    id             TEXT PRIMARY KEY,
    title          TEXT NOT NULL,
    start_date     TEXT NOT NULL,
    end_date       TEXT NOT NULL,
    market_link    TEXT,
    is_active      INTEGER NOT NULL,
    updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS xmonitor_alerts (
    id                     TEXT PRIMARY KEY,
    strategy_instance_id   TEXT NOT NULL REFERENCES xmonitor_strategy_instances(id) ON DELETE CASCADE,
    strategy_type          TEXT NOT NULL,
    tracking_id            TEXT NOT NULL,
    bracket                TEXT,
    trigger_data           TEXT NOT NULL DEFAULT '{}',
    message                TEXT NOT NULL,
    polymarket_url         TEXT NOT NULL DEFAULT '',
    feedback               TEXT CHECK(feedback IN ('yes','no')),
    feedback_note          TEXT,
    created_at             TEXT NOT NULL,
    feedback_at            TEXT,
    push_sent              INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS xmonitor_push_subscriptions (
    id         TEXT PRIMARY KEY,
    endpoint   TEXT NOT NULL UNIQUE,
    p256dh     TEXT NOT NULL,
    auth       TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS xmonitor_api_health (
    id              TEXT PRIMARY KEY,
    api_name        TEXT NOT NULL,
    status          TEXT NOT NULL CHECK(status IN ('ok','error','timeout')),
    error_message   TEXT,
    response_time_ms INTEGER,
    checked_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS xmonitor_historical_posts (
    id             TEXT PRIMARY KEY,
    user_id        TEXT NOT NULL,
    platform_id    TEXT NOT NULL,
    content        TEXT NOT NULL,
    created_at     TEXT NOT NULL,
    imported_at    TEXT NOT NULL,
    metrics        TEXT,
    raw_data       TEXT NOT NULL
);
"""

SEED_STRATEGIES = """
INSERT OR IGNORE INTO xmonitor_strategy_instances (id, strategy_type, name, enabled, params, created_at, updated_at)
VALUES
    ('default-silent-6h',  'silent_period',  '沉默6h提醒',      1, '{"silence_hours":6,"remind_interval_minutes":60}',                       '{now}', '{now}'),
    ('default-tail-99',    'tail_sweep',     '扫尾99%',         1, '{"min_yes_price":99}',                                                    '{now}', '{now}'),
    ('default-settle-12h', 'settlement_no',  '结算12h/100gap',  1, '{"remaining_hours":12,"min_gap":100,"max_no_price":99.5,"remind_interval_minutes":120}', '{now}', '{now}'),
    ('default-panic-2h',   'panic_fade',     '恐慌盘2h/50gap',  1, '{"remaining_hours":2,"min_gap":50,"min_yes_price":5}',                    '{now}', '{now}');
"""


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def init_xmonitor_db():
    db = await get_db()
    try:
        await db.executescript(XMONITOR_SCHEMA)
        seed = SEED_STRATEGIES.replace("{now}", _now_iso())
        await db.executescript(seed)
        await db.commit()
    finally:
        await db.close()


# ── Strategy CRUD ─────────────────────────────────────────

async def list_strategies(db: aiosqlite.Connection) -> list[dict]:
    rows = await fetchall(
        db,
        "SELECT * FROM xmonitor_strategy_instances ORDER BY created_at",
    )
    return [_row_to_strategy(r) for r in rows]


async def get_strategy(db: aiosqlite.Connection, sid: str) -> dict | None:
    rows = await fetchall(
        db,
        "SELECT * FROM xmonitor_strategy_instances WHERE id = ?",
        (sid,),
    )
    return _row_to_strategy(rows[0]) if rows else None


async def create_strategy(db: aiosqlite.Connection, strategy_type: str, name: str, enabled: bool, params: dict) -> dict:
    sid = str(uuid.uuid4())
    now = _now_iso()
    await db.execute(
        "INSERT INTO xmonitor_strategy_instances (id, strategy_type, name, enabled, params, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
        (sid, strategy_type, name, 1 if enabled else 0, json.dumps(params), now, now),
    )
    await db.commit()
    return {"id": sid, "strategy_type": strategy_type, "name": name, "enabled": enabled, "params": params, "created_at": now, "updated_at": now}


async def update_strategy(db: aiosqlite.Connection, sid: str, name: str | None, enabled: bool | None, params: dict | None) -> dict | None:
    existing = await get_strategy(db, sid)
    if not existing:
        return None
    sets, vals = [], []
    if name is not None:
        sets.append("name = ?")
        vals.append(name)
    if enabled is not None:
        sets.append("enabled = ?")
        vals.append(1 if enabled else 0)
    if params is not None:
        sets.append("params = ?")
        vals.append(json.dumps(params))
    if not sets:
        return existing
    now = _now_iso()
    sets.append("updated_at = ?")
    vals.append(now)
    vals.append(sid)
    await db.execute(f"UPDATE xmonitor_strategy_instances SET {', '.join(sets)} WHERE id = ?", tuple(vals))
    await db.commit()
    return await get_strategy(db, sid)


async def delete_strategy(db: aiosqlite.Connection, sid: str) -> bool:
    rows = await fetchall(db, "SELECT id FROM xmonitor_strategy_instances WHERE id = ?", (sid,))
    if not rows:
        return False
    await db.execute("DELETE FROM xmonitor_strategy_instances WHERE id = ?", (sid,))
    await db.commit()
    return True


def _row_to_strategy(r: aiosqlite.Row) -> dict:
    return {
        "id": r["id"],
        "strategy_type": r["strategy_type"],
        "name": r["name"],
        "enabled": bool(r["enabled"]),
        "params": json.loads(r["params"]) if r["params"] else {},
        "created_at": r["created_at"],
        "updated_at": r["updated_at"],
    }


# ── Trackings ─────────────────────────────────────────────

async def upsert_tracking(
    db: aiosqlite.Connection,
    tracking_id: str,
    title: str,
    start_date: str,
    end_date: str,
    market_link: str | None,
    is_active: bool
) -> None:
    now = _now_iso()
    await db.execute(
        """INSERT INTO xmonitor_trackings (id, title, start_date, end_date, market_link, is_active, updated_at)
        VALUES (?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET
            title=excluded.title,
            start_date=excluded.start_date,
            end_date=excluded.end_date,
            market_link=excluded.market_link,
            is_active=excluded.is_active,
            updated_at=excluded.updated_at
        """,
        (tracking_id, title, start_date, end_date, market_link, 1 if is_active else 0, now),
    )
    await db.commit()

async def get_historical_trackings(db: aiosqlite.Connection) -> list[dict]:
    # Only return trackings that have fired alerts (INNER JOIN)
    # They can be grouped by tracking id to avoid duplicates
    sql = """
        SELECT t.*
        FROM xmonitor_trackings t
        INNER JOIN xmonitor_alerts a ON t.id = a.tracking_id
        GROUP BY t.id
        ORDER BY t.start_date DESC
    """
    rows = await fetchall(db, sql)
    return [
        {
            "id": r["id"],
            "title": r["title"],
            "startDate": r["start_date"],
            "endDate": r["end_date"],
            "marketLink": r["market_link"],
            "isActive": bool(r["is_active"]),
        } for r in rows
    ]

# ── Alert Queries ─────────────────────────────────────────

async def create_alert(
    db: aiosqlite.Connection,
    strategy_instance_id: str,
    strategy_type: str,
    tracking_id: str,
    message: str,
    trigger_data: dict,
    bracket: str | None = None,
    polymarket_url: str = "",
    push_sent: bool = False,
) -> dict:
    aid = str(uuid.uuid4())
    now = _now_iso()
    await db.execute(
        """INSERT INTO xmonitor_alerts
        (id, strategy_instance_id, strategy_type, tracking_id, bracket, trigger_data, message, polymarket_url, created_at, push_sent)
        VALUES (?,?,?,?,?,?,?,?,?,?)""",
        (aid, strategy_instance_id, strategy_type, tracking_id, bracket, json.dumps(trigger_data), message, polymarket_url, now, 1 if push_sent else 0),
    )
    await db.commit()
    return {"id": aid, "strategy_instance_id": strategy_instance_id, "strategy_type": strategy_type, "tracking_id": tracking_id, "bracket": bracket, "trigger_data": trigger_data, "message": message, "polymarket_url": polymarket_url, "feedback": None, "feedback_note": None, "created_at": now, "feedback_at": None, "push_sent": push_sent}


async def list_alerts(db: aiosqlite.Connection, strategy_type: str | None = None, limit: int = 50, offset: int = 0) -> list[dict]:
    sql = "SELECT * FROM xmonitor_alerts"
    params: list = []
    if strategy_type:
        sql += " WHERE strategy_type = ?"
        params.append(strategy_type)
    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    rows = await fetchall(db, sql, tuple(params))
    return [_row_to_alert(r) for r in rows]


async def update_alert_feedback(db: aiosqlite.Connection, aid: str, feedback: str, note: str | None) -> dict | None:
    rows = await fetchall(db, "SELECT * FROM xmonitor_alerts WHERE id = ?", (aid,))
    if not rows:
        return None
    now = _now_iso()
    await db.execute(
        "UPDATE xmonitor_alerts SET feedback = ?, feedback_note = ?, feedback_at = ? WHERE id = ?",
        (feedback, note, now, aid),
    )
    await db.commit()
    rows = await fetchall(db, "SELECT * FROM xmonitor_alerts WHERE id = ?", (aid,))
    return _row_to_alert(rows[0])


def _row_to_alert(r: aiosqlite.Row) -> dict:
    return {
        "id": r["id"],
        "strategy_instance_id": r["strategy_instance_id"],
        "strategy_type": r["strategy_type"],
        "tracking_id": r["tracking_id"],
        "bracket": r["bracket"],
        "trigger_data": json.loads(r["trigger_data"]) if r["trigger_data"] else {},
        "message": r["message"],
        "polymarket_url": r["polymarket_url"],
        "feedback": r["feedback"],
        "feedback_note": r["feedback_note"],
        "created_at": r["created_at"],
        "feedback_at": r["feedback_at"],
        "push_sent": bool(r["push_sent"]),
    }


# ── Push Subscription ────────────────────────────────────

async def save_push_subscription(db: aiosqlite.Connection, endpoint: str, p256dh: str, auth: str) -> dict:
    sid = str(uuid.uuid4())
    now = _now_iso()
    await db.execute(
        "INSERT OR REPLACE INTO xmonitor_push_subscriptions (id, endpoint, p256dh, auth, created_at) VALUES (?,?,?,?,?)",
        (sid, endpoint, p256dh, auth, now),
    )
    await db.commit()
    return {"id": sid, "endpoint": endpoint, "p256dh": p256dh, "auth": auth, "created_at": now}


async def delete_push_subscription(db: aiosqlite.Connection, endpoint: str) -> bool:
    rows = await fetchall(db, "SELECT id FROM xmonitor_push_subscriptions WHERE endpoint = ?", (endpoint,))
    if not rows:
        return False
    await db.execute("DELETE FROM xmonitor_push_subscriptions WHERE endpoint = ?", (endpoint,))
    await db.commit()
    return True


async def list_push_subscriptions(db: aiosqlite.Connection) -> list[dict]:
    rows = await fetchall(db, "SELECT * FROM xmonitor_push_subscriptions")
    return [{"id": r["id"], "endpoint": r["endpoint"], "p256dh": r["p256dh"], "auth": r["auth"], "created_at": r["created_at"]} for r in rows]
async def save_historical_posts(db: aiosqlite.Connection, posts: list[dict]) -> int:
    """Save a list of posts to the historical posts table. Returns count of new/updated rows."""
    count = 0
    for p in posts:
        pid = p.get("id")
        user_id = p.get("userId", "")
        platform_id = p.get("platformId", "")
        content = p.get("content", "")
        created_at = p.get("createdAt", "")
        imported_at = p.get("importedAt", _now_iso())
        metrics = json.dumps(p.get("metrics")) if p.get("metrics") else None
        
        if not pid:
            continue
        
        await db.execute(
            """INSERT INTO xmonitor_historical_posts 
               (id, user_id, platform_id, content, created_at, imported_at, metrics, raw_data)
               VALUES (?,?,?,?,?,?,?,?)
               ON CONFLICT(id) DO UPDATE SET
                   user_id=excluded.user_id,
                   platform_id=excluded.platform_id,
                   content=excluded.content,
                   created_at=excluded.created_at,
                   imported_at=excluded.imported_at,
                   metrics=excluded.metrics,
                   raw_data=excluded.raw_data
            """,
            (pid, user_id, platform_id, content, created_at, imported_at, metrics, json.dumps(p)),
        )
        count += 1
    await db.commit()
    return count


async def get_historical_posts(
    db: aiosqlite.Connection,
    limit: int = 50,
    offset: int = 0,
    start_date: str | None = None,
    end_date: str | None = None,
) -> list[dict]:
    where_parts: list[str] = []
    params: list = []
    if start_date:
        where_parts.append("created_at >= ?")
        params.append(start_date)
    if end_date:
        where_parts.append("created_at < ?")
        params.append(end_date)
        
    where_clause = (" WHERE " + " AND ".join(where_parts)) if where_parts else ""
    
    sql = f"""
        SELECT *
        FROM xmonitor_historical_posts
        {where_clause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    """
    params.extend([limit, offset])
    rows = await fetchall(db, sql, tuple(params))
    
    return [
        {
            "id": r["id"],
            "userId": r["user_id"],
            "platformId": r["platform_id"],
            "content": r["content"],
            "createdAt": r["created_at"],
            "importedAt": r["imported_at"],
            "metrics": json.loads(r["metrics"]) if r["metrics"] else None,
            "rawData": json.loads(r["raw_data"]) if r["raw_data"] else None,
        } for r in rows
    ]


async def get_post_activity_matrix(
    db: aiosqlite.Connection,
    start_date: str | None = None,
    end_date: str | None = None,
) -> dict:
    """Return a 7×24 matrix of post counts by day-of-week × hour.

    Rows: 0=Mon … 6=Sun.  Columns: 0–23 hours.
    SQLite strftime('%w') yields 0=Sun, so we remap.
    """
    where_parts: list[str] = []
    params: list[str] = []
    if start_date:
        where_parts.append("created_at >= ?")
        params.append(start_date)
    if end_date:
        where_parts.append("created_at < ?")
        params.append(end_date)

    where_clause = (" WHERE " + " AND ".join(where_parts)) if where_parts else ""

    sql = f"""
        SELECT
            CAST(strftime('%w', created_at) AS INTEGER) AS dow,
            CAST(strftime('%H', created_at) AS INTEGER) AS hour,
            COUNT(*) AS cnt
        FROM xmonitor_historical_posts
        {where_clause}
        GROUP BY dow, hour
    """
    rows = await fetchall(db, sql, tuple(params))

    # Build 7×24 matrix (Mon=0 … Sun=6)
    matrix = [[0] * 24 for _ in range(7)]
    sqlite_to_monday = {0: 6, 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5}

    for r in rows:
        mapped_dow = sqlite_to_monday[r["dow"]]
        matrix[mapped_dow][r["hour"]] = r["cnt"]

    day_totals = [sum(row) for row in matrix]
    hour_totals = [sum(matrix[d][h] for d in range(7)) for h in range(24)]
    total_posts = sum(day_totals)

    # 5-minute buckets per hour (24 × 12)
    bucket_sql = f"""
        SELECT
            CAST(strftime('%H', created_at) AS INTEGER) AS hour,
            CAST(strftime('%M', created_at) AS INTEGER) / 5 AS bucket,
            COUNT(*) AS cnt
        FROM xmonitor_historical_posts
        {where_clause}
        GROUP BY hour, bucket
    """
    bucket_rows = await fetchall(db, bucket_sql, tuple(params))
    minute_buckets: list[list[int]] = [[0] * 12 for _ in range(24)]
    for r in bucket_rows:
        minute_buckets[r["hour"]][r["bucket"]] = r["cnt"]

    return {
        "total_posts": total_posts,
        "matrix": matrix,
        "day_totals": day_totals,
        "hour_totals": hour_totals,
        "minute_buckets": minute_buckets,
    }
