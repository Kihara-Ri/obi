# 2026-11-03 · 前端分层规则改为机检，修正 4 处反向依赖

- **作者**：Claude
- **范围**：新增 `web/tests/layering.test.mjs`、`components/AlbumLine.tsx`；`BulkBar`(+css) / `SaleCard` / `ShipmentCard` / `PeekUnderlay` 从 `components/` 移到 `pages/`；`forms/SaleForm|ShipForm|SaleCostsForm`、相关页面与 `App.tsx` 改 import；AGENTS、`components/REGISTRY.md`

## 出现的问题
AGENTS 写着「core ← components ← pages/forms，禁止反向 import」，但只靠人记：`BulkBar`、`SaleCard`、`ShipmentCard` 直接打开表单（import `forms/`），复盘只发现这三处；写成测试后又抓到 `PeekUnderlay` import `pages/`。

## 怎么解决的
- 测试扫描 `core/` 与 `components/` 下所有相对 import，解析到目标顶层目录，命中 `pages/` / `forms/`（core 另加 `components/`）即失败。
- 会打开表单或挂页面的四个件移到 `pages/`；`SaleCard` 里被三张表单复用的纯展示 `AlbumLine` 拆到 `components/AlbumLine.tsx`。
- 纯搬移，零行为变化：与搬移前的构建对比，`index.css` 逐字节一致；JS 只是共享 chunk 切分变了（原来名不副实的 `SaleForm.js` 拆为 `DetailDrawer.js` / `SaleCard.js` / `shared.js` / `AlbumSummary.js`），总量 +0.7 KB，库存页多一个并行的小 chunk。

## 可能带来的新问题
无已知隐患，已验证：typecheck、构建、前端 176 项（含新测试）通过。未做浏览器回归——代码只搬家、CSS 产物一致。

## 关联
AGENTS 前端分层 · D-036
