# 2026-10-19 · 发布脚本 tools/deploy.sh 优化

- **作者**：Claude
- **范围**：`tools/deploy.sh`（重写）、`tests/test_updates.py`（扩充 8 个用例，夹具支持 schema 升级与公网失败）、`部署说明.md`、`docs/DECISIONS.md`（D-010）

## 改了什么
1. 快照轮换：发布成功后只保留最近 `KEEP_SNAPSHOTS`（默认 5）份 `pre-deploy-*.sqlite3`。
2. 回滚按库结构处理：健康检查失败回滚时，若数据库 schema 已被新版本改动，先停服务、恢复发布前快照再启动旧版；手动 `--rollback` 只切代码，schema 与最近快照不一致时给出恢复提示。
3. 发布前预检（仅本机构建）：未提交改动中止（`--allow-dirty`）、未推送警告、默认跑后端与前端测试及类型检查（`--skip-tests`）。
4. 构建后检查 `static/` 与已提交内容一致，否则中止。
5. 可选 `PUBLIC_URL` 公网检查（`/api/health` 版本与 `/sw.js`），失败退出码 3，不回滚。
6. ssh 复用连接（ControlMaster），一次发布只握手一次；结束时关闭。
7. 发布锁记录发起人与时间；被占用时提示持有者，超过 `LOCK_TTL` 提示 `--unlock`，不自动解锁；失败的发布不会删别人的锁。
8. 服务器 `deploy.log` 追加每次发布 / 回滚记录（版本、上一版、schema 变化、快照名）。
9. 个人默认值读 `data/deploy.env`（此后改为 `data/deploy.local.toml`，见 D-011）；`DEPLOY_HOST=local`（补丁更新器）不读、不做预检。

## 出现的问题
- 提示文字里 `$restored）` 这类「变量后紧跟全角字符」会被 macOS bash 并入变量名，把中文字节截断成非法 UTF-8（脚本头部已有此注意事项）。统一改为 `${变量}` 写法，并在测试里按 UTF-8 解码输出，能直接暴露此类问题。

## 可能带来的新问题
- 服务器上现有 40 份旧快照会在下次发布成功后被一次性清理到 5 份（约 518MB → 约 5 份）。若想多留，先在 `data/deploy.env` 写 `KEEP_SNAPSHOTS=<份数>`。
- 补丁更新器以后会运行新脚本（打包进发布包）：`local` 模式、`sudo -n python3` 读 schema 都在夹具里覆盖，但还没有在真实服务器上跑过更新器路径。
- 预检默认跑测试，发布变慢约 1 分钟。

## 验证
- `bash -n` 通过；`python3 -m unittest tests.test_updates`：19 项通过（新增：快照轮换、发布记录、schema 升级失败恢复快照、锁持有者与过期提示及 `--unlock`、公网检查失败退出码 3、未知参数、配置文件、脏工作树预检）。
- 对真实服务器只做了 `--unlock` 烟测（读取 `data/deploy.env` 的主机、复用 ssh 连接、释放不存在的锁，约 0.7 秒）；没有重新发布。
