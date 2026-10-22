# 2026-10-21 · SQLite 连接用完即关；插件空闲轮询不再占写锁

- **作者**：Claude
- **范围**：storage.py、app.py、server/routes.py、server/artists.py、server/shop_brands.py、server/starter_albums.py、server/listing_photos.py、tools/seed_samples.py

## 改了什么
- **I-008**：
  - 原先 `with x.connect() as db:` 只负责提交或回滚，不关闭连接，共 42 处（storage 25、server 12、app.py 2、样本工具 3）。
  - 现统一为 `with closing(x.connect()) as db, db:`，提交或回滚后立刻关闭连接。
  - 只读的 `require_module` 用 `closing(...)`。
- **插件空闲轮询**：
  - 原先插件 worker 每 2 秒调一次 `claim_twin`，每次都要 `BEGIN IMMEDIATE` 拿写锁。
  - 现在先只读看一眼有没有 queued 或 running 的任务，没有就直接返回，不占写锁。

## 出现的问题
- 原计划顺带开启 WAL。没开，原因如下：
  - 发布脚本（ai-kit ship）的发布前快照和回滚，都是直接 `cp data/albums.sqlite3`。
  - WAL 模式下已提交的数据可能还在 `-wal` 文件里，快照会漏掉这部分。
  - 回滚时如果只覆盖主文件、留下旧的 `-wal`，库可能损坏。
- busy_timeout 已经是 10 秒（`sqlite3.connect(..., timeout=10)`），不用再设。

## 怎么解决的
- **closing 的写法**：外层 `closing` 负责关闭，内层 `db` 负责事务，与 storage 里原有的 22 处写法一致。逐个确认了改动的块在退出后不再使用 `db`，也没有把游标带出块外。
- **claim_twin 的快速路径**：先读后写，没有竞态问题。读到有任务后，仍在 `BEGIN IMMEDIATE` 里重新读注册表再领取；读到没有任务就返回 None，与原先结果相同。

## 可能带来的新问题
- 每次请求都新建连接（原来也是），只是关闭得更早，没有性能退化。
- 测试代码里还有约 26 处直接 `store.connect()`，属于测试自身，不影响运行时，这次没改。
- 开 WAL 需要先让 ship 的快照改用 `sqlite3` 备份 API（或在快照前做 checkpoint）。ship 由 ai-kit 管理（D-007），记入 KNOWN-ISSUES，不在本项目里改。
- 已验证：`python3 -m unittest discover -s tests` 全部通过。带 `-W always::ResourceWarning` 运行时，剩余的 `unclosed database` 警告都来自测试文件里的直接连接。

## 关联
I-008 · I-010 · D-007
