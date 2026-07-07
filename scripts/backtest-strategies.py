"""历史回测：用已结算的 elon-tweets 市场重放全部策略规则。

数据源：
- gamma closed events（区间/clobTokenIds/中奖区间）
- CLOB prices-history（各区间 YES 小时级价格轨迹）
- xtracker posts（推文流水 → 计数轨迹 + 会话/bootstrap 输入）

策略：
- 老：tail_sweep(99¢扫尾) / settlement_no(旧12h/100 vs 新72h/60) / panic_fade / silent_period
- 新：quant VR 入场（modelProb≥10 中 VR 最高，T-72/48/24/12 各测一次）+ 中心区间命中率
"""

import asyncio
import bisect
import json
import re
import statistics
import sys
from datetime import datetime, timedelta, timezone

import httpx

sys.path.insert(0, "/Users/leiger/projects/zenTrade/zentrade-backend")
from app.quant.engine import (  # noqa: E402
    Constants,
    bj_date_key,
    bj_now,
    bootstrap_remaining_samples,
    constants_from_daily_rows,
    day_vectors_from_rows,
    evaluate_buckets,
    lambda_mu,
    MIN_CALIBRATION_DAYS,
)
from app.quant.clients import parse_bucket_label  # noqa: E402

GAMMA = "https://gamma-api.polymarket.com/events"
CLOB = "https://clob.polymarket.com/prices-history"
XTRACKER = "https://xtracker.polymarket.com/api/users/elonmusk/posts"

HISTORY_DAYS = 130          # 推文历史回溯
MAX_EVENTS = 40             # 最多回测市场数
CONCURRENCY = 8

http: httpx.AsyncClient = None  # created inside main (py3.9 loop binding)
sem: asyncio.Semaphore = None


async def fetch_closed_events():
    r = await http.get(GAMMA, params={
        "series_slug": "elon-tweets", "closed": "true",
        "limit": str(MAX_EVENTS), "order": "endDate", "ascending": "false",
    })
    r.raise_for_status()
    return r.json()


async def fetch_all_posts(days: int):
    """全量分页拉推文（近 days 天），返回按时间升序的 unix 秒级时间戳列表。"""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    out = []
    for page in range(80):
        async with sem:
            r = await http.get(XTRACKER, params={"limit": 100, "offset": page * 100})
        r.raise_for_status()
        batch = (r.json().get("data") or [])
        if not batch:
            break
        stop = False
        for p in batch:
            ts = datetime.fromisoformat(p["createdAt"].replace("Z", "+00:00"))
            if ts < since:
                stop = True
                break
            out.append(ts)
        if stop:
            break
    out.sort()
    return out


async def fetch_clob_history(token_id: str):
    async with sem:
        try:
            r = await http.get(CLOB, params={"market": token_id, "interval": "max", "fidelity": "60"})
            r.raise_for_status()
            hist = r.json().get("history", [])
            return [(h["t"], float(h["p"]) * 100) for h in hist]
        except Exception:
            return []


def price_at(series, ts, max_age_h=None):
    """阶梯取值：≤ts 的最后一个价格；max_age_h 限制成交新鲜度（防陈旧价假信号）。"""
    if not series:
        return None
    i = bisect.bisect_right([s[0] for s in series], ts) - 1
    if i < 0:
        return None
    t0, p = series[i]
    if max_age_h is not None and ts - t0 > max_age_h * 3600:
        return None
    return p


MONTHS = {m: i + 1 for i, m in enumerate(
    ["january", "february", "march", "april", "may", "june",
     "july", "august", "september", "october", "november", "december"])}


def window_from_slug(slug: str, end_iso: str):
    """slug 'elon-musk-of-tweets-june-30-july-7' → (start_dt, end_dt)，窗口 16:00 UTC 界。"""
    m = re.search(r"tweets-([a-z]+)-(\d+)-([a-z]+)-(\d+)", slug)
    end = datetime.fromisoformat(end_iso.replace("Z", "+00:00"))
    if not m:
        return None, end
    sm, sd = MONTHS.get(m.group(1)), int(m.group(2))
    if not sm:
        return None, end
    year = end.year if sm <= end.month else end.year - 1
    start = datetime(year, sm, sd, 16, 0, tzinfo=timezone.utc)
    return start, end


