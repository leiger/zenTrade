"""Musk Quant 预警引擎（前端 musk-quant-engine.ts 规则的服务端版）。

评估当前周期市场并产出预警候选。key 含量化桶（floor(price)、floor(µ/5)、
floor(count/20)、BJ 日期），数值明显变化后可跨过 6h 去重窗口再次触发。
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

BJ_OFFSET = timedelta(hours=8)
DEDUP_WINDOW_SECONDS = 6 * 3600

# 206 天历史常量（与前端 musk-quant-engine.ts 一致）
DAILY_BASELINE = 43.4

HOURLY_FRACTION = [
    0.0495, 0.05, 0.0512, 0.0503, 0.0415, 0.031,
    0.0263, 0.0335, 0.035, 0.0295, 0.024, 0.0256,
    0.028, 0.0699, 0.0785, 0.0616, 0.053, 0.027,
    0.0183, 0.0223, 0.0347, 0.0467, 0.0603, 0.0522,
]

# (名称, BJ 小时窗口, 出现频率, 均值, 中位, 强阈值, 弱阈值, 期望贡献)
SESSIONS = [
    ("下午会话", [0, 1, 2, 3, 4, 5], 0.97, 14.4, 10, 15, 5, 13.9),
    ("傍晚会话", [6, 7, 8, 9, 10], 0.51, 11.4, 6, 9, 3, 5.8),
    ("深夜会话", [11, 12, 13, 14, 15, 16], 0.71, 14.3, 11, 16, 5, 10.1),
    ("清晨过渡", [17, 18, 19], 0.16, 16.4, 13, 19, 6, 2.6),
    ("上午会话", [20, 21, 22, 23], 0.64, 10.9, 8, 12, 4, 7.0),
]

# 滚动重估的最小样本量（完整 BJ 天数）；不足时用上面的 206 天冻结常量
MIN_CALIBRATION_DAYS = 21


@dataclass
class Constants:
    """预测模型常量：冻结默认值或由近 N 天数据滚动重估。"""
    daily_baseline: float = DAILY_BASELINE
    hourly_fraction: list[float] = field(default_factory=lambda: list(HOURLY_FRACTION))
    sessions: list[tuple] = field(default_factory=lambda: list(SESSIONS))
    source: str = "default"     # default | live
    days_used: int = 0


def day_vectors_from_rows(rows: list[dict], today_bj_date: str) -> list[list[int]]:
    """(BJ 日期, 小时, 计数) 行 → 完整天的 24 小时向量列表（丢今天与最早一天）。"""
    by_date: dict[str, list[int]] = {}
    for r in rows:
        d, h, c = r["date"], int(r["hour"]), int(r["count"])
        if d >= today_bj_date:
            continue
        by_date.setdefault(d, [0] * 24)[h] += c
    if by_date:
        del by_date[min(by_date)]
    return [by_date[d] for d in sorted(by_date)]


def bootstrap_remaining_samples(
    day_vectors: list[list[int]],
    bj_hour_now: int,
    n_full_days: int,
    n_samples: int = 1000,
    seed: int | None = None,
) -> list[int]:
    """剩余时段发推数的经验 bootstrap 样本。

    剩余窗口 = 今日剩余（BJ 当前小时 → 24:00，从随机历史日取同时段实发）
    + n_full_days 个完整日（各自独立抽历史日总数）。
    天级重采样天然携带过度离散与会话内相关——这正是泊松假设丢掉的部分。
    """
    if not day_vectors:
        return []
    rng = random.Random(seed)
    partial_sums = [sum(v[bj_hour_now:]) for v in day_vectors]
    day_totals = [sum(v) for v in day_vectors]
    samples = []
    for _ in range(n_samples):
        s = rng.choice(partial_sums)
        for _ in range(n_full_days):
            s += rng.choice(day_totals)
        samples.append(s)
    return samples


def constants_from_daily_rows(rows: list[dict], today_bj_date: str) -> Constants:
    """由 (BJ 日期, 小时, 计数) 行滚动重估常量。

    丢弃今天（未完整）与最早一天（可能截断）；不足 MIN_CALIBRATION_DAYS 天返回默认。
    会话阈值改为经验分位数：strong = p75、weak = p25（出现日内）；
    expected_contrib = freq × avg（与原站常量的关系一致）。
    """
    by_date: dict[str, list[int]] = {}
    for r in rows:
        d, h, c = r["date"], int(r["hour"]), int(r["count"])
        if d >= today_bj_date:
            continue
        by_date.setdefault(d, [0] * 24)[h] += c

    if by_date:
        del by_date[min(by_date)]  # 最早一天可能不完整

    days = len(by_date)
    if days < MIN_CALIBRATION_DAYS:
        return Constants()

    day_vectors = list(by_date.values())
    day_totals = [sum(v) for v in day_vectors]
    total = sum(day_totals)
    if total <= 0:
        return Constants()

    daily_baseline = total / days
    hour_sums = [sum(v[h] for v in day_vectors) for h in range(24)]
    hourly_fraction = [s / total for s in hour_sums]

    def _quantile(sorted_vals: list[int], q: float) -> float:
        if not sorted_vals:
            return 0.0
        idx = q * (len(sorted_vals) - 1)
        lo_i, hi_i = int(idx), min(int(idx) + 1, len(sorted_vals) - 1)
        return sorted_vals[lo_i] + (sorted_vals[hi_i] - sorted_vals[lo_i]) * (idx - lo_i)

    sessions = []
    for name, hours, *_defaults in SESSIONS:
        actuals = [sum(v[h] for h in hours) for v in day_vectors]
        appearing = sorted(a for a in actuals if a > 0)
        freq = len(appearing) / days
        avg = sum(appearing) / len(appearing) if appearing else 0.0
        med = _quantile(appearing, 0.5)
        strong = max(1, round(_quantile(appearing, 0.75)))
        weak = max(0, round(_quantile(appearing, 0.25)))
        contrib = freq * avg
        sessions.append((name, hours, round(freq, 2), round(avg, 1), round(med, 1),
                         strong, weak, round(contrib, 1)))

    return Constants(
        daily_baseline=round(daily_baseline, 1),
        hourly_fraction=[round(f, 4) for f in hourly_fraction],
        sessions=sessions,
        source="live",
        days_used=days,
    )


@dataclass
class BucketEval:
    label: str
    lower: int
    upper: int | None
    price_pct: float          # bid/ask 中值（¢），缺失回退 last_trade
    ask_pct: float            # 买入可成交价（¢），VR 用它
    bid_pct: float            # 卖出可成交价（¢），止盈判断用它
    model_prob: float         # 泊松归一化概率 %
    vr: float                 # 模型概率 ÷ ask
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


# ── 落点 µ（与前端同源：小时加权 + 会话修正，统一 λ）────

def mu_hourly(
    current: int, pace: float, remaining_hours: float, now: datetime,
    consts: Constants | None = None,
) -> float:
    c = consts or Constants()
    bj = bj_now(now)
    h, frac = bj.hour, (60 - bj.minute) / 60
    r = c.hourly_fraction[h] * frac
    for i in range(1, int(remaining_hours)):
        r += c.hourly_fraction[(h + i) % 24]
    return round((current + pace * r) * 10) / 10


def session_mu_adjust(
    today_by_hour: list[int], pace: float, now: datetime,
    consts: Constants | None = None,
) -> int:
    """会话状态机的 µ 修正总量（前端 evaluateSessions 的移植，仅保留 muAdjust）。"""
    c = consts or Constants()
    bj_h = bj_hour(now)
    scale = pace / c.daily_baseline if pace > 0 else 1.0
    has_data = any(x > 0 for x in today_by_hour)
    total = 0

    for _name, hours, freq, avg, med, strong, weak, contrib in c.sessions:
        actual = sum(today_by_hour[h] for h in hours)
        start_hour, end_hour = hours[0], hours[-1]

        if bj_h < start_hour:
            continue  # upcoming
        if bj_h <= end_hour:
            # 进行中
            if not has_data or actual == 0:
                continue  # pending
            if actual >= strong:
                total += round(avg * 0.3)
            elif actual <= weak:
                total -= round(avg * 0.25)
            continue
        # 已结束
        if not has_data:
            continue
        if actual == 0:
            if freq >= 0.6:
                total -= round(contrib * scale)
        elif actual >= strong:
            total += round((actual - avg) * 0.5)
        elif actual <= weak:
            total -= round((med - actual) * 0.6)
        else:
            total += round((actual - avg) * 0.3)

    return total


def lambda_mu(
    current: int,
    pace: float,
    remaining_hours: float,
    today_by_hour: list[int],
    now: datetime,
    consts: Constants | None = None,
) -> float:
    """概率模型 λ：会话修正后的落点（与前端 displayLanding 同式）。"""
    muh = mu_hourly(current, pace, remaining_hours, now, consts)
    adjusted = round(muh + session_mu_adjust(today_by_hour, pace, now, consts))
    return max(float(current), float(round((muh + adjusted) / 2)))


# ── 区间估值 ──────────────────────────────────────────────

def bucket_mid_pct(b: dict) -> float:
    """bid/ask 中值定价（¢），与前端 mapBucket 一致。"""
    bid, ask, last = b.get("best_bid"), b.get("best_ask"), b.get("last_trade")
    if isinstance(bid, (int, float)) and isinstance(ask, (int, float)) and ask > 0:
        return round((bid + ask) / 2 * 1000) / 10
    if isinstance(last, (int, float)):
        return round(last * 1000) / 10
    return 0.0


def bucket_ask_pct(b: dict) -> float:
    """买入可成交价（¢）：优先 ask，缺盘口回退中值。"""
    ask = b.get("best_ask")
    if isinstance(ask, (int, float)) and ask > 0:
        return round(ask * 1000) / 10
    return bucket_mid_pct(b)


def bucket_bid_pct(b: dict) -> float:
    """卖出可成交价（¢）：优先 bid，缺盘口回退中值。"""
    bid = b.get("best_bid")
    if isinstance(bid, (int, float)) and bid > 0:
        return round(bid * 1000) / 10
    return bucket_mid_pct(b)


def evaluate_buckets(
    buckets: list[dict],
    mu: float,
    current: int = 0,
    samples: list[int] | None = None,
) -> list[BucketEval]:
    """区间概率（仅中值 ≥1¢ 区间参与归一化）+ VR（ask 口径）+ 中心判定。

    有 bootstrap 样本时用经验分布（形状取自历史，均值对齐 λ−current），
    否则回退泊松。
    """
    enriched = []
    for b in buckets:
        upper = b.get("upper_bound")
        enriched.append({
            "label": b.get("label", "?"),
            "lower": int(b.get("lower_bound", 0)),
            "upper": int(upper) if upper is not None else None,
            "price_pct": bucket_mid_pct(b),
            "ask_pct": bucket_ask_pct(b),
            "bid_pct": bucket_bid_pct(b),
        })

    eligible = [e for e in enriched if e["price_pct"] >= 1]
    raw = {}
    total = 0.0

    finals: list[float] | None = None
    if samples and len(samples) >= 100:
        target_mean = max(0.1, mu - current)
        sample_mean = sum(samples) / len(samples)
        scale = target_mean / sample_mean if sample_mean > 0 else 1.0
        finals = [current + s * scale for s in samples]

    for e in eligible:
        hi = e["upper"] if e["upper"] is not None else 9999
        if finals is not None:
            p = sum(1 for f in finals if e["lower"] - 0.5 <= f <= hi + 0.5) / len(finals)
        else:
            p = poisson_range(e["lower"], hi, mu)
        raw[id(e)] = p
        total += p

    out = []
    for e in enriched:
        model_prob = (raw.get(id(e), 0.0) / total * 100) if total > 0 else 0.0
        vr = model_prob / e["ask_pct"] if e["ask_pct"] > 0 else 0.0
        hi = e["upper"] if e["upper"] is not None else 9999
        out.append(BucketEval(
            label=e["label"],
            lower=e["lower"],
            upper=e["upper"],
            price_pct=e["price_pct"],
            ask_pct=e["ask_pct"],
            bid_pct=e["bid_pct"],
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
    today_by_hour: list[int] | None = None,
    consts: Constants | None = None,
    samples: list[int] | None = None,
) -> list[AlertCandidate]:
    alerts: list[AlertCandidate] = []
    remaining_days = remaining_hours / 24
    # λ 与前端展示落点同源（会话修正）；无小时数据时退化为线性外推
    if today_by_hour is not None:
        mu = lambda_mu(current, pace, remaining_hours, today_by_hour, now, consts)
    else:
        mu = current + (remaining_hours / 24) * pace
    probs = evaluate_buckets(buckets, mu, current=current, samples=samples)
    center = next((p for p in probs if p.is_center), None)

    def fmt(p: BucketEval) -> str:
        return f"{p.label}（VR {p.vr:.2f} / 买入 {p.ask_pct:.1f}¢ / 模型 {p.model_prob:.1f}%）"

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

    # 2. 中心区间高估（负EV）：买入按 ask 计
    center_overpriced = bool(center and center.ask_pct > 35 and center.vr < 1)
    if center and center_overpriced:
        alternatives = "、".join(
            f"{p.label}（VR {p.vr:.2f}）"
            for p in sorted((p for p in probs if p.model_prob >= 3 and p is not center),
                            key=lambda p: p.vr, reverse=True)[:3]
        )
        alerts.append(AlertCandidate(
            key=f"center_overpriced_{center.label}_{math.floor(center.ask_pct)}",
            level="danger", title="⚠️ 中心区间定价偏高，负EV",
            detail=(f"预测正确 ≠ 下注正确：{center.label} 买入价 {center.ask_pct:.1f}¢ 高于模型概率，"
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
            key=f"vr_opp_{opp[0].label}_{math.floor(opp[0].ask_pct)}",
            level="success" if main_vr >= 1.5 else "info",
            title="💡 价值比机会（入场结构建议）",
            detail=f"各区间价值比排名：{top}。只有 VR≥1.0 的区间才有正期望。{verdict}",
            event_slug=event_slug,
        ))

    # 7/8. 止盈信号（<1.5 天，卖出按 bid 计）
    if center and remaining_days < 1.5:
        if center.bid_pct >= 75:
            alerts.append(AlertCandidate(
                key=f"tp_high_{center.label}",
                level="success", title="💰 止盈信号（高位）",
                detail=(f"中心区间 {center.label} 可卖价（bid）{center.bid_pct:.1f}¢：卖出 50% 锁利，"
                        f"剩余博到期 $1；>85¢ 时可大部分止盈。"),
                event_slug=event_slug,
            ))
        elif center.bid_pct >= 65:
            alerts.append(AlertCandidate(
                key=f"tp_mid_{center.label}",
                level="info", title="💰 可轻度止盈",
                detail=f"中心区间 {center.label} 可卖价（bid）{center.bid_pct:.1f}¢：建议减仓 20–30%，锁定部分收益。",
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
