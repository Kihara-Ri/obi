# 2026-10-17 · 对齐 ai-kit 套件；清理过时计划与设计稿

- **作者**：Claude
- **范围**：`.gitignore`；删除 `docs/superpowers/`（11 份）与 8 份过时设计稿；`AI开发复盘.md`、`docs/3D附件装配与引擎解耦.md`、`docs/CHATGPT_PROJECT_CONTEXT.md` 去掉失效链接；`docs/DECISIONS.md`（D-007）

## 改了什么
- 拉取 GitHub `Kihara-Ri/ai-kit` 最新 main 对比项目内套件：`rules.md`、全部钩子（除 `check-hygiene.sh`）、`pre-commit`、`settings.json` 一致，无需改动。
- `.gitignore` 追加套件 R12 条目，未加 `*.zip` `*.tar` `*.gz`（会隐藏插件 ZIP 与引擎 tarball）。
- 删除过时计划与设计：`docs/superpowers/`（plans / specs / reports）；`艺人资料与作品目录实现方案`、`艺人界面与入口改版方案`、`艺人改版验收记录`、`专辑数字孪生自动化方案`、`数字实体管线解耦`、`3D灯箱视口与取放动画`、`album-entities-and-favorites`、`album-metal-pbr`。
- 修复指向已删文档的失效链接（三处）。

## 出现的问题
- 项目内套件 `VERSION` 为 0.2.1，GitHub main 为 0.2.0；`check-hygiene.sh` 与 `config.sh` 有项目专属修改（`HYGIENE_ALLOW`、路径）。直接覆盖会丢失大文件例外。
- `vendor/album_engine/skill/agents/openai.yaml` 是"agent"定义，但属于引擎项目的生成物，并被 `runtime-manifest.json` 按哈希引用，本仓库不可手改。

## 怎么解决的
- 不覆盖项目定制的钩子与配置，只对齐规则与依赖项；版本号保留本地 0.2.1，不伪造上游版本。
- 生成物 `openai.yaml` 留在原处，需在 Album Engine 项目里删除并重新生成清单。

## 可能带来的新问题
- 历史计划与设计稿仅在 git 历史中可取回。
- 若后续要求 `*.zip`/`*.tar`/`*.gz` 也全部忽略，需先把插件与引擎制品排除在外。

## 验证
- `python3 -m unittest discover -s tests`：392 项，1 项跳过，其余通过。
- 仓库内无指向 `docs/superpowers` 的残留引用（`grep` 确认）。

## 关联
D-007、D-004（制品例外）、D-001（legacy 白名单）
