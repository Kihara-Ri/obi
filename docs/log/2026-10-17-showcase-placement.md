# 2026-10-17 · 展示入口按默认首页偏好放置

- **作者**：Claude
- **范围**：`App.tsx` `components/ShowcaseSwitch.tsx` `pages/{ShelfPage,GalleryPage}.tsx` `styles/layout.css` `AGENTS.md` `README.md` `.impeccable.md` `components/REGISTRY.md`

## 改了什么
展示收藏移出「更多」。默认首页是收藏展示的用户：「展示」是底栏第一个标签；默认首页是收藏管理的用户：底栏保持 4 个，库存页与展示页顶栏中间是「库存｜展示」分段切换（库存标签在两页都高亮）。

## 出现的问题
展示放在「更多」里层级不合理；5 个底栏标签偏多。

## 怎么解决的
以 `homePage(startPage, modules)` 判断；新增 ShowcaseSwitch。

## 可能带来的新问题
切回库存总是进入国内库存；`AGENTS.md` 里原有「不增加底栏标签」的约定已改。

## 关联
见同日期其他日志
