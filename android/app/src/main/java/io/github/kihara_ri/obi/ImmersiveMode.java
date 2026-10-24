package io.github.kihara_ri.obi;

import android.app.Activity;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * 收藏展示的「沉浸」：隐藏状态栏 / 导航栏（边缘滑动可临时唤出），页面铺满整个屏幕（含刘海区）。
 * 另外记录每一步的结果（{@link #state()}），由页面在界面里显示，用来在真机上定位系统拒绝隐藏的原因。
 * 所有方法都在 UI 线程调用；{@link #state()} 返回的快照可在任意线程读取。
 */
final class ImmersiveMode {
    private static final int HUAWEI_FLAG_NOTCH_SUPPORT = 0x00010000;
    /** 系统处理隐藏需要时间：这个延迟之后才读取系统栏的真实状态 */
    private static final long CHECK_DELAY_MS = 2200;
    /** 有的 ROM 在切页 / 横竖屏 / 输入法收起后一两百毫秒才回写系统栏状态：隔一会儿再确认一次 */
    private static final long[] REASSERT_DELAYS_MS = {400, 1500};

    private final Activity activity;
    private final View root;
    private boolean on;
    private boolean checked;
    private String notchResult = "";
    private volatile int calls;
    private volatile String snapshot = "";

    ImmersiveMode(Activity activity, View root) {
        this.activity = activity;
        this.root = root;
    }

    boolean isOn() { return on; }

    /** 页面调用：开 / 关沉浸 */
    void request(boolean enable) {
        if (enable) calls++;
        apply(enable);
    }

    /** 沉浸时系统栏被别的东西（WebView 全屏收尾、切回前台、部分 ROM）重新唤出，就再藏一次 */
    void onWindowFocus() {
        if (on) apply(true);
    }

    String state() { return snapshot; }

    /** 根布局的 insets 变化后调用：已完成自检时刷新快照；系统栏又冒出来就再藏一次。 */
    void onInsets(boolean anyInset, boolean imeVisible) {
        if (!on) return;
        if (checked) root.post(() -> { if (on && checked) record("checked"); });
        if (anyInset && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && !imeVisible) root.post(this::reassert);
    }

    @SuppressWarnings("deprecation")
    private void apply(boolean enable) {
        on = enable;
        checked = false;
        Window window = activity.getWindow();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.getAttributes().layoutInDisplayCutoutMode = enable
                    ? (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                            ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                            : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES)
                    : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT;
            window.setAttributes(window.getAttributes());
        }
        // 与游戏 / 视频应用同一套：新式 InsetsController 与旧式 systemUiVisibility 标志同时设。部分厂商 ROM 只认其中一种。
        // FLAG_LAYOUT_NO_LIMITS：个别 ROM 在状态栏区域另外留一条黑边，这个标志让窗口铺出屏幕边界
        int hard = WindowManager.LayoutParams.FLAG_FULLSCREEN | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS;
        if (enable) window.addFlags(hard); else window.clearFlags(hard);
        notchResult = huaweiNotch(enable);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController c = window.getInsetsController();
            if (c != null) {
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                if (enable) c.hide(WindowInsets.Type.systemBars()); else c.show(WindowInsets.Type.systemBars());
            }
        }
        window.getDecorView().setSystemUiVisibility(enable ? hiddenFlags() : SystemBars.visibleFlags(activity));
        root.requestApplyInsets();
        if (enable) {
            for (long delay : REASSERT_DELAYS_MS) root.postDelayed(() -> { if (on) reassert(); }, delay);
            root.postDelayed(() -> { if (on) { checked = true; record("checked"); } }, CHECK_DELAY_MS);
        }
        record(enable ? "applied" : "off");
    }

    @SuppressWarnings("deprecation")
    private int hiddenFlags() {
        return View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
    }

    @SuppressWarnings("deprecation")
    private void reassert() {
        Window window = activity.getWindow();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController c = window.getInsetsController();
            if (c != null) c.hide(WindowInsets.Type.systemBars());
        }
        window.getDecorView().setSystemUiVisibility(hiddenFlags());
    }

    /** EMUI：给窗口加 FLAG_NOTCH_SUPPORT，告诉系统本应用自己处理刘海区，别再涂黑；返回结果写进诊断 */
    private String huaweiNotch(boolean enable) {
        try {
            Class<?> k = Class.forName("com.huawei.android.view.LayoutParamsEx");
            Window window = activity.getWindow();
            Object ex = k.getConstructor(WindowManager.LayoutParams.class).newInstance(window.getAttributes());
            k.getMethod(enable ? "addHwFlags" : "clearHwFlags", int.class).invoke(ex, HUAWEI_FLAG_NOTCH_SUPPORT);
            window.setAttributes(window.getAttributes());
            return "ok";
        } catch (ClassNotFoundException e) {
            return "none";
        } catch (Throwable e) {
            return "error: " + e.getClass().getSimpleName();
        }
    }

    /** 记下沉浸执行到哪一步与系统栏的实际状态 */
    @SuppressWarnings("deprecation")
    private void record(String stage) {
        JSONObject o = new JSONObject();
        try {
            o.put("shell", shellVersion());
            o.put("device", Build.MANUFACTURER + " " + Build.MODEL);
            o.put("android", Build.VERSION.RELEASE);
            o.put("sdk", Build.VERSION.SDK_INT);
            o.put("rom", romVersion());
            o.put("calls", calls);
            o.put("on", on);
            o.put("stage", stage);
            o.put("notch", notchResult);
            Window window = activity.getWindow();
            o.put("fullscreenFlag", (window.getAttributes().flags & WindowManager.LayoutParams.FLAG_FULLSCREEN) != 0);
            o.put("sysui", window.getDecorView().getSystemUiVisibility());
            o.put("focus", activity.hasWindowFocus());
            WindowInsets wi = root.getRootWindowInsets();
            if (wi != null && "checked".equals(stage)) {
                o.put("statusVisible", Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                        ? wi.isVisible(WindowInsets.Type.statusBars()) : wi.getSystemWindowInsetTop() > 0);
                o.put("insetTop", wi.getSystemWindowInsetTop());
            }
            o.put("padTop", root.getPaddingTop());
        } catch (JSONException | RuntimeException ignored) { /* 诊断尽力而为 */ }
        snapshot = o.toString();
    }

    private String shellVersion() {
        try {
            return activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0).versionName;
        } catch (PackageManager.NameNotFoundException e) {
            return "unknown";
        }
    }

    /** EMUI / HarmonyOS 版本（读系统属性；别的 ROM 为空）。 */
    private static String romVersion() {
        try {
            Class<?> sp = Class.forName("android.os.SystemProperties");
            java.lang.reflect.Method get = sp.getMethod("get", String.class, String.class);
            String harmony = (String) get.invoke(null, "hw_sc.build.platform.version", "");
            String emui = (String) get.invoke(null, "ro.build.version.emui", "");
            return (harmony.isEmpty() ? "" : "HarmonyOS " + harmony + " ") + emui;
        } catch (Throwable e) {
            return "";
        }
    }
}

/** 非沉浸时的系统栏标志（旧式接口）：内容铺到系统栏下面，浅色模式下深色图标。 */
final class SystemBars {
    private SystemBars() {}

    @SuppressWarnings("deprecation")
    static int visibleFlags(Activity activity) {
        int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
        boolean night = (activity.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        if (!night) flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        return flags;
    }
}
