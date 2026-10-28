# 2026-10-28 · 安卓本机模式接入售卖照片识别（原生回环中继）

- **作者**：OpenCode agent（DeepSeek V4.1 Flash）
- **范围**：`android/`（ModelRelay、RelayHttp、MainActivity、Manifest、network security config）、`server/local_entry.py`、`server/listing_analysis.py`、`static/local/`、`web/src/components/ListingSettings/`、D-030。

## 改了什么

安卓安装包新增只监听 `127.0.0.1` 的模型回环中继，绕过 OpenCode 不返回 CORS 头的限制；本机模式在检测到中继时组装售卖辅助（只开放 OpenCode / DeepSeek 密钥通道），`ListingAnalysis(inline=True)` 在请求内执行。设置页隐藏 OpenAI / Claude / 兼容 API，默认落到 OpenCode；浏览器静态站点仍不支持售卖。

## 出现的问题

OpenCode 预检返回 404；页面不能换源（IndexedDB 里的旧账本），访问 http 回环是混合内容；Pyodide 不能起线程；Service Worker 原来 120 秒就会判超时。

## 怎么解决的

中继用随机端口 + 路径 token、Origin 校验、主机 / 路径白名单、方法 / 体积 / 头白名单；WebView 保持原源，仅对回环开启混合内容，`network_security_config` 只放行回环明文；分析改为同步，SW 只对 `/api/listing/analyze` 放宽到 300 秒。Java 中继单独编译并用本机冒烟验证（预检 204、错误 Origin 403、错误 token 404、上游 401 原样带回）；本机模式在 Chromium + 模拟中继下跑通保存密钥 / 读目录 / 选模型 / ready。

## 可能带来的新问题

WebView 全局允许混合内容；中继是本机新监听面，需真机确认；分析期间主 Worker 被占用；ChatGPT / Claude 仍仅服务器版。原生改动按 D-023 必须随 3.11.0 次版本发布，尚未做真机验收。

## 关联

D-019（补充）· D-023 · D-029 · D-030 · `2026-10-28-opencode-provider.md`
