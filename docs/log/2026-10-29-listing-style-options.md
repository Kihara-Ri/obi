# 2026-10-29 · 自定义文案风格改成选项式

- **作者**：Claude
- **范围**：`web/src/core/listing-style.ts`（新）、`ListingPreferences`、`core/listing.ts`、`domain_listing.py`（`options` 白名单、内置风格带选项）、`tests/test_listing_generation.py`、`tests/browser/listing-acceptance.mjs`、使用说明 / AGENTS / REGISTRY / CHANGELOG

## 改了什么
用户反馈「风格名称 + 写作要求」让人从零写语气、篇幅、结构这类抽象提示词不实用。按确认的方案（保留一行其他要求、只留一套「我的风格」）改成选项：
- 语气 / 篇幅 / 排版 / 标题写法四组分段选择；列出曲目、品相与附件单独成段、少量表情符号三个开关；选填一行固定结尾、一行其他要求；下方显示「会告诉模型：…」。
- 前端 `composeInstructions` 拼成原有的 `instructions` 文本，写作与候选/生成快照逻辑不变；选项值随风格保存（`options`），只用于回显。
- 内置风格显示选项概述，可「以此为基础，做我的风格」。名称固定「我的风格」，不再命名、不再多套管理。
- 旧的自由文本风格保持可选可用；打开编辑时选项留空、原文字放进「其他要求」，保存后才改写。

## 出现的问题
无。

## 怎么解决的
后端只在 `clean_preferences` 里对 `options` 做键白名单、长度限制，布尔项只认真正的 `True`，不改写作链路。被放弃的方案：把选项直接传给模型（会让快照与哈希逻辑跟着变）。

## 可能带来的新问题
- 「固定结尾」「其他要求」仍是用户自己的文字，进入 instructions 后受写作提示里「不得新增无依据承诺」约束，但内容本身不做校验。
- 选项文案（如「约 150 字内」）是我定的默认措辞，真机上看生成效果后可能要调。
- 已验证：后端 listing 测试 9 项通过（含 options 往返与白名单），前端构建、浏览器 390 宽布局与新建流程；`listing-acceptance.mjs` 预设步骤已改新流程并通过，但脚本后半段依赖联网照片没跑到。

## 关联
2026-10-28-listing-copy-check-settings.md · D-032
