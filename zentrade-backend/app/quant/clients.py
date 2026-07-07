"""HTTP clients for the Musk Quant module (Polymarket gamma / xtracker / CLOB)."""

from __future__ import annotations

import re
import time
from typing import Any

import httpx

GAMMA_EVENTS_URL = "https://gamma-api.polymarket.com/events"
XTRACKER_POSTS_URL = "https://xtracker.polymarket.com/api/users/elonmusk/posts"
CLOB_PRICES_URL = "https://clob.polymarket.com/prices-history"

_http: httpx.AsyncClient | None = None


def _client() -> httpx.AsyncClient:
    global _http
    if _http is None or _http.is_closed:
        _http = httpx.AsyncClient(timeout=15.0)
    return _http


async def close_client():
    global _http
    if _http and not _http.is_closed:
        await _http.aclose()
        _http = None


async def fetch_quant_events() -> list[dict[str, Any]]:
    """活跃的周度推文数市场（gamma 原始 JSON，与前端 /api/quant/markets 代理同形状）。"""
    r = await _client().get(
        GAMMA_EVENTS_URL,
        params={
            "series_slug": "elon-tweets",
            "closed": "false",
            "limit": "10",
            "order": "endDate",
            "ascending": "true",
        },
        headers={"Accept": "application/json"},
    )
    r.raise_for_status()
    data = r.json()
    return data if isinstance(data, list) else []


async def fetch_posts(limit: int = 100, offset: int = 0) -> Any:
    """xtracker 推文流水（与市场结算口径一致），原始 JSON 透传。"""
    r = await _client().get(
        XTRACKER_POSTS_URL,
        params={"limit": limit, "offset": offset},
        headers={"Accept": "application/json"},
    )
    r.raise_for_status()
    return r.json()


async def fetch_price_history(token_id: str, hours: int = 50) -> Any:
    """CLOB 单区间 YES token 小时级价格序列，原始 JSON 透传。"""
    start_ts = int(time.time() - hours * 3600)
    r = await _client().get(
        CLOB_PRICES_URL,
        params={"market": token_id, "interval": "1d", "fidelity": "60", "startTs": start_ts},
        headers={"Accept": "application/json"},
    )
    r.raise_for_status()
    return r.json()


def parse_bucket_label(label: str) -> tuple[int, int | None]:
    """区间 label（"<90" / "90-109" / "≥250" / "250+"）→ (min, max)，max=None 表示开口。

    与前端 musk-quant-api.ts 的 parseBucketLabel 保持一致。
    """
    clean = re.sub(r"[\s,]", "", label)
    m = re.match(r"^[<＜](\d+)$", clean)
    if m:
        return 0, int(m.group(1)) - 1
    m = re.match(r"^[≥>＞](\d+)\+?$", clean) or re.match(r"^(\d+)\+$", clean)
    if m:
        return int(m.group(1)), None
    m = re.match(r"^(\d+)[-–—](\d+)$", clean)
    if m:
        return int(m.group(1)), int(m.group(2))
    return 0, None


def parse_event_buckets(event: dict[str, Any]) -> list[dict[str, Any]]:
    """gamma event → 区间列表（label/bounds/bid/ask/last/volume），按下限升序。"""
    import json as _json

    buckets: list[dict[str, Any]] = []
    for m in event.get("markets", []) or []:
        label = m.get("groupItemTitle") or m.get("question") or "?"
        lower, upper = parse_bucket_label(label)
        bid = m.get("bestBid")
        ask = m.get("bestAsk")
        last = m.get("lastTradePrice")

        token_id = None
        try:
            ids = _json.loads(m.get("clobTokenIds") or "[]")
            token_id = ids[0] if ids else None
        except Exception:
            token_id = None

        buckets.append({
            "market_id": str(m.get("id", "")),
            "label": label,
            "lower_bound": lower,
            "upper_bound": upper,
            "best_bid": float(bid) if isinstance(bid, (int, float)) else None,
            "best_ask": float(ask) if isinstance(ask, (int, float)) else None,
            "last_trade": float(last) if isinstance(last, (int, float)) else None,
            "volume": float(m.get("volume1wk") or m.get("volume") or 0),
            "clob_token_id": token_id,
        })

    buckets.sort(key=lambda b: b["lower_bound"])
    return buckets
