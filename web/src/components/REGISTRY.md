# 组件注册表

新建任何 UI 前先读这里。已有相似组件时，**扩展它的 props**，不要新建近似品。新组件先登记再写代码（ai-kit R4）。
`ui/` 下的单元组件是通用件：不依赖业务类型，可以整个目录原样复制到其他项目（样式随目录，颜色只用 token）。

## 单元组件（`components/ui/<Name>/`，组件 + 样式 + 入口同目录）

| 组件 | 用途 | 关键 props | 键盘 / 语义 | 非颜色的状态区分 |
| --- | --- | --- | --- | --- |
| `Dropdown` | 自定义下拉选择（排序、筛选、表单选项） | `value` `options[{value,label,disabled?}]` `label` `onPick` `disabled?` | role=combobox + listbox；↑↓ Home End Enter Space Esc、字母跳转；读屏名称「label：当前值」；外部点击/触摸关闭；底部放不下自动向上展开 | 当前值填充；键盘导航中当前值加粗、高亮项填充 |
| `Combobox` | 可输入又可下拉的组合框，输入过滤、可填列表外的新值 | `value` `onChange` `options[{value,label,leading?}]` `listLabel` `leading?` `emptyHint?` | role=combobox + aria-activedescendant；↑↓ Enter Esc Tab；外部点击关闭 | 高亮项填充 |
| `Seg` | 分段控件（互斥选择），滑块动画 | `options[{value,label,ariaLabel?,title?,disabled?}]` `value` `onValue` `ariaLabel?` `disabled?` `persistKey?`（页面切换重挂后仍从上次位置滑过去） | role=group + 每段 aria-pressed；←→↑↓ Home End 移动焦点 | 选中段加粗 + 滑块 |
| `TabPanel` | 标签页内容区：切换时按方向滑入并淡入，首次不播 | `value` `order[]` `children` | role=tabpanel；与 `Seg` 配合 | 方向性滑入 |
| `OptionCards` | 带图标的互斥选项卡（图标上、文字下，选中强调描边 + 淡底），适合选项能画出来的设置 | `options[{value,label,icon}]` `value` `onValue` `ariaLabel` `columns?`(每行张数，默认一行) | role=radiogroup / radio；←→↑↓ 移动并选中 | 选中描边 |
| `Switch` | 开关 | `on` `onToggle` `label?` `disabled?` | role=switch + aria-checked；命中区向外扩 | 旋钮位置 |
| `NavRow` | 导航列表行：图标 + 标题 + 右侧数值/控件 + 箭头，一行一件事，没有副标题 | `icon` `title` `value?` `trailing?` `href?`｜`onClick?` | 链接 / 按钮 / 静态三种形态 | 右侧数值与箭头 |
| `Collapse` | 内容区平滑展开 / 收起（高度 + 淡入），收起时内容 inert 但保持挂载 | `open` `children` `id?` | 触发按钮自行设 aria-expanded / aria-controls | 展开动画 |
| `LikeHeart` | 专辑「我喜欢」爱心：空心 / 实心，点一下立即保存，只有图标 | `id` | 空心 vs 实心形状 + `aria-pressed` | 色变 + 轻微按压缩放 |
| `CopyButton` | 一键复制：专辑详情的专辑名、唱片编号、条码旁的图标按钮，复制后图标变对勾并弹提示 | `text` `label` | 复制图标 → 对勾，`aria-label` | 图标变色 |
| `ShipmentStack` | 包裹内专辑：默认收起为叠放封面（≤5 张 + `+N`），点击展开为列表 | `records` `children`（展开后的列表） | 叠放 vs 列表 + 箭头朝向，`aria-expanded` | 封面收成小缩略、箭头翻转 |
| `Disclosure` | 折叠说明：把解释性文字收起来，主界面只留控件和数字 | `summary?`（默认「说明」） `children` | 原生 details，键盘/读屏开箱可用 | 前置箭头旋转 |
| `Splash` | 启动加载画面 + 进入主界面的转场：唱片转动 → 沿中线裂成上下两半 → 主界面从中心圆形扩散露出；极快就绪不显示，显示后至少停留 500ms | `ready` | role=status、aria-label「加载中」；`prefers-reduced-motion` 只淡出 | 唱片转动与退场形变 |
| `SearchField` | 搜索框：放大镜 + 清除按钮，Esc 清空 | `value` `onChange` `ariaLabel` `placeholder?` `inputMode?`（金额用 decimal / numeric） | 清除后焦点回到输入框 | 有内容时出现清除按钮 |
| `BarcodeScanner` / `ScanField` | 相机扫码层；`ScanField` 把扫码图标（可选「×」清空）嵌进输入框右端：全屏后置摄像头取景，识别到校验位正确的 EAN / UPC 条码即回调并关闭（portal 到 body） | `onDetect(code)` `onClose`；ScanField `onScan` `onClear` | 无权限 / 无 HTTPS / 无摄像头给一句原因并可返回；关闭即停相机 | 相机请求 1080p 并开连续对焦，点按取景重新对焦；识别器见 `core/barcode-detector`（原生优先，iPhone 用 zxing-wasm） |
| `FocusInput` | 聚焦输入层：点表单输入框后在键盘正上方升起独立输入面板（portal 到 body，背后页面不动） | `open` `title` `value` `submitLabel` `onChange` `onSubmit` `onClose` `placeholder?` `inputMode?`（金额用 decimal / numeric） | 打开即聚焦；金额框（AmountInput）与专辑名 / 艺人（forms/FocusField）手机端用它；Esc / 遮罩 / 取消关闭 | 动画进场，减少动画偏好下无动画 |
| `Toast` | 全局消息：边框环绕一周后淡出；可带一个操作按钮（如「撤销」，停留 8 秒） | `kind('ok'｜'warn'｜'err')` `text` `action?` `onDone` | 错误 role=alert，其余 status；悬停/聚焦暂停；点击关闭；错误停留 6 秒，警告 3.5 秒，成功 2 秒 | 环绕路径的颜色按级别区分，另有文字 |
| `AutoTextarea` | 随内容长高的多行输入 | `value` `maxRows?` + textarea 原生属性 | 宽度变化时重算高度；支持 ref | — |

