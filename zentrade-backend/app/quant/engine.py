"""Musk Quant 预警引擎（前端 musk-quant-engine.ts 规则的服务端版）。

评估当前周期市场并产出预警候选。key 含量化桶（floor(price)、floor(µ/5)、
floor(count/20)、BJ 日期），数值明显变化后可跨过 6h 去重窗口再次触发。
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

BJ_OFFSET = timedelta(hours=8)
DEDUP_WINDOW_SECONDS = 6 * 3600


@dataclass
class BucketEval:
    label: str
    lower: int
    upper: int | None
    price_pct: float          # bid/ask 中值（¢），缺失回退 last_trade
    model_prob: float         # 泊松归一化概率 %
    vr: float
    is_center: bool


@dataclass
class AlertCandidate:
    key: str
    level: str                # info / warning / danger / success
    title: str
    detail: str
    event_slug: str = ""
    extras: dict = field(default_factory=dict)


# ── 基础数学 ──────────────────────────────────────────────

def poisson_range(lo: int, hi: int, lam: float) -> float:
    """区间累计泊松概率，迭代 PMF 防溢出；开口区间截断至 λ+400。"""
    if lam <= 0:
        return 1.0 if lo <= 0 else 0.0
    upper = min(hi, max(lo, round(lam)) + 400)
    p = math.exp(-lam)
    total = 0.0
    for i in range(1, upper + 1):
        p *= lam / i
        if i >= lo:
            total += p
    if lo == 0:
        total += math.exp(-lam)
    return total


def bj_now(now: datetime) -> datetime:
    return now.astimezone(timezone.utc) + BJ_OFFSET


def bj_hour(now: datetime) -> int:
    return bj_now(now).hour


def bj_date_key(now: datetime) -> str:
    return bj_now(now).strftime("%Y-%m-%d")


# ── 区间估值 ──────────────────────────────────────────────

def bucket_mid_pct(b: dict) -> float:
    """bid/ask 中值定价（¢），与前端 mapBucket 一致。"""
    bid, ask, last = b.get("best_bid"), b.get("best_ask"), b.get("last_trade")
    if isinstance(bid, (int, float)) and isinstance(ask, (int, float)) and ask > 0:
        return round((bid + ask) / 2 * 1000) / 10
    if isinstance(last, (int, float)):
        return round(last * 1000) / 10
    return 0.0


def evaluate_buckets(buckets: list[dict], mu: float) -> list[BucketEval]:
    """泊松概率（仅 ≥1¢ 区间参与归一化）+ VR + 中心判定。"""
    enriched = []
    for b in buckets:
        upper = b.get("upper_bound")
        enriched.append({
            "label": b.get("label", "?"),
            "lower": int(b.get("lower_bound", 0)),
            "upper": int(upper) if upper is not None else None,
            "price_pct": bucket_mid_pct(b),
        })

    eligible = [e for e in enriched if e["price_pct"] >= 1]
    raw = {}
    total = 0.0
    for e in eligible:
        hi = e["upper"] if e["upper"] is not None else 9999
        p = poisson_range(e["lower"], hi, mu)
        raw[id(e)] = p
        total += p

    out = []
    for e in enriched:
        model_prob = (raw.get(id(e), 0.0) / total * 100) if total > 0 else 0.0
        vr = model_prob / e["price_pct"] if e["price_pct"] > 0 else 0.0
        hi = e["upper"] if e["upper"] is not None else 9999
        out.append(BucketEval(
            label=e["label"],
            lower=e["lower"],
            upper=e["upper"],
            price_pct=e["price_pct"],
            model_prob=model_prob,
            vr=vr,
            is_center=e["lower"] <= mu <= hi,
        ))
    return out


# ── 操作阶段（§5.2）─────────────────────────────────────

PHASES = [
    ("phase_final", 0.0, 0.5, "最终阶段 · 临近结算",
     "µ 高度确定（±8 条）。亏损仓位现在出，不再等（死亡陷阱：「再等等看」）；盈利仓位持有到期；>85¢ 可全部止盈。"),
    ("phase_hold2", 0.5, 1.0, "止盈评估阶段",
     "µ 非常稳定。中心 >75¢ → 卖 50% 锁利剩余博到期 $1；>85¢ → 大部分止盈；亏损仓位且 VR<0.8 → 死区（BJ 17:30）出场不拖延。"),
    ("phase_hold1", 1.0, 1.5, "持仓评估阶段",
     "µ 精度较高（±12 条）。检查：持仓 VR 是否 ≥1.0、µ 是否仍在区间内；换仓在死区 BJ 17:30 执行；µ 偏移 >1.5σ（约 25-30 条）才考虑换仓。"),
    ("phase_entry2", 1.5, 2.5, "主力建仓窗口",
     "µ 精度提升（±20 条），最佳入场时机。VR<1 不要为了入场而入场；中心高估则主仓移至更高 VR 区间。"),
    ("phase_entry1", 2.5, 3.0, "建仓窗口开启（早期）",
     "µ 不确定性大（±50 条）。无正期望（VR<1）→ 观望；否则轻仓 ≤25% 试探；等 1.5-2 天 µ 稳定后再加主仓。"),
]


def phase_alert(remaining_days: float, structure_text: str) -> AlertCandidate | None:
    for key, lo, hi, title, text in PHASES:
        if lo <= remaining_days < hi:
            return AlertCandidate(key=key, level="info", title=f"⏰ {title}",
                                  detail=f"{text}{structure_text}")
    return None


# ── 主评估入口 ────────────────────────────────────────────

def build_alerts(
    buckets: list[dict],
    current: int,
    today_count: int,
    pace: float,
    remaining_hours: float,
    event_slug: str,
    now: datetime,
) -> list[AlertCandidate]:
    alerts: list[AlertCandidate] = []
    remaining_days = remaining_hours / 24
    mu = current + (remaining_hours / 24) * pace
    probs = evaluate_buckets(buckets, mu)
    center = next((p for p in probs if p.is_center), None)

    def fmt(p: BucketEval) -> str:
        return f"{p.label}（VR {p.vr:.2f} / {p.price_pct:.1f}¢ / 模型 {p.model_prob:.1f}%）"

    # 三层入场结构（用于阶段提醒与价值比机会正文）
    by_vr = sorted([p for p in probs if p.price_pct > 0 and p.model_prob > 0],
                   key=lambda p: p.vr, reverse=True)
    main = next((p for p in by_vr if p.model_prob >= 10), None)
    main_vr = main.vr if main else 0.0
    verdict = ("✅ 有入场价值，可执行建仓" if main_vr >= 1.2
               else "🟡 勉强可入，等更好时机" if main_vr >= 1.0
               else "❌ 无正期望入场点，等待价格回调")
    structure_text = f" 当前主仓候选：{fmt(main)}。{verdict}" if main else ""

    # 1. 操作阶段提醒（每阶段一次，key 固定）
    pa = phase_alert(remaining_days, structure_text)
    if pa:
        pa.event_slug = event_slug
        alerts.append(pa)

    # 2. 中心区间高估（负EV）
    center_overpriced = bool(center and center.price_pct > 35 and center.vr < 1)
    if center and center_overpriced:
        alternatives = "、".join(
            f"{p.label}（VR {p.vr:.2f}）"
            for p in sorted((p for p in probs if p.model_prob >= 3 and p is not center),
                            key=lambda p: p.vr, reverse=True)[:3]
        )
        alerts.append(AlertCandidate(
            key=f"center_overpriced_{center.label}_{math.floor(center.price_pct)}",
            level="danger", title="⚠️ 中心区间定价偏高，负EV",
            detail=(f"预测正确 ≠ 下注正确：{center.label} 现价 {center.price_pct:.1f}¢ 高于模型概率，"
                    f"买入是负EV操作。更划算的区间：{alternatives or '暂无'}。建议主仓移至价值比最高的相邻区间。"),
            event_slug=event_slug,
        ))

    # 3. 落点接近区间边界
    if center:
        center_max = center.upper if center.upper is not None else 9999
        dist_top = center_max - mu
        dist_bottom = mu - center.lower
        nearest = min(dist_top, dist_bottom)
        if 0 <= nearest <= 10:
            side = "上" if dist_top < dist_bottom else "下"
            alerts.append(AlertCandidate(
                key=f"boundary_{center.label}_{math.floor(mu / 5)}",
                level="danger", title=f"🚨 落点接近区间{side}边界",
                detail=(f"预测落点 ~{round(mu)} 条距 {center.label} {side}沿仅 {round(nearest)} 条"
                        f"（µ 误差约 ±10 条），边界两侧都有实质概率。建议在{side}方相邻区间补建保护仓。"),
                event_slug=event_slug,
            ))

    # 4/5. 今日速率异常（BJ ≥4 时才外推）
    h = bj_hour(now)
    if pace > 0 and h >= 4:
        est = today_count / max(1, h) * 24
        if est / pace < 0.45:
            alerts.append(AlertCandidate(
                key=f"pace_slow_{bj_date_key(now)}",
                level="warning", title="📉 马斯克今天发推异常少",
                detail=(f"今日外推全天约 {round(est)} 条，日均 {pace:.1f} 条/天，今天不到一半。"
                        f"µ 可能虚高约 14 条。单日沉默不要立刻换仓，等死区（BJ 17:30）后再重估。"),
                event_slug=event_slug,
            ))
        elif est / pace > 1.9:
            alerts.append(AlertCandidate(
                key=f"pace_fast_{bj_date_key(now)}",
                level="warning", title="📈 马斯克今天发推异常多",
                detail=(f"今日外推全天约 {round(est)} 条，日均 {pace:.1f} 条/天，今天近两倍。"
                        f"价格正在上涨，不追仓。BJ 14:00 是全天止盈最佳时机，+30% 可考虑减仓 30–50%。"),
                event_slug=event_slug,
            ))

    # 6. 价值比机会
    opp = sorted((p for p in probs if p.vr >= 1.2 and p.model_prob >= 3),
                 key=lambda p: p.vr, reverse=True)
    if opp and (main_vr >= 1.5 or (center_overpriced and main_vr >= 1.2)):
        top = "；".join(fmt(p) for p in opp[:4])
        alerts.append(AlertCandidate(
            key=f"vr_opp_{opp[0].label}_{math.floor(opp[0].price_pct)}",
            level="success" if main_vr >= 1.5 else "info",
            title="💡 价值比机会（入场结构建议）",
            detail=f"各区间价值比排名：{top}。只有 VR≥1.0 的区间才有正期望。{verdict}",
            event_slug=event_slug,
        ))

    # 7/8. 止盈信号（<1.5 天）
    if center and remaining_days < 1.5:
        if center.price_pct >= 75:
            alerts.append(AlertCandidate(
                key=f"tp_high_{center.label}",
                level="success", title="💰 止盈信号（高位）",
                detail=(f"中心区间 {center.label} 涨到 {center.price_pct:.1f}¢：卖出 50% 锁利，"
                        f"剩余博到期 $1；>85¢ 时可大部分止盈。"),
                event_slug=event_slug,
            ))
        elif center.price_pct >= 65:
            alerts.append(AlertCandidate(
                key=f"tp_mid_{center.label}",
                level="info", title="💰 可轻度止盈",
                detail=f"中心区间 {center.label} 涨到 {center.price_pct:.1f}¢：建议减仓 20–30%，锁定部分收益。",
                event_slug=event_slug,
            ))

    # 9. 落点跑偏（当前数超出中心上限）
    if center and remaining_days < 3:
        center_max = center.upper if center.upper is not None else 0
        if center_max and current > center_max:
            nxt = next((p for p in probs
                        if p.lower <= current <= (p.upper if p.upper is not None else 9999)), None)
            alerts.append(AlertCandidate(
                key=f"overshot_{math.floor(current / 20)}",
                level="danger", title="⚠️ 当前发推数已超出落点区间上限",
                detail=(f"当前 {current} 条，超过中心 {center.label} 上限 {center_max} 条。"
                        f"新落点可能是：{fmt(nxt) if nxt else '待模型更新'}。检查持仓，评估是否换仓。"),
                event_slug=event_slug,
            ))

    return alerts
