# 2026-10-17 · 插件验收脚本跟随设置页分段标签

- **作者**：Claude
- **范围**：`web/tests/browser/engine-plugin-acceptance.mjs`

## 改了什么
验收脚本打开设置后先点「高级」标签再找 Album Engine 区块。

## 出现的问题
设置页改为分段标签后，引擎区块在「高级」里，脚本等不到该区块而超时。

## 怎么解决的
新增 `openAdvanced`，两处进入设置的位置都先切到「高级」。

## 可能带来的新问题
无。已对隔离的离线样本实例完整跑过四段（full-ui / uninstall-while-viewing / after-restart / reinstall-view）、展示验收、折叠纸张与 OBI 验收，均无错误与失败请求。

## 关联
D-004
