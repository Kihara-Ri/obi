# 2026-10-23 · 专辑详情封面点开就地放大

- **作者**：Claude
- **范围**：`forms/DetailDrawer.tsx`、`components/ReleaseCandidateCard/useArtExpand.ts`、`styles/drawer.css`、`CHANGELOG.md`

## 改了什么
详情摘要里的封面可点：在抽屉内长到整行宽，标题 / 艺人 / 爱心落到封面下面，再点还原。复用 useArtExpand（新增第二个泛型指定封面元素类型），换行占位与查询页、编辑页同一套 `.rcc-break` / `.is-big` 约定。无封面（字母占位）不可点。

## 出现的问题
用户要求详情封面也能就地放大。

## 怎么解决的
封面容器 `.big` 本身作为放大对象（里面的 img 随它 100% 填充），与 flyIn / flyOut 共用同一元素，互不影响；键盘 Enter / 空格可触发。

## 可能带来的新问题
放大用的仍是缩略图（约 250px），铺到 420px 会略糊；仅 Playwright 验证，未真机验证。

## 关联
2026-10-23-edit-cover-zoom.md
