# 2026-10-19 · 售卖图片包文件名带专辑信息

- **作者**：Claude
- **范围**：`server/listing_photos.py`、`tests/test_listing_drafts.py`、`tests/test_listing_routes.py`、`AGENTS.md`、`CHANGELOG.md`、`使用说明.md`

## 改了什么
图片包内文件名由 `01.jpg` 改为 `艺人 - 专辑名 - 01.jpg`，序号仍按所选顺序，首图为 01，扩展名沿用实际格式。

## 出现的问题
无。

## 怎么解决的
新增 `file_label`：去掉 `\\ / : * ? " < >` 与控制字符，合并空白，去首尾空格与点，艺人、专辑名各限 50 字；两者都为空时退回纯序号。ZIP 外层文件名 `listing-photos.zip` 未改（响应头为 ASCII，改成中文需 RFC 5987，另议）。

## 可能带来的新问题
- 中文名依赖 ZIP 的 UTF-8 标记（已核对 0x800 置位）；老旧解压工具可能显示乱码。
- 已验证：相关 13 项测试通过。真实样本与 iOS 真机未复测。
