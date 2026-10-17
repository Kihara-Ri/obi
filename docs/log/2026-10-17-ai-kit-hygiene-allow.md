# 2026-10-17 · ai-kit 0.2.1：随产品发布的大文件例外

- **作者**：Codex 的未提交工作区改动；Claude 整理、验证并提交
- **范围**：`.ai-kit/config.sh` `.ai-kit/hooks/check-hygiene.sh` `.ai-kit/VERSION`

## 改了什么
`check-hygiene.sh` 支持 `HYGIENE_ALLOW`；本项目把官方插件目录 `plugins/album-engine/` 与 `web/vendor/*.tgz` 列为 R12（大文件/压缩包）例外。

## 出现的问题
官方插件 ZIP（13 MB）与引擎 tarball 是随产品发布的制品，被 R12「不提交大文件与压缩包」拦下。

## 怎么解决的
在配置里按路径列例外，而不是 `--no-verify`（那会连数据泄漏扫描一起绕过）。

## 可能带来的新问题
例外列表需要随制品目录变化维护；ai-kit 仓库的 v0.2.1 已在本机提交并打 tag，尚未推送。

## 关联
见同日期其他日志
