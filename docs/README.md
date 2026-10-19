# 治理文档索引

本目录只放三类长期文档：**规范**（决定怎么做）、**契约**（协议与边界，随代码同步更新）、**运维说明**（如何验证与操作）。
阶段性计划、实现方案与设计稿在完成或被替代后删除，历史只留在 git 历史和 [日志](log/) 中。

每份文档必须在下表登记；`tools/check_docs.py` 校验登记完整、链接有效、引用的路径与 D-/I- 编号存在。

| 文档 | 类别 | 作用 | 维护入口 |
| --- | --- | --- | --- |
| [../AGENTS.md](../AGENTS.md) | 规范 | 所有 AI 与人必读的红线、架构规则与 UI 定案 | 改动需同时更新 DECISIONS |
| [../.ai-kit/rules.md](../.ai-kit/rules.md) | 规范 | ai-kit 12 条铁律（来自上游套件） | 随套件升级，项目取舍见 DECISIONS |
| [DECISIONS.md](DECISIONS.md) | 规范 | 只增不删的决策记录（D-编号） | 新决策追加，废弃则标「已废弃」 |
| [KNOWN-ISSUES.md](KNOWN-ISSUES.md) | 规范 | 已发现未修的问题（I-编号） | 解决后标「已解决」并写日志名 |
| [模块扩展指南.md](模块扩展指南.md) | 契约 | 新模块、收藏展示、包装结构的契约与验收入口 | 随功能变化更新 |
| [AlbumEngine插件.md](AlbumEngine插件.md) | 契约 | Album Engine 插件协议、安装与持久化 | 引擎版本变化时更新 |
| [3D附件装配与引擎解耦.md](3D附件装配与引擎解耦.md) | 契约 | 当前 3D 附件装配与引擎归属边界 | 引擎 schema 变化时更新 |
| [固定样本真实贴图.md](固定样本真实贴图.md) | 运维说明 | 固定开发样本库的获取、离线启动与备份 | 样本或素材锁变化时更新 |
| [PI_SHOP_BRANDS.md](PI_SHOP_BRANDS.md) | 运维说明 | 购买渠道图标的 Pi CLI 补全机制 | 机制变化时更新 |
| [../.impeccable.md](../.impeccable.md) | 规范 | 设计理念与交互原则（浅深主题、触屏展示、减少误操作） | 设计决策变化时同步 |
| [../web/src/components/REGISTRY.md](../web/src/components/REGISTRY.md) | 规范 | 组件注册表：新建 UI 前先查、新组件先登记 | 新增组件时同步 |
| [../web/tests/browser/README.md](../web/tests/browser/README.md) | 运维说明 | 浏览器验收脚本的运行方式 | 脚本变化时同步 |
| [log/](log/) | 记录 | 每次改动的日志（改了什么、问题、解决、新风险） | 每次代码改动新增一份 |
