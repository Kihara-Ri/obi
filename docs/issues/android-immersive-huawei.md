# 问题：安卓版「沉浸展示」在华为 nova 7 上系统栏始终不隐藏

## 现象（用户反馈）
- 设备：华为 nova 7（EMUI 10.x / 可能是 HarmonyOS 2，Android 10 / API 29）。
- 在收藏页开启「沉浸展示」后，手机顶部系统状态栏（时间、信号等）**仍然显示**，竖屏、横屏都一样，且占用屏幕高度（横屏尤其难看）。
- 期望：系统栏（状态栏 + 导航栏）完全隐藏、不占高度；从屏幕边缘滑动可临时唤出（类似游戏 / 横屏视频应用）。
- 已发布 v3.6.33 / 35 / 36 / 37 的多轮修复，用户每次安装后**完全没有变化**。
- v3.6.36 加了「系统拒绝隐藏状态栏」Toast 诊断，用户**一次都没看到**；v3.6.37 把诊断扩展到 API<30 后仍然没有（用户确认"完全没有任何变化"）。系统设置里也没有全屏/刘海相关选项。

## 架构
- 安卓壳：`android/app/src/main/java/io/github/kihara_ri/obi/MainActivity.java`，WebView 加载打包进 APK 的 web（`dist-local/`，origin `appassets.androidplatform.net`）。web 的改动必须发新 APK，用户在「设置 → 应用更新」点「安装」才生效。
- JS 桥：`window.ObiAndroid.setImmersive(on)` → `runOnUiThread(applyImmersive)`。
- Web 侧：`web/src/hooks/useImmersive.ts` 的 `enter()` 调 `setNativeImmersive(true)`。
- `applyImmersive`：设 layoutInDisplayCutoutMode、`FLAG_FULLSCREEN|FLAG_LAYOUT_NO_LIMITS`、（R+）InsetsController.hide、旧式 `setSystemUiVisibility(FULLSCREEN|HIDE_NAVIGATION|IMMERSIVE_STICKY|LAYOUT_*)`、延迟 400ms/1500ms 重申、`huaweiNotch()` 反射 `LayoutParamsEx.addHwFlags(0x10000)`、manifest meta-data `android.notch_support`。
- 根 FrameLayout 用 `OnApplyWindowInsetsListener` 按系统 insets 设 padding（immersive 时排除 displayCutout），返回 `WindowInsets.CONSUMED`。

## 已验证
- AOSP 模拟器 API 35、API 29（google_apis arm64）：调用 `ObiAndroid.setImmersive(true)` 后 `dumpsys window` 显示状态栏 `visible=false`，截图无状态栏，边缘滑动可唤出。即**原生逻辑在原版安卓上正确**。
- 在模拟器上 `fn.call(bridge, on)` 也能正常调用桥接。

## 未解决 / 假设
1. 用户机器上可能根本没走到原生代码：桥接未注入？版本不是最新（APK 没更新成功，旧 WebView 缓存）？`useImmersive` 的 enter 没被触发？需要一种**不依赖 Toast 的可见证据**（例如在界面上显示 `ObiAndroid` 是否存在、`setImmersive` 是否被调用、`getRootWindowInsets` 的 top、当前 APK 版本）来确认执行到了哪一步。
2. EMUI / HarmonyOS 可能对第三方应用在 WebView / 非 Fullscreen 主题下忽略 `FLAG_FULLSCREEN` 与 `systemUiVisibility`；EMUI 还有「全面屏 / 隐藏刘海」应用级设置，默认可能对未适配应用强制保留状态栏。需要查 EMUI 的正确做法（`android:windowFullscreen` 主题属性、`windowLayoutInDisplayCutoutMode`、`android:resizeableActivity`、`android.max_aspect`、Huawei `HwNotchSizeUtil`、`com.huawei.android.view.LayoutParamsEx` 的正确方法名等）。
3. 主题 `Theme.Obi`（DeviceDefault.DayNight）可能需要在 `res/values*/styles.xml` 里直接加 `android:windowFullscreen`/`windowTranslucentStatus` 等；动态设置在 EMUI 上可能被忽略。
4. 也可能 Activity 在启动时就应是全屏窗口，而非运行时切换。可考虑：进入沉浸时重建窗口 / 切换 Activity 主题 / 使用 `WindowCompat` + `WindowInsetsControllerCompat`（androidx.core）这类经各 ROM 验证过的封装。

## 任务
1. 根据上面信息和代码，找出华为 nova 7 上不生效的真正原因（无法拿到真机，需要靠 EMUI 已知行为、官方文档、可靠资料推断，并增加**界面内可见的诊断**以便下一轮定位）。
2. 实现修复；`WindowInsetsControllerCompat` 等成熟方案优先。保持在 AOSP API 29 / 35 模拟器上依旧可用（模拟器 `Obi_API29` / `Qiliu_API_35` 在 `~/Library/Android/sdk`，调试流程见下）。
3. 遵守 `AGENTS.md`（日志 docs/log、CHANGELOG、App.tsx ≤200 行、不写字面颜色等）。

## 调试备忘
- 构建：`cd android && ./gradlew assembleDebug`，APK 在 `app/build/outputs/apk/debug/app-debug.apk`；web 先 `npm --prefix web run build:local`。
- adb 在 `~/Library/Android/sdk/platform-tools`；WebView 调试：`adb forward tcp:9333 localabstract:webview_devtools_remote_<pid>`，用 CDP 执行 `ObiAndroid.setImmersive(true)`；`adb shell dumpsys window | grep InsetsSource` 看状态栏 `visible`。
- 发版流程见 AGENTS.md（下一个版本号 v3.6.38，先 `git tag` 确认）。
