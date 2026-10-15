# 独立 Album 数据模型与「我喜欢」展示范围

此模块由`storage.py`直接管理，与副本账本分离。无需外部网络，也不修改正式服务器的收藏。

## 实体

- `album-entities-v1`：`albumId -> {id, title, artist, musicBrainzReleaseGroupId, liked, createdAt}`。本地 `albumId` 为不可更改的 32 位随机标识；`liked` 是**专辑级**状态，而不是副本级数据。
- `album-copy-links-v1`：`recordId -> albumId`。副本仍独立保留条码、发行版 MBID、购买日期/价格、包装、照片和交易等信息。
- `record-work-links-v1`：已有的人工确认 MusicBrainz Release Group 关联。用于按作品关联不同发行版本，并将同名但不同 Release Group 的作品分别归属不同 Album。
- `album-favorites-v1`：旧的名称键喜好设置。首次迁移时复制到新 Album 的 `liked`，确认新实体落盘后删除旧键；重复读取不会重复迁移。

所有数据保存在 SQLite 的 `meta` JSON 记录中，随完整备份导出和恢复。新实体在新增或修改副本的同一事务中建立和协调；旧数据库在第一次获取专辑列表时按需迁移。修改副本的标题不会修改 `albumId` 或抹去喜欢状态，只有在现有副本一致时才更新 Album 的显示标题。删除副本时可保留无副本 Album 作为历史偏好记录。

## 归属判定

优先使用有效且与当前副本快照对应的 MusicBrainz Release Group ID。未确认版本的历史副本，可以依据 Unicode 归一化的艺人＋标题关联；如果这一名称同时存在两个以上已确认 Release Group，系统保留未确认副本的独立名称组，不将其随意指定到其中一个作品。原有同名的喜欢状态在拆分时保留，之后可以分别修改。

**限制**：缺少确认作品 ID 的两个真正同名同艺人专辑，仍可能按名称合并。遇到这类作品时，应使用既有的艺人作品关联功能确认 Release Group。数据模型已能区分它们，但不能凭文本推断它们一定是不同作品。

## 展示筛选

展示范围包括「全部收藏」「♥ 我喜欢」「艺人」「自定义组」。使用 `album-favorites` API 返回的 `favorites` 投影筛选副本，且保持原有国内/海外/在途、搜索、排序和全部九种展示模式的语义。出售、售出中、回收站不参与展示。

用户的范围选择保存在已有浏览器 `album-gallery-v1` 偏好中。若没有喜欢的专辑，展示空状态和返回「全部收藏」按钮。

「我喜欢」编辑开关**只**出现在编辑专辑的「专辑偏好」区域；卡片展示仅根据专辑属性呈现金/银色金属背面，不提供切换按钮。

## 测试与部署

- `python3 -m unittest tests.test_album_favorites`
- `node --test web/tests/gallery.test.mjs`
- `npm --prefix web test && npm --prefix web run build`

本次只对本机开发测试环境运行，不自动升级或更改远端 `正式服务器` 正式数据库。
