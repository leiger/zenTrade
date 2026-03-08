"""Populate the database with sample data matching the frontend seed."""

from datetime import datetime, timezone, timedelta
from app.database import get_db, fetchall


async def seed_data():
    db = await get_db()
    try:
        existing = await fetchall(db, "SELECT COUNT(*) as cnt FROM theses")
        if existing[0]["cnt"] > 0:
            return

        now = datetime.now(timezone.utc)
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)

        # Thesis 1: Bitcoin
        await db.execute(
            "INSERT INTO theses (id, name, category, asset, description, sort_order, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("seed-1", "Bitcoin", "crypto", "BTC", "", 0, month_ago.isoformat(), week_ago.isoformat()),
        )
        await db.execute("INSERT INTO thesis_tags VALUES (?, ?)", ("seed-1", "buy-fundamental"))
        await db.execute("INSERT INTO thesis_tags VALUES (?, ?)", ("seed-1", "buy-dca"))

        # Snapshot for BTC
        review_date = (month_ago + timedelta(days=90)).isoformat()
        await db.execute(
            "INSERT INTO snapshots (id, thesis_id, content, timeline, expected_review_date, influenced_by, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                "snap-1", "seed-1",
                "当前价位处于减半前的蓄力区间，链上数据显示长期持有者占比持续上升，交易所余额降至2年新低。宏观层面美联储暂停加息，流动性有望回暖。",
                "1Q", review_date, "PlanB (@100trillionUSD)", month_ago.isoformat(),
            ),
        )
        await db.execute("INSERT INTO snapshot_tags VALUES (?, ?)", ("snap-1", "buy-fundamental"))
        await db.execute("INSERT INTO snapshot_links (snapshot_id, url) VALUES (?, ?)", ("snap-1", "https://glassnode.com/reports"))

        # FollowUp for snap-1
        await db.execute(
            "INSERT INTO follow_ups (id, snapshot_id, comment, verdict, created_at) VALUES (?, ?, ?, ?, ?)",
            ("fu-1", "snap-1", "链上数据继续向好，减半叙事正在兑现，维持看多。", "correct", week_ago.isoformat()),
        )

        # Thesis 2: Solana
        await db.execute(
            "INSERT INTO theses (id, name, category, asset, description, sort_order, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("seed-2", "Solana", "crypto", "SOL", "", 1, week_ago.isoformat(), now.isoformat()),
        )
        await db.execute("INSERT INTO thesis_tags VALUES (?, ?)", ("seed-2", "buy-narrative"))
        await db.execute("INSERT INTO thesis_tags VALUES (?, ?)", ("seed-2", "sell-stoploss"))

        review_date_2 = (week_ago + timedelta(days=7)).isoformat()
        await db.execute(
            "INSERT INTO snapshots (id, thesis_id, content, timeline, expected_review_date, influenced_by, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                "snap-2", "seed-2",
                "SOL 生态 TVL 突破 $8B，Jupiter 交易量创新高。Meme 币热度回升但需警惕泡沫。设置 $120 为关键支撑位，跌破即执行防守止损。",
                "1W", review_date_2, "", week_ago.isoformat(),
            ),
        )
        await db.execute("INSERT INTO snapshot_tags VALUES (?, ?)", ("snap-2", "buy-narrative"))
        await db.execute("INSERT INTO snapshot_tags VALUES (?, ?)", ("snap-2", "sell-stoploss"))

        # Thesis 3: NVIDIA (no snapshots)
        await db.execute(
            "INSERT INTO theses (id, name, category, asset, description, sort_order, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("seed-3", "NVIDIA", "us-stock", "NVDA", "", 2, month_ago.isoformat(), month_ago.isoformat()),
        )
        await db.execute("INSERT INTO thesis_tags VALUES (?, ?)", ("seed-3", "buy-fundamental"))

        await db.commit()
    finally:
        await db.close()
