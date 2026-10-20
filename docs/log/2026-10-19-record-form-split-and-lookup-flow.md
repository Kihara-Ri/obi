# 2026-10-19 · 拆分 RecordForm 并优化检索流程

- **作者**：Claude
- **范围**：`web/src/forms/RecordForm.tsx`、`web/src/forms/record/*`（新）、`server/routes.py`、`server/release_catalog.py`、`musicbrainz.py`、相关测试、`.ai-kit/legacy.txt`、组件注册表

## 改了什么
**拆分（行为不变）**：796 行的 RecordForm 拆成 158 行主文件 + `forms/record/` 下 hook（检索、封面、库内匹配、成本预览、专辑偏好）与区块组件（检索、照片、发行资料、封面、金额、偏好）和 `buildPayload`；所有文件 ≤200 行，RecordForm 移出 `.ai-kit/legacy.txt`。`copy-edition.test.mjs` 的源码断言改为读取主文件加全部拆分模块。

**检索流程**：
- 合并两条检索路径：回车/按钮与「输入完整条码后自动校验」共用 `search()`；相同查询进行中复用同一次请求；新查询取消旧请求；条码位数不全时只提示继续输入，不再对半截条码发请求报错。
- 选版后封面与曲目详情并行；iTunes 与 Cover Art Archive 并行，不再等 iTunes 落空再查 CAA；表单资料先到位，封面后台继续（`coverBusy` 独立于检索忙碌态，保存时区分提示）。
- 服务端对 MusicBrainz 采用对冲请求：1.5 秒内未答复就并行启动 Discogs，不再串行等两个来源；MusicBrainz 很快命中则不打扰 Discogs。
- MusicBrainz 短时限流（冷却 ≤3 秒）自动等待并重试一次；`MusicBrainzClient.cooldown_remaining()` 新增。
- 候选按钮标注来源（Discogs）；编辑中改条码校验通过时同样能恢复 Discogs 身份。

## 追加：封面检索并行（`covers.py`）
- 原因：`metadata()` 用一把全局锁串起所有来源的限速等待与网络读取，iTunes（每次间隔 3.1 秒）与 MusicBrainz/CAA 被迫排队。
- 改动：限速改为按来源主机各一把锁，缓存读写另用短锁；`layered_search` 拆成 iTunes 腿与 MusicBrainz/CAA 腿并行，iTunes 超过 2 秒无精确匹配或跑完仍无才启动后者，任一腿先精确命中另一腿即被叫停；合并、排序、去重不变。
- 实测（同一台机器、冷缓存、同组标题）：24.4s→6.4s、15.7s→9.4s（后者 MusicBrainz 当时被限流，只靠 iTunes 腿）。新增三项测试：两腿并行、不同主机互不等待、MusicBrainz 先精确命中叫停 iTunes。

## 出现的问题
- 拆分时先写的 RecordForm 因 macOS `sed -i` 语法失败未落盘，改用 Write 重写后核对类型检查与构建。
- 浏览器实测发现选版后封面匹配仍需约 10–18 秒：根因在 `covers.py` 的全局串行限速，已在上一节并行化。
- 保存时若封面仍在匹配会提示稍候；没有做「保存后异步补封面」，因为那会改变保存语义。

## 怎么解决的
见上；后端新增并行与重试测试，前端由浏览器真实走通：输入条码自动检索 → 选 Discogs 版 → 入库；编辑中重输条码走 verify；未收录编号 → 手动录入 → 入库。

## 可能带来的新问题
- 对冲请求在 MusicBrainz 慢于 1.5 秒时会多用一次 Discogs 配额（公开接口约 25 次/分）。
- iTunes 自身仍每次间隔 3.1 秒（API 限额所致），iTunes 腿跑完全程仍需十余秒；被叫停的 iTunes 腿可能还有一个请求在后台完成，只会补缓存。
- 拆分后的 hook 依赖调用顺序（cover → hints / lookup），改动时需保持。
- 已验证：后端全量、前端 118 项、typecheck/build。iOS 真机、Docker 构建未验证。
