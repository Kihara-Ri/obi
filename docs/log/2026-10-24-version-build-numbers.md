# 2026-10-24 · 版本号：构建号随部署走，正式版攒批再打（D-024）

- **作者**：Claude
- **范围**：`AGENTS.md`、`docs/DECISIONS.md`、`tools/update_release.py`、`web/src/core/whats-new.ts`、`tests/test_updates.py`、`web/tests/whats-new.test.mjs`

## 改了什么
日常部署不打 tag、不改版本号，VERSION 用 `git describe` 构建号；正式 tag 只在一批改动做完、真机确认后打。约定写进 AGENTS.md 与 D-024。

## 版本比较核对
- 部署（ship）：只做字符串相等核对，构建号可用。
- 服务器补丁更新器 `choose_patch`：原来已装版本必须是 `vX.Y.Z`，构建号会直接报错 → 改为接受 `vX.Y.Z-N-gHASH[-dirty]`，按基础正式版比较（不会把 v3.8.5 之后的构建「降级」回 v3.8.5）。
- 「更新说明」：本来就按前缀取 `X.Y.Z`，构建号不会触发弹窗；只补注释与测试。
- 安卓 `Updater`：只看 GitHub 正式 Release，已装版本来自安装包 / 内容包 tag，不受影响。

## 可能带来的新问题
未打 tag 的构建到不了安卓手机；真机验证仍要打正式版。频繁需要时再做测试通道（D-024 重新评估条件）。
