# 2026-10-21 · 删除宿主内的旧生成管线；镜像与补丁包共用一份文件清单

- **作者**：Claude
- **范围**：vendor/album_engine/（整目录）、server/twin_*.py、server/digital_twins.py、server/artwork_fallback.py、server/album_engine_adapter.py、server/engine_plugins.py、server/routes.py、storage.py、twins.py、Dockerfile、tools/package_app.py、tools/update_release.py、tools/seed_samples.py、tests/、README.md、AGENTS.md、部署说明.md、docs/DECISIONS.md、docs/PI_SHOP_BRANDS.md

## 改了什么
- **旧生成管线（D-017）**：
  - 删除 ~~`vendor/album_engine/`~~（23 个文件）。
  - 删除 7 个兼容模块：`server/digital_twins.py`，以及 `twin_sources / twin_surfaces / twin_assembly / twin_guided / twin_errors`、`artwork_fallback`。
  - 删除 storage 的 `select_twin_art`、`set_twin_spine_surface`，以及 `RuntimeFacade.cancel`。
  - `check_engine_installation` 不再有「没装插件时检查 vendored 副本」分支。
- **接口**：删掉无调用方的 `/api/catalog/artwork`、`/api/twins/spine`。
- **I-007**：`/api/twin-source-preview/` 从精确匹配表移到前缀表，附件编辑器的发行版参考图恢复显示。
- **文件清单（I-006）**：
  - Dockerfile 改为 `COPY *.py ./`。
  - `tools/package_app.py` 抽出 `manifest()`，根目录 `*.py` 一律视为运行时模块，与镜像同一口径。
  - 新增 `tests/test_runtime_manifest.py`，按 Dockerfile 的 COPY 清单搭出镜像目录并 `import app`。
- **I-009**：补丁更新器的 `PACKAGE_ROOTS` 补上 `vendor`、`plugins`。

## 出现的问题
- 原计划一并删除 `/api/twin-review-assets/` 和 storage 的任务协议方法。核对插件 0.3.0 的 `ports.py` 后发现，`TaskPort` 要求宿主实现 `review_asset_url`、`claim_twin`、`write_twin_source` 等方法，`review_asset_url` 返回的就是这个接口的地址，因此保留。
- 改写 `test_updates` 时发现 I-009：自 fe68191 起，补丁包含 `vendor/`、`plugins/`，而服务器上的更新器白名单没有这两项，会拒收整包，裸机自动更新实际一直失败。
- 起初把决策编号写成 D-015，与已有条目冲突，改为 D-017。

## 怎么解决的
- **测试**：
  - `test_digital_twins` 原先靠旧引擎跑完生成，现改用 `Publisher` 替身。替身只调用 TaskAdapter 暴露的事务（领取 → 发布），存储事务、权限与路由断言保留。
  - 引擎逻辑的测试随旧引擎删除，插件包有自己的测试。
  - 新增一条用真实插件包跑 `update_accessories` 的测试，覆盖生产上仍可达的编辑路径。
- **样本工具**：`tools/seed_samples.py` 改从 `vendor/album_data` 取数据编解码（与旧副本逐字节相同，已 `cmp` 验证，样本输出不变），不再生成 `sample-catalog-artwork.json`。

## 可能带来的新问题
- 服务器上已部署的旧更新器仍按旧白名单拒收补丁包，需要手动发布一次（`tools/deploy.sh`）把新更新器带上去，之后自动更新才恢复。
- 本机没有 Docker，`docker compose build` 未实测。已用 `tests/test_runtime_manifest.py` 按 COPY 清单模拟镜像目录并成功 `import app`。
- 已验证：`python3 -m unittest discover -s tests` 全部通过；`tools/check_docs.py` 0 处问题。

## 关联
D-004 · D-005 · D-017 · I-006 · I-007 · I-009 · 2026-10-21-dead-code-sweep.md
