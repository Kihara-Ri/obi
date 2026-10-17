# 2026-10-17 · 去掉按钮按下位移

- **作者**：Claude
- **范围**：`styles/components.css` `styles/gallery-focus.css` `AGENTS.md`

## 改了什么
删除全局 `button:active{transform:translateY(1px)}` 与展示灯箱箭头的按下位移，并去掉按钮 transition 里的 transform。

## 出现的问题
每个按钮按下都会上下抖一下，界面发飘。

## 怎么解决的
直接删除；确需按压反馈的个别按钮自己加并说明理由（写入 `AGENTS.md`）。

## 可能带来的新问题
按下的视觉反馈只剩悬停底色。

## 关联
见同日期其他日志
