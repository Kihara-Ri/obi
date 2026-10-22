# 版本封面退用专辑封面 + MusicBrainz 限流重试（v3.6.7）

- 用户诉求：必须对上 CD 发行版，封面可以妥协；限流要自动重试。
- 前端：`AlbumResults` 把专辑（release group）封面作为 `fallbackArt` 传给 `LookupCard` → `ReleaseCandidateCard`。版本自己的 CAA 图出错或 8 秒超时后改用它，并显示说明；Discogs 来源（无自己的图）直接用它。条码 / 编号查询没有专辑封面可退，行为不变。
- 后端：`ReleaseCatalog._mb_json` 对 `RateLimited` 最多尝试 3 次，每次等冷却（≤6 秒才等）；最终提示「正忙」。`tests/test_release_catalog.py` 新增覆盖。
- 排查结论：截图里两个「没有找到 CD 版本」的条目在 MusicBrainz 上确实没有 CD 发行（Dookie 4-track demo 1 个非 CD；Dookie Demos 3 个无 CD），不是取数据出错。
- 验证：Playwright 模拟 release 404 / release-group 正常，退用专辑封面并显示说明；未在真机验证。
