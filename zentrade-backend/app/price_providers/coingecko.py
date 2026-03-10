from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen


COINGECKO_BASE = "https://api.coingecko.com/api/v3"
COINGECKO_SYMBOL_IDS = {
    "BTC": "bitcoin",
    "ETH": "ethereum",
    "SOL": "solana",
    "BNB": "binancecoin",
    "XRP": "ripple",
    "ADA": "cardano",
    "AVAX": "avalanche-2",
    "DOGE": "dogecoin",
    "DOT": "polkadot",
    "MATIC": "matic-network",
    "LINK": "chainlink",
    "UNI": "uniswap",
    "ARB": "arbitrum",
    "OP": "optimism",
}
FALLBACK_QUOTES = {
    "BTC": 68420.0,
    "ETH": 3480.0,
    "SOL": 168.0,
    "BNB": 612.0,
    "XRP": 0.63,
    "DOGE": 0.17,
}


def _fetch_json(url: str, headers: dict[str, str] | None = None) -> Any:
    req = Request(url, headers=headers or {})
    with urlopen(req, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


async def get_quote(symbol: str) -> dict[str, Any]:
    coin_id = COINGECKO_SYMBOL_IDS.get(symbol.upper())
    api_key = os.getenv("COINGECKO_API_KEY")
    if not coin_id:
      raise ValueError(f"Unsupported CoinGecko symbol: {symbol}")

    if api_key:
        params = urlencode({"ids": coin_id, "vs_currencies": "usd", "include_last_updated_at": "true"})
        headers = {"x-cg-demo-api-key": api_key}
        try:
            data = await asyncio.to_thread(
                _fetch_json,
                f"{COINGECKO_BASE}/simple/price?{params}",
                headers,
            )
            quote = data.get(coin_id, {})
            if quote.get("usd") is not None:
                updated_at = quote.get("last_updated_at")
                as_of = (
                    datetime.fromtimestamp(updated_at, tz=timezone.utc).isoformat()
                    if updated_at
                    else datetime.now(timezone.utc).isoformat()
                )
                return {
                    "symbol": symbol.upper(),
                    "market": "crypto",
                    "price": float(quote["usd"]),
                    "currency": "USD",
                    "as_of": as_of,
                    "source": "coingecko",
                }
        except Exception:
            pass

    return {
        "symbol": symbol.upper(),
        "market": "crypto",
        "price": FALLBACK_QUOTES.get(symbol.upper(), 1.0),
        "currency": "USD",
        "as_of": datetime.now(timezone.utc).isoformat(),
        "source": "manual",
    }


async def get_history(symbol: str, range_key: str) -> list[dict[str, Any]]:
    quote = await get_quote(symbol)
    days_map = {"1D": 1, "1W": 7, "1M": 30, "3M": 90, "1Y": 365}
    days = days_map.get(range_key, 30)
    base_price = quote["price"]
    now = datetime.now(timezone.utc)

    api_key = os.getenv("COINGECKO_API_KEY")
    coin_id = COINGECKO_SYMBOL_IDS.get(symbol.upper())
    if api_key and coin_id:
        headers = {"x-cg-demo-api-key": api_key}
        params = urlencode({"vs_currency": "usd", "days": days})
        try:
            data = await asyncio.to_thread(
                _fetch_json,
                f"{COINGECKO_BASE}/coins/{coin_id}/market_chart?{params}",
                headers,
            )
            prices = data.get("prices", [])
            if prices:
                return [
                    {
                        "timestamp": datetime.fromtimestamp(point[0] / 1000, tz=timezone.utc).isoformat(),
                        "value": float(point[1]),
                    }
                    for point in prices
                ]
        except Exception:
            pass

    pattern = [0.91, 0.95, 0.98, 1.02, 1.04, 1.01, 1.07, 1.03]
    points = max(8, min(days, 24))
    return [
        {
            "timestamp": (now - timedelta(days=points - idx - 1)).isoformat(),
            "value": round(base_price * pattern[idx % len(pattern)], 4),
        }
        for idx in range(points)
    ]
