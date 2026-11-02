# 2026-11-02 · 按架构复盘做的第一轮优化

- **作者**：Claude
- **范围**：`storage.py`（照片暂存切换、库指纹）、`server/state_sync.py`、`server/context.py`、`server/routes.py`（state 缓存、记录保存的写锁）、`web/src/core/lazy-page.ts`、`web/src/hooks/useShownPage.ts`、`web/src/App.tsx`、`web/src/core/whats-new.ts`、`web/src/components/WhatsNew/WhatsNew.tsx`、`web/vite.config.ts` 与 AGENTS 的缓存注释、新增测试

## 改了什么
落实 [架构与工程复盘](../架构与工程复盘.md) 第 8 节前三项与 P1 写锁：
1. 照片：新照片集合在账本事务提交前完整写入 `data/.photo-swap/<随机>/`（保留的照片硬链接，不支持时复制），提交后两次改名换上；事务或暂存失败即丢弃暂存。目录布局 `photos/<id>/<序号>.<ext>` 不变。
2. `/api/state`：按「库文件头提交计数 + 大小 + mtime、汇率缓存状态、服务信息」作指纹，指纹不变直接复用上一份已序列化的响应（304 与整份都不再调用 `Store.state()`）；仍缺汇率的状态不缓存。缓存挂在 `Services.state_cache`，不是模块级单例。
3. 首屏：`lazyPage` 改为按需下载，切页判断在 `useShownPage`（App 受 ai-kit R10 的 200 行限制）；App 只等当前页 chunk（地址里有页面时与 `/api/state` 并行），首屏后后台预取其余页；切到未到齐的页面时内容停在当前页，到齐再切（底栏照常立即响应）。首屏后加载失败给提示，切到该页时重试。
4. 更新说明：版本没变（或首次）时不再下载 CHANGELOG chunk。
5. `/api/records` 与 `/api/records/metadata` 路由不再整体持锁，只在 `Store.save` 时持 `WRITE_LOCK`；发行版核对联网在锁外，期间被改由 revision 复核拒绝。

## 出现的问题
- 本地工作区曾有照片逐张上传的旧草稿（`storage.py` 从 `server` 包导入，形成循环导入）；远程 v3.13.0 已把它改为根目录模块 `photo_uploads.py`，本次提交变基到 v3.13.0 之上，不再涉及。
- 本次两次 dirty 部署基于未同步远程的本地工作区，曾让线上暂时缺少 v3.13.0 的方形沉浸样式等改动；变基后从干净提交重新部署补回。
- 写测试时发现 `UPDATE … SET data=data` 不会推进 SQLite 的提交计数——内容也没变，不影响缓存正确性。

## 怎么解决的
- 照片没有改成内容寻址文件：那会改数据目录布局并需要迁移已有数据，违反红线 2 的谨慎原则；暂存 + 改名已消除半完成状态。
- 指纹不用 `PRAGMA data_version`（只对同一连接有效）；用文件头第 24 字节的提交计数（回滚日志模式；开 WAL 前须改，见 I-010）。
- 页面分发与 `pageModule` 一一对应，写在同一文件。

## 可能带来的新问题
- 两次改名之间有极短窗口，照片 GET 可能 404 一次；比原来「删目录再逐张写」的窗口小得多。
- 若进程恰在提交后、改名前退出，新照片留在 `data/.photo-swap/`（7 天后清理），记录与 `photos/` 中旧照片不一致，需要手工移回。
- 开启 WAL 后提交计数不再更新，必须同时换指纹来源（I-010 已说明 WAL 前要先改快照方式）。
- 已验证：后端 578 项、前端 174 项、typecheck、build、文档与泄漏检查；固定样本浏览器实测库存 / 在途 / 交易 / 统计 / 展示 / 设置 / 查询切页与 `#settings`、无 hash 首屏，console 零报错；1500 张合成账本 304 由约 26 ms 降到 0.09 ms。未在本机跑 Docker 构建（Docker 未运行）；未做真机 4G 测量。

## 关联
D-018 · D-035 · D-036 · I-010 · 2026-11-02-architecture-review.md
