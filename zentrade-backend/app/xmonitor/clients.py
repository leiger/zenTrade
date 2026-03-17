"""HTTP clients for XTracker and Polymarket APIs."""

from __future__ import annotations

import logging
import re
import time
from typing import Any

import httpx

logger = logging.getLogger("xmonitor.clients")

XTRACKER_BASE = "https://xtracker.polymarket.com/api"
POLYMARKET_GAMMA_BASE = "https://gamma-api.polymarket.com"

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


# ── XTracker ──────────────────────────────────────────────

async def xtracker_get_user(handle: str = "elonmusk") -> dict[str, Any]:
    """Fetch user info including active tracking periods."""
    r = await _client().get(f"{XTRACKER_BASE}/users/{handle}", params={"platform": "X"})
    r.raise_for_status()
    body = r.json()
    return body.get("data", body)


async def xtracker_get_posts(handle: str = "elonmusk", start_date: str | None = None, end_date: str | None = None) -> list[dict[str, Any]]:
    """Fetch posts for a user within an optional date range."""
    params: dict[str, str] = {"platform": "X"}
    if start_date:
        params["startDate"] = start_date
    if end_date:
        params["endDate"] = end_date
    r = await _client().get(f"{XTRACKER_BASE}/users/{handle}/posts", params=params)
    r.raise_for_status()
    body = r.json()
    return body.get("data", [])


async def xtracker_get_tracking(tracking_id: str, include_stats: bool = True) -> dict[str, Any]:
    """Fetch a specific tracking period with optional statistics."""
    params = {"includeStats": "true"} if include_stats else {}
    r = await _client().get(f"{XTRACKER_BASE}/trackings/{tracking_id}", params=params)
    r.raise_for_status()
    body = r.json()
    return body.get("data", body)


async def xtracker_get_active_trackings(handle: str = "elonmusk") -> list[dict[str, Any]]:
    """Get all active tracking periods for a user."""
    user = await xtracker_get_user(handle)
    trackings = user.get("trackings", [])
    return [t for t in trackings if t.get("isActive")]


# ── Polymarket ────────────────────────────────────────────

def _extract_slug(market_link: str) -> str | None:
    """Extract slug from a Polymarket event URL."""
    if not market_link:
        return None
    m = re.search(r"polymarket\.com/event/([^/?#]+)", market_link)
    return m.group(1) if m else None


async def polymarket_get_event(slug: str) -> dict[str, Any] | None:
    """Fetch a Polymarket event by slug, including all market brackets."""
    r = await _client().get(f"{POLYMARKET_GAMMA_BASE}/events", params={"slug": slug})
    r.raise_for_status()
    events = r.json()
    if not events:
        return None
    return events[0] if isinstance(events, list) else events


def parse_brackets(event: dict[str, Any]) -> list[dict[str, Any]]:
    """Parse market brackets from a Polymarket event response."""
    markets = event.get("markets", [])
    brackets: list[dict[str, Any]] = []
    for m in markets:
        question = m.get("question", "")
        bracket_range = _extract_bracket_range(question)
        lower, upper = _parse_range_bounds(bracket_range)
        prices = m.get("outcomePrices", "[]")
        if isinstance(prices, str):
            import json
            try:
                prices = json.loads(prices)
            except Exception:
                prices = [0, 0]
        yes_price = float(prices[0]) * 100 if len(prices) > 0 else 0
        no_price = float(prices[1]) * 100 if len(prices) > 1 else 0

        slug = event.get("slug", "")
        bracket_url = f"https://polymarket.com/event/{slug}" if slug else ""

        brackets.append({
            "question": question,
            "bracket_range": bracket_range,
            "lower_bound": lower,
            "upper_bound": upper,
            "yes_price": round(yes_price, 2),
            "no_price": round(no_price, 2),
            "volume": m.get("volume", 0),
            "polymarket_url": bracket_url,
        })

    brackets.sort(key=lambda b: b["lower_bound"])
    return brackets


def _extract_bracket_range(question: str) -> str:
    """Extract range like '240-259' or '580+' from a market question."""
    m = re.search(r"(\d+)-(\d+)", question)
    if m:
        return f"{m.group(1)}-{m.group(2)}"
    m = re.search(r"(\d+)\+", question)
    if m:
        return f"{m.group(1)}+"
    return "unknown"


def _parse_range_bounds(bracket_range: str) -> tuple[int, int | None]:
    """Parse lower and upper bounds from a bracket range string."""
    if bracket_range.endswith("+"):
        return int(bracket_range[:-1]), None
    parts = bracket_range.split("-")
    if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
        return int(parts[0]), int(parts[1])
    return 0, None


async def fetch_market_for_tracking(tracking: dict[str, Any]) -> dict[str, Any] | None:
    """Fetch Polymarket event data for a given tracking period."""
    market_link = tracking.get("marketLink", "")
    slug = _extract_slug(market_link)
    if not slug:
        return None
    event = await polymarket_get_event(slug)
    if not event:
        return None
    return {
        "title": event.get("title", ""),
        "slug": slug,
        "start_date": event.get("startDate"),
        "end_date": event.get("endDate"),
        "polymarket_url": f"https://polymarket.com/event/{slug}",
        "brackets": parse_brackets(event),
    }
