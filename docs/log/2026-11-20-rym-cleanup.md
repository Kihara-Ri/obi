# 2026-11-20 · 清理 RateYourMusic（RYM）残留

- **作者**：Claude
- **范围**：
  - 代码：`storage.py`、`server/http.py`、`server/routes.py`
  - 测试：`tests/test_ledger.py`、`tests/test_artists_storage.py`、`tests/test_web_app.py`
  - 文档：`docs/界面与功能定案.md`、`使用说明.md`

## 改了什么
- RYM 直达的前端和接口在 2026-10-03 就已退役。这次清掉剩下的部分：
  - **历史数据**：账本 `meta` 表里的 `rym-links`（艺人链接）和 `rym-token`（书签令牌）。启动迁移时删除这两项（幂等，每次启动都会执行）；恢复旧备份时也丢弃这两项。
  - **跨站豁免**：书签当年要跨站写数据，为此留了一个豁免管线：`trusted(allow_cross_site)` 参数和一个空的 `CROSS_SITE_POST` 集合。两者都删除，所有写接口一律做 Origin 校验。
  - **text/plain 入口**：当年为书签的 no-cors fetch 开放了 `text/plain` 请求。现在 JSON 写接口只收 `application/json`，跨站表单和 no-cors fetch 这类简单请求一律返回 415，CSRF 面更小。
- 测试改为验证三件事：RYM 键被清除、旧备份里的 RYM 键被丢弃、`text/plain` 写请求返回 415。旧接口的 404 断言删除。

## 出现的问题
- 用户确认 RYM 反爬太严，不会再用，要求把残留清理干净，包括历史数据。

## 怎么验证的
- 后端测试全部通过，包括新的清除断言和 415 断言。
- 前端单测、浏览器验收通过。前端所有写请求本来就发 `application/json`，不受影响。

## 可能带来的新问题
- 清除前的数据库快照（部署时自动保留）里仍有旧的 RYM 值，但 app 里没有入口能把它们恢复回来。
- 如果有外部脚本用 `text/plain` 调写接口，以后会收到 415。目前项目里没有这样的调用方。
- 复盘、决策记录和 CHANGELOG 里提到 RYM 的内容属于历史记录，保留不动。
