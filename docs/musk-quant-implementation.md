# Musk Quant 量化分析模块 — 实现总结

> 日期：2026-07-07
> 来源：全面学习并移植 https://musk-tweet-quant-rtmv.vercel.app/ （含 `/morphology_compare.html` 子页面）的策略体系，
> 以 ZenTrade 现有设计风格（Next.js App Router + Shadcn UI + zinc 主题）重新实现。
> 完整算法逆向规格见 [musk-quant-strategy-spec.md](./musk-quant-strategy-spec.md)（522 行，含原站行号引用）。

---

## 一、这次做了什么

1. **逆向学习原站**：原站是 Vite 打包的纯前端 SPA。下载并美化其 334KB JS bundle（1.4 万行），
   由子代理逐段解析，产出完整功能规格文档，覆盖数据源、预测模型、价值比、入场结构、阶段系统、
   会话节奏、止盈规则、预警规则、形态分类器的全部公式与硬编码常量。
2. **新建独立菜单**：侧边栏 Polymarket 分组下新增 **Musk Quant**（图标 Crosshair），路由 `/musk-quant`，
   与现有 X Monitor 并列、互不影响；后续融合时可将各 Tab 迁移。
3. **完整移植 7 大能力**：市场概览（信号/预测/定价/建仓计划）、概率分析（VR 表/时速雷达/分布对比/三层结构）、
   **走势形态对比（morphology）**、发推节奏热力图、持仓管理、策略指南。
4. **数据自给**：不依赖原站或其 GitHub Gist，直连 Polymarket 官方公开 API（经本地代理），
   市场发现方式比原站更优（原站枚举 slug 探测，我们用 `series_slug=elon-tweets` 一次拿全）。

## 二、页面结构

```
Sidebar › Polymarket › Musk Quant (/musk-quant)
┌────────────────────────────────────────────────────────────────┐
│ Musk Quant  · 市场切换 07-07/07-10/07-14 · Posts/Today/Remaining/Pace │
├────────────────────────────────────────────────────────────────┤
│ [Market Overview][Probability][Morphology][Rhythm Heatmap]      │
│ [Positions][Strategy Guide]                                     │
├────────────────────────────────────────────────────────────────┤
│ Market Overview: 实时操作信号 → 落点预测卡（双µ/精准度/窗口）        │
│   → 本期每日发推 + 区间定价(价格/VR/盈亏比) → 阶段建仓卡            │
│   → 彩票仓机会 → 今日节奏&落点影响 → 操作阶段纪律                   │
│ Probability: 盘口价值比表 + 时速倒推雷达 | 三层入场结构 + 分布对比   │
│ Morphology: 可信度提示 → 区间标签 → 对比A(中心vs下方)               │
│   → 对比B(中心vs上方)，每组含 48h 实际曲线 + 形态判定 + 6 模板       │
│ Rhythm Heatmap: 今日vs历史基线柱状图 + 14天×24h 热力图              │
│ Positions: 汇总卡 + 记录表单 + 明细(信号/浮盈/中奖模拟)             │
│ Strategy Guide: 操作手册手风琴(买/卖/异常/FAQ) + 一张纸总结         │
└────────────────────────────────────────────────────────────────┘
```

## 三、核心算法（移植自原站，常量逐字保留）

### 3.1 落点预测（双 µ 体系）
- **线性 µ**（概率模型用）：`M = 当前累计 + 剩余小时/24 × 日均节奏`
- **小时加权 µ**：按 206 天历史的 BJ 24 小时发推占比表 `HOURLY_FRACTION` 加权剩余时间
- **会话修正**：5 个会话（下午 97%/傍晚 51%/深夜 71%/清晨 16%/上午 64%）状态机
  （upcoming/pending/ongoing/strong/weak/confirmed/absent）产生 µ 修正量
- **展示落点** `De = max(当前, round((µ_hourly + 修正后µ)/2))`
- **预测精准度曲线**：剩余 ≥72h→45%，线性爬升至 <6h→88%

