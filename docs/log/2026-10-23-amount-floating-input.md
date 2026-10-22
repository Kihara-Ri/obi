# 2026-10-23 · 金额框改为悬浮聚焦输入

- **作者**：Claude
- **范围**：`web/src/forms/fields.tsx`（AmountInput）、`forms/record/MoneySection.tsx`、`forms/SaleForm.tsx`、`components/ui/FocusInput/*`、`components/ui/Drawer.tsx`、`components/REGISTRY.md`、`CHANGELOG.md`

## 改了什么
手机（≤840px）上金额框变成只读，点一下在键盘上方升起 FocusInput 悬浮层（数字键盘），背后抽屉 / 页面不动；电脑端仍是原 number 输入框。买入金额与成交价两处原本的裸 input 也换成 AmountInput。FocusInput 增加 `inputMode`，进场动画改为 .32s 缓出 + 渐显，层的 top/bottom 加过渡，键盘弹起时卡片平滑上移，减少动画偏好下无动画。

## 出现的问题
金额框是真实 input，聚焦就触发 Drawer 的键盘避让（reveal 滚动），页面被拉起。

## 怎么解决的
金额框只读 + inputMode=none，不拉系统键盘；Drawer 的 reveal 跳过只读输入；输入在悬浮层里实时写回（取消只关层不回滚，避免点遮罩丢输入）。被放弃：在原位保留真实输入并强行阻止滚动——iOS / 安卓行为不一致。

## 可能带来的新问题
未在真机验证软键盘（仅 Playwright 390px，无真实键盘）。只读金额框不能原位粘贴 / 长按编辑，需点开悬浮层。

## 关联
I-016
