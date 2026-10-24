# 2026-10-24 · 「更多」子页慢划失控；左缘返回手势统一（D-025）

- **作者**：Claude
- **范围**：新增 `web/src/core/edge-swipe.ts`；`hooks/useEdgeSwipeBack.ts`、`components/ui/Drawer.tsx` 改用它

## 出现的问题
iPhone 上在「更多 → 账本」等子页慢慢右滑，划到一半突然不跟手、内容一下弹回，随后显示「更多」。

## 原因
子页手势的 touchstart 是 passive，且位移不到 8px（方向未判定）前不 preventDefault。慢划时这段时间很长，iOS 的系统边缘返回趁机接管：页面收到 touchcancel → 回弹，系统再播自己的返回。抽屉的手势早在 touchstart 就拦了（见其注释），两套实现已经分叉。

## 怎么解决的
抽出 `core/edge-swipe.ts`：起手即拦（贴边按钮 / 链接除外）、方向判定前的 touchmove 也拦；touchcancel、多指、丢失 touchend 回弹；返回阈值统一为宽度 30% 或甩动。子页与抽屉只保留各自的画面逻辑。

## 验证
样本库预览 375×812 合成触摸：子页 touchstart 与前几帧 touchmove 均被 preventDefault（旧代码不拦）；慢划 80px 回弹、touchcancel 回弹、慢划 200px 返回「更多」；抽屉根页轻拉回弹、二级页 60px 回弹 / 150px 返回（含中途 App 重渲染），返回动画约 285ms 收尾；控制台无错误。iOS 系统手势本身无法在模拟器外复现，需真机确认。

## 可能带来的新问题
抽屉二级页返回阈值由 70px 变为屏宽 30%（约 112px），轻划更不容易误返回、但需要多划一点；左缘 28px 内起手的纵向滚动在子页上不再生效。
