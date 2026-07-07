# Polymarket「马斯克每周推文数」量化分析工具 — 完整功能规格（逆向自 bundle.pretty.js）

> 逆向来源：`bundle.pretty.js`（14489 行）。行号均指该文件。
> 应用代码从 L10046 开始（之前为 React runtime、lucide 图标、@vercel/analytics）。
> 根组件：`Lt`（主 App，L12626）+ Vercel Analytics（L9442-9540，root render 在 L14487-14489）。
> 语言：全中文 UI；主题为深色（bg-[#0d0f1e]）。

---

## 0. 全局约定

- **时区**：一切以北京时间（BJ, UTC+8）为准。`Ct()`（L12362）：`new Date(Date.now() + 8*3600e3).getUTCHours()` 取 BJ 小时。
- **ET 标注**（热力图列头，L10055-10058）：`ET小时 = BJ小时 - 13`（<0 加 24，≥24 减 24），显示为 `{h}:00 ET`。
- **市场周期**：每期 7 天，北京时间 24:00 结算（指南文案 L10773）。
- **价格单位**：区间 YES 价格以 `%`/`¢` 表示（0–100），来自 `outcomePrices[0]*100`，保留 1 位小数（`Math.round(p*1000)/10`，L12491）。
- **历史基线**：206 天历史数据，日均 **43.4 条**（常量 43.4 出现在 L12879、L13828、L13994）。
- **推广参数**：`vt = "?via=serene77mc-g6kj"`（L12331），拼在所有 polymarket 市场链接后；头部「主页」链接为 `https://polymarket.com/?r=adul`（L13178）。

### localStorage 键
| 键 | 内容 | 行号 |
|---|---|---|
| `musk_tweet_heatmap_data` | `{data:[{date,hour,count}], lastUpdated, cachedAt}`，TTL 20min（`Xe=1200e3`） | L10059-10088 |
| `musk_price_history_v1` (`yt`) | 价格快照数组，最多 `bt=144` 条，保留 720 分钟（12h），同一市场 240s 内去重 | L12332-12333, L12988-13010 |
| `musk_positions_v1` (`xt`) | 持仓数组 | L12334, L12627-12654 |
| `alert_config_v2` (`ot`) | 预警配置 | L11653 |
| `alert_sent_v1` (`st`) | 已发送预警记录（去重用） | L11654 |

---

## 1. 数据源与拉取

### 1.1 API 端点总表

| 端点 | 用途 | 返回 | 行号 |
|---|---|---|---|
| `GET /api/discover-markets`（Vercel 代理，非 localhost 优先，15s 超时） | 市场发现 | `{markets:[{slug,title,volume,liquidity,startDate/start_date,endDate/end_date,ranges,top_ranges,scraped_at}]}` | L12520-12551 |
| `GET https://gamma-api.polymarket.com/events?slug={slug}`（直连回退，每个 8s 超时，`Promise.allSettled` 并发探测） | 市场发现 | Gamma event 数组 | L12465, L12552-12562 |
| `GET https://api.github.com/gists/d174b4498c408076ff218e164f24807e?t={now}` 文件 `polymarket-data.json` | 市场数据的最终回退 | 市场数组（过滤 end_date 已过期的） | L12665-12688 |
| 同上 gist，文件 `polymarket-history.json` | 价格历史回填 | `{snapshots:[{ts, markets:[{slug, ranges:[{r,p,l}]}]}]}` → 转 `{timestamp, marketSlug, tweetCount:0, ranges:[{range,price,modelProb,liquidity}]}` | L12689-12718 |
| `GET https://clob.polymarket.com/prices-history?market={clobTokenId}&interval=max&fidelity=1`（15s 超时） | 每个区间的价格历史，重采样为 30 分钟桶（`s=1800e3`，阶梯取值：取 ≤桶时刻的最后一个价格） | `{history:[{t,p}]}` | L12564-12624 |
| `GET /api/xtracker`（非 localhost，15s 超时） | 追踪统计（每期市场的推文统计） | `{success, trackings:[...]}`（见 1.4） | L12731-12746 |
| `GET /api/gist-data`（10s 超时，只为触发服务器刷新 gist，忽略结果） | gist 预热 | — | L12747-12751 |
| `GET https://gist.githubusercontent.com/Adul9981/d174b4498c408076ff218e164f24807e/raw/xtracker-data.json?t={now}` | 追踪统计回退 | `{success, data:[...]}`；slug 缺失时从 `marketLink` 尾段解析 | L12752-12762 |
| `GET /api/elon-tweets`（热力图主源，15s 超时） | 每小时推文计数 | `{tweets:[{date:"YYYY-MM-DD",hour,count}], lastUpdated}`；count 上限截为 25 | L10146-10158, L12777-12794 |
| `GET https://xtracker.polymarket.com/api/users/elonmusk/posts?limit=100&offset={n}`（分页回退） | 原始推文 → 客户端聚合成热力图 | `{data|posts:[{createdAt, content, platformId, id}]}` | L10090-10121 |
| `GET https://xtracker.polymarket.com/api/users/elonmusk/posts?limit=20` | 最新推文列表（取前 10 条） | 同上 | L10638-10654 |
| `POST {ntfyServer}/{ntfyTopic}` | ntfy 推送 | headers: `Title`, `Priority: default`, `Tags: bell`；body 纯文本 | L11815-11848 |
| `POST https://api.telegram.org/bot{token}/sendMessage`（仅 localhost 直连）/ `POST {workerUrl}` / `POST /api/telegram-proxy` | Telegram 推送 | body `{botToken,chatId,message}`（代理）或 TG 原生 `{chat_id,text,parse_mode:"HTML",disable_web_page_preview:true}` | L11849-11897 |
| 外链 `https://xtracker.polymarket.com/user/elonmusk`（`He`） | 「查看全部」推文 | — | L10046 |

### 1.2 市场发现（slug 枚举法，`jt` L12468-12479）
当前日期前后各偏移 `-14..+10` 天作为周期起始日 `i`，结束日 `a = i + 7天`，生成 slug：

```
elon-musk-of-tweets-{月名(英文小写)[i.getUTCMonth()]}-{i.getUTCDate()}-{月名[a.getUTCMonth()]}-{a.getUTCDate()}
```
例：`elon-musk-of-tweets-july-1-july-8`。去重后并发探测 gamma `events?slug=`。

**事件解析 `Mt`（L12481-12519）**：过滤 `closed/archived/endDate<=now`；每个子 market 从 `question` 正则 `(\d+-\d+|\d+\+)` 提取区间名；价格 = `JSON.parse(outcomePrices)[0]*1000/10`（即 % 保留 1 位）；`clobTokenIds[0]` 为 tokenId；ranges 按区间下限升序；`top_ranges` = 按价格降序前 3。

**回退链**：`/api/discover-markets` → 直连 gamma slug 探测 → GitHub gist `polymarket-data.json`。加载成功后对每个市场调 CLOB 历史回填（`It`）。

### 1.3 轮询节奏（L12799-12807）
- 市场数据 `ee()`：**每 300s**
- Gist 价格历史 `ne()`：**每 600s**
- 热力图预取 `ie()`：**每 1200s**（且 localStorage 缓存 20 分钟内直接用）
- 头部时钟：每 1s
- 预警检查：**每 240s**（L11957）
- 价格快照写入：模型概率变化时写 localStorage，同市场 **240s 去重**，保留 12h、最多 144 条（L12988-13010）

### 1.4 追踪对象（xtracker tracking）字段（从用法反推）
```ts
interface Tracking {
  slug: string;
  startDate: string; endDate: string;         // ISO
  stats: {
    total: number;          // 本期累计推文数
    todayTotal: number;     // 今日（BJ）已发
    pace: number;           // 本期日均（条/天）
    daysRemaining: number;  // 剩余整天
    hoursRemaining: number; // 剩余小时（不含整天）
    daily: { date: string; count: number }[]; // 本期每日计数
  }
}
```
当前市场与 tracking 匹配：先按 slug，再按 `end_date` 的日期部分（L12830-12839）。

---

## 2. 落点预测模型（µ）

设：`m` = 当前累计推文数（`stats.total`）；`pace` = 日均条/天（`stats.pace`）；`k` = 剩余小时 = `daysRemaining*24 + hoursRemaining`。

### 2.1 线性外推 µ_linear（`M`，L12843-12852）
```
expectedRemaining (ge) = k / 24 * pace
M = m + ge
```

### 2.2 小时加权 µ_hourly（`_e`，L12853-12862）
使用 **BJ 每小时占全天比例表 `St`**（L12335-12360，逐字）：
```js
St = { 0:0.0495, 1:0.05,   2:0.0512, 3:0.0503, 4:0.0415, 5:0.031,
       6:0.0263, 7:0.0335, 8:0.035,  9:0.0295, 10:0.024, 11:0.0256,
       12:0.028, 13:0.0699, 14:0.0785, 15:0.0616, 16:0.053, 17:0.027,
       18:0.0183, 19:0.0223, 20:0.0347, 21:0.0467, 22:0.0603, 23:0.0522 }
```
（∑=1；对应 206 天历史，均值 43.4 条/天；小时均值 = `St[h]*43.4`，见 2.5。）

```
h  = 当前BJ小时;  frac = (60 - 当前分钟)/60
r  = St[h] * frac + Σ_{i=1..floor(k)-1} St[(h+i) % 24]
µ_hourly = round((m + pace * r) * 10) / 10
```

### 2.3 会话修正后的展示落点（`Ee`/`De`，L12951-12952）
```
Ee = round(µ_hourly + totalMuAdjust)      // totalMuAdjust 见 §7.2
De = max(m, round((µ_hourly + Ee) / 2))   // UI「落点预测」大数字（今日节奏卡、盘口价值比标题 µ=De）
Ne = round(M)                             // 市场概览「预测落点 ~Ne」、推文生成用
```
注意：**区间概率计算只用 µ_linear（M）**，会话修正只影响展示值 De/Ee。

### 2.4 区间概率（泊松模型，L12953-12986）
- 泊松 PMF 迭代实现 `Oe(x, λ)`：`e^{-λ} * Π λ/i`；区间概率 `je(min,max,λ)=Σ_{i=min..max} PMF(i)`，λ = M。
- 区间解析 `Tt`（L12427-12436）：`"a-b"` → `{min:a,max:b}`；`"a+"` → `{min:a, max:9999}`。
- 仅取 `price >= 1`（≥1¢）的区间；对所有入选区间的原始概率求和后**归一化**：`realProb = rawProb/total*100`。
- 中心区间 `isCenter`：`min <= M <= max`。
- 输出按区间下限升序。

### 2.5 正态分布对比（L13011-13036，「分布模型对比」卡片）
- `σ (Pe) = max(8, sqrt(max(0, ge)) * 2.2)`，UI 文案「泊松 vs 正态 (σ=…, Elon×2.2) · μ=M」。
- 正态 CDF 用 Abramowitz-Stegun erf 近似（系数 0.3275911, 0.254829592, −0.284496736, 1.421413741, −1.453152027, 1.061405429，L13014-13018）。
- `normalProb = (Φ((max−M)/σ) − Φ((min−M)/σ))` 归一化 ×100。
- 每区间显示：`市场 x%`、`泊松 p%`、`正态 q%`、`Δ = 正态−泊松`（Δ>1 绿、Δ<−1 红）；脚注：「正态分布偏宽（Δ正）→ 尾部风险更大；偏窄（Δ负）→ 中心更集中」。

### 2.6 预测精准度曲线（置信度%，L13260-13261）
`e` = 剩余小时：
```
e >= 72          → 45
48 <= e < 72     → round(45 + (72-e)/24 * 13)    // 45→58
24 <= e < 48     → round(58 + (48-e)/24 * 14)    // 58→72
12 <= e < 24     → round(72 + (24-e)/12 * 10)    // 72→82
6  <= e < 12     → round(82 + (12-e)/6 * 6)      // 82→88
e < 6            → 88
```

### 2.7 区间分析派生量（`Ge`/`Ke`，L13070-13094）
每区间：
```
marketPrice = price(%);  trueProb = clamp(realProb, 0, 100)
alpha = trueProb / price          // 即 VR
edge  = trueProb - price
minVelocity = max(0, (min - m) / k)   // 条/小时（进入区间所需最低时速）
maxVelocity = max(0, (max - m) / k)
status: m > max → "busted"; m >= min → "passed"; else "active"
tweetsNeededMin/Max = max(0, min−m) / max(0, max−m)
```

### 2.8 时速倒推难度（`qe`，L13095-13116）
当前时速 `v = pace/24`；仅 `active` 区间：
```
dist = |（min+max)/2 − M|
difficulty = v >= minVelocity ? (dist < 20 ? "easy" : dist < 50 ? "medium" : "hard") : "impossible"
```
标签：easy=轻松(绿)、medium=中等(琥珀)、hard=困难/较难(青)、impossible=需加速(玫红)。

---

## 3. 价值比 VR / EV

- **公式**：`VR = 模型概率(realProb%) ÷ 盘口价(¢)`（多处：L11681-11684, L13285, L14108）。
- **分析页脚注**（L14135）：「VR = 模型概率 ÷ 盘口价，≥1.2 有价值」。表格着色：VR≥1.2 绿加粗并加 `✓`；≥1.0 青；<1 灰。
- **预警文案分级 `b(vr)`**（L11699）：
  - `≥2.5` ⭐高赔率低估
  - `≥1.5` ✅明显低估
  - `≥1.2` ✅低估
  - `≥1.0` 🟡合理
  - `≥0.8` 🟠略高估
  - `<0.8` ❌高估
- **市场概览「区间定价」**（L13284-13292, L13505-13556）：显示前 6 个区间（按下限升序），列 = 价格¢ / VR / 盈亏比(=100/price, x)；星标 `vr>=2 → ⭐⭐`，`vr>=1.5 → ⭐`；行高亮：中心=绿框，`vr>=1.5 && price<=20`=琥珀框；VR 颜色 ≥1.5 绿 / ≥1 灰 / <1 红。
- **EV 指数**：指南中提到（L10911, L10919）超额收益筛选阈值 **EV 指数 > 1.25**（<1.25 跳过）——语义上即 VR。
- **盘口价值比 vs 模型 VR**：同一公式；「盘口价值比」表（分析页）用 `trueProb/marketPrice`（含 busted/passed 区间，最多 12 行），市场概览 VR 用 `realProb/price`（只含 price>0）。

---

## 4. 三层入场结构

### 4.1 预警消息版（`S()`，L11701-11708）
- 🟦 **主仓 50–70%** → `realProb >= 10%` 的区间中 VR 最高者（`c.filter(realProb>=10)[0]`，c 按 VR 降序）。
- 🟨 **保护仓 20–30%** → 中心区间**下方相邻**区间（按下限排序取 center 前一个），文案 `(+0.3档偏高对冲)`；若中心已是最低档 → 「无下方区间」。
- ⭐ **高赔率仓 ≤5%** → `price <= 5¢ && VR >= 2` 且不与主仓/保护仓重复的第一个。
- 总体结论：主仓 VR `>=1.2` →「✅ 有入场价值，可执行建仓」；`>=1.0` →「🟡 勉强可入，等更好时机」；否则「❌ 无正期望入场点，等待价格回调」。

### 4.2 市场概览·阶段建仓卡（L13558-13711）
以 `e` = 剩余小时分段（`e>72` 或 `e<6` 不显示该卡）：
- `48 < e <= 72`：🟡 **轻仓布局（第3天）** — 🎯中心落点仓 **$80–130**，🛡️保护仓↑/↓ 各 **$30–50**。
- `36 < e <= 48`：🟢 **主力建仓窗口（第1–2天）** — 中心 **$170–210**，保护仓各 **$50–70**。
- `e <= 36`：🔴 **最后1.5天 · 博弈高倍价差** — 不再显示三层结构，改为：
  - **NO 埋伏机会 · 目标10¢→100¢**：`noPrice = 100 − yes价 ∈ (0, 15]` 且 `距上沿 = max − m ∈ [20, 80]`；显示 NO 价与最高倍数 `round(100/noPrice)x`。
  - **YES 联动机会 · 目标20¢→80¢**：`yes价 ∈ (0, 15]` 且 `max − m ∈ [0, 15]`；显示 YES 价与 `round(100/price)x`。
- 中心落点仓选择：包含 M 的区间；若无则取中点距 M 最近的区间（L13579）。保护仓↑=其上方相邻（min>中心max 的第一个）、保护仓↓=下方相邻（max<中心min 的第一个）。

### 4.3 彩票仓（任意时间，L13293-13307 + L13778-13825）
筛选：`yes价 ∈ (0, 2¢]`、`区间下限 > m`（未进入）、`shootDist = 下限 − M ∈ [0, 60]`（µ 射程内）。
展示：「还需 +N条」（下限−m）、价格、`最高 round(100/price)x`、标签「彩票仓 ≤$50」。
警示文案：「⚠️ 高风险 · 极低成本 · 仅在确信今日节奏活跃时布局 · 最坏归零不影响主仓」。

### 4.4 指南版资金计划（$5000 基准，L10771-10897）
| 时机 | 买什么 | 金额 | 目的 |
|---|---|---|---|
| 倒数第三天上午（距到期2.5–3天） | 中心区间 60% + 上翼 28% + 下翼 12% | $1250 | 分散建仓，不押单一区间 |
| 倒数第二天（1.5–2.5天） | 集中加仓中心区间（主力仓） | $2000 | 落点更确定，重仓押注 |
| 最后一天上午（1–1.5天） | 卖翼仓 40% 同时寻找最佳盈亏比区间少量押注 | $200–300 | 用中心稳定收益的一部分博超额 |
| 任意时间（机会单） | 中心附近区间价格跌到 8% 以下时少量买入 | $50–100 | 低价保险，扩大安全边界 |
| 预留不动 | — | $750 | 异常情况下的机动资金 |

---

## 5. 阶段系统

### 5.1 头部徽章 `Et(daysRemaining)`（L12438-12456）
- `>=5` → **前期布局**（teal）
- `>=3` → **中期调整**（teal）
- `>=1` → **后期收缩**（amber）
- `<1` → **最后24H**（rose）

### 5.2 预警阶段（`remainingDays` = 剩余天数含小数，L11709-11739；同一阶段只发一次，key 固定）
| key | 区间(天) | 标题 | 消息要点 |
|---|---|---|---|
| `phase_entry1` | [2.5, 3) | ⏰ 建仓窗口开启（早期） | µ不确定性大（±50条）；无正期望（VR<1）→观望；否则轻仓≤25%试探；若中心高估则「主仓看两侧区间，不买中心」；列最高VR区间；「等 1.5-2天 µ稳定后再加主仓」 |
| `phase_entry2` | [1.5, 2.5) | ⏰ 主力建仓窗口 | µ精度提升（±20条），最佳入场时机；VR<1 →「不要为了入场而入场」；中心高估→主仓移至更高VR区间；附完整三层结构 `S()` |
| `phase_hold1` | [1, 1.5) | ⏰ 持仓评估阶段 | µ精度较高（±12条）；检查：持仓VR是否≥1.0、µ是否仍在区间内；换仓在死区 BJ 17:30 执行；µ偏移 >1.5σ（约25-30条）才考虑换仓 |
| `phase_hold2` | [0.5, 1) | ⏰ 止盈评估阶段 | µ非常稳定；>75¢→卖50%锁利剩余博到期$1；>85¢→大部分止盈；亏损仓位且VR<0.8→死区出场不拖延 |
| `phase_final` | [0, 0.5) | ⏰ 最终阶段 · 临近结算 | µ高度确定（±8条）；亏损仓位现在出（死亡陷阱：「再等等看」）；盈利仓位持有到期或已止盈50%→不动；>85¢可全部止盈 |

（µ 误差随阶段：±50 → ±20 → ±12 → ±8 条。）

### 5.3 翼仓减仓计划（指南 L10957-10993；一张纸总结 L11126-11177）
| 时点 | 动作 |
|---|---|
| 倒数第三天上午（距到期2.5–3天） | 第一次建仓 |
| 倒数第二天（1.5–2.5天） | 主力加仓中心 |
| 最后一天上午（1–1.5天） | 上/下翼**各卖出 40%**，同时评估超额收益机会 |
| 最后一天晚上（0.5–1天） | **再卖剩余 50%**（此时翼仓只剩最初 30% 仓位） |
| 到期前 12 小时 | **翼仓全部清仓**，专注等待中心结算 |

---

## 6. 止盈 / 止损 / 风险规则

### 6.1 中心仓止盈（指南 L10995-11026）
- 涨到 **65–74%** → 卖 20%，锁定部分收益（剩 80%）。
- 涨到 **75%+** → 再卖 30%（共减仓 50%）。

### 6.2 止盈预警（L11793-11803，仅 `remainingDays < 1.5`）
- 中心 `price >= 75¢` → 「💰 止盈信号（高位）」（high）：卖 50% 锁利，剩余博到期 $1；>85¢ 可大部分止盈（引 RULES §5.3）。
- 中心 `price >= 65¢` → 「💰 可轻度止盈」（default）：减仓 20–30%。

### 6.3 持仓页信号（L11285, 图例 L11594-11611）
- **止盈↑ (takeprofit)**：当前价 `>= 70%` →「建议锁定部分利润」。
- **减仓↓ (stoploss)**：当前价 `<= 均价 × 0.4`（跌幅 ≥60%）→「考虑止损」。
- **出场 (modelexit)**：模型概率 `< 3%` →「区间已无胜算」。

### 6.4 中心区间高估（负EV）警告（L11689, L11740-11749）
触发：中心区间 `price > 35¢ && VR < 1`。urgent 级：「预测正确≠下注正确…买入是负EV操作」，列出 `realProb>=3` 的前 3 个替代区间，建议主仓移至 VR 最高的相邻区间。

### 6.5 异常处置（指南 L11050-11079）
- 速率偏高预警 → 延迟卖上翼；持续 2h+ 考虑少量补买上翼。
- 速率偏低预警 → 延迟卖下翼；持续 2h+ 补买下翼低价保险。
- µ 一天内移动超过一个区间（20条）→ 不加仓，等落点稳定 2h+ 再确认。
- 中心价格跌到入场价 40% 以下且模型概率也很低 → 止损，资金转移到当前中心区间，不要死守。

### 6.6 死亡陷阱
`phase_final` 消息（L11733）：亏损仓位「现在出，不再等（死亡陷阱：『再等等看』）」。

---

## 7. 会话节奏模型

### 7.1 会话定义 `wt`（L12365-12425，逐字）
```js
[
 { name:"下午会话", emoji:"☀️", bjHours:[0,1,2,3,4,5],    cdt:"CDT 11am–5pm", freq:0.97, avgTweets:14.4, medTweets:10, strongThreshold:15, weakThreshold:5, expectedContrib:13.9, muDropIfAbsent:14 },
 { name:"傍晚会话", emoji:"🌆", bjHours:[6,7,8,9,10],     cdt:"CDT 5–10pm",  freq:0.51, avgTweets:11.4, medTweets:6,  strongThreshold:9,  weakThreshold:3, expectedContrib:5.8,  muDropIfAbsent:11 },
 { name:"深夜会话", emoji:"🌙", bjHours:[11,12,13,14,15,16], cdt:"CDT 10pm–3am", freq:0.71, avgTweets:14.3, medTweets:11, strongThreshold:16, weakThreshold:5, expectedContrib:10.1, muDropIfAbsent:14 },
 { name:"清晨过渡", emoji:"🌅", bjHours:[17,18,19],       cdt:"CDT 4–7am",   freq:0.16, avgTweets:16.4, medTweets:13, strongThreshold:19, weakThreshold:6, expectedContrib:2.6,  muDropIfAbsent:16 },
 { name:"上午会话", emoji:"🏙️", bjHours:[20,21,22,23],    cdt:"CDT 7–11am",  freq:0.64, avgTweets:10.9, medTweets:8,  strongThreshold:12, weakThreshold:4, expectedContrib:7,    muDropIfAbsent:11 }
]
```

### 7.2 会话状态机与 µ 修正（`xe`，L12870-12950）
对每个会话（`s`=该会话今日实发，`c = pace>0 ? pace/43.4 : 1` 为节奏缩放，`l = round(expectedContrib*c)` 为期望贡献）：

- 当前 BJ 小时 < 会话起点 → `upcoming`「待开始（BJ a:00后）」；**买入信号**：深夜会话且 BJ∈[11,12] → buy；上午会话且 BJ∈[20,21] → buy。
- 会话进行中：
  - 无今日数据或 s=0 → `pending`「窗口已开 · 等待首推」
  - `s >= strongThreshold` → `strong`「强势进行中」，`muAdjust = +round(avg*0.3)`，信号 hold
  - `s <= weakThreshold` → `weak`，异常=true（`当前s条，预期l条，偏低 round((1−s/max(l,1))*100)%`），`muAdjust = −round(avg*0.25)`
  - 其它 → `ongoing`，深夜会话时信号 hold
- 会话已结束（有今日数据）：
  - s=0 → `absent`「缺席（0条）」；`freq >= 0.6` 时异常（`历史{freq*100}%的天会出现，今日缺席`）且 `muAdjust = −round(expectedContrib*c)`；深夜缺席 → 信号 wait
  - `s >= strong` → `strong`「✓ 强势」，`muAdjust = +round((s − avg) * 0.5)`
  - `s <= weak` → `weak`「✓ 偏弱」，异常（`实际s条，历史中位med条，偏低明显`），`muAdjust = −round((med − s) * 0.6)`
  - 其它 → `confirmed`「✓ 正常」，`muAdjust = +round((s − avg) * 0.3)`
- `totalMuAdjust = Σ muAdjust`（用于 §2.3 的 Ee）。

### 7.3 建仓时机徽章（L12897-2942，按优先级）
1. BJ 12:00–12:35 → `BEST`「⭐⭐ 最佳建仓时机」：深夜会话窗口将在25min内开启，历史+150%跳跃即将发生
2. 深夜会话 ongoing/strong → `ACTIVE`「🌙 深夜会话进行中」：全天最强会话（均值14条），µ正在上移，评估止盈时机
3. BJ 21:00–21:35 → `GOOD`「⭐ 上午会话前建仓」：上午会话（64%频率）即将在 BJ 22:00 开启
4. 上午会话 ongoing/strong → `ACTIVE`「🏙️ 上午会话进行中」：CDT 9-11am 活跃期，第二强信号
5. BJ 17–19 → `DEAD`「💤 睡眠沉默期」：µ冻结，适合冷静评估/剪仓
6. BJ 8–11 → `LOW`「🔵 深夜前过渡期」：CDT 7-10pm 低谷，等 BJ 12:00
7. 傍晚会话 ongoing/strong → `WATCH`「🌆 傍晚会话进行中」：51% 频率，**若出现则 65% 概率今晚有深夜会话**
8. 其它 → `NEUTRAL`「🟡 过渡时段」

### 7.4 市场概览当前窗口分类（L13262-13283）
- BJ 12–16 → 🔥 深夜爆发期（橙）
- BJ 16–20 → 💤 入睡低谷（灰）
- BJ 20–24 或 0–4 → ⚡ 美国活跃期（绿）
- 其它（4–12）→ 📉 傍晚低谷（青）

阶段卡时段提示（L13563-13578）：BJ 11–17「现在是马斯克最活跃的时段，价格变动快」🔥；17–20「通常已入睡，适合冷静评估」😴；≥20「美国上午开始，可能重新活跃」⚡；<6「美国下午，发推稳定」📈；其它「发推偏少时段，等待即可」💤。

### 7.5 今日节奏 6 时段块（L13830-13860）
`00–04 medium 美国下午📢 / 04–08 low 美国傍晚🔵 / 08–12 low 美国晚上🔵 / 12–16 peak 深夜⭐🔥 / 16–20 sleep 入睡💤 / 20–24 medium 美国上午📢`。已过时段显示实发条数；当前时段「进行中」；未来 peak「预计爆发」、sleep「入睡」、其它「预计中等」。

### 7.6 落点影响提示（L13861-13893）
- 会话 `absent && freq>=0.6` → ⚠️ `{会话}今日缺席，落点预计下移约 round(expectedContrib*c) 条`
- `weak && isAnomaly` → 🔻 `{会话}偏弱（今日s条），落点可能小幅偏低`
- `strong && muAdjust>2` → 📈 `{会话}强势（今日s条），落点预计上移约 muAdjust 条`
- 深夜 upcoming → ⏳ `深夜爆发时段（BJ 13–16）约 max(0, 13−BJ时) 小时后开始，是落点最大变量（历史均值 +14 条）`
- 深夜 ongoing/strong/pending → 🌙 `深夜时段进行中（全天最高），µ正在上移，注意评估止盈`
- 都没有 → ✅ `今日节奏正常，落点预测约 {De} 条`

---

## 8. 热力图标签页（`tt`，L10123-10636）

### 8.1 主热力图
- 数据：`/api/elon-tweets` → 失败回退客户端分页抓 xtracker（近 720h=30 天，offset 上限 2000，BJ 时区聚合，L10090-10121）→ 再失败提示「获取数据失败，请重试或手动导入」。
- 缓存：localStorage 20 分钟；显示「缓存」角标 + 更新时间（BJ）。
- 网格：最近 **20 个日期**（升序，`slice(-20)`）× 24 小时（BJ），格子 34×34px；颜色 `Ge(count)`（L10049）：`0→#0d2035, ≤2→#1a3a6e, ≤5→#1d4ed8, ≤8→#2563eb, ≤12→#3b82f6, ≤16→#60a5fa, else #93c5fd`；格内显示数字（≤5 用浅蓝字）。
- **异常**：`count > 25`（`Ue=25`）标红点「!」，tooltip「数据异常」；导入/API 数据一律 `min(count,25)` 截断。
- 列头显示 BJ 小时 + 对应 ET（=BJ−13）；当前 BJ 小时列绿点、今日当前格绿色 ring+三角。
- 行尾显示当日总数；hover 浮层：日期（`M/D 周X`）、`HH:00 北京时间 (ET)`、`发推 N 条`。
- 图例：无/1-2/3-5/6-8/9-12/13+ · 「北京时间」·「当前时段」· 高频时段 = 20 天内 4 小时块（0-4/4-8/…）日均 top2（L10202-10224）。
- 导入：粘贴 JSON `[{date,hour,count}]` 校验后应用；导出：下载 `heatmap-YYYY-MM-DD.json`。

### 8.2 今日节奏 vs 历史基线（L10518-10634）
副标题「蓝色=今日实际 · 灰色=206天历史均值 · 紫色=全天最高峰时段」。24 根双层柱：
- **历史小时均值硬编码表 `n`**（L10524-10549，逐字；≈ St×43.4）：
```js
{0:2.15, 1:2.17, 2:2.22, 3:2.18, 4:1.8, 5:1.34, 6:1.14, 7:1.46, 8:1.52, 9:1.28,
 10:1.04, 11:1.11, 12:1.21, 13:3.03, 14:3.41, 15:2.67, 16:2.3, 17:1.17, 18:0.8,
 19:0.97, 20:1.5, 21:2.03, 22:2.62, 23:2.27}
```
- 归一化分母 `max(3.41, 今日值, 1)`；高峰时段 13、14 点紫色（#7c3aed）、18 点最低谷（#374151）；今日柱颜色：`实际 > 均值*1.5` → 琥珀 #f59e0b「超预期」，`实际 < 均值*0.4` → 红 #ef4444「低于预期40%」，否则蓝 #3b82f6；当前小时绿点标记。

### 8.3 最新推文（`nt`，L10638-10712）
xtracker `limit=20` 取前 10 条，每条链接 `https://x.com/elonmusk/status/{platformId}`，内容截断 200 字符，相对时间（分钟前/小时前/日期）；「查看全部」→ xtracker 用户页。

### 8.4 市场概览页内嵌「今日发推热力图」（L13977-14049）
24 柱：灰色背景柱 = 基线 `round(St[h]*43.4*10)/10`，前景柱 = 今日实发（仅已过小时）；柱高按 6 条封顶换算%；颜色：`实发 >= 基线*1.4 || >= 基线*0.6` → teal（正常），否则 rose「偏低」；图例：实际（正常）/实际（偏低）/历史基线。

### 8.5 目标区间时速倒推雷达（在**概率分析页**，L14137-14262）
副标题 `当前速率: (pace/24).toFixed(2) 条/时`。每个 active 区间一张卡（最多 12）：区间名 + 中心标 + 难度徽章（§2.8）；「还需发推 +min ~ +max 条」；「所需时速 minV ~ maxV /h」（∞ 显示 `∞`）；「真实概率 x%」。底部图例：轻松/中等/较难/需加速。

---

## 9. 预警系统（telegram 标签页 + 后台引擎）

### 9.1 引擎（`gt` hook，L11918-11963）
- 启用条件：`enabled && (ntfy 模式有 topic || telegram 模式有 botToken+chatId)`。
- **每 240s** 运行 `dt(input)` 生成候选预警；对每条按 `key` 查 `alert_sent_v1`：**6 小时内（`ct=360*60*1e3`）同 key 不重发**；发送成功后记录 `{key, sentAt}`（记录保留 2×窗口=12h）。
- 输入 `alertInput`（L13052-13065）：`{mu: M, remainingDays: days+hours/24, currentTweetCount: m, todayTotal, apiPace: pace, analysisData:[{range, price, realProb, isCenter, parsed}]}`。

### 9.2 预警规则全表（`dt`，L11671-11814）
预处理：`c` = 有效区间（price>0 && realProb>0）按 VR 降序；`l`=中心区间；`p`（中心高估）= `l.price > 35 && l.vr < 1`；`m`=主仓候选（realProb≥10 中 VR 最高）；`v`=中心下方相邻（保护仓）；`y`=高赔率仓（price≤5 && vr≥2，去重）；`x`=剩余时间文本（<1天 显示小时）。

| # | key | priority | 触发条件 | 内容 |
|---|---|---|---|---|
| 1 | `phase_*` | high | remainingDays 落入 §5.2 五档之一（每档 key 固定，命中即 break） | 阶段标题 + 阶段文案（含三层结构/VR/中心高估分支） |
| 2 | `center_overpriced_{range}_{floor(price)}` | urgent | 中心 price>35¢ 且 VR<1 | 「⚠️ 中心区间定价偏高，负EV！」+ 替代区间（realProb≥3 前3个）+「主仓放弃中心区间，移至价值比最高的相邻区间」 |
| 3 | `boundary_{range}_{floor(µ/5)}` | urgent | `min(中心max−µ, µ−中心min) ∈ [0,10]` | 「🚨 落点接近区间{上/下}边界」，距边界 N 条，列相邻区间，建议补建保护仓（RULES §3.4），µ误差约±10条 |
| 4 | `pace_slow_{YYYY-MM-DD}` | default | 今日外推全天 `est = todayTotal / max(1, 24 − (remainingDays%1)*24) * 24`；`est/pace < 0.45` | 「📉 马斯克今天发推异常少」：µ可能虚高约14条（RULES §2.3）；单日沉默不换仓，等死区 BJ 17:30 重估 |
| 5 | `pace_fast_{YYYY-MM-DD}` | default | `est/pace > 1.9` | 「📈 马斯克今天发推异常多」：不追仓（RULES §6.1）；BJ 14:00 是全天止盈最佳时机，+30% 可减仓 30-50% |
| 6 | `vr_opp_{range}_{floor(price)}` | vr≥1.5→high 否则 default | 存在 `vr≥1.2 && realProb≥3` 的区间，且主仓候选 `vr>=1.5` 或（中心高估 && `vr>=1.2`） | 「💡 入场结构建议（价值比分析）」：VR 排名前 4 + 三层结构 + 「只有VR≥1.0的区间才有正期望（RULES §1.1.1）」 |
| 7 | `tp_high_{range}` | high | remainingDays<1.5 && 中心 ≥75¢ | 「💰 止盈信号（高位）」卖50%（RULES §5.3） |
| 8 | `tp_mid_{range}` | default | remainingDays<1.5 && 中心 ≥65¢ | 「💰 可轻度止盈」减仓 20–30% |
| 9 | `overshot_{floor(count/20)}` | urgent | `中心max>0 && 当前累计 > 中心max && remainingDays<3` | 「⚠️ 当前发推数已超出落点区间」+ 新落点候选（含当前数的区间）及其 VR |

（RULES §x.y 为外部策略文档编号，代码中仅在消息文本引用：§1.1.1 正期望、§2.3 µ虚高、§3.4 保护仓、§5.3 止盈、§6.1 不追仓。）

### 9.3 推送配置（默认值 `lt`，L11656-11665）
```js
{ mode:"ntfy", ntfyTopic:"", ntfyServer:"https://ntfy.sh", workerUrl:"",
  botToken:"", chatId:"1899924436", groupChatId:"", enabled:false }
```
- **ntfy（推荐）**：POST `{server}/{topic}`，Header `Title`（预警标题）、`Priority: default`、`Tags: bell`；正文去除 HTML 标签（`ut`，L11667）。UI 引导安装 ntfy App（App Store id1625396347 / Google Play io.heckel.ntfy），订阅自定义频道名。
- **Telegram Bot**：优先 `workerUrl`（自建 worker，POST JSON `{botToken,chatId,message}`）；localhost 直连 `api.telegram.org`（`parse_mode: HTML`）；线上走 `/api/telegram-proxy`。`chatId` + 可选 `groupChatId` 同时发送（「✓ 预警将同时发到私聊 + 群组」），任一成功即算成功。
- 测试按钮发送：「✅ 马斯克推文预测市场 / 预警连接成功！你将收到：⏰ 操作时机提醒 🚨 落点边界预警 📉📈 速率异常 ⭐ EV+ 超额机会 💰 中心区间止盈信号」。
- 页面列出 7 类推送说明（L12281-12308）：操作阶段提醒 / 中心区间高估警告（>35¢ 且 VR<1.0）/ 落点边界预警（≤10条）/ 速率异常 / 价值比机会（VR≥1.5 或中心高估）/ 止盈信号（65%/75%）/ 落点跑偏；脚注「同一条预警 6 小时内不重复发送」。

---

## 10. 持仓管理标签页（`at`，L11224-11652）

### 10.1 数据模型
```ts
interface Position {
  id: string;          // `pos_${Date.now()}`
  range: string;       // 区间名
  entryPrice: number;  // 入场价 %（0.1–99.9）
  amount: number;      // 投入 USDC
  shares: number;      // = amount / (entryPrice/100)
  timestamp: number;
  marketSlug: string;
}
```
存 `musk_positions_v1`。区间下拉来自当前模型区间（`rangeOptions = {range, currentPrice, modelProb, isCenter}`，选中区间自动填当前价，中心标 `★中心`）。表单实时提示：`每份 $x.xxx · 赔率 y.yy x`、`≈ N 份 YES token`。

### 10.2 评估逻辑
- 单笔：`currentValue = shares * price/100`；`pnl = currentValue − amount`；`pnlPct = pnl/amount*100`。
- **按区间合并**（多笔显示「N 笔合并」）：`avgEntry = ΣAmount/ΣShares*100`；合并盈亏同理；删除按钮删除该区间全部笔。
- 信号（L11285）：见 §6.3。行左侧色条 + 徽章：止盈↑（绿）/减仓↓（红）/出场（琥珀）。
- 汇总卡：总投入 / 当前估值（按市价折算）/ 浮动盈亏（$ 与 %）；警示：「⚠️ 各区间互斥，最终只有一个区间结算为 YES。当前估值与浮盈均按市价折算，非中奖金额。」
- 「若该区间命中，单笔收益」列表：中奖 → `$shares`（+$`shares−amount`），并列模型概率（≥20 绿 / ≥5 琥珀 / <5 红）。
- 无导入/导出（导入导出仅热力图有）。

---

## 11. 策略指南标签页（`rt`，L10714-11185，操作手册）

结构：头部卡 + 4 个手风琴（同时只开一个，默认开 `buy`）+ 一张纸总结。

**头部**：「马斯克推文市场 · 操作手册」/「简化版 · 只讲操作，不讲数学」。核心思路：「中心落点区间带来**稳定基础收益**，最佳盈亏比区间带来**超额收益**，翼仓做保险按时减仓——**规则写死，不靠临场判断。**」

**§1 什么时候买、买多少**：资金表（§4.4）+ 超额收益策略框：「在工具『实时操作建议』区域，会自动找出当前市价远低于模型概率的区间（EV指数 > 1.25），即『价格被低估的区间』。策略：此时中心仓位已有浮动盈利，可以用浮盈的 **10–15%** 买入最佳盈亏比区间，实现『中心保底 + 翼仓超额』双层结构。注意：这是小仓位博弈，不是主力仓。若无明显价值区间（EV指数 < 1.25），跳过即可。」+ ⚠️ 不建议：距到期超过3天重仓入场；同一期内无限补仓；把全部资金押在超额机会上。

**§2 什么时候卖（固定规则，不靠感情）**：翼仓减仓计划（§5.3）+ 中心止盈（§6.1）+「卖出后它反而涨了，怎么办？」——「这不是错误，这是正确的风险管理。预测市场的利润来自**多次操作的平均收益**，不是某一次押对。翼仓归零的次数远多于中奖的次数。」

**§3 出现异常情况怎么办**：§6.5 四条。

**§4 心理备忘（FAQ）**（L11092-11103，原文）：
- Q「卖了翼仓，结果它中奖了，怎么办？」A「你没有做错。翼仓赔率是5–8倍，但中奖概率只有15–20%。长期来看，按计划卖出比死守期望值更高。这次是偶然，不代表策略错了。」
- Q「中心区间加了很多，突然很慌怎么办？」A「先看模型的预测落点（µ）是否还在中心区间内。如果是，说明策略没变化，你只是在正常价格波动中焦虑。如果µ已经移走了一个区间，才需要调整。」
- Q「要不要一直盯着价格看？」A「距到期3天以上：每6小时看一次即可。距到期1–3天：每2–3小时看一次。最后一天：需要随时关注，执行翼仓减仓和超额机会评估。到期前12小时：翼仓必须清仓。」
- Q「为什么利润总是来自没有重仓的区间？」A「因为你重仓的区间是模型认为最可能的区间，它的赔率往往已经被市场定价得比较高了。翼仓和最佳盈亏比区间赔率低、潜在回报高——这是预测市场的结构特征，超额收益策略就是利用这个特征。」

**一张纸总结（以北京时间24:00到期为基准）**（L11115-11183）：5 格时间轴 = 倒数第三天上午(2.5–3天)第一次建仓(绿) / 倒数第二天(1.5–2.5天)主力加仓中心(绿) / 最后一天上午(1–1.5天)翼减+超额(黄) / 最后一天晚上(0.5–1天)翼仓继续减(琥珀) / 到期前12小时·最终阶段·翼仓清仓(红)。脚注：「中心区间是稳定收益来源 · 超额机会是锦上添花 · 翼仓按时减仓，不靠临场判断」。

---

## 12. 推文生成标签页（`Rt`，L14359-14486）

自动生成一条可分享的中文推文（等宽预览框），内容模板（L14410-14425）：
```
{开场钩子 m}

发推节奏（近 N 天）：
D{天序} (M/D)  X 条 [← 今天]      // 近7天 daily，天序 = (日期−startDate)/864e5+1
（无 daily 时：日均 {pace} 条/天）

累计 {total} 条 · 预测落点 ~{Ne} 条 · 还剩 {N天M小时}

Polymarket 赔率：
► {中心区间}  {价}%（中奖 {100/价}x）    // 中心置顶带 ►，加另外按 trueProb 降序前 2 个 active 区间
  {区间}  {价}%（中奖 x）

——
{行动文案 te}

https://polymarket.com/event/{slug}?via=serene77mc-g6kj #Polymarket
```
**开场钩子 m**（优先级，L14393）：剩余 <0.5 天 →「今晚 24:00 结算，答案快揭晓了。」；距中心区间上/下边界 ≤8 条 →「还差 N 条，落点就要往上/下跨区间了。」；今日外推 `< pace*0.5` →「马斯克今天突然安静了。」；`> pace*1.8` →「马斯克今天猛发了一波。」；≥2.5 天 →「马斯克推文预测，还剩 X 天。」；≥1.5 天 →「落点慢慢收敛了，还剩 X 天。」；否则「最后 X天/小时，节奏很关键。」

**行动文案 te**（按剩余天 l，L14406）：`l>=2.5`「落点还在跑，现在进太早。预测还剩 ~N 条要发，等节奏再稳一天看看。」；`>=2`「第一次入场窗口。我主仓打 {中心}（现在 x%，约 yx），两翼各配一点，总资金 25%。」；`>=1.5`「落点基本定了。{中心} 是核心…现在集中加仓，两翼开始减持。」；`>=1`「翼仓该动了——先减 40%，锁住收益。剩 X，专注等 {中心} 结算。」；`>=0.5`「最后不到一天。翼仓全清，{中心} 留仓等结果。现在进 {中心} 的人赌的是 yx。」；否则「结算进入倒计时。仓位已定，等结果。」

按钮：Telegram 分享（`t.me/share/url?url=…&text=…`）、Twitter/X（`twitter.com/intent/tweet?text=…`）、复制到剪贴板（成功态 2s）。

---

## 13. UI 结构总览

### 顶部 Header（L13119-13200）
Logo（activity 图标）+「马斯克推文预测市场 / MUSK TWEET PREDICTION」；右侧：阶段徽章 `Et`（§5.1）、BJ 实时时钟（时:分:秒）、数据新鲜度点（>10 分钟变琥珀「数据 N分钟前」，`Ot` 补 Z 解析 ISO）、「主页」→ polymarket.com/?r=adul、「进入市场」→ 当期 event 链接（紫色主按钮）。

### 导航（L13201-13256）
主 3 个（高亮 teal）：`market 市场概览` / `analysis 概率分析` / `heatmap 发推热力图`；分隔线；次 4 个：`positions 持仓管理` / `tweet 推文生成` / `guide 策略指南` / `telegram 预警`。

### 市场概览 tab（顺序，L13259-14051）
1. 顶行：`BJ {h}:00` + 市场切换按钮组（slug 解析为「M月D日–M月D日」，`h()` L13332；选中记忆 slug）。
2. 4 张统计卡：推文数（total）/ 时速（pace 条/天）/ 剩余时间（`Nd` 或 `Nh`，副行余数小时）/ 当前窗口（§7.4 emoji+标签）。
3. 预测卡：「预测落点 ~Ne 条 · 日均 pace 条/天」+「预测精准度 t%」（§2.6）+ 距到期 + 「查看市场」「刷新」按钮。
4. 双栏：左 2/5「本期每日发推」（近 7 天 daily，绿色深浅按当期最大值比例 ≥0.8/0.6/0.4/0.2 分档）；右 3/5「区间定价」（前 6 区间：价格/VR/盈亏比 + CENTER/星标，§3）。
5. 阶段建仓卡（§4.2；hours>72 或 <6 隐藏）。
6. 🎰 彩票仓机会卡（§4.3，有候选才显示）。
7. 「📊 今日节奏 & 落点影响」：时机徽章大卡（§7.3，右侧大数字 De 落点预测）+ 6 时段块（§7.5）+「📌 对本期落点的影响」提示列表（§7.6）；角标「BJ h:00 · 206天数据」。
8. 「今日发推热力图」（§8.4，有今日数据才显示）。

### 概率分析 tab（L14053-14325）
左 2/3：①「盘口价值比」表（副标题 `µ = De · 当前 m 条 · 剩余 Nd`；列 区间/盘口价/模型概率/VR，中心行高亮，最多 12 行；脚注 VR≥1.2 有价值）；②「目标区间时速倒推雷达」（§8.5）。右 1/3：③「分布模型对比」（§2.5，最多 12 行，滚动）；④「进入 Polymarket 下注」大按钮。无数据时显示空态。

### 其余 tab
持仓管理（§10，max-w-4xl）；发推热力图（§8，max-w-6xl）；策略指南（§11，max-w-4xl）；推文生成（§12，max-w-3xl）；预警（§9.3 配置界面，max-w-2xl：模式二选一卡片、ntfy/TG 表单、发送测试、开启预警推送开关、推送类型说明）。

---

## 14. 复刻注意点（陷阱清单）

1. **两个 µ**：概率/中心区间用线性 µ（M），展示落点用会话修正后的 De = max(m, round((µ_hourly+Ee)/2))；两者可能落在不同区间。
2. 泊松归一化只在 `price>=1¢` 的区间集合内进行；`a+` 区间求和上限 9999。
3. 热力图 count 一律截断到 25，>25 视为数据异常（xtracker 偶发脏数据）。
4. 预警的「今日外推」分母：`max(1, 24 − (remainingDays 的小数部分)*24)` —— 借用市场剩余时间的小数近似「今天已过小时数」（因结算点为 BJ 24:00）。
5. 预警 key 含量化桶（floor(price)、floor(µ/5)、floor(count/20)、日期），使同类预警在数值明显变化后可再次触发（跨过 6h 去重）。
6. 市场数据主键为 slug；切换市场后记忆 slug，刷新列表后按 slug 恢复选中，否则回到最近到期的市场（列表按 end_date 升序）。
7. CLOB 历史重采样为 30 分钟阶梯桶，与本地 4 分钟快照、gist 快照按 `timestamp-marketSlug` 去重合并（价格历史目前仅收集，UI 中未绘图；传入推文生成组件但未使用）。
8. 所有 polymarket 跳转必须带 `?via=serene77mc-g6kj`（事件页）或 `/?r=adul`（主页）。
9. 默认 Telegram chatId 硬编码 `1899924436`（原作者私人 ID，复刻时应清空）。
10. Gist ID `d174b4498c408076ff218e164f24807e`（属 GitHub 用户 Adul9981），内含 `polymarket-data.json`、`polymarket-history.json`、`xtracker-data.json` 三个文件，由外部定时任务写入。
