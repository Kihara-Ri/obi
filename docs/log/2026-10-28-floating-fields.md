# 2026-10-28 · 抽屉里的文字输入统一走聚焦输入层

- **作者**：Claude
- **范围**：`components/ui/FocusInput/`（`FocusInput` 扩展多行等属性，新增 `useFloatingFields`）、`components/ui/Drawer.tsx`（接入并删除键盘避让）、`styles/drawer.css`、AGENTS / REGISTRY / CHANGELOG

## 现象
用户录屏（iPhone 主屏幕 PWA）：点抽屉里任意输入框，画面先上移露出输入框，随即抽屉被拉回、输入框落到键盘下；之后抽屉又被顶下一截、顶上空一块。所有表单都有。

## 原因
`Drawer` 在键盘弹出且 `visualViewport.offsetTop>0` 时把 `#panel` 整层 `translateY(offsetTop)`。WebKit 平移可视视口是为了露出输入框，这层平移把它原样抵消；WebKit 再平移、代码再抵消，超调即「顶上空一块」。`reveal()` 用 `offsetTop + height` 判断可视区，在平移过的面板上与屏幕对不上，误判可见而不滚动。2026-10-21-drawer-offset.md 只把平移限制到「有键盘时」。

## 改了什么（用户定案：点输入框时单独抽出来聚焦）
- 先试过「去掉平移 + 聚焦瞬间按预估键盘高度滚动」并部署，用户否决，已整体撤回。
- `useFloatingFields`：手机 sheet 上在抽屉根节点捕获 `touchstart/touchend`（轻点才拦，滑动放行）、`mousedown`、`focusin`（label / Tab / 程序聚焦兜底），原框不拿焦点，`flushSync` 打开 `FocusInput` 并同步聚焦（iOS 只在手势内弹键盘）。输入经原生 value setter + `input` 事件实时写回，React `onChange` 照常；取消还原；单行回车转发 keydown 给原框。标题取 label[for] / 包裹 label / aria-label / placeholder。媒体查询每次点按实时判断。
- 不接管：只读 / 禁用、非文字类型（勾选、单选、文件、日期等）、已自带浮层的框（只读实现）、`data-native-input`。
- `FocusInput`：新增 `multiline`（AutoTextarea，最高 8 行，回车换行）、`type`（password 等）、`maxLength`、`onEnter`；聚焦改到 layout effect。
- `Drawer`：删除 `translateY(offsetTop)`、`--kb`、`reveal` 及聚焦监听，只保留文档滚动锁；浮层经 portal 冒泡的按键不再进抽屉的 Esc / Tab 处理。`drawer.css` 去掉 `--kb` 相关规则。

## 验证
`typecheck`、`build`、前端单测 163 项通过。内置浏览器 375×812：「记录售出 → 订单号」浮层出现、标题「订单号」、实时写回、「完成」保留、「取消」还原、抽屉内容不滚动；「备注」走多行、回车换行；Esc 只关浮层不关抽屉；1024 宽下原生输入不受影响。**iOS 真机 / 主屏幕 PWA 未验**（模拟器工具不稳定），需用户在手机上确认键盘能在点按时弹出。

## 可能带来的新问题
- 不能用键盘 ▲▼ 在字段间跳。
- 依赖「输入时校验」的框只在写回时触发 `input`，不触发 `blur` / `change`；目前抽屉内没有依赖 onBlur 的字段。
- 边打字边出结果的框（展示组成员搜索、艺人搜索）结果在浮层背后，点「完成」后可见。
- 长文（售卖正文）在浮层里最多显示 8 行，超出内部滚动。

## 关联
2026-10-21-drawer-offset.md · 2026-10-21-keyboard-sheet.md · 2026-10-23-amount-floating-input.md
