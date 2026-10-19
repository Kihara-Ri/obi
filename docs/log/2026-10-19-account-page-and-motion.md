# 2026-10-19 · 账户页重做、下拉退出动画与动效补充

- **作者**：Claude
- **范围**：`pages/settings/AccountSettings.tsx`（重写）、`pages/settings/PasswordChange.tsx`（新）、`components/ui/Collapse/`（新）、`components/ui/useLeaving.ts`（新）、`Dropdown` / `Combobox`（退出动画）、`Disclosure.css`、`Seg.css`、`Toast.css`、`pagetransition.css`、`pages/settings/AccountSettings.css`、`pages/settings/PasswordChange.css`（新，样式随组件同目录）、`styles/settings.css`、`styles/base.css`、`main.tsx`、`components/REGISTRY.md`、`static/assets/`（重新构建）

## 账户页（设置 → 账户）
- 之前：改密表单常驻、输入框固定 280px 在手机上右侧留白；未满足条件时主按钮是发暗的黄色；「说明」「安装到主屏幕」两处折叠让卡片底部留出大块空白。
- 现在：「登录与安全」卡片以行式入口呈现——「登录密码」一行点开才展开改密表单（`Collapse` 平滑展开），「退出登录」独立一行（红色标题，副标题说明会清除本机封面缓存）。
- 改密表单：整宽（桌面最宽 420px）、可见标签、实时规则提示（至少 12 位 / 两次一致，满足变绿、不一致变红）、「显示密码」开关；规则不满足时按钮为中性灰，满足后才可提交，提交中显示「更改中…」，成功后自动收起并清空。
- 「安装到主屏幕」不再用折叠：已从主屏幕启动（standalone）时整块不显示，否则直接给出一句说明。
- 本机模式（未启用登录）仍只显示「当前为本机模式，未启用登录」。

## 动效
- 下拉 / 组合框列表增加退出动画（`useLeaving` + `menu-out`，120ms），向上展开的反向。
- `Disclosure`：支持 `::details-content` 的浏览器里高度平滑展开 / 收起，其余浏览器保留淡入。
- 触屏按下反馈（`@media (hover:none)`）：列表行、导航行、账户行、菜单项按下时给一层底色，没有位移（遵守「按钮没有全局按下位移」）。
- Seg 文字色、页面切换时长与缓动、Toast 进出场改用动效令牌（页面切换数值不变，视觉零变化）；Toast 退出时轻微缩小。

## 没有做
- 页面切换的「左右并排带子」结构、桌面不播切换动画、展示布局的轨道/吸附动效，属于 AGENTS.md 里用户已定案的行为，没有改动；如需给桌面页面切换加淡入，需要先确认。

## 验证
- 类型检查、构建通过；`web/tests/ui-components.test.mjs` 通过。
- 本地用测试密码启用登录后，在手机视口走通账户页：展开改密、规则提示变色、按钮启用、显示密码；桌面视口表单宽度 420px。
- 下拉：打开后关闭，列表经 `is-leaving`（`menu-out`）再隐藏。
- 控制台无错误。内置浏览器空闲时动画不推进，中间帧未逐帧采样。
