# 2026-11-25 · 样本库换成官网封面墙那 30 张

- **作者**：Claude
- **范围**：`tools/seed_samples.py`、`tools/sample_reference_models.py`、`tools/fetch_sample_covers.py`、`tools/sample_bundle.py`、`tools/preview_samples.py`、`tools/sample-bundle.json`；Python 测试与浏览器验收脚本中的专辑名和数量；`AGENTS.md`、`使用说明.md`、`docs/固定样本真实贴图.md` 等文档。

## 改了什么
固定样本库从 21 个副本换成 32 个副本，专辑就是官网首屏封面墙展示的 30 张（D-054）。原有 21 个副本保留场景只换专辑，另加 11 个国内库存副本；3D 参考模型 Loveless 换成 Spiderland。素材锁重新生成（`sampleVersion` 2026-11-25.1，32 张封面、3 个模型）。

## 出现的问题
- 换专辑后 24 个 Python 测试失败：搜索词、标题、数量和展示页数量都写死了旧专辑。
- 第一次 `prepare --rebuild` 报「开发实例封面缺失或损坏：illinois」：发布参考模型会把 3D 副本的 2D 封面换成该版本正面图，而锁里存的是换之前的封面。
- 测试里引用 `bundle.SAMPLE_VERSION` 名字写错（模块导入名是 `workflow`）。

## 怎么解决的
- 测试按新专辑改搜索词和期望值；展示页数量 16 → 27。
- 重锁时先在临时实例里发布参考模型再采集素材，锁里的封面就是发布后的样子；旧 manifest 存进 `bundle/history/` 让 `--rebuild` 能归档旧实例。
- `purge_synthetic` 跳过不认识的键，避免旧缓存里的键报错。
- 放弃了「只换黑胶预览的专辑」：用户选了整个样本库一起换。

## 可能带来的新问题
- 封面墙以后换专辑，样本库不会自动跟随。
- 已验证：`preview_samples.py check` 32 副本 / 32 封面 / 展示 27；临时目录全新 `prepare --download` 能复现锁；Python 全量通过；展示页和上架浏览器验收通过；黑胶预览 32 张都有封面。

## 关联
D-054 · D-053 · 2026-11-25-vinyl-step1.md