def build_event(e):
    start, end = window_from_slug(e.get("slug", ""), e.get("endDate"))
    st = e.get("startTime")
    if st:
        try:
            start = datetime.fromisoformat(st.replace("Z", "+00:00"))
        except ValueError:
            pass
    if start is None:
        return None
    buckets, winner = [], None
    for mkt in e.get("markets", []):
        label = mkt.get("groupItemTitle") or "?"
        lo, hi = parse_bucket_label(label)
        try:
            ids = json.loads(mkt.get("clobTokenIds") or "[]")
            token = ids[0] if ids else None
        except Exception:
            token = None
        try:
            prices = json.loads(mkt.get("outcomePrices") or "[]")
            resolved_yes = len(prices) > 0 and float(prices[0]) >= 0.99
        except Exception:
            resolved_yes = False
        b = {"label": label, "lower": lo, "upper": hi, "token": token}
        buckets.append(b)
        if resolved_yes:
            winner = label
    buckets.sort(key=lambda b: b["lower"])
    days = (end - start).total_seconds() / 86400
    return {"slug": e.get("slug"), "start": start, "end": end, "days": days,
            "buckets": buckets, "winner": winner}


def count_at(post_ts_sorted, start, t):
    lo = bisect.bisect_left(post_ts_sorted, start)
    hi = bisect.bisect_right(post_ts_sorted, t)
    return max(0, hi - lo)


def hourly_rows_from_posts(posts):
    """全量推文 → (BJ date, hour, count) 行，供 day_vectors / constants 用。"""
    agg = {}
    for ts in posts:
        bj = ts + timedelta(hours=8)
        key = (bj.strftime("%Y-%m-%d"), bj.hour)
        agg[key] = agg.get(key, 0) + 1
    return [{"date": d, "hour": h, "count": c} for (d, h), c in sorted(agg.items())]


def today_by_hour_at(posts, t):
    bj_t = t + timedelta(hours=8)
    day = bj_t.strftime("%Y-%m-%d")
    row = [0] * 24
    for ts in posts:
        bj = ts + timedelta(hours=8)
        if bj.strftime("%Y-%m-%d") == day and bj <= bj_t:
            row[bj.hour] += 1
    return row