> **滑块类控件统一用 `useSlidingThumb`**（`ui/SlidingThumb`）：`Seg` 的滑块、库存页国内/海外的下划线共用它，时长与缓动统一取 tokens 的 `--slide-ms` / `--slide-ease`（底栏胶囊也用同一组）。新做带滑块的控件不要再自己测量位置。

> 浮层退出动画：`Dropdown` / `Combobox` 用 `ui/useLeaving`（open 变 false 后保留 120ms 播放 `menu-out` 再隐藏）；`BulkBar` 同理。

> `Switch` 目前还没有页面使用（页内的喜欢开关、巡游开关是各自的专用样式）。新增开关优先用它。

## 其他共用组件（`components/` 与 `forms/`）

| 组件 | 用途 | 备注 |
| --- | --- | --- |
| `PackagingIcon` / `PackagingLabel` / `PackagingPicker` | 包装类型示意图（按 `PACKAGING_PRESETS` 的 value，另有 other / 未填写）；`PackagingLabel` 详情里显示「图标 + 中文名 + 原术语小字」；`PackagingPicker` 是表单里的图标选项卡（`OptionCards` 三列），不让手打包装名 | `kind` / `text` / `value` `onPick` |
| `ModuleChooser` `ModulePresets` `ModuleTiles` `ModulePhone` `ModuleImpact` `ModuleIcon` | 设置 · 功能与首次设置：使用方式图标卡 → 功能图标开关（点按开关，联动依赖）+ 默认首页 → 迷你手机实时预览底栏与详情管理（新增「+」、收起虚线「−」）；完整变化清单收在「全部变化与说明」 | 预览数据来自 `core/modules` 的 `SURFACE_GROUPS`（含 `icon` 键），与导航及表单的模块判断同步维护；选中/开启用对勾与粗边区分，不只靠颜色 |
| `Details` | 带展开 / 收起高度动画的 `<details>`：用 Chevron 做箭头，替代所有裸 `<details>`；`Disclosure` 基于它 | `summary` `children` `className?` `open?`+`onOpenChange?` 或 `defaultOpen?` |
| `GallerySettings` | 展示页「展示设置」抽屉内容：每项一行（左标题、右 `Seg`）——顺序 / 封面大小 / 间距 / 滑动方向，「显示标题与艺术家」用 `Switch`；巡游速度不在这里；抽屉内容是快照，用本地 state 镜像并回写页面偏好 | `mode` `inGroup` `initial` `onChange` |
| `GalleryRoamingSwitch` `GalleryRoamingPacePicker` | 展示页巡游开关（播放 / 暂停图标按钮）与速度胶囊：胶囊显示倍率，点开就地浮出 5 档 `Seg`（选中即生效、浮层不关，点外面 / Esc 收起）；工具区与沉浸悬浮条共用 | `enabled` `onToggle` / `pace` `onPace` |
| `StageArrow` `StageControls` `stageKey` | 展示舞台的箭头图标、箭头 + 位置指示条、←→ 键处理（`GalleryStageControls.tsx`）；胶片 / 等距 / 中心布局共用 | `next?` / `index` `count` `start` `end` `step` |
| `measureGalleryGridLoop` | 网格布局（封面墙 / 桌面铺开）巡游无缝循环的周期测量：按 offsetTop 数列数与行距，返回副本份数、周期像素与单份可滚距离（`useGalleryRoaming.ts`）；新网格布局要循环时复用它 |
| `GalleryFilmNavigator` | 胶片下方导航：印样条（小封面一排，当前高亮并滚到中间，点击跳转）+ `StageControls` 胶囊；替代原滑杆 |
| `useGalleryDragScroll` | 桌面鼠标拖动横向滚动容器（只写 scrollLeft、竖向手势让给页面、拖后吞掉误点 click）；胶片使用，新的横向轨道可复用 |
| `PageVeil` | 库存 ↔ 展示的转场幕布：Splash 转场版合上 → 预加载封面（`core/preload-covers`，上限 48 张、5 秒兜底）→ 打开。仅手机、非历史导航、非减少动态 | `covers: string[]` `onDone` |
| `PeekUnderlay` | 子页左缘右划返回时垫在内容下面的上一级页面（更多 / 设置），由 `obi-peek` 事件开关，仅手势期间挂载，`inert` | 无（事件驱动） |
| `WhatsNew` | 更新后第一次打开的更新说明弹窗：原生 `<dialog>`，列出上次看过的版本之后的 CHANGELOG 条目（最多 4 版），关闭即记下当前版本；首次安装不弹 | 无（读 `state.service.version`） |
| `ReleaseCandidateCard` `ReleaseSummary` `OriginTag` | 发行版卡片（摘要与角标在同目录 `ReleaseSummary.tsx`）：封面（右下角 `OriginTag` 标来源：此版本 / 同专辑 / iTunes / 上传，样式 `.cover-origin` 与查询页专辑列表共用；封面按 `core/version-cover` 的顺序找）+ 名称 + 来源（艺人下一行小字）→ 关键信息网格 → 可展开的曲目与版本资料（按需取详情，不重复摘要字段）→ 调用方的操作区（render prop）。「查询」页（复制 / 入库）与专辑表单（选用此版本、已确认摘要）共用；头部封面点开放大用 `useArtExpand`（编辑页候选封面行同用）| 候选 `c` `children({info, load, busy})`；`fallbackArt?`；`ReleaseSummary` 另可 `title` `artist` `info` `source?` `url?` `origin?` |
| `ListingSteps` | 服务商设置步骤与上架资料运行进度（整理资料 / 核对实物 / 生成文案） | `steps[{label,done}]`；当前步 = 第一个未完成 |
| `PurchaseForm` | 管理页「编辑买入信息」：金额 / 币种 / 日期 / 额外费用 / 渠道 | 复用 `MoneySection`、`ShopField`；管钱的编辑都放这里 |
| `PhotoDownload` | 专辑详情「实物照片」标题右侧的下载图标：手机把原图交给系统分享面板（存储图像进相册），桌面下载 ZIP | `id` `count` `revision` `artist` `title`；可传 `variant="button"` 与共享 `preparedFiles` 用于上架页；手机进入详情时预取照片，分享须在点击手势内同步调用；加载中禁用，图标有 aria-label |
| `ListingReview` | 实物核对摘要、待核实事项与照片依据 | 无逐项确认；冲突默认展开、其余依据折叠 |
| `ListingPreferences` | 文案风格单一下拉；「我的风格」用选项（Seg + Switch）配置，拼成写作要求（`core/listing-style.ts`） | 复用 Dropdown、Seg、Switch；保存/删除走偏好 revision，预设随备份恢复 |
| `ListingSettings` | 设置「账户 → 已连接服务」：服务商列表，连接/测试/在用状态，点入详情抽屉（仅二手交易） | 复用 Drawer；密钥/令牌不回传，只显示末四位 |
| `ProviderPage` | 服务商详情：头部状态、三步进度、密钥/模型/测试三块 | 复用 ListingSteps、Dropdown；状态只走 token |
| `ProviderAccess` | 详情页「密钥/授权」区（按服务商分支） | 密钥输入后即清空；移除/更换分开 |
| `OpenCodeLogin` | OpenCode 网页登录：打开 opencode.ai/auth，回到应用时读剪贴板回填密钥框（不自动保存） | `busy` `onKey`；剪贴板经 `core/clipboard` 的 `readClipboardText`（安卓走原生桥）；另有「粘贴」按钮兜底 |
| `ProviderIcon` | 服务商品牌 SVG 图标（Lobe Icons, MIT） | 品牌色走 `--brand-*` token；OpenAI 单色随文字色 |
| `Chevron` | 全站唯一箭头（down / right，open 旋转） | 同一 SVG、14px、同一过渡；禁止再用 › ▾ ▸ 字符或另画箭头；折叠用 `Collapse` |
| `ui/Drawer` | 抽屉 / 手机底部 sheet：遮罩、焦点圈、Esc、下拉收起、脏表单确认 | 存量文件（见 `.ai-kit/legacy.txt`），动到时拆分 |
| `ui/Lightbox` | 照片灯箱 | 同上 |
| `NavIcon` | 手机底栏的统一线条图标（展示 / 库存 / 在途 / 售出中 / 更多），24 栅格、currentColor | `name` | 未知名称回退为「更多」点点 | — |
| `EngineMount` | 挂载已安装 Album Engine 插件里的视图（3D 查看器、校准、编辑器） | `kind` `props` `onUnavailable?` | 未安装时不渲染；失败显示 role=alert 提示 | — |
| `AlbumEngineSettings` | 设置「高级」里安装 / 卸载 Album Engine 插件 | 无（读 `useApp().albumEngine`） | 状态 role=status；错误 role=alert | 状态文字 |
| `AppUpdateSection` | 设置「高级」里的「应用更新」（只在安卓壳里显示）：当前版本、自动更新进度、「检查更新」、Android 12+ 的「允许自动安装」 | 无（读 `window.ObiAndroid` 桥） | 状态行 role=status；检查中按钮 disabled + aria-busy | 状态文字 |
| `ImmersiveDiag` | 收藏展示沉浸模式的界面内诊断（只在安卓壳里、某一步没成功时出现）：逐步 ✓/✗ 列出安装包是否支持、调用是否成功、原生是否收到、系统栏是否真的隐藏，并附安装包 / 网页版本与机型；判断逻辑在 `core/android-immersive.ts` | `probe`（`useImmersive` 返回） | role=alert；「知道了」关闭本次 | ✓/✗ 符号 + 失败行加粗 |
| `FeedbackSection` | 设置「高级」里的「反馈问题」：打开 GitHub 新建 issue，正文预填版本、运行方式与 UA，不附带业务数据 | 无（读 `useApp().state.service.version`） | 两个外链 `target=_blank`，文字带 ↗ | 文字 |
| `ShopField` | 购买渠道字段：历史店铺归并 + 品牌图标，交互由 `Combobox` 提供 | 样式 `ShopField.css` |
| `ShowcaseSwitch` | 手机顶栏的「库存｜展示」切换（仅以管理为主的用户显示） | `current` | 基于 `Seg` | 选中段 |
| `ThemeToggle` | 浅色 / 深色 / 跟随系统 | 基于 `Seg` |
| `BulkBar` | 库存页底部悬浮的批量操作条；清空选择时先播放退出动画再卸载 | `page` `ids` `isTrash` | role=toolbar | 已选数量 |
| `Cover` `Thumb` `PriceCell` | 封面、缩略图、价格格 | 卡片 / 详情 / 销售行共用 |
| `PageHead` `Ledger` | 页头与侧栏账本 | |
| `Sidebar` `MobileNav`（`AppNav`） | 桌面侧栏与手机底栏；`navCounts` 算两处共用的各页数量 | 仅供 `App` 外壳使用；入口按模块开关过滤 |
| `forms/fields.tsx` | `Field` `MoneyField` `TextareaField` `DateChipsRow` | 表单字段构造；`MoneyField` 日元只保留整数部分 |
| `forms/record/*` | 专辑表单的拆分模块：`useReleaseLookup` / `pickRelease`（发行版检索、校验、确认、手动录入）、`releaseCover`（选版后封面匹配：此版本 CAA 正面图优先，其次 iTunes 精确）、`useCoverSearch`、`useRecordHints`、`useCostPreview`；区块 `ReleaseLookupSection` `PhotoEntry` `ReleaseDetails` `CoverPanel` `MoneySection`；`buildPayload` | 仅供 `RecordForm` 组合，行为与拆分前一致；检索逻辑只改 `useReleaseLookup`，不在区块组件里写请求 |
| `forms/shared.ts` | `useFormSubmit` `useRate` `bulkAction` | 提交流程统一入口 |

