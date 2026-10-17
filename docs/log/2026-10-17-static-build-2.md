# 2026-10-17 · 重新构建静态资源（数字实体一栏收尾后）

- **作者**：Claude
- **范围**：`static/assets/*`

## 改了什么
按当前源码重新构建 `static/assets/`。

## 出现的问题
构建产物需要与源码同步，服务端只认 `static/assets/`。

## 怎么解决的
`npm --prefix web run typecheck && npm --prefix web run build`。

## 可能带来的新问题
构建产物 diff 不可读。

## 关联
D-005
