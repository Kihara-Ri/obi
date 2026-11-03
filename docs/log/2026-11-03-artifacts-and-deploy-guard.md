# 2026-11-03 · 构建产物移出 git，发布防回退并留源码快照

- **作者**：Claude
- **范围**：`.gitignore`、`web/package.json`（build 先清空 `static/assets`）、`deploy.toml`（`artifacts = []`）、`.github/workflows/ci.yml`（只构建一次）、`tools/deploy.sh`（远程领先即中止、`refs/deploys/*`）；AGENTS / README / 部署说明 / D-010 / D-038

## 出现的问题
- `static/assets` 每次前端改动都要一起提交，diff 与改动统计被产物淹没；CI 构建三次。
- 11-02 从落后于远程的工作树 `--allow-dirty` 发布，回退了远程已上线的 v3.13.0，事后说不清线上是哪份代码。

## 怎么解决的
- 产物不跟踪；`npm run build` 先清空 `static/assets`（`emptyOutDir` 为 false，不清会把旧 chunk 带进发布包）。清空后重建与原提交逐字节一致，没有残留文件。
- CI：`web` 任务构建并上传 `web-build`，后端测试与浏览器验收下载同一份。
- `tools/deploy.sh`：先 `git fetch`，远程有本地没有的提交就中止；用临时索引把实际发出的整棵树写成 `refs/deploys/<时间>`（干净时就是 HEAD），不动真实暂存区。补丁更新器（`DEPLOY_HOST=local` / `PACKAGE_PATH`）不走这两步。

## 可能带来的新问题
- 新 clone 要先构建才能起服务端、跑 `test_web_app`（已写进 README）。
- 历史中的产物仍在 `.git` 里，仓库体积不会变小（不改写历史）。
- CI 改动未在 GitHub 上跑过，推送后需看第一轮结果。

## 验证
清空重建后 `git status static` 无差异；后端 581 项、前端 175 项、文档检查通过；ci.yml 解析出的依赖为 backend / sample-browser → web；`deploy.sh` 语法检查通过，快照逻辑用临时索引演练（真实暂存区不变）。

## 关联
D-010 · D-038
