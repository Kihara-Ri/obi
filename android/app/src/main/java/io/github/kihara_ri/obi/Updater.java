package io.github.kihara_ri.obi;

import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 自动更新（D-022）：查 GitHub 最新正式 Release → 下载 Obi-<tag>.apk → 校验 SHA-256、包名、版本与签名证书
 * → 用 PackageInstaller 安装。Android 12+ 且用户允许过「安装未知应用」时安装无需确认（应用更新自己）；
 * 正在使用时不打断，等离开应用（onStop）或后台任务时再装。其他情况在前台请用户确认一次。
 */
final class Updater {
    static final String REPO = "Kihara-Ri/obi";
    private static final String FEED = "https://api.github.com/repos/" + REPO + "/releases/latest";
    private static final Pattern TAG = Pattern.compile("^v(0|[1-9]\\d{0,2})\\.(0|[1-9]\\d?)\\.(0|[1-9]\\d?)$");
    private static final long APK_LIMIT = 80L << 20;
    private static final long FOREGROUND_INTERVAL = 10 * 60 * 1000L;
    private static final long DECLINE_QUIET = 24 * 60 * 60 * 1000L;
    static final int JOB_ID = 3101;
    static final String ACTION_STATUS = "io.github.kihara_ri.obi.UPDATE_STATUS";

    private static final ExecutorService worker = Executors.newSingleThreadExecutor();
    private static final Handler main = new Handler(Looper.getMainLooper());
    private static volatile boolean busy;

