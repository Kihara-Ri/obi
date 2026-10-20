# 2026-10-19 · 应用内文件下载（未完成，工作区快照）

- **作者**：未知。这些改动不是本会话做的，于 2026-10-19 13:27 起出现在工作区，尚未提交。
- **范围**：`server/routes.py`、`web/src/pages/StatsPage.tsx`、`web/src/pages/TradesPage.tsx`、`web/src/pages/settings/DataSettings.tsx`、`web/src/components/DownloadButton.tsx`（新，未跟踪）、`web/src/core/download.ts`（新，未跟踪）

## 改了什么
- 把账本、交易、设置里的导出与备份链接（`<a href="/api/…">`）改为 `DownloadButton`，经 `fetch` 取回后用系统分享或标准下载保存，避免 iOS 快速查看覆盖页面。
- `server/routes.py`：导出文件名带当天日期（`albums-YYYYMMDD.csv`、`sales-YYYYMMDD.csv`）。

## 出现的问题
- 改动仍在工作区，未提交，未经本会话验证。
- 页面中的导出按钮文案与样式沿用旧 `link-button` 类名，尚未在移动端或桌面端核对视觉。

## 怎么解决的
本条目只记录现状，未修改这些改动。待作者确认后，应补上真正的作者、验证结果，并把新文件纳入提交。

## 可能带来的新问题
- `DownloadButton` 的 `ariaLabel` 等新属性与旧 `<a>` 的行为（如右键另存为）不完全一致。
- 备份文件名 `album-ledger-backup.json` 写死在前端，与服务端 `/api/backup` 的命名可能不同步。
- 工作区里若还有其他未提交改动，合并前需逐一确认归属。
