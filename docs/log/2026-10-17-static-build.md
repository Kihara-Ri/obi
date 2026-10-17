# 2026-10-17 · 重新构建静态资源

- **作者**：Codex 的未提交工作区改动；Claude 整理、验证并提交
- **范围**：`static/assets/*` `static/models/packaging/*`

## 改了什么
按当前源码重新构建 `static/assets/`（含本日 UI 改动与引擎插件接入）；`static/models/packaging/*.glb` 与 `album-scene.js` 删除——模型改随插件包提供。

## 出现的问题
构建产物长期落后于源码（服务端只认 `static/assets/`）。

## 怎么解决的
`npm --prefix web run typecheck && npm --prefix web run build`。

## 可能带来的新问题
构建产物体积大、diff 不可读；以后每次源码变更都要重新构建后一并提交。

## 关联
见同日期其他日志
