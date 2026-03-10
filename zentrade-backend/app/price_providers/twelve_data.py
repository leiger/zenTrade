from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen


TWELVE_DATA_BASE = "https://api.twelvedata.com"
FALLBACK_QUOTES = {
    "AAPL": ("USD", 226.4),
    "NVDA": ("USD", 912.0),
    "MSFT": ("USD", 428.0),
    "0700": ("HKD", 382.0),
    "9988": ("HKD", 86.0),
    "600519": ("CNY", 1688.0),
    "000858": ("CNY", 139.0),
    "TLT": ("USD", 93.4),
    "GOLD": ("USD", 2142.0),
}


def _fetch_json(url: str) -> Any:
    req = Request(url)
    with urlopen(req, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def _provider_symbol(category: str, symbol: str) -> str:
    if category == "hk-stock":
        return f"{symbol}.HK"
    if category == "a-stock":
        suffix = "SH" if symbol.startswith(("5", "6", "9")) else "SZ"
        return f"{symbol}.{suffix}"
    return symbol.upper()


async def get_quote(category: str, symbol: str) -> dict[str, Any]:
    api_key = os.getenv("TWELVE_DATA_API_KEY")
    provider_symbol = _provider_symbol(category, symbol)

    if api_key:
        params = urlencode({"symbol": provider_symbol, "apikey": api_key})
        try:
            data = await asyncio.to_thread(_fetch_json, f"{TWELVE_DATA_BASE}/price?{params}")
            if data.get("price") is not None:
                currency = data.get("currency") or FALLBACK_QUOTES.get(symbol.upper(), ("USD", 0))[0]
                return {
                    "symbol": symbol.upper(),
                    "market": category,
                    "price": float(data["price"]),
                    "currency": currency,
                    "as_of": datetime.now(timezone.utc).isoformat(),
                    "source": "twelve_data",
                }
        except Exception:
            pass

    currency, price = FALLBACK_QUOTES.get(symbol.upper(), ("USD", 1.0))
    return {
        "symbol": symbol.upper(),
        "market": category,
        "price": price,
        "currency": currency,
        "as_of": datetime.now(timezone.utc).isoformat(),
        "source": "manual",
    }


async def get_history(category: str, symbol: str, range_key: str) -> list[dict[str, Any]]:
    api_key = os.getenv("TWELVE_DATA_API_KEY")
    quote = await get_quote(category, symbol)
    provider_symbol = _provider_symbol(category, symbol)

    interval_map = {
        "1D": ("1h", 24),
        "1W": ("1day", 7),
        "1M": ("1day", 30),
        "3M": ("1week", 13),
        "1Y": ("1month", 12),
    }
    interval, output_size = interval_map.get(range_key, ("1day", 30))

    if api_key:
        params = urlencode({
            "symbol": provider_symbol,
            "interval": interval,
            "outputsize": output_size,
            "apikey": api_key,
        })
        try:
            data = await asyncio.to_thread(_fetch_json, f"{TWELVE_DATA_BASE}/time_series?{params}")
            values = data.get("values", [])
            if values:
                return [
                    {
                        "timestamp": datetime.fromisoformat(point["datetime"]).replace(tzinfo=timezone.utc).isoformat(),
                        "value": float(point["close"]),
                    }
                    for point in reversed(values)
                ]
        except Exception:
            pass

    pattern = [0.96, 0.98, 1.01, 1.04, 1.02, 1.06, 1.08, 1.05]
    points = max(8, min(output_size, 24))
    now = datetime.now(timezone.utc)
    return [
        {
            "timestamp": (now - timedelta(days=points - idx - 1)).isoformat(),
            "value": round(quote["price"] * pattern[idx % len(pattern)], 4),
        }
        for idx in range(points)
    ]
