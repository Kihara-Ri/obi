# 2026-10-20 · 抽屉里的「打开设置」失效

- **作者**：Claude
- **范围**：`web/src/App.tsx`、`web/src/state/AppContext.ts`、`web/src/components/TwinControls.tsx`、`web/tests/twin-controls.test.mjs`

## 改了什么
编辑专辑 · 数字实体在引擎未安装 / 不可用时的「打开设置」原来是 `<a href="#settings">`：只改了地址栏 hash，抽屉仍盖在页面上，看起来「点了没反应」。
- 新增 `app.closeDrawerAndGo(hash)`：先收起抽屉（表单有未保存修改时先确认），等收起时的历史条目还原完成后再跳转。
- 「打开设置」改为按钮调用它。

## 出现的问题（根因）
抽屉每次打开会往历史里压一条同址条目，收起（`drawerExited`）时用异步的 `history.go(-n)` 还原。直接改 hash 再收抽屉，这次 `history.go` 会把刚做的跳转撤销；而且抽屉在动画期间仍盖着页面。所以必须「先收、再跳」，并挂在 `history.go` 引发的那次 `popstate` 之后。

## 怎么解决的
`App.tsx` 里 `afterExit` / `pendingGo`：`drawerExited` 在有历史条目时把跳转交给紧随其后的 popstate 执行，没有历史条目时直接执行。单测改为断言是按钮、不再是 `href="#settings"`。类型检查、构建、前端 125 项测试通过；iPhone 模拟器用一份拿掉引擎插件的临时数据目录复现并验证：点「打开设置」后抽屉收起并进入「设置与备份」。

## 可能带来的新问题
- 其他抽屉里如果以后再放页面链接，应使用 `closeDrawerAndGo`，不要直接用 `<a href="#…">`（目前代码里只有这一处）。
- 带未保存修改点「打开设置」会先弹「放弃修改」确认，取消则留在抽屉里；未验证该分支的真机表现。
- 未部署。