### 3.2 区间概率与价值比
- 泊松 PMF（λ = 线性 µ）对每个区间求和，**仅 ≥1¢ 的区间参与归一化**
- 正态对比模型：σ = max(8, √剩余期望 × 2.2)，erf 用 Abramowitz-Stegun 近似
- **VR = 模型概率 ÷ 盘口价**；分级：≥2.5 高赔率低估 / ≥1.5 明显低估 / ≥1.2 低估（✓有价值）/ ≥1.0 合理 / ≥0.8 略高估 / <0.8 高估

### 3.3 三层入场结构
- 主仓 50–70%：模型概率 ≥10% 中 VR 最高区间
- 保护仓 20–30%：中心下方相邻区间（+0.3 档偏高对冲）
- 高赔率仓 ≤5%：价格 ≤5¢ 且 VR≥2
- 结论：主仓 VR≥1.2 可建仓 / ≥1.0 勉强 / <1.0 观望

### 3.4 阶段系统与操作纪律
- 阶段徽章：≥5 天前期布局 / ≥3 中期调整 / ≥1 后期收缩 / <1 最后 24H
- 操作阶段（µ 误差 ±50→±20→±12→±8 条）：建仓窗口(2.5–3天)→主力建仓(1.5–2.5天)→持仓评估(1–1.5天)→止盈评估(0.5–1天)→最终阶段
- 阶段建仓卡：>48h 轻仓（中心 $80–130）；36–48h 主力（中心 $170–210）；≤36h 转 NO 埋伏/YES 联动高倍博弈
- 翼仓减仓：最后一天上午卖 40% → 晚上再卖剩余 50% → 到期前 12h 清仓
- 止盈：65¢ 减 20–30%；75¢ 卖 50%；85¢ 大部分止盈；死亡陷阱 = 亏损仓“再等等看”

### 3.5 实时操作信号（原站预警规则的页面版）
中心高估负 EV（>35¢ 且 VR<1）/ 落点距边界 ≤10 条 / 今日速率异常（外推 <0.45× 或 >1.9× 日均）/
价值比机会（VR≥1.2 且概率 ≥3%）/ 止盈信号（<1.5 天且 65¢/75¢）/ 落点跑偏（当前数超中心上限）

### 3.6 走势形态分类器（morphology_compare 页面）
- **六种形态模板**（18 个真实市场最后 48h 曲线，各含 48 点绿/红价格序列）：
  A 全程碾压 20% / B 快速确立 12% / C 中期反超 33%（最常见）/ D 末期追赶 8% / E 临门一脚 2% / F 领先险守 22%
- 分类特征：绿/红连续领先小时数、36h 内交叉次数、红 12h 涨幅、绿 6h 涨幅、红历史最高价
- 每形态按特征加权打分，置信度 = min(0.92, 最高分)；输出主判定+次可能+理由文案
- 对比对象：中心（盘口价最高）vs 下方相邻（对比 A）、上方相邻（对比 B），CLOB 小时级价格对齐取最近 48h
- 可信度分层：<24h 最高 / <48h 强 / 更远仅供参考

## 四、代码清单（zentrade-app）

