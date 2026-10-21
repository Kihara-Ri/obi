# 2026-10-21 · 非官方发行（私版）标记

- **作者**：Claude
- **范围**：`domain.py`、`web/src/forms/record/{useReleaseLookup,ReleaseLookupSection}`、`forms/detail/ReleasePage.tsx`、`forms/DetailDrawer.tsx`、`types.ts`

## 背景
Pink Floyd《The Wall Rehearsals 1980》（2025，无条码的私版）。MusicBrainz 只有另一张 1996 美国版同名私版，绑上去资料全错；原来只能「手动录入」，版本说明里写文字，没有明确标记。

## 做法
- 发行资料新增字段 `unofficial`（''/'1'）。`clean_release_info`：为 '1' 时强制 `manualRelease='1'`，且不得同时带 MusicBrainz / Discogs 版本编号。
- 表单：发行版区域加勾选「这是非官方发行」；勾选 = 手动录入 + 非官方（清除资料库版本编号）；取消只去掉非官方，仍是手动录入。
- 显示：表单卡片来源「非官方」，详情副标题加「非官方」，「发行资料」页来源行写明；待确认提示本来就排除手动录入，无需改。

## 验证
后端测试（含新增 `UnofficialRelease`）、web 测试、tsc、构建通过；手机宽度浏览器里勾选 / 取消勾选正常（状态行、卡片来源、勾选态）。没有验证保存后详情页副标题与「发行资料」页的真实显示。
