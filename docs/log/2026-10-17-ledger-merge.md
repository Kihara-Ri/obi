# 2026-10-17 · 账本合并，已交易改名交易记录

- **作者**：Claude
- **范围**：`App.tsx` `pages/{StatsPage,TradesPage}.tsx` `components/PageHead.tsx` `core/modules.ts` `styles/more.css` `README.md`；删除 `pages/LedgerPage.tsx`

## 改了什么
「账本概览」并入「收支统计」，统一叫「账本」（stats 页新增「售出金额」块）；`#ledger` 重定向到账本；「已交易」全部改名「交易记录」。

## 出现的问题
两个页面语义重复（在库/成本/售出金额/利润）。

## 怎么解决的
删除 LedgerPage；stats 页补缺的指标块；App 里把 `ledger` 路由别名到 `stats`；侧栏账本卡片保留。

## 可能带来的新问题
没有购入和交易的组合下不再有账本入口。

## 关联
见同日期其他日志
