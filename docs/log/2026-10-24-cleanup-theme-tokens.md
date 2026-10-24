# 2026-10-24 · 精简：主题 token 去重复、取消多余导出、悬空变量

- **作者**：Claude
- **范围**：`web/src/styles/tokens.css`、`core/stage-expand.ts`、`pages/LookupPage.css`

## 改了什么
1. `tokens.css` 第一段原本还留着一整套深色值（给不认 `light-dark()` 的浏览器兜底），现在主题 token 已有浅色默认 / 系统深色 / 显式深色三段，基线里的这些值成了死代码，删除；同时去掉与之冲突的 `color-scheme:dark`。
2. `stage-expand.ts` 只在文件内用的 `Exit`、`Geometry` 类型不再导出。
3. `LookupPage.css` 引用了从未定义的 `--font-sans`，改用 `--font`。

## 出现的问题
上一次修主题时在原文件上叠加，留下了重复与死值。

## 怎么解决的
脚本核对：被引用的 CSS 变量都有定义（除运行时由脚本写入的内联变量），浅 / 深两段 token 名称完全一致；浏览器里三种状态（跟随系统深色、显式浅、显式深）取值正确。

## 可能带来的新问题
无已知。安卓原生里仍保留的试探性沉浸标志（FLAG_LAYOUT_NO_LIMITS、华为刘海反射与 manifest 声明、两次延迟重申）没有动：删它们需要升次版本，且无法在真机上证明不会让 nova 7 重新出现黑边。