| 文件 | 说明 |
|---|---|
| `src/app/(main)/musk-quant/page.tsx` | 页面入口，6 个 Tab |
| `src/app/api/quant/markets/route.ts` | gamma 代理：`series_slug=elon-tweets` 市场发现 |
| `src/app/api/quant/posts/route.ts` | xtracker 代理：推文流水（分页透传） |
| `src/app/api/quant/price-history/route.ts` | CLOB 代理：区间 YES token 小时级价格 |
| `src/types/musk-quant.ts` | 类型：QuantEvent/QuantBucket/ElonPost/QuantPosition/… |
| `src/lib/musk-quant-api.ts` | 数据获取与映射（含区间 label 解析、bid/ask 中值定价） |
| `src/lib/musk-quant-store.ts` | Zustand store（市场/推文/持仓 localStorage） |
| `src/lib/musk-quant-engine.ts` | **策略引擎**：双 µ、泊松/正态、VR、三层结构、阶段、会话、信号、持仓评估 |
| `src/lib/musk-quant-morphology.ts` | **形态引擎**：6 模板常量、predictPattern 分类器、序列对齐 |
| `src/hooks/useMuskQuantAnalysis.ts` | 派生分析 Hook（60s 重算） |
| `src/components/modules/musk-quant/QuantHeader.tsx` | 头部：市场切换/统计条 |
| `src/components/modules/musk-quant/MarketOverview.tsx` | 市场概览 Tab |
| `src/components/modules/musk-quant/ProbabilityAnalysis.tsx` | 概率分析 Tab |
| `src/components/modules/musk-quant/MorphologyCompare.tsx` | 形态对比 Tab（SVG 双线图，无第三方图表库） |
| `src/components/modules/musk-quant/RhythmHeatmap.tsx` | 节奏热力图 Tab |
| `src/components/modules/musk-quant/PositionManager.tsx` | 持仓管理 Tab |
| `src/components/modules/musk-quant/StrategyGuide.tsx` | 策略指南 Tab |
| `src/components/shared/Sidebar.tsx` | 新增 Musk Quant 菜单项 |

架构决策：**纯前端功能**，未改动 FastAPI 后端；外部 API 经 Next.js Route Handler 服务端代理（规避 CORS，带 30–120s 缓存）；持仓存 localStorage（与原站一致）。图表全部用自绘 SVG，与项目「无图表库」惯例一致。

## 五、数据源

| 数据 | 端点 | 用途 |
|---|---|---|
| 市场/区间/价格 | `gamma-api.polymarket.com/events?series_slug=elon-tweets&closed=false` | 自动发现 3 个滚动周市场，26 区间含 bid/ask |
| 推文流水 | `xtracker.polymarket.com/api/users/elonmusk/posts`（分页，回溯 30 天） | 计数（与结算口径一致）、热力图、会话模型 |
| 价格历史 | `clob.polymarket.com/prices-history?fidelity=60`（近 50h） | 形态对比 48h 曲线 |

## 六、开发中发现并修复的关键问题

1. **计数窗口错误（重要）**：gamma 事件的 `startDate` 是**市场创建时间**（早于计数窗口约 3 天），
   真正的计数起点是 `startTime`。用错会导致推文计数翻倍（222 vs 实际 104）、λ 虚高、
   模型概率归一化后在错误区间集中（曾出现 140-159 “模型 100%、VR 47”的假信号）。
   修复后模型与市场对齐：预测 ~109 条，市场中心 100-119（63¢），中心 VR 1.08。
2. **泊松数值实现**：PMF 用迭代乘法避免阶乘溢出；开口区间（`500+`）求和上限截断至 λ+400。
3. **React Compiler 规则**：渲染期禁止 `new Date()`/`Date.now()`，统一用
   `useState(() => new Date())` + 定时器（与 PostActivityHeatmap 同款模式）。

## 七、验证结果

- `tsc --noEmit` 通过；ESLint 新增文件 0 error / 0 warning（仓库既有文件的历史报错不受影响）
- `next build` 通过，`/musk-quant` 与 3 个 `/api/quant/*` 路由正常生成
- 生产模式实测（真实数据）：
  - 市场发现：June30–July7 / July3–10 / July7–14 三期正常切换
  - 计数 104 条与 Polymarket xtracker 口径一致；预测 ~109 与市场中心区间吻合
  - 形态对比：对比 A 判定「A 全程碾压 92%」、对比 B 判定「C 中期反超 92%」，曲线与判定互相印证
  - 信号系统：正确触发「落点接近区间上边界」（距 100-119 上沿 5 条）

## 八、遗留与后续建议

1. ~~**预警推送未实现**~~ → 已完成（见 §十 优化 2）。
2. **推文生成 Tab 未移植**（原站用于分享引流，与交易决策无关，规格已留档可随时补）。
3. **策略融合**：后续可把 X Monitor 的 4 个事件型策略与本模块的阶段/信号体系合并为统一 Tab，
   规格文档中的预警规则表（§9.2）可直接映射为后端策略实例。
