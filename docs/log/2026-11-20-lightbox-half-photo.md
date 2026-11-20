# 2026-11-20 · 灯箱偶尔只显示半张照片

- **作者**：Claude
- **范围**：
  - 新增 `web/src/components/ui/LightboxSlide.tsx`、`LightboxSlide.css`
  - `web/src/components/ui/Lightbox.tsx`、`web/src/components/ui/photoSave.ts`
  - `web/tests/lightbox-retry.test.mjs`、`web/tests/helpers/compiled-sources.mjs`
  - `web/src/components/REGISTRY.md`

## 改了什么
- 灯箱里的照片改为**整张读完才显示**，读取中在原位置转圈。
- 读取出错，或 12 秒还没读完：在地址后加 `retry=1` 重读一次（服务端忽略这个参数）；仍失败就显示「照片读取失败」。
- 灯箱按 `data-src` 找当前照片，重读后换了地址也能正常开合动画。

## 出现的问题
- 手机上点开详情照片，有时大图只显示上半截，下面一片空，一直不补全；有时又正常。
- 原因：详情里的缩略图是懒加载的，还没下完就点开时，灯箱和缩略图共用同一个地址，浏览器把已收到的半张先画出来。传输一旦卡住或中断，就停在半张；iOS 的合成层有时在图片读完后也不重绘。缩略图已下完再点开就正常，所以时好时坏。

## 怎么验证的
- 新增 `retrySrc` 单测：只给本站照片接口加参数，data:/blob: 原样。
- 预览里打开详情照片：转圈后整张出现，开合动画、翻页正常。
- 前端单测、类型检查、构建、后端测试、文档检查、浏览器验收通过。
- 未在真机 iOS 上复现原问题（偶发），以真机使用为准。

## 可能带来的新问题
- 网络慢时，大图要等整张下完才出现，不再逐行显示。
