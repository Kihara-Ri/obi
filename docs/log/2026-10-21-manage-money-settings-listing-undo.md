# 2026-10-21 · 撤销调回海外、买入信息移入管理、设置与上架界面重做、3D 资源缓存

- **作者**：Claude
- **范围**：`storage.py`、`server/{http,routes,engine_plugins}.py`、`web/src/{App.tsx,state/AppContext.ts}`、`components/{ModuleChooser,ModuleImpact,ModulePresets,ListingReview,ListingSteps}`、`components/ui/Toast`、`pages/settings/*`、`forms/{PurchaseForm,RecordForm,ListingForm,shared}`、`forms/detail/ManagePage.tsx`、`core/modules.ts`、`styles/{base,settings-modules,listing-form}.css`、`tests/test_ledger.py`、AGENTS.md、使用说明、CHANGELOG、组件注册表

## 改了什么
1. **撤销调回海外**：bulk 新增 `undo_to_overseas`，按审计里最近一次 `to_overseas` 的 `before` 还原 `shipmentId` 与 `listed`；要求记录仍是海外且 revision 恰好是调回后的下一版，否则拒绝。前端 toast 支持操作按钮（停留 8 秒），`bulkAction` 可传 `undo`。
2. **外观滑块闪烁**：主题切换用 View Transitions 整页交叉淡化 0.5 秒，旧画面里滑块还在原位，与实时滑动叠在一起。给 `.theme-seg` 单独命名并隐藏旧画面，滑块只播实时滑动。
3. **设置 · 功能 / 数据重做**：见 CHANGELOG；预览数据在 `core/modules.ts` 的 `SURFACE_GROUPS`，与 App 导航及各表单的模块判断一一对应，改一边要改另一边。
4. **3D 加载**：宿主可控的部分是插件资源缓存。`api_engine_asset` 原先一律 no-store，每次点 3D 重下 Three.js（1.1MB）与 0.6–4.7MB 的 GLB；改为清单 sha256 强 ETag + `max-age=86400`，GLB 纳入 gzip 并按 ETag 在内存缓存压缩结果。
5. **上架资料重做**：三步进度 + 分析 / 核对 / 文案卡片 + 确认状态文字。API 与数据不变。
6. **买入信息移入管理**：`PurchaseForm`（管理页「编辑买入信息」）只提交 price/currency/date/fees/location（+ revision），金额、币种、日期变化时清空 `actual`；`RecordForm` 编辑模式不再显示购买信息，也不再改这些字段。

## 出现的问题
浏览器里点「管理」被权限分类器拒绝，管理页、买入表单、撤销提示条、上架表单没能做点击级实测；设置 · 功能与 · 数据两页已在浏览器渲染确认。

## 没验证 / 限制
- 3D 首次打开仍要下载引擎与 GLB（规范禁止在点击 3D 前预取），本次只让第二次起命中缓存；若首次仍慢，需要引擎项目侧拆分/压缩模型（Draco / 精简贴图），宿主做不了。浏览器缓存期内同版本内容变化（如引擎开发中不升版本）最长一天读到旧文件。
- 撤销只在提示条内可用，关闭提示后不再有入口。
- 「撤销」「买入信息」的前端交互未点击验证；后端新增 2 条单测，全量 455 项后端、131 项前端通过。
