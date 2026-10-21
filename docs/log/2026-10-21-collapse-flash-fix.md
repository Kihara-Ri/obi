# 收起下拉后闪一下

- `Details`：收起动画结束到 React 摘掉 `open` 之间，高度弹回原值一帧 → 动画加 `fill:'forwards'`。
- `useLeaving`（Dropdown / Combobox 共用）：leaving 原先在 `useEffect` 里才置 true，open 变 false 的那次渲染先绘一帧「已隐藏」，再重新显示做退出动画 → 改为渲染期派生 state，同一次渲染就进入 leaving。
- 未验证：真机逐帧观感。
