package io.github.kihara_ri.obi;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.security.GeneralSecurityException;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * 补丁（同一个 主.次 版本内）只更新网页内容：下载 Obi-<tag>-web.zip，校验签名后解到应用私有目录，
 * 由 MainActivity 优先从那里提供页面（找不到的文件，如 Pyodide 运行时，仍取安装包自带的）。
 * 不重装应用，所以任何安卓版本上都不需要用户确认。新安装包（版本 ≥ 补丁）装好后覆盖目录自动作废。见 D-023。
 */
final class ContentPatch {
    static final long ZIP_LIMIT = 40L << 20;
    private static final long UNPACKED_LIMIT = 120L << 20;
    private static final int ENTRY_LIMIT = 2000;

    private ContentPatch() {}

    /** 补丁只能覆盖同一个 主.次 版本：原生外壳（桥接、权限）没变，网页才能放心替换。 */
    static boolean sameLine(long patchCode, long installedCode) {
        return patchCode / 100 == installedCode / 100;
    }

    static long code(Context c) {
        return Updater.prefs(c).getLong("contentCode", 0);
    }

    /** 当前生效的补丁目录；没有补丁或已被更新的安装包取代则为 null。 */
    static File root(Context c) {
        long code = code(c);
        if (code <= Updater.installedCode(c)) return null;
        File dir = new File(new File(c.getFilesDir(), "content"), String.valueOf(code));
        return new File(dir, "index.html").isFile() ? dir : null;
    }

    /** 界面显示的版本：补丁生效时是补丁版本，否则是安装包版本。 */
    static String version(Context c, String fallback) {
        String tag = Updater.prefs(c).getString("contentTag", "");
        return root(c) != null && !tag.isEmpty() ? tag.replaceFirst("^v", "") : fallback;
    }

    /** 补丁已写好但页面还在用旧内容：下次进入应用时换上。 */
    static boolean pending(Context c) {
        return Updater.prefs(c).getBoolean("contentPending", false) && root(c) != null;
    }

    static void activated(Context c) {
        Updater.prefs(c).edit().remove("contentPending").apply();
    }

    static void verifySignature(Context c, File zip, byte[] sig) throws IOException {
        try {
            android.content.pm.Signature[] mine = c.getPackageManager()
                    .getPackageInfo(c.getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES).signingInfo.getApkContentsSigners();
            X509Certificate cert = (X509Certificate) CertificateFactory.getInstance("X.509")
                    .generateCertificate(new ByteArrayInputStream(mine[0].toByteArray()));
            java.security.Signature verifier = java.security.Signature.getInstance("SHA256withRSA");
            verifier.initVerify(cert.getPublicKey());
            try (InputStream in = new FileInputStream(zip)) {
                byte[] buf = new byte[64 * 1024];
                for (int n; (n = in.read(buf)) > 0; ) verifier.update(buf, 0, n);
            }
            if (!verifier.verify(sig)) throw new IOException("补丁签名校验失败，已拒绝");
        } catch (GeneralSecurityException | PackageManager.NameNotFoundException | RuntimeException e) {
            throw new IOException("补丁签名校验失败：" + e.getMessage());
        }
    }

    /** 解压、核对 content.json（版本须与 Release 一致，防止拿旧补丁冒充新版本），再整体换上。 */
    static void apply(Context c, String tag, long code, File zip) throws IOException {
        File base = new File(c.getFilesDir(), "content");
        File tmp = new File(base, "tmp");
        deleteTree(tmp);
        if (!tmp.mkdirs()) throw new IOException("无法创建补丁目录");
        unzip(zip, tmp);
        try {
            JSONObject meta = new JSONObject(new String(readFile(new File(tmp, "content.json")), StandardCharsets.UTF_8));
            if (!tag.equals(meta.optString("tag"))) throw new IOException("补丁版本与 Release 不符");
        } catch (JSONException e) {
            throw new IOException("补丁缺少版本信息");
        }
        if (!new File(tmp, "index.html").isFile() || !new File(tmp, "sw.js").isFile()) throw new IOException("补丁内容不完整");
        File target = new File(base, String.valueOf(code));
        deleteTree(target);
        if (!tmp.renameTo(target)) throw new IOException("无法启用补丁");
        SharedPreferences.Editor edit = Updater.prefs(c).edit();
        edit.putLong("contentCode", code).putString("contentTag", tag).putBoolean("contentPending", true).apply();
        File[] old = base.listFiles();
        if (old != null) for (File f : old) if (!f.equals(target)) deleteTree(f);
    }

    private static void unzip(File zip, File into) throws IOException {
        String root = into.getCanonicalPath() + File.separator;
        long total = 0;
        int entries = 0;
        try (ZipInputStream in = new ZipInputStream(new FileInputStream(zip))) {
            for (ZipEntry e; (e = in.getNextEntry()) != null; ) {
                if (e.isDirectory()) continue;
                if (++entries > ENTRY_LIMIT || e.getName().startsWith("local/pyodide/")) throw new IOException("补丁内容不符合要求");
                File out = new File(into, e.getName());
                if (!out.getCanonicalPath().startsWith(root)) throw new IOException("补丁含非法路径");
                //noinspection ResultOfMethodCallIgnored
                out.getParentFile().mkdirs();
                try (FileOutputStream f = new FileOutputStream(out)) {
                    byte[] buf = new byte[64 * 1024];
                    for (int n; (n = in.read(buf)) > 0; ) {
                        total += n;
                        if (total > UNPACKED_LIMIT) throw new IOException("补丁解压后过大");
                        f.write(buf, 0, n);
                    }
                }
            }
        }
    }

    private static byte[] readFile(File f) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (InputStream in = new FileInputStream(f)) {
            byte[] buf = new byte[8192];
            for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
        }
        return out.toByteArray();
    }

    static void deleteTree(File f) {
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) deleteTree(k);
        //noinspection ResultOfMethodCallIgnored
        f.delete();
    }
}
