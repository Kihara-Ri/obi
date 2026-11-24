# 2026-11-24 · 介绍站封面墙改为用户手选名单

- **作者**：Claude
- **范围**：`site/cover-wall.json`、`site/public/covers/*.png`、`site/src/covers.json`

## 改了什么
封面墙改为用户手选的 30 张，按用户给的顺序上墙（首屏三列轮流分配，「九种方式」各布局按清单顺序取用）。新增 19 张：In the Court of the Crimson King、Meddle、The Glow Pt. 2、F♯ A♯ ∞、Frengers、夏草が邪魔をする、What's Going On...?、American Football（1999）、Carrie & Lowell、Wish You Were Here、Ants From Up There、One Last Kiss、NO TITLE AS OF 13 FEBRUARY 2024 28,340 DEAD、'Allelujah! Don't Bend! Ascend!、Life Continues、It's a Poppin' Time 等。名单外原有 11 张设为 `show:false`，保留在清单里，对应像素图随生成脚本删除。

## 出现的问题
- 原清单有 5 张封面指向 `../../me.api/media/music/`。仓库目录迁移后该相对路径已失效，重新运行 `pixel-covers.py` 会报取不到原图。
- F♯ A♯ ∞、Slow Riot、Carrie & Lowell（原版）、It's a Poppin' Time 在 iTunes 搜不到；MusicBrainz 搜索接口偶尔返回 503。

## 怎么解决的
- 5 张失效路径（Dark Side of the Moon、Illinois、Lift Yr. Skinny Fists、Racing Mount Pleasant、Slow Riot）全部改用 Cover Art Archive / iTunes 的公开封面地址，不再依赖另一个仓库的本地路径。
- iTunes 搜不到的经 MusicBrainz release-group 查 Cover Art Archive 正面封面；503 时等待后重试。
- 清单保持「一张专辑一行」的原格式，避免无关 diff。
- 验证：介绍站构建与 CSP 检查通过；本地预览桌面与 375px 手机宽度下首屏封面墙、「九种方式」封面墙正常，30 张像素图全部 200，无横向滚动。

## 可能带来的新问题
- 「"Ex" All Time Favourites」原用 CAA 上的 24K Gold 再版封面（铁锈色外框），按用户要求换成 iTunes 的原版人像封面。
- American Football 封面上「americ / anfootball」是原设计的断行，不是裁切造成的，保持原图。
- Racing Mount Pleasant、Slow Riot、'Allelujah! 等封面偏浅、对比低，在像素墙里辨识度较弱。
- 同一艺人（GY!BE 5 张、陳奕迅 3 张）较多，滚动时可能出现相邻相似封面。
- 封面地址依赖外部 CDN，首次生成需要联网；生成后只提交像素图，站点运行不依赖外网。

## 关联
D-044 · 2026-11-24-readme-tidy.md
