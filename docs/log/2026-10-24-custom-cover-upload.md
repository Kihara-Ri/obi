# 2026-10-24 · 自定义封面：从相册上传

- **作者**：Claude
- **范围**：`web/src/forms/record/CoverPanel.tsx`、`useCoverSearch.ts`、`web/src/styles/drawer.css`、`CHANGELOG.md`

## 改了什么
专辑表单封面区在「换一张封面」旁加「上传封面」。选图（相册 / 文件，含 HEIC）后复用实物照片的 `compressPhoto` 压成长边 ≤1600 的 JPEG，写入表单的 `cover`（data URL）并清掉 `coverSource`；保存时服务端 `stash_cover` 按内容哈希落盘，记录里只留 `/api/cover/` 引用。

## 为什么没有后端 / 原生改动
保存路径本来就接受封面 data URL（≤3MB）；安卓壳早已支持 `<input type=file>`（实物照片在用）。所以只是前端改动，不需要升次版本。

## 可能带来的新问题
之后在同一表单里重新「选用此版本」会按发行版重新自动匹配封面，覆盖已上传的图（与「换一张封面」一致）。图超过约 2.9MB（压缩后）会提示换图。
