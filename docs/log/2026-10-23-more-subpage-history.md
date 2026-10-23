# 2026-10-23 · 更多子页的历史栈与返回

- **作者**：Claude
- **范围**：`web/src/core/nav.ts`、`web/src/styles/layout.css`、`CHANGELOG.md`

## 改了什么
`navigate()`（手机）：从父页进入 `BACK_TARGET` 里登记的子页时 `location.hash = target` 压一条历史并记下 `pushedFrom`；在子页点顶栏返回（目标正是父页，且这条历史是自己压的）时 `history.back()`；其余照旧 `location.replace`。`.head-back` 加 `-webkit-tap-highlight-color:transparent` 与 `-webkit-touch-callout:none`。

## 出现的问题
子页是 replace 进来的，历史里没有「更多」：iOS 网页应用左缘右划无处可退（划不动）；安卓壳的返回键 `web.canGoBack()` 为假，直接退到桌面。返回键按下还会出现 iOS 链接点按高亮，表现为闪一下。

## 怎么解决的
见上。安卓壳无需改动：现有 `onBackPressed` 在历史里有「更多」后会 `goBack()`。WebKit / Chromium 手机尺寸验证：更多→查询历史 +1，返回键回到更多且过渡动画照常；子页里点底栏仍是 replace。

## 可能带来的新问题
- 在子页点底栏去别处是替换当前历史项，此后右划会回到「更多」而不是子页（可接受）。
- 刷新后 `pushedFrom` 丢失，返回键退回 replace，历史里多一条「更多」。
- 「闪」的原因按 iOS 点按高亮推断，没有真机复现。

## 关联
2026-10-23-nav-defer-page.md
