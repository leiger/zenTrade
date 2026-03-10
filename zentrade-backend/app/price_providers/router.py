from __future__ import annotations

from typing import Any

from app.price_providers import coingecko, twelve_data


async def get_quote(category: str, symbol: str) -> dict[str, Any]:
    if category == "crypto":
        return await coingecko.get_quote(symbol)
    return await twelve_data.get_quote(category, symbol)


async def get_history(category: str, symbol: str, range_key: str) -> list[dict[str, Any]]:
    if category == "crypto":
        return await coingecko.get_history(symbol, range_key)
    return await twelve_data.get_history(category, symbol, range_key)
