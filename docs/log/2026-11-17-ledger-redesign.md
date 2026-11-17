# 2026-11-17 · 账本页重排并加入每月收支

- **作者**：Claude
- **范围**：`web/src/core/ledger.ts`（新）、`web/src/pages/StatsPage.tsx` / `StatsPage.css`、`LedgerChart.*`、`LedgerTable.*`（新）、`web/src/forms/ShipForm.tsx`；删除 `web/src/styles/stats.css`（及 legacy 名单里的这一行）；测试 `web/tests/ledger.test.mjs`

## 改了什么
六个同级指标块改成：利润卡 → 「钱压在哪」库存成本分段 → 每月买入 / 到手柱状图 → 一行一月的月度表（新增买入支出、退货损失）。在途天数由写死的「约 11 天」改为按往期包裹算平均。

## 出现的问题
- 图表利润标签被 `.ledger-chart-pv` 的默认灰色盖住了全局 `.positive`；深色模式下 `--surface-3` 的买入柱几乎看不见。
- 桌面宽度下柱列按 1/6 宽度铺开太稀。

## 怎么解决的
标签加 `.ledger-chart-pv.positive/.negative`；买入柱改用 `--border-strong`；柱列限宽 88px。计算全部放进 `core/ledger.ts` 纯函数并写测试，页面只排版。

## 可能带来的新问题
样例数据只有 3 个月，跨年标注与 6 个月以上的横向滑动只在单元测试 / 代码层面覆盖，没有在真实多年数据上目测。已验证：tsc、npm test（193）、build、手机 390 浅色 / 深色与桌面 1280 截图、无横向溢出。

## 关联
2026-11-17-shelf-row-swipe.md

## 追加：去掉年份切换
用户认为不分年更好：账本始终统计全部时间，月份带年份显示（图表在每年第一个月下标年份，表格写「2026年9月」），`ledgerYears` 与 `ledgerSummary` 的年份参数一并删除；图表的年份标签改为绝对定位，免得撑高那一列、让柱子底线错开。
