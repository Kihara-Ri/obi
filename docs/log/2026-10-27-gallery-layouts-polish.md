# 2026-10-27 · 收藏展示：九种布局逐个打磨与巡游循环

- **作者**：Claude
- **范围**：`GalleryWall.tsx`、`GalleryFilm.tsx`、`GalleryFilmNavigator.tsx`、`GalleryOrbit.tsx`、`GalleryTable.tsx`、`GalleryIsometric.tsx`、`useGalleryMotion.ts`、`useGalleryRoaming.ts`（`measureGalleryGridLoop`）、`core/gallery-motion.ts`（`galleryWallLoop`、`advanceGalleryLoop`、flow / crate / fan / ring 姿态）、`core/gallery.ts`（`galleryHash`）、`scripts/gallery-orbit-keyframes.mjs`（新，替代手写 flow / ring 关键帧，接入 prebuild，输出与组件同名的 `components/GalleryOrbit.css` 以满足 R10）、`useGalleryDragScroll.ts`（胶片的桌面鼠标拖动抽出，`GalleryFilm.tsx` 回到 200 行内）、`styles/gallery-*.css`、`tests/gallery-motion.test.mjs`、AGENTS、REGISTRY、CHANGELOG

## 改了什么
用户逐个布局看截图后确认的方案：
- 封面墙：始终铺满剩余屏幕；巡游无缝循环（lcm(张数, 列数) 为周期，渲染副本）；封面加载微光 + 淡入。
- 瀑布流：同样窗口化，各列独立无缝循环；封面按副本哈希错落大小。
- 胶片：约 80% 屏宽；导航去外框成轻量一行；巡游三份副本循环。
- 翻阅：中心缩小、两侧各露两张、地面倒影（`-webkit-box-reflect`）；四种中心布局巡游时首尾相接，手动仍停两端。
- 唱片箱：实木箱、前挡板加高（当前封面露约 70%）、整组居中；翻过的唱片向前倒下并淡出（`opacity = 1 - tipped²`），后排每张多露一截。
- 桌面铺开：木纹桌面、随手散放（±8° + 错位，行距收紧偶尔压角）；窗口化 + 无缝循环，复用封面墙的周期测量。
- 扇形展开：手机上两侧只露一张且被裁，改为中心与紧邻一张保持原弧线、外侧每张只再转 11°，封面 40% 宽。
- 等距封面墙：四边渐隐遮罩、当前封面抬起、显示「x / 16」；本来就一直循环，未改。
- 环形展架：中心约 42% 宽、横向半径 1.45 → 1.1、完整椭圆底座、环后封面按纵深变暗（`--orbit-shade` 经 `@property` 在关键帧里插值，暗层用 `::after` 而非 filter，避免压平盒子厚度）。

- 追加（用户反馈「胶片下面的条很鸡肋」）：舞台箭头统一改为底部居中的磨砂胶囊「‹ x / n ›」（纯 CSS，`.gallery-stage-controls` 结构不变，所有中心布局与等距共用）；胶片去掉灰色面板与滑杆，`GalleryFilmNavigator` 改为印样条 + 胶囊，点缩略图循环时挑最近的一份滚过去；片基自己带边框圆角，下方导航区透明。

- 追加（用户反馈「巡游开始加速非常慢，只要一个过渡」）：原因有二——连续布局用 1.2 秒 smootherstep，前 0.3 秒只有约 10% 速度，加上本身速度慢，看起来像很久才动；中心布局开启后要等满一整段停留（标准 4 秒）才翻第一张。改为 `rampEase`（三次缓出）0.5 秒到速 / 0.35 秒缓停，`useGalleryMotion` 的匀速起步同样 0.5 秒缓出；中心布局刚开启时把轮播时钟预置到「还剩 0.6 秒」（`FIRST_TURN_DELAY`），触碰后的恢复仍等完整停留。新增 `rampEase` 单测。实际手感在隐藏预览面板里 rAF 暂停无法测，需真机确认。

- 追加（用户反馈「巡游一卡一卡有颗粒感」）：不是帧率问题——WebKit 的滚动偏移是整像素，标准档封面墙约 17px/s，60Hz 下每帧 0.3px、120Hz 下 0.14px，画面停 3–7 帧再跳 1px；瀑布流各列速度略不同、跳的时机错开更明显。另外每帧在写完上一列滚动后读封面 `getBoundingClientRect`，强制同步排版。改为 `paintGalleryScroll`（滚动写 floor，余数用滚动容器自身 `translate` 补；容器框挪 <1px 看不出，不必给每张封面开合成层）、`clearGalleryScrollRests`（触碰 / 滚轮 / 速度降到 0 时清除），封面墙 / 瀑布流 / 桌面 / 胶片共用；行距改为尺寸变化后量一次缓存。用模拟整像素滚动的单测验证画面位置逐帧连续。被放弃：巡游期间整体改用 transform 驱动（手指接管时要换算回滚动位置，循环 / 副本 / 对焦都要跟着改，风险大）。真机手感待确认。

## 出现的问题
1. 胶片相邻帧在 80% 宽时完全看不见（侧帧 .86 缩放）→ 76cqw + 8px 间距。
2. 胶片关巡游时位置丢失（隐藏面板 rAF 限流，`rawRef` 过期）→ 在 onScroll 里同步写 `rawRef`。
3. 翻阅第二张邻张被第一张完全挡住 → 外侧间距 .2 → .3、中心 56cqw → 50cqw。
4. 扇形：用户选的「手中牌 12°、两侧各 3 张都在屏内」与既有验收冲突——邻张交叠约 75%，换层时轮廓无法错开，会闪层（`扇形换层前后实体轮廓错开…` 等 5 项失败）。

## 怎么解决的
1–3 见上。
4. 折中：|offset| ≤ 1 的交接区完全保留原弧线（换层验收全部通过），只收紧外侧；整数停留点冻结表的 2–4 项与「侧张低于中心 30px」阈值（→ 24px）按新外侧更新。手机宽度下仍只能做到两侧各两张、最外一张伸出舞台边缘，未达到用户原选的「各 3 张全在屏内」——已说明，用户确认保留此折中。
另：中心布局循环用 `loopCount` 让 `useGalleryMotion` 无界，`GalleryOrbit` 按槽位渲染、槽位折回记录；退出循环时先把位置折回 [0, n) 再归位，避免被夹到最后一张。

## 可能带来的新问题
- 循环副本让 DOM 张数翻几倍（16 张 3 列时封面墙 80 个节点），大范围（几百张）巡游时内存与首帧需留意。
- `-webkit-box-reflect` 非标准，Firefox 无倒影；`@property` 不支持时环后不变暗（不影响布局）。
- 动画路径（翻页、倒下、扇形交接）在隐藏预览面板里 rAF 完全暂停，只验证了静止姿态与循环位置，真机需再看一次动效。
- 已验证：typecheck / build / 158 项单测；375×812 样本库逐个布局截图，封面墙 / 瀑布流 / 胶片 / 翻阅 / 桌面铺开的循环折回与关巡游后撤副本，深浅主题唱片箱，控制台除 SW 注销时的脚本拉取报错外无错误。

- 提交时 R9 误报：`web/package.json` 只在 `prebuild` 里加了 `node scripts/gallery-orbit-keyframes.mjs`，依赖未变；按钩子说明用 `--no-verify` 提交（同次运行中数据泄漏、治理文档、R10/R11 检查均已通过）。

## 关联
[2026-10-26 巡游就地调速](2026-10-26-gallery-roaming-pace.md)；AGENTS「用户已定案的 UI 偏好」展示条目
