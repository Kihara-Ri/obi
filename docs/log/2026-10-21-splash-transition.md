# 2026-10-21 · 启动画面与进入主界面的转场

- **作者**：Claude
- **范围**：`web/src/components/ui/Splash/`（新）、`App.tsx`、`styles/login.css`、`components/REGISTRY.md`

## 做了什么
- 新单元组件 `Splash`，取代 App 里的 `.loading` 占位。加载中唱片匀速转动、"加载中"文字缓慢呼吸。
- 就绪后：文字淡出、反光层停转 → 唱片沿水平中线裂成上下两半，放大飞出屏幕；同时主界面从中心用圆形孔洞（`mask` + `@property --splash-r`）扩散露出。总长约 720ms。
- 加载 <150ms 就绪：整个画面不出现；出现后至少停留 500ms。`prefers-reduced-motion`：只淡出。
- 两半唱片从一开始就同时挂载，反光层相位一致；投影单独一层，避免中线接缝出发丝线。

## 取舍
- Splash 在加载 / 就绪两个分支里位于同一子节点位置，就绪后不重挂载，退场动画才能接着播。
- 孔洞扩散依赖 `@property`（Safari 16.4+）；不支持时孔洞直接跳到终态，但同一个动画里的 opacity 仍会淡出，不会卡住画面。
- 唱片外观沿用 login.css 的 `.vinyl`；Splash.css 因加载顺序更早，选择器加了 `.splash` 前缀防止被 `.vinyl` 的 104px 尺寸盖掉。

## 验证
浏览器（390×844，样本库 + 人为延迟 /api）：加载帧、转场 260 / 430 / 600ms 帧（Web Animations 定帧）符合预期；快速加载不出现画面；console 除内嵌浏览器拒绝 Service Worker 外零报错。未在真机 iOS PWA 上看帧率（内嵌浏览器窗格在后台时时间线不推进，帧率数据无效）。第二轮：浅色 / 深色定帧检查通过，慢网络提示实测出现。
