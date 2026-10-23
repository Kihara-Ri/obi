# 2026-10-23 · 换封面后保存一直转圈：封面不再绕手机往返

- **作者**：Claude
- **范围**：`server/routes.py`、`web/src/forms/record/releaseCover.ts`、`tests/test_barcode_lookup.py`

## 改了什么
`/api/covers/download` 下载封面后立即按内容哈希落盘，在请求带 `stash: true` 时返回 `/api/cover/<哈希>.<ext>` 短引用而不是 base64 data URL；`/api/catalog/front-cover` 同理用 `?stash=1`。默认行为不变。前端只在服务器模式（`!isLocalSite()`）带这个选项。保存载荷里的封面因此只是一条短引用（`stash_cover` 对非 data URL 原样放行）。

## 出现的问题
手机（4G）编辑专辑换封面后，「保存修改」转圈很久。

## 怎么解决的
原流程：服务端下载封面（最大 2MB，base64 约 2.7MB）→ 整张下发到手机 → 保存时手机再把这 2.7MB 原样上传。上行带宽慢，卡在最后一次上传。现在图只在服务端与图源之间走一次，手机侧只加载预览。服务端写库本身约 10ms，已实测排除。

## 本机模式（安卓）
本机模式下封面下载在 net 引擎（`/netdata`）、账本在 main 引擎（`/data`），文件系统不共享，落盘会让 `/api/cover/…` 404、保存后封面丢失——所以本机模式不带 stash，维持 data URL。且本机模式没有网络上传这一跳（图在设备内存里传），原本就没有此问题。首版曾无条件落盘，已在合入前纠正。

## 可能带来的新问题
- 选中过却没保存的封面会在 `data/covers/` 留孤儿文件（与此前换封面遗留旧文件同类，无 GC）。
- 仅跑了后端全量测试与前端 typecheck/build，未在手机真机验证。