4. 原站的 GitHub Gist 数据链路（外部定时任务写入）我们不依赖；若担心 xtracker 限流，
   可让后端定时缓存推文流水。

## 九点五、回测结论（2026-07-07）

完整报告见 [strategy-backtest-2026-07-07.md](./strategy-backtest-2026-07-07.md)。要点：
沉默→爆发假说成立（2.3× 基线）；扫尾99% 正常工作；结算NO 必须用动态 gap（固定 gap 或死或负期望）；
VR 主仓策略 T-72h 前全灭、盈利呈彩票型，n=8 样本下未证明正期望，小仓位跑到 ≥20 期再评估。

## 十、2026-07-07 优化轮（backend `app/quant/` 模块）

> 背景分析结论：这套策略的真实 edge 在「与结算源同步的计数速度 + 纪律执行」，
> 数学模型（冻结常量、泊松、中间价 VR、双 µ 不一致）是最弱一环。本轮按此逐项修正。

1. **数据地基（回测前提）**：后端每 5 分钟把全部区间 bid/ask/last 落库
   `quant_price_snapshots`；推文流水复用 xmonitor 已有落库。查询端点
   `/api/quant/snapshots`、`/api/quant/hourly-counts`。攒 4–6 期后可回测
   「VR≥1.2 买入持有」的真实期望。
   **附带修复**：生产 nginx 将 `/api/` 全部转发 FastAPI，今天新增的 Next.js
   `/api/quant/*` 代理在线上从未生效（页面无数据）——现由后端提供同形状端点，
   Next 版本仅在本地 dev 生效。
2. **后端预警推送**：`buildSignals` 全部规则 + 5 个操作阶段提醒移植为
   `app/quant/engine.py`，每 5 分钟对当前周期评估，量化 key + 6h 去重
   （`quant_alert_log`），历史入 `quant_alerts`，经 xmonitor web-push 通道推送。
   关浏览器不再错过 BJ 12:00 建仓窗、死区换仓、清仓时点。
3. **可成交价口径**：VR = 模型概率 ÷ **ask**（买入）；止盈/持仓估值用 **bid**。
   点差 ≥5¢ 或无盘口标记 illiquid，彩票仓/高赔率仓/NO 埋伏自动跳过；
   VR 表加「薄」标。低价薄区间的 VR 虚高假信号由此消除。
4. **统一 λ**：概率模型 λ 从线性 µ 改为会话修正后的落点（= displayLanding），
   展示落点与概率中心不再可能落在不同区间。前后端同式。
5. **滚动常量**：`/api/quant/constants` 用近 90 天完整 BJ 日重估日均基线、
   24 小时占比、5 会话统计（阈值 = p75/p25 分位，expectedContrib = freq×avg），
   每小时刷新；<21 天回退 206 天冻结表。前端启动拉取并贯穿预测/会话/热力图基线。
6. **经验 bootstrap 分布**：`/api/quant/remaining-samples` 从历史日向量重采样
   「剩余窗口发推数」（今日剩余时段 + N 个完整日），形状保留过度离散
   （实测 var/mean ≈ 18 vs 泊松的 1），均值对齐 λ；前后端共用，<21 天回退泊松。
   直接修正泊松系统性低估尾部区间概率的问题。
7. **形态分类器降级**：UI 明示「描述性参考，18 样本人工权重，匹配度≠置信度」；
   每次判定 upsert 到 `quant_morphology_log`（每期每对比每 BJ 日一条），
   攒样本后对照实际结果评估其预测力再决定去留。

## 九、使用说明

- 入口：侧边栏 Polymarket › **Musk Quant**
- 顶部圆形按钮切换三个滚动周期（默认最近到期）；每 60 秒自动重算，手动刷新在标题行
- 决策主线：先看「实时操作信号」→ 落点预测与精准度 → 区间定价 VR → 按阶段建仓卡执行；
  最后 48h 结合 Morphology 形态判定持仓/入场；持仓记录后自动给出止盈/止损/出场信号
