# 2026-10-21 · 全项目审查：清理无引用的旧代码与样式

- **作者**：Claude
- **范围**：web/src（组件、core、types、9 个样式文件）、server/routes.py、server/skills/、tools/、tests/、.dockerignore、tools/package_app.py、docs/模块扩展指南.md、.ai-kit/legacy.txt

## 改了什么
删掉宿主源码、插件包和测试都不引用的旧代码，行为与界面不变：
- 前端文件：`components/PackagingEditor.tsx`（自 6e2b4ad 起无人引用）及其样式 `styles/packaging-editor.css`；`core/album-spine-fit.ts`（自 47a689a 起无人引用）。
- 前端导出：`release-text.ts` 的 `listingText`、`types.ts` 的 `STATUS_NAMES`，均无调用方。
- 死样式：
  - `digital-twins.css` 中旧生成面板的 `twin-start / cancel / barcode / input-actions / edition* / release-* / artwork* / tracks / change-barcode`。
  - `drawer.css` 中的 `drawer-page-ghost`、标题 `is-forward / is-back` 及其 keyframes、`cur-static`、`switch-*`、`batch-*`（保留 `batch-photos`）、`detail-footer-stack`、`record-copy-edition-grid`、`record-twin-entry`、`record-detail-actions`。
  - 其他文件：`settings.css` 的 `module-option(s)` 和 `settings-optional*`，`components.css` 的 `ok-pill`，`shelf.css` 的 `domestic-b` 和 `card-storage`，`sales.css` 和 `shipments.css` 的 `sa-price`，`rcc-cover`，`PhotoDownload.css` 的 `section-head`。
- 后端：`server/skills/album-digital-twin/`（脚本只是 exec 旧 `vendor/album_engine` 的文件，镜像里不存在；插件包自带 skill）及其测试 `test_album_digital_twin_skill.py`；`package_app.py` 与 `.dockerignore` 里对应的条目。
- 工具：一次性包装迁移修复脚本 `rebind_packaging_twins.py`、`reconcile_packaging_migration.py`、`audit_packaging_twins.py`（无文档、无测试、无引用）。
- `routes.api_release_front_cover` 里重复的 `import base64`。

## 出现的问题
- 插件包 0.3.0 的 bundle 仍使用宿主的 `twin-error`、`twin-generate-actions`，这两条保留。
- `.sale-album>div:not(.thumb):not(.sa-price)` 里的 `:not(.sa-price)` 没有删：删掉会改变选择器优先级，有改变层叠结果的风险。
- 审查中发现 3 个问题，按 R9 只记录不修：I-006（Docker 镜像缺 `kana.py`）、I-007（`twin-source-preview` 路由 404）、I-008（SQLite 连接未关闭）。

## 怎么解决的
- 判定无引用的方法：逐个类名在 `web/src`（排除 CSS）、`static/*.js`、`index.html`、`vendor/`、解包后的插件 bundle 里全文检索。动态拼接的类（如 `is-${phase}`、theme.js 用的 `theme-fade`）一律保留。
- 生成管线（`vendor/album_engine`、`server/twin_*` 兼容层、storage 的生成方法、TaskAdapter）这次不动。插件 runtime 的 TaskAdapter 合同依赖它，`test_digital_twins` 也在覆盖生产存储路径，需要先单独规划。

## 可能带来的新问题
无已知隐患。已验证：
- `python3 -m unittest discover -s tests`：477 OK（原 478 个，少的 1 个是删掉的 skill 测试）。
- `npm --prefix web run typecheck && build`：通过，index.css 225KB → 219KB。
- `npm --prefix web test`：140/140。
- `tools/check_docs.py`：0 处问题。
- 本机没有 Docker，按 Dockerfile 的 COPY 清单模拟镜像目录并 `import app`：去掉 skills 不影响镜像；同时实测到 I-006。
- 未做浏览器目检：删掉的都是无元素命中的规则。

## 关联
D-004 · D-005 · I-006 · I-007 · I-008
