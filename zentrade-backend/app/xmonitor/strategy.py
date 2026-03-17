"""Strategy engine: evaluates conditions and generates throttled alerts."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger("xmonitor.strategy")


@dataclass
class ThrottleKey:
    strategy_instance_id: str
    tracking_id: str
    bracket: str | None = None

    def __hash__(self):
        return hash((self.strategy_instance_id, self.tracking_id, self.bracket))

    def __eq__(self, other):
        if not isinstance(other, ThrottleKey):
            return False
        return (self.strategy_instance_id, self.tracking_id, self.bracket) == (other.strategy_instance_id, other.tracking_id, other.bracket)


@dataclass
class ThrottleState:
    last_alert_at: datetime | None = None
    alert_count: int = 0


@dataclass
class AlertCandidate:
    strategy_instance_id: str
    strategy_type: str
    tracking_id: str
    bracket: str | None
    message: str
    trigger_data: dict[str, Any]
    polymarket_url: str = ""


class StrategyEngine:
    """Evaluate strategy conditions against current monitoring data."""

    def __init__(self):
        self._throttles: dict[ThrottleKey, ThrottleState] = {}

    def reset_throttle(self, strategy_instance_id: str, tracking_id: str, bracket: str | None = None):
        key = ThrottleKey(strategy_instance_id, tracking_id, bracket)
        self._throttles.pop(key, None)

    def reset_all_for_strategy(self, strategy_instance_id: str):
        keys_to_remove = [k for k in self._throttles if k.strategy_instance_id == strategy_instance_id]
        for k in keys_to_remove:
            del self._throttles[k]

    def _should_fire(self, key: ThrottleKey, interval_minutes: float | None) -> bool:
        """Check if enough time has elapsed since last alert for this key."""
        state = self._throttles.get(key)
        if state is None:
            return True
        if state.last_alert_at is None:
            return True
        if interval_minutes is None:
            return state.alert_count == 0
        elapsed = (datetime.now(timezone.utc) - state.last_alert_at).total_seconds()
        return elapsed >= interval_minutes * 60

    def _record_fire(self, key: ThrottleKey):
        state = self._throttles.setdefault(key, ThrottleState())
        state.last_alert_at = datetime.now(timezone.utc)
        state.alert_count += 1

    def evaluate(
        self,
        strategies: list[dict[str, Any]],
        tracking_id: str,
        post_count: int,
        last_post_at: datetime | None,
        remaining_seconds: float,
        brackets: list[dict[str, Any]],
        market_url: str = "",
    ) -> list[AlertCandidate]:
        """Run all enabled strategies and return alerts that should fire."""
        now = datetime.now(timezone.utc)
        alerts: list[AlertCandidate] = []

        for strat in strategies:
            if not strat.get("enabled"):
                continue
            stype = strat["strategy_type"]
            params = strat.get("params", {})
            sid = strat["id"]

            if stype == "silent_period":
                result = self._eval_silent_period(sid, tracking_id, params, now, last_post_at, post_count, remaining_seconds, market_url)
            elif stype == "tail_sweep":
                result = self._eval_tail_sweep(sid, tracking_id, params, now, post_count, brackets, market_url)
            elif stype == "settlement_no":
                result = self._eval_settlement_no(sid, tracking_id, params, now, post_count, remaining_seconds, brackets, market_url)
            elif stype == "panic_fade":
                result = self._eval_panic_fade(sid, tracking_id, params, now, post_count, remaining_seconds, brackets, market_url)
            else:
                continue

            if result:
                alerts.extend(result)

        return alerts

    # ── Strategy 1: Silent Period ─────────────────────────

    def _eval_silent_period(
        self, sid: str, tracking_id: str, params: dict, now: datetime,
        last_post_at: datetime | None, post_count: int, remaining_seconds: float, market_url: str,
    ) -> list[AlertCandidate]:
        silence_hours = params.get("silence_hours", 6)
        interval_min = params.get("remind_interval_minutes", 60)

        if last_post_at is None:
            return []

        silence_secs = (now - last_post_at).total_seconds()
        silence_h = silence_secs / 3600

        if silence_h < silence_hours:
            self.reset_all_for_strategy(sid)
            return []

        key = ThrottleKey(sid, tracking_id)
        if not self._should_fire(key, interval_min):
            return []

        self._record_fire(key)
        remaining_h = remaining_seconds / 3600

        return [AlertCandidate(
            strategy_instance_id=sid,
            strategy_type="silent_period",
            tracking_id=tracking_id,
            bracket=None,
            message=f"{silence_h:.1f}h no posts — possible burst incoming",
            trigger_data={
                "silence_hours": round(silence_h, 1),
                "post_count": post_count,
                "remaining_hours": round(remaining_h, 1),
            },
            polymarket_url=market_url,
        )]

    # ── Strategy 2: Tail Sweep ────────────────────────────

    def _eval_tail_sweep(
        self, sid: str, tracking_id: str, params: dict, now: datetime,
        post_count: int, brackets: list[dict], market_url: str,
    ) -> list[AlertCandidate]:
        min_yes = params.get("min_yes_price", 99)
        alerts = []

        for b in brackets:
            lower = b.get("lower_bound", 0)
            upper = b.get("upper_bound")
            yes_price = b.get("yes_price", 0)

            if post_count < lower:
                continue
            if upper is not None and post_count < lower:
                continue
            if yes_price < min_yes:
                continue

            key = ThrottleKey(sid, tracking_id, b["bracket_range"])
            if not self._should_fire(key, None):
                continue

            self._record_fire(key)
            alerts.append(AlertCandidate(
                strategy_instance_id=sid,
                strategy_type="tail_sweep",
                tracking_id=tracking_id,
                bracket=b["bracket_range"],
                message=f"Bracket {b['bracket_range']} already passed, Yes @ {yes_price:.1f}%",
                trigger_data={
                    "bracket": b["bracket_range"],
                    "post_count": post_count,
                    "yes_price": yes_price,
                },
                polymarket_url=b.get("polymarket_url", market_url),
            ))

        return alerts

    # ── Strategy 3: Settlement No ─────────────────────────

    def _eval_settlement_no(
        self, sid: str, tracking_id: str, params: dict, now: datetime,
        post_count: int, remaining_seconds: float, brackets: list[dict], market_url: str,
    ) -> list[AlertCandidate]:
        remaining_hours_threshold = params.get("remaining_hours", 12)
        min_gap = params.get("min_gap", 100)
        max_no_price = params.get("max_no_price", 99.5)
        interval_min = params.get("remind_interval_minutes", 120)

        remaining_h = remaining_seconds / 3600
        if remaining_h > remaining_hours_threshold:
            return []

        alerts = []
        for b in brackets:
            lower = b.get("lower_bound", 0)
            gap = lower - post_count
            no_price = b.get("no_price", 0)

            if gap < min_gap:
                continue
            if no_price >= max_no_price:
                continue

            key = ThrottleKey(sid, tracking_id, b["bracket_range"])
            if not self._should_fire(key, interval_min):
                continue

            self._record_fire(key)
            alerts.append(AlertCandidate(
                strategy_instance_id=sid,
                strategy_type="settlement_no",
                tracking_id=tracking_id,
                bracket=b["bracket_range"],
                message=f"<{remaining_h:.0f}h left, need {gap}+ more — buy No @ {no_price:.1f}%",
                trigger_data={
                    "bracket": b["bracket_range"],
                    "post_count": post_count,
                    "gap": gap,
                    "remaining_hours": round(remaining_h, 1),
                    "no_price": no_price,
                },
                polymarket_url=b.get("polymarket_url", market_url),
            ))

        return alerts

    # ── Strategy 4: Panic Fade ────────────────────────────

    def _eval_panic_fade(
        self, sid: str, tracking_id: str, params: dict, now: datetime,
        post_count: int, remaining_seconds: float, brackets: list[dict], market_url: str,
    ) -> list[AlertCandidate]:
        remaining_hours_threshold = params.get("remaining_hours", 2)
        min_gap = params.get("min_gap", 50)
        min_yes_price = params.get("min_yes_price", 5)

        remaining_h = remaining_seconds / 3600
        if remaining_h > remaining_hours_threshold:
            return []

        matched_brackets = []
        for b in brackets:
            lower = b.get("lower_bound", 0)
            gap = lower - post_count
            yes_price = b.get("yes_price", 0)

            if gap < min_gap:
                continue
            if yes_price < min_yes_price:
                continue

            matched_brackets.append({
                "bracket": b["bracket_range"],
                "gap": gap,
                "yes_price": yes_price,
                "polymarket_url": b.get("polymarket_url", market_url),
            })

        if not matched_brackets:
            return []

        key = ThrottleKey(sid, tracking_id)
        if not self._should_fire(key, None):
            return []

        self._record_fire(key)
        bracket_summary = "; ".join(
            f"{mb['bracket']}: need {mb['gap']}, Yes @ {mb['yes_price']:.1f}%"
            for mb in matched_brackets[:5]
        )
        return [AlertCandidate(
            strategy_instance_id=sid,
            strategy_type="panic_fade",
            tracking_id=tracking_id,
            bracket=matched_brackets[0]["bracket"],
            message=f"<{remaining_h:.0f}h left, panic Yes detected — buy No | {bracket_summary}",
            trigger_data={
                "remaining_hours": round(remaining_h, 1),
                "post_count": post_count,
                "matched_brackets": matched_brackets,
            },
            polymarket_url=market_url,
        )]
