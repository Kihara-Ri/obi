# 2026-10-19 · 在途包裹：专辑默认摞起来，点击展开成列表

- **作者**：Claude
- **范围**：`web/src/components/ShipmentStack/`（新）、`web/src/components/ShipmentCard.tsx`、`web/src/components/REGISTRY.md`

## 改了什么
包裹卡片里的专辑列表默认收起为一摞叠放封面（最多 5 张，多出的用 `+N`），点击整摞或右侧箭头展开为原有列表，再点收起。新增 `ShipmentStack`（复用 `Collapse`），在途与已签收包裹共用；列表内容、金额与按钮不变。

## 出现的问题
无功能问题。浏览器实测（手机宽度）：收起为叠放封面，展开为三张专辑列表，箭头翻转。控制台仅有一条 “fetching the script” 错误，疑似 service worker，未确认与本改动无关。

## 怎么解决的
—

## 可能带来的新问题
- 展开状态不持久，切页或刷新后回到收起。
- 叠放封面用了少量字面 px 与阴影值，与 R5 的 token 要求有出入，沿用了 `shipments.css` 的写法。
