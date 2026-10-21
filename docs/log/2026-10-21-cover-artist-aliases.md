# 2026-10-21 · 日版封面与艺人识别

- **作者**：Claude
- **范围**：`covers.py`、`kana.py`（新）、`server/artists.py`、`server/routes.py`、`storage.py`、`web/src/forms/record/{useCoverSearch,releaseCover}.ts`

## 现象
1. GReeeeN《キセキ》：iTunes 日本区把这张列为 `Kiseki - Single`（罗马字），与记录里的「キセキ」对不上，得分 <0.65 被丢弃，所以候选里没有 iTunes。
2. 日版《狂気》/ピンク・フロイド：标题与艺人都是日文译名；MusicBrainz 查不到封面，iTunes 目录里是 The Dark Side of the Moon / Pink Floyd，艺人名搜索也对不上。

## 做法
- `kana.romaji`：假名 → 简易罗马字；`covers.candidate` 在艺人一致时，假名与罗马字标题等价（艺人不同仍不算）。
- `search(..., release_id)`：已确认 MB 发行版时取其规范标题 / 艺人 / release-group，再按规范名查一遍，另附 release-group 封面（`exact=False`，只给用户点选，沿用「不静默用 group 图」的规则）。前端「换一张封面」与自动匹配都带上发行版编号。
- `ArtistService._release_credit`：艺人解析先看库里这位艺人的已确认发行版，其 artist-credit 署名等于该名字就直接取 credit 的艺人 MBID（方式 `release-credit`），失败回落到名称搜索。

## 验证
真实 iTunes / MusicBrainz：キセキ → `Kiseki - Single` 判为精确；狂気 + 发行版编号 → 候选含 The Dark Side of the Moon (iTunes 精确) 与 CAA group 封面（首次约 25 秒，iTunes 限速，之后走缓存）。单测 `tests/test_covers_identity.py`。未在真机验证；已有记录的艺人要再打开艺人页 / 触发解析才会绑定。
