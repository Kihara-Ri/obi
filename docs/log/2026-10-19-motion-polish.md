# 2026-10-19 · 控件与操作的过渡动效统一

- **作者**：Claude
- **范围**：`web/src/styles/tokens.css`（动效令牌）、`components.css`、`base.css`、`BulkBar.css`、`Cards.css`、`drawer.css`、`photos.css`、`ui/Dropdown`、`ui/Combobox`、`ui/Switch`、`ui/Disclosure`、`components/BulkBar.tsx`（新）、`pages/ShelfPage.tsx`（拆出批量条）、`components/REGISTRY.md`、`static/assets/`（重新构建）

## 改了什么
- 新增动效令牌：`--dur-fast .12s / --dur .18s / --dur-slow .28s`，`--ease-out`（进场）、`--ease-soft`（状态过渡）；新增与改动的过渡统一使用它们。
- 按钮：悬停过渡补上文字色与透明度；开关、折叠说明箭头改用令牌。
- 下拉 / 组合框列表：进场淡入并轻微下落（向上展开的反向）。折叠说明展开时正文淡入。
- 选择模式：行首选择钮由「瞬间出现」改为从左展开 + 淡入，行内容平滑让位；卡片视图的封面勾选框改为淡入 + 轻微放大；勾选标记弹入。
- 批量操作条：拆成 `BulkBar` 组件，清空选择时先播放退出动画（保留最后一次的选择内容、按钮不可点）再卸载。
- 修复：手机端批量条进场动画沿用桌面的 `translateX(-50%)`，进场瞬间会偏到左侧再跳回；现手机端使用只含纵向位移的 `bulk-in-m`。
- 抽屉进出与灯箱遮罩改用令牌曲线（进场时长 .22s → .28s）。

## 没有做
- 没有加全局按下位移或按下变暗（AGENTS.md 明确去掉了 `button:active{transform}`）；下拉列表只有进场动画，没有退出动画。
- 页面切换、Seg/标签滑块、Toast、展示布局动效保持原样。

## 验证
- 类型检查、构建通过。
- 手机视口实测：批量条进场时横向位置恒为 12px（无左偏），退出时带 `is-leaving` 并保留「已选 1 张」、之后卸载；选择钮宽度 0 → 28px、不透明度 0 → 1；下拉列表使用 `menu-in`（.18s）。内置面板空闲时动画时间线不推进，需触发一帧渲染后才走完，因此未能逐帧采样中间值。
- 减少动态效果：沿用 `base.css` 的全局规则（动画与过渡全部关闭），未改动。