    private Updater() {}

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("updater", Context.MODE_PRIVATE);
    }

    static boolean debuggable(Context c) {
        return (c.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }

    /** v3.1.2 → 30102，与 app/build.gradle 的 versionCode 同一口径；非正式版本号返回 -1。 */
    static long codeOf(String tag) {
        Matcher m = tag == null ? null : TAG.matcher(tag);
        if (m == null || !m.matches()) return -1;
        return Long.parseLong(m.group(1)) * 10000 + Long.parseLong(m.group(2)) * 100 + Long.parseLong(m.group(3));
    }

    static long installedCode(Context c) {
        try {
            return c.getPackageManager().getPackageInfo(c.getPackageName(), 0).getLongVersionCode();
        } catch (PackageManager.NameNotFoundException e) {
            return Long.MAX_VALUE;
        }
    }

    /** 能否不经用户确认直接装：Android 12+，且用户已允许本应用安装未知应用。 */
    static boolean canInstallSilently(Context c) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && c.getPackageManager().canRequestPackageInstalls();
    }

    /** 后台定期检查：每 30 分钟（有网络时），补丁发布后通常半小时内就装上。 */
    static void schedule(Context c) {
        JobScheduler js = c.getSystemService(JobScheduler.class);
        if (js == null || js.getPendingJob(JOB_ID) != null) return;
        js.schedule(new JobInfo.Builder(JOB_ID, new ComponentName(c, UpdateJob.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPeriodic(30 * 60 * 1000L)
                .setPersisted(true)
                .build());
    }

    /** 检查并在合适时安装。manual = 用户点了「检查更新」：不节流，也不受「稍后」静默期限制。 */
    static void check(Context context, boolean manual, Runnable done) {
        Context c = context.getApplicationContext();
        SharedPreferences p = prefs(c);
        if (busy) { if (done != null) main.post(done); return; }
        busy = true;
        state(c, "checking");
        worker.execute(() -> {
            try {
                run(c, manual);
            } catch (Exception e) {
                p.edit().putString("error", message(e)).apply();
                state(c, "error");
            } finally {
                busy = false;
                p.edit().putLong("checkedAt", System.currentTimeMillis()).apply();
                if (done != null) main.post(done);
            }
        });
    }

    static boolean dueInForeground(Context c) {
        return System.currentTimeMillis() - prefs(c).getLong("checkedAt", 0) >= FOREGROUND_INTERVAL;
    }

    private static void run(Context c, boolean manual) throws Exception {
        SharedPreferences p = prefs(c);
        JSONObject release = latest(c);
        String tag = release.optString("tag_name");
        long code = codeOf(tag);
        long installed = installedCode(c);
        if (release.optBoolean("draft") || release.optBoolean("prerelease") || code <= Math.max(installed, ContentPatch.code(c))) {
            clearDownload(c);
            p.edit().remove("error").putString("latest", tag).apply();
            state(c, "current");
            return;
        }
        p.edit().putString("latest", tag).apply();
        // 同一个 主.次 版本内的补丁只换网页内容，不重装应用，任何安卓版本都不需要用户确认（D-023）
        if (ContentPatch.sameLine(code, installed)) { patchContent(c, release, tag, code); return; }
        File apk = apkFile(c);
        if (p.getLong("readyCode", -1) != code || !apk.exists()) {
            clearDownload(c);
            state(c, "downloading");
            String name = "Obi-" + tag + ".apk";
            String apkUrl = assetUrl(c, release, tag, name);
            String sumText = new String(fetch(assetUrl(c, release, tag, name + ".sha256"), 4096), StandardCharsets.US_ASCII).trim();
            Matcher sum = Pattern.compile("^([0-9a-f]{64})\\s+\\*?" + Pattern.quote(name) + "$").matcher(sumText);
            if (!sum.matches()) throw new IOException("安装包校验文件格式不正确");
            File part = new File(apk.getParentFile(), "download.part");
            String digest = download(apkUrl, part);
            if (!digest.equals(sum.group(1))) { part.delete(); throw new IOException("安装包 SHA-256 校验失败"); }
            verifyArchive(c, part, code);
            if (!part.renameTo(apk)) throw new IOException("无法保存安装包");
            p.edit().putLong("readyCode", code).putString("readyTag", tag).remove("error").apply();
        }
        state(c, "ready");
        if (manual) {
            // 用户主动检查：只准备好并在设置页给出「安装」按钮，由用户点了才装，不在离开应用时自动装
            p.edit().remove("declinedAt").putBoolean("manualHold", true).apply();
            return;
        }
        if (p.getBoolean("manualHold", false)) return;
        // 后台任务里必须在任务结束前提交安装：任务一结束进程就可能被系统冻结
        if (canInstallSilently(c) && !MainActivity.visible()) installNow(c);
        else main.post(() -> installWhenAppropriate(c));
    }

    private static void patchContent(Context c, JSONObject release, String tag, long code) throws Exception {
        SharedPreferences p = prefs(c);
        String name = "Obi-" + tag + "-web.zip";
        String sumText = new String(fetch(assetUrl(c, release, tag, name + ".sha256"), 4096), StandardCharsets.US_ASCII).trim();
        Matcher sum = Pattern.compile("^([0-9a-f]{64})\\s+\\*?" + Pattern.quote(name) + "$").matcher(sumText);
        if (!sum.matches()) throw new IOException("补丁校验文件格式不正确");
        byte[] sig = fetch(assetUrl(c, release, tag, name + ".sig"), 2048);
        state(c, "downloading");
        File zip = new File(apkFile(c).getParentFile(), "content.zip");
        try {
            if (!download(assetUrl(c, release, tag, name), zip).equals(sum.group(1))) throw new IOException("补丁 SHA-256 校验失败");
            ContentPatch.verifySignature(c, zip, sig);
            ContentPatch.apply(c, tag, code, zip);
        } finally {
            //noinspection ResultOfMethodCallIgnored
            zip.delete();
        }
        p.edit().remove("error").apply();
        state(c, "current");
    }

    /** 已下载好的新版本：能静默装且没人在用 → 现在装；在用 → 等 onStop；需要确认 → 前台询问。 */
    static void installWhenAppropriate(Context c) {
        SharedPreferences p = prefs(c);
        long code = p.getLong("readyCode", -1);
        if (code <= installedCode(c) || !apkFile(c).exists() || p.getBoolean("manualHold", false)) return;
        if (canInstallSilently(c)) {
            if (!MainActivity.visible()) install(c);
            return;
        }
        MainActivity activity = MainActivity.current();
        if (activity == null) return;
        if (System.currentTimeMillis() - p.getLong("declinedAt", 0) < DECLINE_QUIET) return;
        activity.askToInstall(p.getString("readyTag", ""));
    }

    /** 设置页「安装」按钮：用户明确要装，不再等离开应用。 */
    static void installByUser(Context c) {
        prefs(c).edit().remove("manualHold").apply();
        install(c);
    }

    static void install(Context c) {
        worker.execute(() -> installNow(c));
    }

    private static void installNow(Context c) {
        try {
            PackageInstaller installer = c.getPackageManager().getPackageInstaller();
            PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
            params.setAppPackageName(c.getPackageName());
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
                params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
            File apk = apkFile(c);
            int id = installer.createSession(params);
            try (PackageInstaller.Session session = installer.openSession(id)) {
                try (InputStream in = new FileInputStream(apk); OutputStream out = session.openWrite("obi.apk", 0, apk.length())) {
                    copy(in, out, null);
                    session.fsync(out);
                }
                Intent status = new Intent(ACTION_STATUS).setPackage(c.getPackageName()).setClass(c, UpdateReceiver.class);
                int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0);
                state(c, "installing");
                session.commit(PendingIntent.getBroadcast(c, id, status, flags).getIntentSender());
            }
        } catch (IOException | RuntimeException e) {
            prefs(c).edit().putString("error", "安装失败：" + message(e)).apply();
            state(c, "error");
        }
    }

    static void clearDownload(Context c) {
        apkFile(c).delete();
        prefs(c).edit().remove("readyCode").remove("readyTag").remove("manualHold").apply();
    }

    static File apkFile(Context c) {
        File dir = new File(c.getCacheDir(), "update");
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        return new File(dir, "obi-update.apk");
    }

    /** 给设置页「应用更新」用的状态（JSON）。 */
    static String status(Context c) {
        SharedPreferences p = prefs(c);
        JSONObject o = new JSONObject();
        try {
            o.put("state", p.getString("state", "idle"));
            o.put("version", BuildConfigVersion.name(c));
            o.put("latest", p.getString("latest", ""));
            o.put("ready", p.getString("readyTag", ""));
            o.put("installable", p.getLong("readyCode", -1) > installedCode(c) && apkFile(c).exists());
            o.put("error", p.getString("error", ""));
            o.put("checkedAt", p.getLong("checkedAt", 0));
            o.put("silent", canInstallSilently(c));
            o.put("silentSupported", Build.VERSION.SDK_INT >= Build.VERSION_CODES.S);
        } catch (JSONException ignored) { /* 固定键，不会失败 */ }
        return o.toString();
    }

    static void state(Context c, String state) {
        prefs(c).edit().putString("state", state).apply();
    }

    // ── 网络与校验 ──

    private static JSONObject latest(Context c) throws IOException, JSONException {
        SharedPreferences p = prefs(c);
        String feed = debuggable(c) ? p.getString("feed", FEED) : FEED;
        HttpURLConnection http = open(feed);
        http.setRequestProperty("Accept", "application/vnd.github+json");
        String etag = p.getString("etag", null);
        String cached = p.getString("feedBody", null);
        if (etag != null && cached != null && feed.equals(p.getString("feedUrl", ""))) http.setRequestProperty("If-None-Match", etag);
        int code = http.getResponseCode();
        // 304 不计入 GitHub 未登录接口的每小时 60 次限额
        if (code == 304 && cached != null) return new JSONObject(cached);
        if (code != 200) throw new IOException("版本接口返回 " + code);
        String body;
        try (InputStream in = http.getInputStream()) { body = new String(readAll(in, 1 << 20), StandardCharsets.UTF_8); }
        p.edit().putString("etag", http.getHeaderField("ETag")).putString("feedBody", body).putString("feedUrl", feed).apply();
        return new JSONObject(body);
    }

    private static String assetUrl(Context c, JSONObject release, String tag, String name) throws IOException {
        JSONArray assets = release.optJSONArray("assets");
        String expected = "https://github.com/" + REPO + "/releases/download/" + tag + "/" + name;
        for (int i = 0; assets != null && i < assets.length(); i++) {
            JSONObject a = assets.optJSONObject(i);
            if (a == null || !name.equals(a.optString("name"))) continue;
            String url = a.optString("browser_download_url");
            // 正式包只认本仓库的 Release 附件；debug 包可指向本机测试源
            if (url.equals(expected) || (debuggable(c) && !prefs(c).getString("feed", FEED).equals(FEED))) return url;
        }
        throw new IOException("新版本 " + tag + " 的安装包还没上传（稍后自动重试）");
    }

    private static HttpURLConnection open(String url) throws IOException {
        HttpURLConnection http = (HttpURLConnection) new URL(url).openConnection();
        http.setConnectTimeout(20000);
        http.setReadTimeout(30000);
        http.setInstanceFollowRedirects(true);
        http.setRequestProperty("User-Agent", "ObiAndroidUpdater");
        return http;
    }

    private static byte[] fetch(String url, int limit) throws IOException {
        HttpURLConnection http = open(url);
        if (http.getResponseCode() != 200) throw new IOException("下载失败：" + http.getResponseCode());
        try (InputStream in = http.getInputStream()) { return readAll(in, limit); }
    }

    private static String download(String url, File to) throws IOException {
        HttpURLConnection http = open(url);
        if (http.getResponseCode() != 200) throw new IOException("下载安装包失败：" + http.getResponseCode());
        try {
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            try (InputStream in = http.getInputStream(); OutputStream out = new FileOutputStream(to)) {
                copy(in, out, sha);
            }
            return hex(sha.digest());
        } catch (NoSuchAlgorithmException e) {
            throw new IOException(e);
        }
    }

    /** 包名、版本必须对上，签名证书必须与已安装的一致（系统也会再校验一次签名）。 */
    private static void verifyArchive(Context c, File apk, long code) throws IOException {
        PackageManager pm = c.getPackageManager();
        PackageInfo archive = pm.getPackageArchiveInfo(apk.getPath(), PackageManager.GET_SIGNING_CERTIFICATES);
        if (archive == null || !c.getPackageName().equals(archive.packageName) || archive.getLongVersionCode() != code)
            throw new IOException("安装包内容与版本不符");
        try {
            PackageInfo self = pm.getPackageInfo(c.getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
            if (archive.signingInfo != null && self.signingInfo != null) {
                Signature[] mine = self.signingInfo.getApkContentsSigners();
                Signature[] theirs = archive.signingInfo.getApkContentsSigners();
                if (!Arrays.equals(mine, theirs)) throw new IOException("安装包签名与当前应用不一致，已拒绝");
            }
        } catch (PackageManager.NameNotFoundException e) {
            throw new IOException(e);
        }
    }

    private static void copy(InputStream in, OutputStream out, MessageDigest sha) throws IOException {
        byte[] buf = new byte[64 * 1024];
        long total = 0;
        for (int n; (n = in.read(buf)) > 0; ) {
            total += n;
            if (total > APK_LIMIT) throw new IOException("安装包超过大小限制");
            if (sha != null) sha.update(buf, 0, n);
            out.write(buf, 0, n);
        }
    }

    private static byte[] readAll(InputStream in, int limit) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[16 * 1024];
        for (int n; (n = in.read(buf)) > 0; ) {
            if (out.size() + n > limit) throw new IOException("响应超过大小限制");
            out.write(buf, 0, n);
        }
        return out.toByteArray();
    }

    private static String hex(byte[] bytes) {
        StringBuilder s = new StringBuilder();
        for (byte b : bytes) s.append(String.format(Locale.ROOT, "%02x", b));
        return s.toString();
    }

    static String message(Exception e) {
        if (e instanceof java.net.UnknownHostException || e instanceof java.net.SocketTimeoutException) return "网络不可用，稍后自动重试";
        return e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
    }
}
