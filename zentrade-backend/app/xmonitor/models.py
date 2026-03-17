from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


StrategyType = Literal["silent_period", "tail_sweep", "settlement_no", "panic_fade"]


# ── Strategy Instance ────────────────────────────────────

class StrategyInstanceCreate(BaseModel):
    strategy_type: StrategyType
    name: str
    enabled: bool = True
    params: dict[str, Any] = Field(default_factory=dict)


class StrategyInstanceUpdate(BaseModel):
    name: str | None = None
    enabled: bool | None = None
    params: dict[str, Any] | None = None


class StrategyInstance(BaseModel):
    id: str
    strategy_type: StrategyType
    name: str
    enabled: bool
    params: dict[str, Any]
    created_at: str
    updated_at: str


# ── Alert ─────────────────────────────────────────────────

class AlertFeedback(BaseModel):
    feedback: Literal["yes", "no"]
    feedback_note: str | None = None


class MonitorAlert(BaseModel):
    id: str
    strategy_instance_id: str
    strategy_type: StrategyType
    tracking_id: str
    bracket: str | None = None
    trigger_data: dict[str, Any]
    message: str
    polymarket_url: str = ""
    feedback: str | None = None
    feedback_note: str | None = None
    created_at: str
    feedback_at: str | None = None
    push_sent: bool = False


# ── Push Subscription ─────────────────────────────────────

class PushSubscriptionCreate(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


class PushSubscription(BaseModel):
    id: str
    endpoint: str
    p256dh: str
    auth: str
    created_at: str


# ── Monitor Status ────────────────────────────────────────

class ApiHealthStatus(BaseModel):
    xtracker: Literal["ok", "error", "unknown"] = "unknown"
    polymarket: Literal["ok", "error", "unknown"] = "unknown"
    xtracker_error: str | None = None
    polymarket_error: str | None = None
    xtracker_last_success: str | None = None
    polymarket_last_success: str | None = None


class TrackingPeriod(BaseModel):
    id: str
    title: str
    start_date: str
    end_date: str
    market_link: str | None = None
    is_active: bool
    total_posts: int = 0
    pace: int = 0
    daily_average: float = 0.0


class MonitorStatus(BaseModel):
    user_handle: str = "elonmusk"
    api_health: ApiHealthStatus
    active_trackings: list[TrackingPeriod]
    current_post_count: int = 0
    last_post_at: str | None = None
    seconds_since_last_post: float | None = None


# ── Market Brackets ───────────────────────────────────────

class MarketBracket(BaseModel):
    question: str
    bracket_range: str  # e.g. "240-259"
    lower_bound: int
    upper_bound: int | None = None  # None for "580+"
    yes_price: float
    no_price: float
    volume: float = 0.0
    polymarket_url: str = ""


class MarketEvent(BaseModel):
    title: str
    slug: str
    start_date: str | None = None
    end_date: str | None = None
    polymarket_url: str = ""
    brackets: list[MarketBracket] = []


# ── WebSocket Messages ────────────────────────────────────

class WsMessage(BaseModel):
    type: Literal[
        "status_update",
        "new_post",
        "new_alert",
        "api_health_change",
        "market_update",
    ]
    data: dict[str, Any]