- ⚠️ 持仓存在浏览器 localStorage，清缓存会丢失；金额建议仅作记录用途

## 十一、2026-07-08 融合轮：并入 X Monitor（单页 8 Tab）

1. **页面合并**：`/musk-quant` 独立页移除（路由保留、redirect 到 `/x-monitor` 兼容旧书签），侧边栏 Polymarket 分组只留 X Monitor 一项。
2. **Tab 重组**（11 → 8）：Overview（量化市场概览 + 右侧策略方案面板）/ Probability / Morphology / Rhythm（14d×24h 节奏热力图 + 7×24 周活跃热力图合并）/ Alerts（告警时间轴）/ Positions（量化持仓 + 手动交易记录）/ Strategies（策略实例 CRUD + 策略笔记）/ Guide（操作手册）。Tab 状态入 URL（`?tab=`），推送跳转 `?alert=` 自动定位 Alerts。
3. **右侧策略方案面板** `StrategyPlanPanel.tsx`：操作阶段纪律（随剩余时间实时切换，从 MarketOverview 底部迁出）+ 回测铁律 4 条（来自 strategy-backtest-2026-07-07.md）+ 止盈阶梯/死亡陷阱提醒；xl 屏 sticky。
4. **头部统计融合**：MonitorHeader 新增 Today、Forecast（预测落点）两格，数据来自量化引擎；手动刷新同时刷 xmonitor 与 quant 两个数据源。
5. **市场联动**：tracking 切换按 marketLink slug 同步 quant 选中市场；无对应量化数据（如 July 6–8 短周期市场不在 elon-tweets 周度系列）时显示提示条并隐藏 Today/Forecast。
6. **默认市场修正**：musk-quant store 默认选中第一个**未到期**市场——gamma `closed=false` 会滞后返回已结算市场，原先会默认选中剩余 0h 的死市场。
7. **字体标准 ≥12px**：两个模块全部 `text-[8/9/10/11px]`（约 125 处）统一为 `text-xs`，热力图 tooltip 宽度相应放宽（200→220px，百分比列 32→44px）；Sidebar 两处 10px 一并提升。

## 十二、2026-07-08 可读性轮：图标 / 字号 / 热力图统一

1. **emoji 图标全部换成 Lucide**：新增 `QuantIcons.tsx`（WindowIcon/RhythmIcon/TimingIcon/ImpactIcon 按引擎的 tone/kind/key 映射）；引擎展示文案中的 emoji 前缀（⏰⭐🟡✅ 等）全部剥离，语义交给图标与颜色（engine 数据字段里的 emoji 保留但 UI 不再渲染）。
2. **字号体系**：底线 12px（text-xs 仅用于 uppercase 小标签/密集表格徽章）；建议/说明正文统一 14px（text-sm）；卡片标题 16px（text-base）；落点预测主数字 text-4xl。卡片内边距整体放大一档。
3. **形态模板放大**：六模板从一行 6 个改为 lg 下 3×2 网格（曲线 220×96），实际对比曲线 640×200；判定/建议文案 14px。
4. **热力图统一**：删除无交互的 `RhythmHeatmap.tsx`，其两个维度并入交互式 `PostActivityHeatmap`（子 Tab：Day×Hour / **Daily 14d** / Hourly / **Today vs Baseline** / Timeline）。新维度数据来自 musk-quant 推文流水（30 天）+ 滚动常量基线，支持时区切换（基线按 BJ 定义、切时区时平移），每个格/柱 HoverCard 展示 5 分钟分桶明细，Today 视图额外显示实际 vs 基线偏离倍数（>1.5x 琥珀 / <0.4x 红）。
5. **price-history 容错**：`fetchPriceHistory` 先走同源代理、失败回退 FastAPI 后端（dev 下 Next 代理偶发外网 fetch 失败，后端端点更稳）。
6. 删除已无引用的 `QuantHeader.tsx`（头部已并入 MonitorHeader）。
