# 2026-10-20 · 手机键盘弹出时抽屉上抬，输入框不再被盖住

- **作者**：Claude
- **范围**：`web/src/components/ui/Drawer.tsx`、`web/src/styles/drawer.css`

## 改了什么
键盘弹出时，用 `visualViewport` 算出键盘高度（`innerHeight - vv.height`，捏合缩放 `scale>1` 时不算），写入 `#panel` 的 CSS 变量 `--kb`；手机 sheet 的 `bottom` 改为 `var(--kb,0px)`（`.compact` 的 `max-height` 同步扣除），sheet 随之缩到键盘上沿。同时把当前聚焦的 input / textarea / select 在 `drawer-body` 内滚到可见区中间；键盘已开时换字段（`focusin`）也会重新对齐。键盘收起 `--kb` 归零，布局恢复。

## 出现的问题
此前设计是「sheet 位置不变，键盘叠在其下半部之上，聚焦字段露出交给 WebKit 滚动」。真机上 WebKit 并不会把 `drawer-body` 里的字段滚到键盘之上，键盘盖住了输入框，看不到正在输入的内容。

## 怎么解决的
见上。iPhone 17 Pro 模拟器实测（编辑专辑，点底部「备注」框）：sheet 缩到键盘上方，输入框位于可见区中间，底栏按钮在键盘之上；收起键盘后恢复整高。类型检查、构建、前端 120 项测试通过。

## 可能带来的新问题
- 键盘弹出时可视区变矮，抽屉正文可滚动区域变小（头部 + 底栏仍占约 150pt）；很矮的屏幕上正文只剩一小截。如需更宽裕，可在键盘开启时隐藏底栏。
- 模拟器的键盘行为与真机接近但不等同（真机的输入法候选栏、`visualViewport.offsetTop` 变化时机可能不同），需真机再确认；已部署的线上版本**尚不含**本次修复。
