# 2026-11-24 · 接口文档按场景组织，介绍站新增「接口」页

- **作者**：Claude
- **范围**：docs/接口场景指南.md（新）、docs/README.md、docs/HTTP接口一览.md、docs/Agent上架接口.md、README.md、CHANGELOG.md、site/src/pages/api.astro（新）、site/src/components/ApiFlow.astro（新）、site/src/lib/api-flows.ts（新）、site/src/components/Header.astro、Footer.astro、site/README.md

## 改了什么
新增场景指南，把对外接口按「闲鱼上架到入账」「买前查重复」「部署与监控」串成步骤，写明每步的调用方、令牌、请求和状态变化。介绍站新增 `/api/` 页，用竖向流程轴展示同样内容，页眉和页脚加「接口」入口。

## 出现的问题
手机宽度下请求体代码块把页面撑出横向滚动：网格没有声明列宽，隐式列按 `<pre>` 的最小内容宽度扩张。

## 怎么解决的
流程、步骤列表和卡片网格都声明 `grid-template-columns:minmax(0,1fr)`，长路径和请求体在自身内横向滚动。页眉锚点在非首页加首页前缀，首页仍保持页内平滑滚动。

## 可能带来的新问题
指南和 `lib/api-flows.ts` 是两份内容，接口变化时需同步（已在两处注释与 site/README 写明）。手机页眉不显示导航，「接口」入口在手机上只在页脚。已验证：check_docs、站点 build 与 CSP check 通过；1280 与 390 宽、浅色与深色无横向溢出。

## 关联
D-044 · D-047 · 2026-11-24-purchased-record-query.md
