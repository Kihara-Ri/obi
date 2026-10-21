# 2026-10-21 · 抽屉被顶下一截

- **作者**：Claude
- **范围**：`web/src/components/ui/Drawer.tsx`

## 现象
真机（iPhone）划动详情抽屉时偶尔卡住：sheet 顶上露出一大块空白，标题被切，底部操作栏在屏幕外，内容划不动。

## 判断与改动
抽屉有一段为键盘写的逻辑：`visualViewport.offsetTop > 1` 就把整层面板 `translateY(offsetTop)`。但 Safari 工具栏伸缩、橡皮筋回弹、缩放也会让 offsetTop 非零，没有键盘时同样被平移，sheet 整体下移、底部出屏。改为仅在键盘弹出（`--kb` > 0）时才平移。

## 验证
类型检查与前端测试通过。**没有在真机复现**（桌面模拟没有 Safari 工具栏的 offsetTop 行为），根因是依据代码与截图症状的判断，需要你在手机上观察是否还会出现。
