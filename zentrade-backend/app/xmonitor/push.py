"""Web Push notification service."""

from __future__ import annotations

import json
import logging
import os
from typing import Any

logger = logging.getLogger("xmonitor.push")

VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "")
VAPID_EMAIL = os.getenv("VAPID_EMAIL", "admin@zentrade.local")

TAG_MAP = {
    "silent_period": "xmonitor-silent",
    "tail_sweep": "xmonitor-tail",
    "settlement_no": "xmonitor-settle",
    "panic_fade": "xmonitor-panic",
    "api_health": "xmonitor-api",
}

TTL = 1800  # 30 minutes


async def send_push_notification(
    subscriptions: list[dict[str, Any]],
    alert_id: str,
    strategy_type: str,
    strategy_name: str,
    message: str,
    polymarket_url: str = "",
):
    """Send push notification to all subscriptions. Uses tag to collapse same-type notifications."""
    if not VAPID_PRIVATE_KEY:
        logger.warning("VAPID_PRIVATE_KEY not configured, skipping push")
        return

    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        logger.error("pywebpush not installed")
        return

    payload = json.dumps({
        "alert_id": alert_id,
        "strategy_type": strategy_type,
        "strategy_name": strategy_name,
        "message": message,
        "polymarket_url": polymarket_url,
        "tag": TAG_MAP.get(strategy_type, "xmonitor"),
    })

    vapid_claims = {"sub": f"mailto:{VAPID_EMAIL}"}

    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
                },
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims=vapid_claims,
                ttl=TTL,
            )
        except Exception as e:
            logger.warning("Push failed for endpoint %s: %s", sub["endpoint"][:50], e)


async def send_api_health_push(
    subscriptions: list[dict[str, Any]],
    api_name: str,
    status: str,
    message: str,
):
    """Send API health change notification."""
    if not VAPID_PRIVATE_KEY:
        return

    try:
        from pywebpush import webpush
    except ImportError:
        return

    payload = json.dumps({
        "alert_id": "",
        "strategy_type": "api_health",
        "strategy_name": f"API Health: {api_name}",
        "message": message,
        "tag": TAG_MAP["api_health"],
    })

    vapid_claims = {"sub": f"mailto:{VAPID_EMAIL}"}

    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
                },
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims=vapid_claims,
                ttl=TTL,
            )
        except Exception as e:
            logger.warning("Health push failed for %s: %s", sub["endpoint"][:50], e)


def get_vapid_public_key() -> str:
    return VAPID_PUBLIC_KEY
