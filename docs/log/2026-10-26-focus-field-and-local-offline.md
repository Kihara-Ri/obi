# 2026-10-26 · 专辑名 / 艺人用聚焦输入层；本机站点（安卓版）断网不再拦截

- **作者**：Claude
- **范围**：新增 `forms/FocusField.tsx`、`forms/fields.tsx`（导出 `useSheet`）、`forms/RecordForm.tsx`、`core/backend.ts`（`serverOffline`）、`core/api.ts`、`core/download.ts`、`hooks/usePwa.ts`、`forms/record/useReleaseLookup.ts`（断网文案）、`components/REGISTRY.md`

## 出现的问题
1. 手机上填专辑名、艺人时，系统键盘升起会让抽屉自动滚动，页面抽动一下。
2. 安卓版是本机站点（Pyodide，数据在手机上），断网时仍常驻「网络已断开」横幅，`api()` 写入预检还会直接拒绝保存，上传 / 导出同样被拦。

## 怎么解决的
1. 新增 `FocusField`：手机宽度下输入框只读（不拉键盘、不触发抽屉避让），点一下升起 `FocusInput`，与金额框同一套机制；桌面仍是普通输入框。专辑名 / 艺人（含编辑时的「专辑名（更正用）」）改用它。
2. `serverOffline()` = 断网且不是本机站点：`api()` 写入 / 上传与 `downloadFile` 预检只在服务器版生效；`usePwa` 在本机站点不报离线、不显示横幅。查询发行版失败且断网时就地提示「当前没有网络，暂时无法查询，可手动录入」。

## 验证
前端 typecheck / build / 154 项测试通过；样本库 375×812：点专辑名 / 艺人升起聚焦层、输入回填、回车收起，全程抽屉 scrollTop 不变；服务器版派发 offline 事件横幅仍出现。本机站点分支只做了类型与逻辑检查，未在真机 / dist-local 验证。

## 可能带来的新问题
安卓壳需用 `android/make-web-patch.sh` 打补丁包才能带上本次网页改动（只改网页与 Python，符合 D-023）。`FocusInput` 的值在每次输入时同步到表单，与原输入框一致。
