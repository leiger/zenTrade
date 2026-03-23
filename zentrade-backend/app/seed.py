"""Populate the database with sample data matching the frontend seed."""

import os
import uuid
from datetime import datetime, timezone, timedelta

from app.database import get_db, fetchall
from app.portfolio_utils import create_valuation_snapshot


async def seed_data():
    db = await get_db()
    try:
        now = datetime.now(timezone.utc)
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)
        thesis_existing = await fetchall(db, "SELECT COUNT(*) as cnt FROM theses")
        if thesis_existing[0]["cnt"] == 0:
            # Thesis 1: Bitcoin
            await db.execute(
                "INSERT INTO theses (id, name, category, asset, status, description, sort_order, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)",
                ("seed-1", "Bitcoin", "crypto", "BTC", "", 0, month_ago.isoformat(), week_ago.isoformat()),
            )
            await db.execute("INSERT INTO thesis_tags VALUES (?, ?)", ("seed-1", "buy-fundamental"))
            await db.execute("INSERT INTO thesis_tags VALUES (?, ?)", ("seed-1", "buy-dca"))

            review_date = (month_ago + timedelta(days=90)).isoformat()
            await db.execute(
                "INSERT INTO snapshots (id, thesis_id, content, timeline, expected_review_date, influenced_by, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    "snap-1", "seed-1",
                    "当前价位处于减半前的蓄力区间，链上数据显示长期持有者占比持续上升，交易所余额降至2年新低。宏观层面美联储暂停加息，流动性有望回暖。",
                    "1Q", review_date, '["PlanB (@100trillionUSD)"]', month_ago.isoformat(),
                ),
            )
            await db.execute("INSERT INTO snapshot_tags VALUES (?, ?)", ("snap-1", "buy-fundamental"))
            await db.execute("INSERT INTO snapshot_links (snapshot_id, url) VALUES (?, ?)", ("snap-1", "https://glassnode.com/reports"))

            await db.execute(
                "INSERT INTO follow_ups (id, snapshot_id, comment, verdict, created_at) VALUES (?, ?, ?, ?, ?)",
                ("fu-1", "snap-1", "链上数据继续向好，减半叙事正在兑现，维持看多。", "correct", week_ago.isoformat()),
            )

            await db.execute(
                "INSERT INTO theses (id, name, category, asset, status, description, sort_order, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)",
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

            await db.execute(
                "INSERT INTO theses (id, name, category, asset, status, description, sort_order, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)",
                ("seed-3", "NVIDIA", "us-stock", "NVDA", "", 2, month_ago.isoformat(), month_ago.isoformat()),
            )
            await db.execute("INSERT INTO thesis_tags VALUES (?, ?)", ("seed-3", "buy-fundamental"))

        account_existing = await fetchall(db, "SELECT COUNT(*) as cnt FROM accounts")
        if account_existing[0]["cnt"] == 0:
            accounts = [
                ("acct-1", "Binance", "exchange", "Binance", "USD", "主交易所账户", month_ago.isoformat(), now.isoformat()),
                ("acct-2", "Interactive Brokers", "broker", "IBKR", "USD", "美股与港股账户", month_ago.isoformat(), now.isoformat()),
                ("acct-3", "Ledger Wallet", "wallet", "Ledger", "USD", "长期持有钱包", month_ago.isoformat(), now.isoformat()),
            ]
            for account in accounts:
                await db.execute(
                    "INSERT INTO accounts (id, name, type, broker_or_platform, base_currency, notes, created_at, updated_at) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    account,
                )

            assets = [
                ("asset-btc", "BTC", "Bitcoin", "crypto", "CRYPTO", "USD", "coingecko"),
                ("asset-aapl", "AAPL", "Apple", "us-stock", "NASDAQ", "USD", "twelve_data"),
                ("asset-0700", "0700", "腾讯控股", "hk-stock", "HKEX", "HKD", "twelve_data"),
                ("asset-600519", "600519", "贵州茅台", "a-stock", "SSE", "CNY", "twelve_data"),
            ]
            for asset_id, symbol, name, category, market, quote_currency, price_source in assets:
                await db.execute(
                    "INSERT INTO assets (id, symbol, name, category, market, quote_currency, price_source, metadata_json, created_at, updated_at) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, ?)",
                    (asset_id, symbol, name, category, market, quote_currency, price_source, month_ago.isoformat(), now.isoformat()),
                )

            holdings = [
                ("holding-1", "acct-1", "asset-btc", 0.42, 61200.0, "USD", "open", month_ago.isoformat(), "", "核心仓位", month_ago.isoformat(), now.isoformat()),
                ("holding-2", "acct-2", "asset-aapl", 18.0, 189.0, "USD", "open", month_ago.isoformat(), "", "长期科技持仓", month_ago.isoformat(), now.isoformat()),
                ("holding-3", "acct-2", "asset-0700", 300.0, 332.0, "HKD", "open", month_ago.isoformat(), "", "港股核心仓位", month_ago.isoformat(), now.isoformat()),
                ("holding-4", "acct-3", "asset-btc", 0.25, 54400.0, "USD", "open", week_ago.isoformat(), "", "冷钱包仓位", week_ago.isoformat(), now.isoformat()),
            ]
            for holding in holdings:
                await db.execute(
                    "INSERT INTO holdings (id, account_id, asset_id, quantity, avg_cost, cost_currency, status, opened_at, closed_at, notes, created_at, updated_at) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    holding,
                )

            adjustments = [
                ("adj-1", "holding-1", "acct-1", "asset-btc", "buy", 0.30, 58200.0, 0, "USD", month_ago.isoformat(), "初始建仓", "seed-1", month_ago.isoformat()),
                ("adj-2", "holding-1", "acct-1", "asset-btc", "buy", 0.12, 68750.0, 0, "USD", week_ago.isoformat(), "逢回调加仓", "seed-1", week_ago.isoformat()),
                ("adj-3", "holding-2", "acct-2", "asset-aapl", "buy", 12.0, 181.0, 0, "USD", month_ago.isoformat(), "分批建仓", None, month_ago.isoformat()),
                ("adj-4", "holding-2", "acct-2", "asset-aapl", "buy", 6.0, 205.0, 0, "USD", week_ago.isoformat(), "补仓", None, week_ago.isoformat()),
                ("adj-5", "holding-3", "acct-2", "asset-0700", "buy", 300.0, 332.0, 0, "HKD", month_ago.isoformat(), "港股配置", None, month_ago.isoformat()),
                ("adj-6", "holding-4", "acct-3", "asset-btc", "transfer_in", 0.25, 54400.0, 0, "USD", week_ago.isoformat(), "转入冷钱包", "seed-1", week_ago.isoformat()),
            ]
            for adjustment in adjustments:
                await db.execute(
                    "INSERT INTO adjustments (id, holding_id, account_id, asset_id, type, quantity_delta, unit_price, fee, fee_currency, executed_at, notes, related_thesis_id, created_at) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    adjustment,
                )

            portfolio_values = [
                (month_ago + timedelta(days=0), 81200.0),
                (month_ago + timedelta(days=7), 84650.0),
                (month_ago + timedelta(days=14), 87920.0),
                (month_ago + timedelta(days=21), 90410.0),
                (week_ago + timedelta(days=3), 93880.0),
                (now, 97240.0),
            ]
            for idx, (point_time, point_value) in enumerate(portfolio_values):
                await create_valuation_snapshot(
                    db,
                    scope_type="portfolio",
                    scope_id="global",
                    quantity=4,
                    market_price=point_value,
                    market_value_usd=point_value,
                    fx_rate_to_usd=1,
                    source="derived",
                    as_of=point_time.isoformat(),
                )

            holding_snapshot_values = [
                ("holding-1", 0.42, 68420.0, 28736.4),
                ("holding-2", 18.0, 226.4, 4075.2),
                ("holding-3", 300.0, 382.0, 14668.8),
                ("holding-4", 0.25, 68420.0, 17105.0),
            ]
            for holding_id, quantity, market_price, market_value in holding_snapshot_values:
                await create_valuation_snapshot(
                    db,
                    scope_type="holding",
                    scope_id=holding_id,
                    quantity=quantity,
                    market_price=market_price,
                    market_value_usd=market_value,
                    fx_rate_to_usd=1,
                    source="derived",
                    as_of=now.isoformat(),
                )

        await db.commit()
    finally:
        await db.close()