## 约定

- 新单元组件：`components/ui/<Name>/<Name>.tsx` + `<Name>.css` + `index.ts`，并在 `components/ui/index.ts` 导出；`main.tsx` 已在页面样式之前 `import './components/ui'`，保证基础样式先于页面里的覆盖规则。
- 组件文件头部写用途、关键行为与键盘约定；样式只用 token（`var(--…)`）。
- 上下文里的尺寸 / 外观覆盖（如 `.gallery-setting .seg button`）留在使用处所属的页面样式里，组件自己的 CSS 只放通用外观。
- 动效：时长与缓动用 `tokens.css` 的 `--dur-fast/--dur/--dur-slow`、`--ease-out`（进场减速）、`--ease-soft`（状态过渡）；滑块仍用 `--slide-ms/--slide-ease`。`prefers-reduced-motion` 下 `base.css` 全局关闭动画与过渡。按钮没有全局按下位移（见 AGENTS.md）。

- `ListingCopy`：文案卡片，空态（就地生成 / 手动编写）、阅读（长文限高渐隐，就地展开，sticky 收起条）、编辑（输入框，完成/保存在表单底栏）；复用 AutoTextarea。
- `ListingPhotos`：本副本自适应缩略图（加载骨架/失败态）、右下角图标复制单张；复用 PhotoDownload 保存全部，不混入资料库封面。
- `ListingOptions`（forms）：默认折叠的风格、本次补充与生成选项；复用 ListingPreferences。
