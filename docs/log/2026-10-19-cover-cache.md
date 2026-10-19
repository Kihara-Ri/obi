# 2026-10-19 · 封面淡入与本地缓存

- **作者**：Claude
- **范围**：`web/src/components/Cover.tsx`、`web/src/styles/components.css`、`static/sw.js`（壳缓存 v23 + 封面缓存）、`web/src/core/cover-cache.ts`（新）、`web/src/pages/settings/AccountSettings.tsx`（退出登录清缓存）、`static/assets/`（重新构建）

## 改了什么
- 封面 `<img>` 载入前透明、载入后渐显（200ms），不再从空白格子突然跳出图片；已缓存图片挂载即就绪。
- Service Worker 对 `/api/cover/` 采用缓存优先：命中直接返回，未命中取网络并只保存 200 响应；封面按内容哈希命名，可长期命中。
- 退出登录时删除 `album-covers` 缓存（`clearCoverCache`）。壳缓存的版本清理不影响封面缓存。

## 出现的问题 / 需要注意
- 封面缓存随设备保存，退出登录会清空；但在其他设备上修改密码会让那些设备退出登录，它们的封面缓存不会被清理，直到手动清除站点数据。
- 库存图片保存在本机 Cache Storage 中，与 `sw.js` 原有“不缓存私有库存”的约定相反，此处已按用户明确批准执行。

## 验证
- 类型检查与构建通过。
- Node 模拟 Service Worker 逻辑：同一封面第二次请求不走网络；401 响应不入缓存。
- 浏览器内置面板无法注册 Service Worker（`An unknown error occurred when fetching the script`），这一问题在修改前即存在，因此真实 Service Worker 行为未在浏览器中验证，需要在手机上确认。
- 淡入在本地浏览器中验证：可见封面全部变为 `is-ready`。
