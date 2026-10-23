package io.github.kihara_ri.obi;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Message;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.webkit.ServiceWorkerClientCompat;
import androidx.webkit.ServiceWorkerControllerCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Obi 安卓壳：把本机模式静态站点（assets/www，见 D-019）放进 WebView。
 * 站点固定在 https://appassets.androidplatform.net/ 根路径（安全上下文；数据按这个源存在 IndexedDB，
 * 以后不能换源，否则旧数据读不到）。/api/* 仍由站点自己的 Service Worker 交给页面里的 Pyodide 引擎。
 * 原生只补浏览器有、WebView 没有的部分：文件保存、选图 / 拍照、相机权限、外部链接、返回键、系统栏留白，
 * 以及安装包自身的自动更新（Updater）。
 */
public class MainActivity extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    static final String ORIGIN = "https://" + HOST;
    private static final int REQUEST_FILES = 1;
    private static final int REQUEST_CAMERA = 2;

    private FrameLayout root;
    private WebView web;
    private WebView popup;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraOutput;
    private Runnable afterCameraPermission;
    private AlertDialog updateDialog;
    private boolean pageReady;
    private long stoppedAt;

    private static MainActivity current;
    private static volatile boolean visible;

    /** 正在显示的界面（没有则为 null），供更新器决定是否询问用户。 */
    static MainActivity current() { return visible ? current : null; }
    static boolean visible() { return visible; }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 仅 debug 包可用 chrome://inspect / Playwright 调试页面；正式包不开
        if ((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) WebView.setWebContentsDebuggingEnabled(true);
        root = new FrameLayout(this);
        setContentView(root);
        applySystemBars();

        if (WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BASIC_USAGE)) {
            // Service Worker 的预缓存与更新请求不经过页面的 WebViewClient，要单独接到同一份资源
            ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(new ServiceWorkerClientCompat() {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                    return serveAsset(request.getUrl());
                }
            });
        }
        web = createWebView();
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(ORIGIN + "/");
        takeDebugUpdateFeed(getIntent());
        Updater.schedule(this);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        takeDebugUpdateFeed(intent);
    }

    // 仅 debug 包：adb shell am start ... --es obi.updateFeed http://10.0.2.2:端口/latest.json 指向本机测试源
    private void takeDebugUpdateFeed(Intent intent) {
        String feed = intent == null ? null : intent.getStringExtra("obi.updateFeed");
        if (feed == null || !Updater.debuggable(this)) return;
        Updater.prefs(this).edit().putString("feed", feed).remove("etag").remove("checkedAt").apply();
    }

    /** 补丁已写好：清掉旧的 Service Worker 与缓存后重载，页面立刻换成新内容（数据在 IndexedDB，不受影响）。 */
    private void activatePatch() {
        ContentPatch.activated(this);
        web.evaluateJavascript("(async()=>{try{for(const r of await navigator.serviceWorker.getRegistrations())await r.unregister();"
                + "for(const k of await caches.keys())await caches.delete(k)}catch(e){}location.reload()})()", null);
    }

    @Override
    protected void onStart() {
        super.onStart();
        // 离开超过 30 秒再回来才换补丁，避免正在填写时突然重载
        if (pageReady && ContentPatch.pending(this) && System.currentTimeMillis() - stoppedAt >= 30000) activatePatch();
        current = this;
        visible = true;
        // 打开应用时查一次（10 分钟内不重复）；已下好的、需要确认的更新在这里询问
        if (Updater.dueInForeground(this)) Updater.check(this, false, null);
        else Updater.installWhenAppropriate(this);
    }

    @Override
    protected void onStop() {
        visible = false;
        stoppedAt = System.currentTimeMillis();
        super.onStop();
    }

    /** 不能静默安装时（Android 10/11，或还没允许本应用安装应用）在前台问一次。 */
    void askToInstall(String tag) {
        if (isFinishing() || (updateDialog != null && updateDialog.isShowing())) return;
        boolean firstGrant = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !getPackageManager().canRequestPackageInstalls();
        String message = "新版本已下载，安装后数据保留。" + (firstGrant
                ? "\n\n下一步请在系统页面允许 Obi「安装未知应用」，之后点「安装」即可直接完成。"
                : "");
        updateDialog = new AlertDialog.Builder(this)
                .setTitle("更新到 Obi " + tag.replaceFirst("^v", ""))
                .setMessage(message)
                .setPositiveButton("现在更新", (d, w) -> Updater.install(this))
                .setNegativeButton("稍后", (d, w) -> Updater.prefs(this).edit().putLong("declinedAt", System.currentTimeMillis()).apply())
                .show();
    }

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    private WebView createWebView() {
        WebView view = new WebView(this);
        view.setBackgroundColor(getColor(R.color.obi_background));
        WebSettings s = view.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportMultipleWindows(true);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setUserAgentString(s.getUserAgentString() + " ObiAndroid/" + BuildConfigVersion.name(this));
        view.addJavascriptInterface(new Bridge(), "ObiAndroid");
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(view, readAsset("bridge.js"), Collections.singleton(ORIGIN));
        }
        view.setWebViewClient(new AppClient());
        view.setWebChromeClient(new ChromeClient());
        return view;
    }

    // ── 资源：把 https://appassets.androidplatform.net/<路径> 映射到 assets/www/<路径> ──

    WebResourceResponse serveAsset(Uri url) {
        if (!HOST.equals(url.getHost())) return null;
        String path = url.getPath() == null ? "/" : url.getPath();
        if (path.endsWith("/")) path += "index.html";
        if (path.contains("..")) return notFound();
        try {
            File patched = ContentPatch.root(this);
            File file = patched == null ? null : new File(patched, path.substring(1));
            // 补丁目录里有就用补丁的，没有（如 Pyodide 运行时）用安装包自带的
            InputStream in = file != null && file.isFile() && file.getCanonicalPath().startsWith(patched.getCanonicalPath() + File.separator)
                    ? new FileInputStream(file) : getAssets().open("www" + path);
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-cache");
            return new WebResourceResponse(mimeType(path), null, 200, "OK", headers, in);
        } catch (IOException missing) {
            return notFound();
        }
    }

    private static WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<>(),
                new ByteArrayInputStream("Not Found".getBytes(StandardCharsets.UTF_8)));
    }

    private static final Map<String, String> MIME = new HashMap<>();
    static {
        String[][] types = {
                {"html", "text/html"}, {"js", "text/javascript"}, {"mjs", "text/javascript"}, {"css", "text/css"},
                {"json", "application/json"}, {"webmanifest", "application/manifest+json"}, {"wasm", "application/wasm"},
                {"svg", "image/svg+xml"}, {"png", "image/png"}, {"jpg", "image/jpeg"}, {"jpeg", "image/jpeg"},
                {"webp", "image/webp"}, {"gif", "image/gif"}, {"ico", "image/x-icon"}, {"avif", "image/avif"},
                {"woff2", "font/woff2"}, {"woff", "font/woff"}, {"ttf", "font/ttf"}, {"txt", "text/plain"},
                {"zip", "application/zip"}, {"whl", "application/zip"}, {"glb", "model/gltf-binary"},
                {"gltf", "model/gltf+json"}, {"ktx2", "image/ktx2"}, {"mp3", "audio/mpeg"}, {"mp4", "video/mp4"},
        };
        for (String[] t : types) MIME.put(t[0], t[1]);
    }

    static String mimeType(String path) {
        int dot = path.lastIndexOf('.');
        String type = dot < 0 ? null : MIME.get(path.substring(dot + 1).toLowerCase(Locale.ROOT));
        return type == null ? "application/octet-stream" : type;
    }

    private String readAsset(String name) {
        try (InputStream in = getAssets().open(name)) {
            byte[] bytes = new byte[in.available()];
            int read = 0;
            while (read < bytes.length) read += in.read(bytes, read, bytes.length - read);
            return new String(bytes, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("缺少 " + name, e);
        }
    }

    // ── 链接与新窗口 ──

    private boolean openOutside(Uri url) {
        if (HOST.equals(url.getHost())) return false;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, url).addCategory(Intent.CATEGORY_BROWSABLE));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "没有可以打开这个链接的应用", Toast.LENGTH_SHORT).show();
        }
        return true;
    }

    private class AppClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            return serveAsset(request.getUrl());
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            if (view != web || !url.startsWith(ORIGIN)) return;
            pageReady = true;
            if (ContentPatch.pending(MainActivity.this)) activatePatch();
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            boolean outside = openOutside(request.getUrl());
            if (outside && view == popup) closePopup();
            return outside;
        }
    }

    private class ChromeClient extends WebChromeClient {
        // target=_blank：站内页面（如原图）在上层的第二个 WebView 打开，主页面与其中的引擎不被卸载；
        // 站外链接在第一次导航时交给系统浏览器并关掉这个窗口。
        @Override
        public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
            closePopup();
            popup = createWebView();
            root.addView(popup, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            ((WebView.WebViewTransport) resultMsg.obj).setWebView(popup);
            resultMsg.sendToTarget();
            return true;
        }

        @Override
        public void onCloseWindow(WebView window) {
            if (window == popup) closePopup();
        }

        @Override
        public void onPermissionRequest(PermissionRequest request) {
            boolean wantsCamera = false;
            for (String r : request.getResources()) if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) wantsCamera = true;
            if (!wantsCamera) { request.deny(); return; }
            String[] grant = {PermissionRequest.RESOURCE_VIDEO_CAPTURE};
            withCamera(() -> request.grant(grant), request::deny);
        }

        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;
            Intent pick = new Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE);
            String[] accept = params.getAcceptTypes();
            boolean images = accept.length == 0 || String.join(",", accept).contains("image");
            pick.setType(images ? "image/*" : "*/*");
            pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
            if (!images) { launchChooser(pick, null); return true; }
            withCamera(() -> launchChooser(pick, cameraIntent()), () -> launchChooser(pick, null));
            return true;
        }
    }

    private void closePopup() {
        if (popup == null) return;
        root.removeView(popup);
        popup.destroy();
        popup = null;
    }

    // ── 选图 / 拍照 ──

    private Intent cameraIntent() {
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, "Obi-" + System.currentTimeMillis() + ".jpg");
        values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
        values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Obi");
        cameraOutput = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
        if (cameraOutput == null) return null;
        return new Intent(MediaStore.ACTION_IMAGE_CAPTURE).putExtra(MediaStore.EXTRA_OUTPUT, cameraOutput);
    }

    private void launchChooser(Intent pick, Intent camera) {
        Intent chooser = Intent.createChooser(pick, "选择照片");
        if (camera != null) chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{camera});
        try {
            startActivityForResult(chooser, REQUEST_FILES);
        } catch (ActivityNotFoundException e) {
            finishFiles(null);
        }
    }

    private void finishFiles(Uri[] uris) {
        if (fileCallback != null) fileCallback.onReceiveValue(uris);
        fileCallback = null;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQUEST_FILES) return;
        List<Uri> uris = new ArrayList<>();
        if (resultCode == RESULT_OK && data != null && data.getClipData() != null) {
            for (int i = 0; i < data.getClipData().getItemCount(); i++) uris.add(data.getClipData().getItemAt(i).getUri());
        } else if (resultCode == RESULT_OK && data != null && data.getData() != null) {
            uris.add(data.getData());
        } else if (resultCode == RESULT_OK && cameraOutput != null) {
            uris.add(cameraOutput);  // 相机应用写入 EXTRA_OUTPUT 后不一定回传 data
        }
        if (cameraOutput != null && !uris.contains(cameraOutput)) {
            getContentResolver().delete(cameraOutput, null, null);  // 没拍：删掉预留的空相片
        }
        cameraOutput = null;
        finishFiles(uris.isEmpty() ? null : uris.toArray(new Uri[0]));
    }

    // ── 相机权限 ──

    private Runnable onCameraDenied;

    private void withCamera(Runnable granted, Runnable denied) {
        if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) { granted.run(); return; }
        afterCameraPermission = granted;
        onCameraDenied = denied;
        requestPermissions(new String[]{Manifest.permission.CAMERA}, REQUEST_CAMERA);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        if (requestCode != REQUEST_CAMERA) return;
        Runnable next = results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED ? afterCameraPermission : onCameraDenied;
        afterCameraPermission = null;
        onCameraDenied = null;
        if (next != null) next.run();
    }

    // ── 文件保存：bridge.js 把 navigator.share({files}) 转到这里，分块传 base64 ──

    private final Map<String, Pending> saving = new HashMap<>();
    private final List<String> savedPlaces = new ArrayList<>();

    private static class Pending {
        Uri uri;
        OutputStream out;
        boolean image;
    }

    private class Bridge {
        @JavascriptInterface
        public String begin(String name, String mime) {
            boolean image = mime != null && mime.startsWith("image/");
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            values.put(MediaStore.MediaColumns.MIME_TYPE, mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, (image ? Environment.DIRECTORY_PICTURES : Environment.DIRECTORY_DOWNLOADS) + "/Obi");
            values.put(MediaStore.MediaColumns.IS_PENDING, 1);
            Uri collection = image ? MediaStore.Images.Media.EXTERNAL_CONTENT_URI : MediaStore.Downloads.EXTERNAL_CONTENT_URI;
            try {
                Pending p = new Pending();
                p.uri = getContentResolver().insert(collection, values);
                if (p.uri == null) return "";
                p.out = getContentResolver().openOutputStream(p.uri);
                p.image = image;
                String id = Long.toString(System.nanoTime());
                synchronized (saving) { saving.put(id, p); }
                return id;
            } catch (IOException | RuntimeException e) {
                return "";
            }
        }

        @JavascriptInterface
        public boolean chunk(String id, String base64) {
            Pending p;
            synchronized (saving) { p = saving.get(id); }
            if (p == null) return false;
            try {
                p.out.write(Base64.decode(base64, Base64.DEFAULT));
                return true;
            } catch (IOException | IllegalArgumentException e) {
                return false;
            }
        }

        @JavascriptInterface
        public boolean finish(String id, boolean ok) {
            Pending p;
            synchronized (saving) { p = saving.remove(id); }
            if (p == null) return false;
            try {
                p.out.close();
            } catch (IOException e) {
                ok = false;
            }
            if (!ok) { getContentResolver().delete(p.uri, null, null); return false; }
            ContentValues done = new ContentValues();
            done.put(MediaStore.MediaColumns.IS_PENDING, 0);
            getContentResolver().update(p.uri, done, null, null);
            synchronized (savedPlaces) { savedPlaces.add(p.image ? "相册（Pictures/Obi）" : "下载（Download/Obi）"); }
            return true;
        }

        // 一次分享结束：返回保存位置，由页面的提示一并显示（不再另弹系统 Toast）
        @JavascriptInterface
        public String report() {
            synchronized (savedPlaces) {
                String place = String.join("、", new java.util.LinkedHashSet<>(savedPlaces));
                savedPlaces.clear();
                return place;
            }
        }

        @JavascriptInterface
        public void shareText(String title, String text) {
            Intent send = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text);
            if (title != null && !title.isEmpty()) send.putExtra(Intent.EXTRA_SUBJECT, title);
            runOnUiThread(() -> startActivity(Intent.createChooser(send, title == null || title.isEmpty() ? "分享" : title)));
        }

        @JavascriptInterface
        public String version() {
            return BuildConfigVersion.name(MainActivity.this);
        }

        @JavascriptInterface
        public String updateStatus() {
            return Updater.status(MainActivity.this);
        }

        @JavascriptInterface
        public void checkUpdate() {
            runOnUiThread(() -> Updater.check(MainActivity.this, true, null));
        }

        // 手动检查后下载好的新版本：用户点「安装」才装
        @JavascriptInterface
        public void installUpdate() {
            runOnUiThread(() -> Updater.installByUser(MainActivity.this));
        }

        // 打开系统「安装未知应用」开关页；允许后更新可在后台自动安装
        /** 收藏展示的沉浸模式：隐藏状态栏 / 导航栏（边缘滑动可临时唤出），页面铺满整个屏幕（含刘海区）。 */
        @JavascriptInterface
        public void setImmersive(boolean on) {
            runOnUiThread(() -> applyImmersive(on));
        }

        @JavascriptInterface
        public void openInstallSettings() {
            Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName()));
            runOnUiThread(() -> startActivity(intent));
        }
    }

    // ── 返回键、系统栏 ──

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (popup != null) {
            if (popup.canGoBack()) popup.goBack(); else closePopup();
        } else if (web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    private boolean immersive;

    // 沉浸时系统栏被别的东西（WebView 全屏收尾、切回前台、部分 ROM）重新唤出，就再藏一次
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && immersive) applyImmersive(true);
    }

    @SuppressWarnings("deprecation")
    private void applyImmersive(boolean on) {
        immersive = on;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode = on
                    ? (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                            ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                            : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES)
                    : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT;
            getWindow().setAttributes(getWindow().getAttributes());
        }
        // 与游戏 / 视频应用同一套：新式 InsetsController 与旧式 systemUiVisibility 标志同时设。
        // 部分厂商 ROM 只认其中一种；两种并存互不冲突。
        // FLAG_LAYOUT_NO_LIMITS：个别 ROM 在状态栏区域另外留一条黑边，这个标志让窗口铺出屏幕边界
        int hard = WindowManager.LayoutParams.FLAG_FULLSCREEN | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS;
        if (on) getWindow().addFlags(hard); else getWindow().clearFlags(hard);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                if (on) c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars() | WindowInsets.Type.systemBars());
                else c.show(WindowInsets.Type.systemBars());
            }
        }
        int base = View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
        int night = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES ? 0
                : View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        getWindow().getDecorView().setSystemUiVisibility(on
                ? base | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                : base | night);
        root.requestApplyInsets();
        // 有的 ROM 在切页 / 横竖屏 / 输入法收起后一两百毫秒才回写系统栏状态：隔一会儿再确认一次
        if (on) {
            root.postDelayed(() -> { if (immersive) reassertImmersive(); }, 400);
            root.postDelayed(() -> { if (immersive) reassertImmersive(); }, 1500);
            root.postDelayed(this::reportStuckBars, 2200);
        }
    }

    // 系统拒绝隐藏（个别 ROM 不理会应用的请求）时给个提示，方便反馈具体机型 / 系统版本
    private void reportStuckBars() {
        if (!immersive || Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return;
        WindowInsets wi = root.getRootWindowInsets();
        if (wi != null && wi.isVisible(WindowInsets.Type.statusBars()) && !stuckReported) {
            stuckReported = true;
            android.widget.Toast.makeText(this, "系统拒绝隐藏状态栏（" + Build.MANUFACTURER + " " + Build.MODEL
                    + " / Android " + Build.VERSION.RELEASE + "）", android.widget.Toast.LENGTH_LONG).show();
        }
    }
    private boolean stuckReported;

    @SuppressWarnings("deprecation")
    private void reassertImmersive() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) c.hide(WindowInsets.Type.systemBars());
        }
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    // targetSdk 35 起内容默认铺到状态栏 / 导航栏下面：按系统栏与键盘的高度给 WebView 留白，页面里的布局不用改
    private void applySystemBars() {
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            Insets bars = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                    ? insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime() | (immersive ? 0 : WindowInsets.Type.displayCutout()))
                    : insets.getSystemWindowInsets();
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            if (immersive && (bars.top > 0 || bars.bottom > 0 || bars.left > 0 || bars.right > 0)
                    && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && !insets.isVisible(WindowInsets.Type.ime())) {
                v.post(() -> { if (immersive) reassertImmersive(); });
            }
            return WindowInsets.CONSUMED;
        });
        root.setBackgroundColor(getColor(R.color.obi_background));
        boolean night = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        getWindow().setStatusBarColor(getColor(R.color.obi_background));
        getWindow().setNavigationBarColor(getColor(R.color.obi_background));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                int light = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                c.setSystemBarsAppearance(night ? 0 : light, light);
            }
        } else {
            int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
            if (!night) flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            getWindow().getDecorView().setSystemUiVisibility(flags);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        if (current == this) current = null;
        if (updateDialog != null) updateDialog.dismiss();
        closePopup();
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
