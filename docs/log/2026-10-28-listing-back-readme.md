# 2026-10-28 · 上架页返回钮与 README 重写

- **作者**：Claude
- **范围**：`web/src/forms/ListingForm.tsx`（openListingForm 增加 `back`）、`README.md`

## 改了什么
- 上架页标题栏左侧补返回钮「‹ 返回管理」，与「编辑买入信息」「发行资料」同一做法（DrawerSpec.back + backDrawer）。
- README 按 album-engine / algorithm-studio / 账单助手的写法重写：一句话定位、模块表、录入与上架资料、快速开始、结构、验证、文档索引；删去与 AlbumEngine 插件文档、CHANGELOG 重复的 3D / 展示细节。

## 出现的问题
- 用户反馈上架页「没有了返回上一层的按钮」。原因：6dedc10 改版时去掉了底栏「取消」（`backDrawer`），而这个抽屉从未配置标题栏返回钮，于是没有任何返回上一层的入口，只剩关闭。

## 怎么解决的
标题栏返回钮而不是恢复底栏「取消」：底栏现在只放取用操作（保存图片 / 复制文案，编辑时完成 / 保存草稿），且返回钮是全站二级抽屉的统一入口。浏览器（深色、390 宽）验证：打开面板 → 点返回 → 回到管理页，console 零报错。

## 可能带来的新问题
无已知隐患。已验证：typecheck、build、浏览器返回流程。README 链接锚点已核对，`tools/check_docs.py` 通过；README 精简后原有的细节说明仍分别保留在使用说明、AlbumEngine 插件文档与 CHANGELOG，未逐条回查是否有只在旧 README 出现的内容。

## 关联
2026-10-28-listing-panel-polish.md · D-032
