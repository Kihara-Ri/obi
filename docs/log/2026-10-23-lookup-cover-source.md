# 2026-10-23 · 查询页封面来源统一（iTunes 优先）+ 修复切页闪烁

- **作者**：Claude
- **范围**：`server/group_covers.py`（新）、`server/routes.py`、`tests/test_text_search.py`、`web/src/pages/AlbumResults.tsx`、`pages/LookupPage.css`、`forms/record/CoverPanel.tsx`、`styles/drawer.css`、`hooks/usePageTransition.ts`、`CHANGELOG.md`

## 改了什么
1. 专辑搜索结果的父级封面：服务端对每个 MusicBrainz 专辑并发做一次 iTunes 关键词搜索（JP→US），标题（album_key）与艺人严格匹配才采用；等待上限 1.2 秒，没赶上的先返回 CAA 地址，后台继续并写入缓存（命中 30 天、查无 1 天，来源出错不缓存）。返回新增 `coverSource`（itunes / caa）。图片不经服务器代理。
2. 前端：父级封面左下角显示来源角标；加载失败或 8 秒未出：iTunes 退回 CAA，CAA 失败显示占位 ♪；子级发行版的备用封面跟随父级当前可用地址。
3. 选封面候选行把 provider 做成小标签，iTunes 与 CAA 候选并列，由用户点选。
4. 切页闪烁：`usePageTransition` 的切页 effect 改为 `useLayoutEffect`。

## 出现的问题
查询页父级封面（CAA release-group，无校验无重试）和子级（自己的 release 封面）各自独立请求，常一边有一边没有。切页闪是上一版 `useDeferredValue` 的副作用：新页提交后 passive effect 在首帧绘制之后才加快照与淡入类。

## 怎么解决的
见上。逐帧采样确认新页内容出现的每一帧都带快照或淡入类，没有裸露帧。

## 可能带来的新问题
- iTunes 首次并发请求可能被限流，此时回退 CAA，后台重试结果下次搜索才体现。
- 父级与子级用的封面仍可能不是同一张（子级优先自己的 CAA 版本图）。

## 关联
2026-10-23-nav-defer-page.md
