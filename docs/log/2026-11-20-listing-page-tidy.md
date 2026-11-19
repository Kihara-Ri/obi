# 2026-11-20 · 上架资料页：文案始终全文，生成设置并入重新生成

- **作者**：Claude
- **范围**：`web/src/components/ui/Details/Details.tsx`、`web/src/components/ListingCopy/`、`web/src/forms/ListingForm.tsx`、`ListingForm.css`、`ListingOptions.tsx`、`web/src/components/ListingReview/ListingReview.css`、`web/src/components/ListingPhotos/ListingPhotos.tsx`、`web/src/styles/tokens.css`、`web/tests/browser/listing-*.mjs`、`tools/browser_acceptance.sh`

## 改了什么
- 售卖文案阅读态始终显示全文：去掉限高渐隐、「展开全文 / 收起全文」条，以及点正文切换展开的行为；正文可以正常按住选字。
- 「生成设置」不再是页面底部单独的折叠项：
  - 已有文案时，点「重新生成」会在标题下就地展开面板（文案风格 + 本次补充 + 取消 / 开始生成）。
  - 空态时，设置直接摆在「AI 生成上架资料」按钮上方。
  - 编辑中也能打开这个面板，生成结果作为候选，与原来一致。
- 页面底部剩下「核对与依据」「已发布？记录平台与链接」两行，改成上下有分隔线的紧凑列表，不再是悬空的大间距。
- 核对内容去掉了外层卡片（之前是折叠项里套卡片、卡片里再套折叠），改为平铺。
- 照片说明从三行缩短为一行。
- 通用折叠 `Details` 收起时，内边距跟高度一起动画到 0：原先 border-box 下 `height:0` 压不掉正文的 padding，收起末段会留一条约 24px 的空白（还透出淡淡的内容），动画结束、摘掉 open 时才突然消失。

## 出现的问题
- 截图反馈：页面太乱；点文案正文会意外展开 / 收起；生成设置离「重新生成」很远，看不出两者的关系。

## 怎么验证的
- 售卖主验收（`listing-acceptance.mjs`）：生成、重新生成都走面板「开始生成」，涵盖编辑中重新生成、自定义风格、本次补充冲突样本。
- 文案阅读验收（`listing-reader-acceptance.mjs`，390 / 1280）：没有展开按钮，正文不被裁切，点正文布局不变，面板展开后取消可收回，底栏一直在屏内。
- 折叠收起逐帧量：250ms 时正文高度 0.4px，结束为 0，不再停在 24px。
- 前端单测、类型检查、构建通过。

## 可能带来的新问题
- 超长文案会把照片和下面的内容推得更远，需要滚动才能看到。
- 选了「我的风格」时，风格编辑器会整块出现在面板里，面板比较高。
