# 2026-10-17 · 单元组件重做

- **作者**：Claude
- **范围**：`web/src/components/ui/*` `ShopField` `main.tsx` `styles/{components,drawer,tokens,shelf,layout}.css` `App.tsx`（Toast 与滚轮）`ShelfPage` `TradesPage`

## 改了什么
`ui/` 下 Dropdown / Seg / Switch / Toast / AutoTextarea 改为一组件一目录（组件 + 样式 + 入口）；新增 Combobox、SearchField、`useSlidingThumb`（分段控件滑块与库存下划线共用）；`ShopField` 改用 Combobox；库存页与交易记录页的搜索框换成 SearchField（有清除按钮）；统一滑块时长/缓动 token；Toast 改为组件自己计时（错误停留 6 秒、悬停暂停、点击关闭）；聚焦的数字输入框在滚轮滚动时失焦；新增组件注册表与单元组件的结构测试。

## 出现的问题
Dropdown 键盘 ↑↓ 时高亮不动；Safari/iOS 点外部关不掉浮层；消息提示一律约 3 秒；组件自带 `import './X.css'` 使 node 测试里 `require` 失败。

## 怎么解决的
组件自管键盘高亮、`pointerdown` 外部关闭、按级别计时；`main.tsx` 在页面样式前 `import './components/ui'` 保证组件基础样式先于页面覆盖；测试助手为每个 css 放空占位文件。

## 可能带来的新问题
Combobox 浮层现在相对输入框定位，图标识别提示出现时会被盖住；组件样式提前加载，页面里依赖旧顺序的同级覆盖需视觉回查。

## 关联
I-005
