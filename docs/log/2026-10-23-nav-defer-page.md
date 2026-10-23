# 2026-10-23 · 底栏先响应、换页渲染延后

- **作者**：Claude
- **范围**：`App.tsx`、`components/AppNav.tsx`、`styles/layout.css`、`CHANGELOG.md`

## 改了什么
App 里 `livePage`（随路由即时变化，给底栏 / 侧栏用）与 `page = useDeferredValue(livePage)`（给页面内容、过渡逻辑用）分开：点底栏时导航和胶囊先响应，重的换页渲染在后台完成再提交。底栏胶囊滑动期间（450ms）加 `.is-moving` 暂时关掉 backdrop-filter（底色本就 92% 不透明）。「路由规范化」那个 effect 改用 `livePage`，避免 deferred 值落后于路由时被误判改写 hash。

## 出现的问题
用户要求继续优化底栏切换速度：点击后克隆旧页、挂新页、播动画同挤一帧。

## 怎么解决的
见上；usePageTransition 仍按 `page` 变化抓快照 / 播过渡——快照在 hashchange 同步抓取，旧页在新页提交前一直在屏上，所以不受延后影响。

## 可能带来的新问题
点击到页面内容换掉之间多出一拍（取决于渲染耗时），期间旧页仍显示；仅 Playwright 验证（146 个单测通过、切页逻辑与重定向正常），未真机验证。

## 关联
2026-10-23-nav-pill-transform.md
