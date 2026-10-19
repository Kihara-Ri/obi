# 2026-10-19 · 导出改为应用内下载，修复 iOS 无法退出导出页

- **作者**：Claude
- **范围**：`web/src/core/download.ts`（新）、`web/src/components/DownloadButton.tsx`（新）、`web/src/pages/TradesPage.tsx`、`web/src/pages/StatsPage.tsx`、`web/src/pages/settings/DataSettings.tsx`、`server/routes.py`（导出文件名）、`static/assets/`（重新构建）

## 改了什么
- 导出 CSV 与下载完整备份不再是 `<a href="/api/…">` 整页跳转，改为 `DownloadButton`：`fetch` 取回后，移动端走系统分享面板（可“存储到文件”），桌面端走标准下载，全程不离开应用。
- 导出文件名带日期：`albums-YYYYMMDD.csv`、`sales-YYYYMMDD.csv`。

## 出现的问题
- iOS 上点导出，附件直接用“快速查看”盖住整个页面，且在主屏/PWA 模式下没有返回按钮，只能杀掉应用。

## 怎么解决的
- 附件类响应改由 JS 处理，不再触发浏览器导航；失败用 toast 提示，用户取消分享视为成功。

## 可能带来的新问题
- `navigator.share` 文件分享需要 iOS 15+ / 较新的 Android Chrome；不支持时回退到 `<a download>`，在部分 iOS 版本里仍可能打开预览，需真机确认。
- 备份文件名 `album-ledger-backup.json` 仍由前端写死，与服务端保持一致但未动。

## 验证
- `python3 -m unittest discover -s tests`：393 项，OK（1 项跳过）。
- `npm --prefix web run typecheck && npm --prefix web run build`：通过。
- 临时实例 `curl` 检查：三个导出端点的 `Content-Disposition` 正确。
- 未在真机 iOS 上验证分享面板；浏览器 UI 仅做了启动检查，未完整走完导出页面点击流程。

## 关联
- 历史入口：`server/export_csv.py`、`server/routes.py` 的 `api_export`