async def main():
    global http, sem
    http = httpx.AsyncClient(timeout=30.0)
    sem = asyncio.Semaphore(CONCURRENCY)
    print("拉取已结算市场 …", flush=True)
    raw = await fetch_closed_events()
    events = [ev for ev in (build_event(e) for e in raw) if ev and ev["winner"]]
    print(f"  {len(events)} 个已结算且有中奖区间的市场", flush=True)

    print(f"拉取近 {HISTORY_DAYS} 天推文 …", flush=True)
    posts = await fetch_all_posts(HISTORY_DAYS)
    print(f"  {len(posts)} 条推文（{posts[0].date()} → {posts[-1].date()}）", flush=True)
    all_rows = hourly_rows_from_posts(posts)
    oldest_post = posts[0]

    # 只回测推文历史完整覆盖的市场
    events = [ev for ev in events if ev["start"] >= oldest_post]
    weekly = [ev for ev in events if ev["days"] >= 5]
    short = [ev for ev in events if ev["days"] < 5]
    print(f"  可回测：{len(weekly)} 个周度市场 + {len(short)} 个短周期市场", flush=True)

    print("拉取 CLOB 价格轨迹 …", flush=True)
    tokens = [(ev, b) for ev in events for b in ev["buckets"] if b["token"]]
    histories = await asyncio.gather(*(fetch_clob_history(b["token"]) for _, b in tokens))
    for (_, b), h in zip(tokens, histories):
        b["hist"] = h
    got = sum(1 for _, b in tokens if b.get("hist"))
    print(f"  {got}/{len(tokens)} 个区间有价格数据", flush=True)

    results = {
        "tail_sweep": [], "settle_old": [], "settle_new": [], "panic": [],
        "settle_dyn2": [], "settle_dyn3": [],
        "vr": {72: [], 48: [], 24: [], 12: []},
        "center": {72: [], 48: [], 24: [], 12: []},
    }
    coverage = []

    for ev in events:
        start, end, winner = ev["start"], ev["end"], ev["winner"]
        span_h = int((end - start).total_seconds() // 3600)
        n_hist = sum(1 for b in ev["buckets"] if b.get("hist"))
        coverage.append({"slug": ev["slug"], "buckets": len(ev["buckets"]), "with_hist": n_hist})
        if n_hist == 0:
            continue

        # ── 老策略：逐小时扫描（价格需 24h 内有成交，防陈旧价假信号）──
        fired = {k: set() for k in ("ts", "so", "sn", "d2", "d3")}
        for hh in range(1, span_h + 1):
            t = start + timedelta(hours=hh)
            ts = int(t.timestamp())
            cnt = count_at(posts, start, t)
            remaining_h = (end - t).total_seconds() / 3600
            elapsed_d = max(1 / 24, (t - start).total_seconds() / 86400)
            pace_t = cnt / elapsed_d
            for b in ev["buckets"]:
                p = price_at(b.get("hist", []), ts, max_age_h=24)
                if p is None:
                    continue
                hi = b["upper"] if b["upper"] is not None else 10 ** 9
                # tail_sweep：已进入未冲破 & YES≥99（要求 6h 内新鲜成交）
                p_fresh = price_at(b.get("hist", []), ts, max_age_h=6)
                if (b["label"] not in fired["ts"] and b["lower"] <= cnt <= hi
                        and p_fresh is not None and p_fresh >= 99):
                    fired["ts"].add(b["label"])
                    results["tail_sweep"].append(
                        {"win": b["label"] == winner, "price": p_fresh, "slug": ev["slug"]})
                gap = b["lower"] - cnt
                no_p = 100 - p
                if no_p >= 99.5 or gap <= 0:
                    continue
                # settlement_no 旧参数 12h/100gap
                if b["label"] not in fired["so"] and remaining_h <= 12 and gap >= 100:
                    fired["so"].add(b["label"])
                    results["settle_old"].append(
                        {"win": b["label"] != winner, "no_price": no_p, "slug": ev["slug"]})
                # settlement_no 新参数 72h/60gap
                if b["label"] not in fired["sn"] and remaining_h <= 72 and gap >= 60:
                    fired["sn"].add(b["label"])
                    results["settle_new"].append(
                        {"win": b["label"] != winner, "no_price": no_p, "slug": ev["slug"]})
                # 动态 gap：所需超过当前节奏外推的 k 倍（k=2 / 3），72h 窗口
                exp_remaining = pace_t * remaining_h / 24
                if (b["label"] not in fired["d2"] and remaining_h <= 72
                        and gap >= max(30, 2.0 * exp_remaining)):
                    fired["d2"].add(b["label"])
                    results["settle_dyn2"].append(
                        {"win": b["label"] != winner, "no_price": no_p, "slug": ev["slug"]})
                if (b["label"] not in fired["d3"] and remaining_h <= 72
                        and gap >= max(40, 3.0 * exp_remaining)):
                    fired["d3"].add(b["label"])
                    results["settle_dyn3"].append(
                        {"win": b["label"] != winner, "no_price": no_p, "slug": ev["slug"]})
                # panic_fade：最后2h gap≥50 且 YES≥5
                if remaining_h <= 2 and gap >= 50 and p >= 5:
                    results["panic"].append(
                        {"win": b["label"] != winner, "yes": p, "slug": ev["slug"]})

        # ── 新策略：VR 入场 + 中心命中（各决策时点）──
        for back_h in (72, 48, 24, 12):
            t = end - timedelta(hours=back_h)
            if t <= start + timedelta(hours=6):
                continue  # 决策点太靠近开盘无意义
            ts = int(t.timestamp())
            cnt = count_at(posts, start, t)
            if cnt == 0:
                continue
            elapsed_d = max(1 / 24, (t - start).total_seconds() / 86400)
            pace = cnt / elapsed_d
            remaining_h = back_h

            tbh = today_by_hour_at(posts, t)
            decision_bj = bj_date_key(t)
            rows_before = [r for r in all_rows if r["date"] < decision_bj]
            vecs = day_vectors_from_rows(rows_before, decision_bj)
            samples = (bootstrap_remaining_samples(
                vecs, (t + timedelta(hours=8)).hour,
                max(0, round((remaining_h - (24 - (t + timedelta(hours=8)).hour)) / 24)),
                n_samples=800, seed=hash(ev["slug"]) % 10 ** 6)
                if len(vecs) >= MIN_CALIBRATION_DAYS else None)

            lam = lambda_mu(cnt, pace, remaining_h, tbh, t)

            eng_buckets = []
            for b in ev["buckets"]:
                p = price_at(b.get("hist", []), ts, max_age_h=48)
                if p is None:
                    continue
                eng_buckets.append({
                    "label": b["label"], "lower_bound": b["lower"], "upper_bound": b["upper"],
                    "best_bid": p / 100, "best_ask": p / 100, "last_trade": p / 100,
                })
            if len(eng_buckets) < 3:
                continue
            probs = evaluate_buckets(eng_buckets, lam, current=cnt, samples=samples)

            # 中心命中率 + 市场最热区间基准
            center = next((p for p in probs if p.is_center), None)
            fav = max(eng_buckets, key=lambda b: b["last_trade"])
            if center:
                results["center"][back_h].append({
                    "hit": center.label == winner,
                    "fav_hit": fav["label"] == winner,
                    "slug": ev["slug"],
                })

            # VR 主仓：modelProb≥10 中 VR 最高
            cands = [p for p in probs if p.model_prob >= 10 and p.price_pct > 0]
            if cands:
                main = max(cands, key=lambda p: p.vr)
                ret = (100 / main.price_pct - 1) if main.label == winner else -1.0
                results["vr"][back_h].append({
                    "win": main.label == winner, "vr": main.vr,
                    "price": main.price_pct, "ret": ret, "slug": ev["slug"],
                })

    # ── silent_period：6h 沉默后是否有爆发 ──
    gaps_after, base_rate = [], None
    for i in range(1, len(posts)):
        gap_h = (posts[i] - posts[i - 1]).total_seconds() / 3600
        if gap_h >= 6:
            nxt = posts[i] + timedelta(hours=2)
            burst = sum(1 for p2 in posts[i:] if p2 <= nxt)
            gaps_after.append(burst)
    total_span_h = (posts[-1] - posts[0]).total_seconds() / 3600
    base_rate = len(posts) / total_span_h * 2  # 任意 2h 的均值

    # ── 输出 ──
    out = {"events": len(events), "weekly": len(weekly), "short": len(short)}

    def agg(trades, ret_key=None):
        if not trades:
            return {"n": 0}
        wins = sum(1 for x in trades if x.get("win") or x.get("hit"))
        d = {"n": len(trades), "wins": wins, "win_rate": round(wins / len(trades) * 100, 1)}
        if ret_key:
            rets = [x[ret_key] for x in trades if ret_key in x]
            if rets:
                d["avg_ret_pct"] = round(statistics.mean(rets) * 100, 1)
        return d

    out["tail_sweep"] = agg(results["tail_sweep"])
    if results["tail_sweep"]:
        prices = [x["price"] for x in results["tail_sweep"]]
        rets = [(100 / x["price"] - 1) if x["win"] else -1.0 for x in results["tail_sweep"]]
        out["tail_sweep"]["avg_entry"] = round(statistics.mean(prices), 2)
        out["tail_sweep"]["avg_ret_pct"] = round(statistics.mean(rets) * 100, 2)
    def agg_no(trades):
        d = agg(trades)
        if trades:
            rets = [(100 / x["no_price"] - 1) if x["win"] else -1.0 for x in trades]
            d["avg_ret_pct"] = round(statistics.mean(rets) * 100, 2)
            d["avg_no_entry"] = round(statistics.mean(x["no_price"] for x in trades), 2)
        return d

    out["settle_old"] = agg_no(results["settle_old"])
    out["settle_new"] = agg_no(results["settle_new"])
    out["settle_dyn2x"] = agg_no(results["settle_dyn2"])
    out["settle_dyn3x"] = agg_no(results["settle_dyn3"])
    out["coverage"] = {
        "events_with_prices": sum(1 for c in coverage if c["with_hist"] > 0),
        "events_total": len(coverage),
    }
    out["panic"] = {"n_signals": len(results["panic"])}

    out["vr"] = {}
    for h, trades in results["vr"].items():
        a = agg(trades, "ret")
        if trades:
            hi = [x for x in trades if x["vr"] >= 1.2]
            a["vr>=1.2"] = agg(hi, "ret")
            a["vr<1.2"] = agg([x for x in trades if x["vr"] < 1.2], "ret")
        out["vr"][f"T-{h}h"] = a
    out["center"] = {}
    for h, t in results["center"].items():
        a = agg(t)
        if t:
            a["fav_win_rate"] = round(sum(1 for x in t if x["fav_hit"]) / len(t) * 100, 1)
        out["center"][f"T-{h}h"] = a

    out["silent"] = {
        "n_gaps_6h": len(gaps_after),
        "avg_posts_next_2h": round(statistics.mean(gaps_after), 2) if gaps_after else 0,
        "baseline_2h": round(base_rate, 2),
    }

    print("\n===== RESULT_JSON =====")
    print(json.dumps(out, ensure_ascii=False, indent=1))

    # 保存明细供追查
    with open("/private/tmp/claude-501/-Users-leiger-projects-zenTrade/63ecc60a-c339-4a44-8b28-4913527f38ec/scratchpad/backtest_detail.json", "w") as f:
        json.dump({k: v for k, v in results.items() if k != "center"}, f,
                  ensure_ascii=False, default=str, indent=1)

    await http.aclose()


asyncio.run(main())
