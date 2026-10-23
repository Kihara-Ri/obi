# 2026-10-24 · 安卓沉浸展示：查到根因（原生改动从未送到手机）+ 界面内诊断

- **作者**：Claude
- **范围**：`android/.../MainActivity.java`、`Updater.java`、`web/src/core/android-immersive.ts`、`web/src/hooks/useImmersive.ts`、`web/src/components/ImmersiveDiag/`、`AppUpdateSection`、`GalleryPage`、`tools/check_android_line.py`、`tools/package_app.py`、`.github/workflows/android.yml`、`tests/test_android_line.py`

## 改了什么
1. 发布 v3.7.0（升次版本），让已装 3.6.x 的手机收到真正的新安装包。
2. 沉浸诊断改为界面内显示：原生 `immersiveState()` 返回快照（安装包版本、机型、EMUI/HarmonyOS 版本、调用次数、阶段、FULLSCREEN 标志、systemUiVisibility、刘海适配结果、焦点、状态栏是否可见、顶部 inset 与留白）；页面进入沉浸 2.6 秒后读取，有一步失败就在底部列出 ✓/✗ 步骤与版本机型（`ImmersiveDiag`）。去掉原 Toast。
3. 「应用更新」在安装包版本与网页版本不同时显示安装包版本（此前只显示网页补丁版本，掩盖了外壳没更新）。
4. 发布闸门 `tools/check_android_line.py`：补丁 tag 相对 `vX.Y.0` 改了原生外壳即失败，打包与安卓 CI 构建前都执行。

## 出现的问题
用户在华为 nova 7 上装了 v3.6.33–37 后「完全没有变化」，Toast 也一次没出现。

## 怎么解决的
按 D-023，同一 主.次 版本内的新版本只下载网页内容包、不重装安装包。`setImmersive` 桥接在 v3.6.22 才加入，之后 v3.6.33–37 的全部修复也只改了 Java——全是补丁版本，所以手机上仍是当初装的 3.6.x 外壳：原生代码（含 Toast 诊断）从未运行；若外壳早于 3.6.22，连桥接都没有，网页退回 `requestFullscreen`，在 WebView 里不会隐藏系统栏。设置页显示的「当前版本」是网页补丁版本，让人以为已是 3.6.37。`check_android_line.py v3.6.37` 实际列出了 `MainActivity.java` 与 `AndroidManifest.xml` 的改动，印证了这一点。
EMUI 方面查到的资料：未适配刘海时系统把全屏页面整体下移（出现黑条），并不会让时间/信号的状态栏常驻；`android.notch_support` 与 `LayoutParamsEx.addHwFlags(0x10000)` 的写法是对的。所以没有再加新的系统栏标志。
放弃的方案：继续叠加 androidx `WindowInsetsControllerCompat` 等封装——在根因是「外壳没更新」的情况下没有意义，且模拟器上现有原生路径已验证可用。

## 可能带来的新问题
- 用户必须在「设置 → 应用更新」点「安装」才生效（Android 10 还要在系统页面确认一次）。
- 真机 EMUI 上原生路径仍未验证；若装了 3.7.0 仍不隐藏，诊断卡片会列出卡住的一步与 ROM 版本。
- 自测发现：系统弹窗（模拟器 ANR 对话框）抢走焦点时会重走隐藏流程；诊断只在原生 2.2 秒自检后才判断系统栏，未完成自检时最多再等两轮。

## 关联
D-023 · android-immersive-huawei.md · android-immersive-diagnose.md · android-immersive-bars-2.md
