import aiosqlite
import os

DB_PATH = os.getenv("DB_PATH", os.path.join(os.path.dirname(__file__), "..", "zentrade.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS tags (
    id   TEXT PRIMARY KEY,
    label    TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('buy', 'sell'))
);

CREATE TABLE IF NOT EXISTS theses (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    category    TEXT NOT NULL CHECK(category IN ('crypto','us-stock','a-stock','hk-stock','bond','commodity')),
    asset       TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS thesis_tags (
    thesis_id TEXT NOT NULL REFERENCES theses(id) ON DELETE CASCADE,
    tag_id    TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (thesis_id, tag_id)
);

CREATE TABLE IF NOT EXISTS snapshots (
    id                   TEXT PRIMARY KEY,
    thesis_id            TEXT NOT NULL REFERENCES theses(id) ON DELETE CASCADE,
    content              TEXT NOT NULL DEFAULT '',
    timeline             TEXT NOT NULL CHECK(timeline IN ('1D','1W','1M','1Q')),
    expected_review_date TEXT NOT NULL,
    influenced_by        TEXT NOT NULL DEFAULT '',
    created_at           TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS snapshot_tags (
    snapshot_id TEXT NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
    tag_id      TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (snapshot_id, tag_id)
);

CREATE TABLE IF NOT EXISTS snapshot_links (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_id TEXT NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
    url         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS follow_ups (
    id          TEXT PRIMARY KEY,
    snapshot_id TEXT NOT NULL UNIQUE REFERENCES snapshots(id) ON DELETE CASCADE,
    comment     TEXT NOT NULL DEFAULT '',
    verdict     TEXT NOT NULL CHECK(verdict IN ('correct','wrong','neutral')),
    created_at  TEXT NOT NULL
);
"""

SEED_TAGS = """
INSERT OR IGNORE INTO tags (id, label, category) VALUES
    ('buy-fundamental', '基本面驱动', 'buy'),
    ('buy-technical', '技术面破位/支撑', 'buy'),
    ('buy-dca', '定投计划执行', 'buy'),
    ('buy-sentiment', '情绪面超卖/FUD', 'buy'),
    ('buy-narrative', '叙事跟踪', 'buy'),
    ('sell-target', '达到目标位', 'sell'),
    ('sell-invalidated', '逻辑证伪', 'sell'),
    ('sell-stoploss', '防守止损', 'sell'),
    ('sell-rebalance', '再平衡需求', 'sell');
"""


async def fetchall(db: aiosqlite.Connection, sql: str, params: tuple = ()) -> list:
    cursor = await db.execute(sql, params)
    return await cursor.fetchall()


async def get_db() -> aiosqlite.Connection:
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    return db


async def init_db():
    db = await get_db()
    try:
        await db.executescript(SCHEMA)
        await db.executescript(SEED_TAGS)
        await db.commit()
    finally:
        await db.close()
