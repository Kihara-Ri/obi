# 2026-10-23 · 抽屉二级页右划返回：结算期间不接新手势

- **作者**：Claude
- **范围**：`web/src/components/ui/Drawer.tsx`、`CHANGELOG.md`

## 改了什么
抽屉二级页的左缘右划返回增加 `edgeSettleRef`：回弹（300ms）与「返回已提交、pop 动画未收尾」期间，新的左缘手势不接管，与「更多」子页 `useEdgeSwipeBack` 的 `is-swipe-settle` 同口径。pop 动画收尾（layout effect 的 `cleanup`）与回弹复位时清除标志。

## 出现的问题
拖动返回时露出的上一层有时是空白（整个下层不见，只剩抽屉底色）。

## 怎么解决的
下层靠 `is-animating` 才脱离 `.is-covered{visibility:hidden}`。回弹后的 300ms 复位计时器若恰好落在下一次右划中途，会清掉同一批节点上的 `is-animating` / transform / 暗层，下层重新隐藏。子页那套手势在结算期间拒绝新手势，抽屉这边是漏口。原因由代码推断，未在真机复现；与 `e73f5fd`（起点在按钮 / 缩略图条带上也接管）后更容易连续右划有关。
放弃的方案：新手势接管回弹中的画面（读计算位移继续跟手）——项目里没有同类机制，与子页不一致。

## 可能带来的新问题
- 回弹 / pop 的约 0.3 秒内左缘划动无效（不拦截 touchstart，iOS 系统边缘返回可能在此窗口介入）。
- 返回被拒（脏表单取消放弃）时，标志要等 700ms 的复位后才清除。
- 仅通过 typecheck / build，未做真机验证。
