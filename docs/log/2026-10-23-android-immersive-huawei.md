# 2026-10-23 · 安卓沉浸展示：华为适配与老系统诊断

- **作者**：Claude
- **范围**：MainActivity.java、AndroidManifest.xml、web/src/hooks/useImmersive.ts

## 改了什么
声明刘海屏适配（manifest meta-data + 反射 LayoutParamsEx.addHwFlags），诊断提示扩展到 Android 10 及以下；桥接调用改为直接方法调用。

## 出现的问题
用户的华为 nova 7 上沉浸展示仍显示状态栏，且 v3.6.36 的诊断提示没弹（该检查只在 Android 11+ 运行）。

## 怎么解决的
在 Android 10（API 29）模拟器上复现：原生路径本身正常，状态栏可隐藏。因此针对 EMUI 加刘海适配标志；诊断改用 getSystemWindowInsetTop 兼容旧系统；桥接改为 typeof 判断后直接调用，避免老 WebView 上 `?.()` 编译成 `.call` 被吞错。

## 可能带来的新问题
无法在真实华为机上验证，EMUI 是否因刘海标志生效待用户确认；若仍无效，诊断 Toast 会给出机型信息。

## 关联
android-immersive-bars.md · android-immersive-bars-2.md · android-immersive-diagnose.md
