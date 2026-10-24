# 2026-10-24 · 展示页：触屏按住封面不再抬起

- **作者**：Claude
- **范围**：`web/src/styles/gallery-case.css`、`AGENTS.md`、`CHANGELOG.md`

## 出现的问题
手指碰到展示页的封面时，封面会上浮 4px，看起来发飘。

## 怎么解决的
所有展示布局的封面都经 `.gallery-case-body` 渲染，抬起规则只有这一处；现在只在 `(hover:hover) and (pointer:fine)` 下生效，触屏 / 粗指针不抬。桌面鼠标悬停、键盘聚焦的抬起保留。AGENTS.md 里「悬停/触碰抬起」的偏好描述同步改成仅鼠标 / 键盘。

## 可能带来的新问题
触屏上按住时失去「被按住」的视觉反馈（点击仍会打开灯箱 / 选中）。JS 里的触碰类名 `is-gallery-contact` 仍会加，只是触屏下没有样式。
