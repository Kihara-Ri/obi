# 第一个公开正式版 v3.0.0：内部改名、许可证、历史清理

- **作者**：Claude
- **范围**：全仓库 `diedu` → `obi`（`deploy/`、`deploy.toml`、`docker-compose.yml`、CI、`tools/`、`server/`、`static/local/`、`web/`、文档）、`LICENSE`、`README.md`、`部署说明.md`、`tools/check-data-leak.sh`、`web/tests/browser/listing-acceptance.mjs`、git 历史

## 改了什么
- 内部标识统一为 obi，库存视图偏好从旧键迁移；systemd 单元改名为 `obi.service` / `obi-update.*`。
- 加 AGPL-3.0 `LICENSE`；README 把 3D 段落归到「3D 实体（可选插件）」，删掉已移除 skill 的引用，补许可证。
- 部署说明：修正「已移除视觉模型」与售卖照片识别的矛盾、去掉空的「闲鱼试验工具」节、skill 位置改为插件内，新增「从旧名迁移」。
- 修复 CI 红：售卖识别设置改版（D-013）后 `listing-acceptance.mjs` 还在找旧的服务商下拉框，改成列表 + 详情页流程。
- 泄漏扫描的个人身份串移到 `data/leak-patterns.txt` / CI secret；改写 git 历史（D-020）。

## 出现的问题
- 数据协议 schema 的 `$id` 改了以后 7 个契约测试失败：它参与和引擎共享的契约哈希。已改回。
- 浏览器验收第一次失败是上一轮留下的旧预览服务器占着 63282 端口，测到了别的实例；停掉后通过。
- 公开前扫历史发现：基线提交里有个人域名（09-30 当天已清理但留在历史）、服务器别名、`/home/<用户>`、含 12 条真实成交单号的 `import_xianyu_sales.py`、含收藏清单的封面整理脚本；泄漏扫描脚本本身把这些身份串写成了正则。

## 怎么解决的
- 历史用 git filter-repo 删路径 + 替换文本，用户选择保留作者邮箱。
- 被放弃的方案：另开只有一个提交的新仓库（会丢 v2.x Release 与提交历史）。

## 可能带来的新问题
- 提交哈希全变；本地其他克隆需重新克隆。
- 线上服务器从 `/opt/diedu` 迁到 `/opt/obi`（运行用户 `diedu` 改名为 `obi`），迁移步骤见部署说明。
- `@diedu/album-engine` 包名仍是旧名，需在 Album Engine 项目里改。
- 已验证：后端 465 测试、前端 144 测试、typecheck、build、固定样本浏览器验收、售卖识别浏览器验收。

## 关联
D-020 · D-013
