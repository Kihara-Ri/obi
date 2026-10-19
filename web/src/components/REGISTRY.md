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
| `Switch` | 开关 | `on` `onToggle` `label?` `disabled?` | role=switch + aria-checked；命中区向外扩 | 旋钮位置 |
| `NavRow` | 导航列表行：图标 + 标题 + 右侧数值/控件 + 箭头，一行一件事，没有副标题 | `icon` `title` `value?` `trailing?` `href?`｜`onClick?` | 链接 / 按钮 / 静态三种形态 | 右侧数值与箭头 |
| `Collapse` | 内容区平滑展开 / 收起（高度 + 淡入），收起时内容 inert 但保持挂载 | `open` `children` `id?` | 触发按钮自行设 aria-expanded / aria-controls | 展开动画 |
| `Disclosure` | 折叠说明：把解释性文字收起来，主界面只留控件和数字 | `summary?`（默认「说明」） `children` | 原生 details，键盘/读屏开箱可用 | 前置箭头旋转 |
| `SearchField` | 搜索框：放大镜 + 清除按钮，Esc 清空 | `value` `onChange` `ariaLabel` `placeholder?` | 清除后焦点回到输入框 | 有内容时出现清除按钮 |
| `Toast` | 全局消息：边框环绕一周后淡出 | `kind('ok'｜'warn'｜'err')` `text` `onDone` | 错误 role=alert，其余 status；悬停/聚焦暂停；点击关闭；错误停留 6 秒，警告 3.5 秒，成功 2 秒 | 环绕路径的颜色按级别区分，另有文字 |
| `AutoTextarea` | 随内容长高的多行输入 | `value` `maxRows?` + textarea 原生属性 | 宽度变化时重算高度；支持 ref | — |

> **滑块类控件统一用 `useSlidingThumb`**（`ui/SlidingThumb`）：`Seg` 的滑块、库存页国内/海外的下划线共用它，时长与缓动统一取 tokens 的 `--slide-ms` / `--slide-ease`（底栏胶囊也用同一组）。新做带滑块的控件不要再自己测量位置。

> 浮层退出动画：`Dropdown` / `Combobox` 用 `ui/useLeaving`（open 变 false 后保留 120ms 播放 `menu-out` 再隐藏）；`BulkBar` 同理。

> `Switch` 目前还没有页面使用（页内的喜欢开关、漫游开关是各自的专用样式）。新增开关优先用它。

## 其他共用组件（`components/` 与 `forms/`）

| 组件 | 用途 | 备注 |
| --- | --- | --- |
| `ListingPhotos` | 本副本售卖选图、首图、顺序与图片包下载 | 不改原照片次序；选择用 checkbox 与序号区分 |
| `ListingReview` | 照片证据、版本候选及人工核对 | 不自动采用候选或覆盖文案；确认用 checkbox |
| `ListingSettings` | 独立多服务商连接、模型与思考强度 | 复用 Dropdown；连接用文字状态；密钥/令牌不回传 |
| `ui/Drawer` | 抽屉 / 手机底部 sheet：遮罩、焦点圈、Esc、下拉收起、脏表单确认 | 存量文件（见 `.ai-kit/legacy.txt`），动到时拆分 |
| `ui/Lightbox` | 照片灯箱 | 同上 |
| `EngineMount` | 挂载已安装 Album Engine 插件里的视图（3D 查看器、校准、编辑器） | `kind` `props` `onUnavailable?` | 未安装时不渲染；失败显示 role=alert 提示 | — |
| `AlbumEngineSettings` | 设置「高级」里安装 / 卸载 Album Engine 插件 | 无（读 `useApp().albumEngine`） | 状态 role=status；错误 role=alert | 状态文字 |
| `ShopField` | 购买渠道字段：历史店铺归并 + 品牌图标，交互由 `Combobox` 提供 | 样式 `ShopField.css` |
| `ShowcaseSwitch` | 手机顶栏的「库存｜展示」切换（仅以管理为主的用户显示） | `current` | 基于 `Seg` | 选中段 |
| `ThemeToggle` | 浅色 / 深色 / 跟随系统 | 基于 `Seg` |
| `BulkBar` | 库存页底部悬浮的批量操作条；清空选择时先播放退出动画再卸载 | `page` `ids` `isTrash` | role=toolbar | 已选数量 |
| `Cover` `Thumb` `PriceCell` | 封面、缩略图、价格格 | 卡片 / 详情 / 销售行共用 |
| `PageHead` `Ledger` | 页头与侧栏账本 | |
| `forms/fields.tsx` | `Field` `MoneyField` `TextareaField` `DateChipsRow` | 表单字段构造；`MoneyField` 日元只保留整数部分 |
| `forms/shared.ts` | `useFormSubmit` `useRate` `bulkAction` | 提交流程统一入口 |

## 约定

- 新单元组件：`components/ui/<Name>/<Name>.tsx` + `<Name>.css` + `index.ts`，并在 `components/ui/index.ts` 导出；`main.tsx` 已在页面样式之前 `import './components/ui'`，保证基础样式先于页面里的覆盖规则。
- 组件文件头部写用途、关键行为与键盘约定；样式只用 token（`var(--…)`）。
- 上下文里的尺寸 / 外观覆盖（如 `.gallery-setting .seg button`）留在使用处所属的页面样式里，组件自己的 CSS 只放通用外观。
- 动效：时长与缓动用 `tokens.css` 的 `--dur-fast/--dur/--dur-slow`、`--ease-out`（进场减速）、`--ease-soft`（状态过渡）；滑块仍用 `--slide-ms/--slide-ease`。`prefers-reduced-motion` 下 `base.css` 全局关闭动画与过渡。按钮没有全局按下位移（见 AGENTS.md）。
