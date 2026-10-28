package io.github.kihara_ri.obi;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 读系统剪贴板的纯文本（OpenCode 网页登录后回填密钥用）。
 *
 * WebView 不授予 clipboard-read，navigator.clipboard.readText() 会被拒，所以经 ObiAndroid.clipboardText() 走原生。
 * 只返回第一条文本，最长 4000 字；安卓 10 起只有前台且有焦点时才读得到，读不到返回空串。
 * 页面只在用户点了「用 OpenCode 账户登录」或「粘贴」之后才调用，不在后台轮询。
 */
final class Clip {
    private static final int MAX = 4000;

    private Clip() {}

    static String read(Activity activity) {
        AtomicReference<String> out = new AtomicReference<>("");
        CountDownLatch done = new CountDownLatch(1);
        activity.runOnUiThread(() -> {
            try { out.set(text(activity)); } catch (RuntimeException ignored) { /* 读不到按空处理 */ }
            done.countDown();
        });
        try { done.await(2, TimeUnit.SECONDS); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        return out.get();
    }

    private static String text(Context c) {
        ClipboardManager clipboard = (ClipboardManager) c.getSystemService(Context.CLIPBOARD_SERVICE);
        if (clipboard == null || !clipboard.hasPrimaryClip()) return "";
        ClipData clip = clipboard.getPrimaryClip();
        if (clip == null || clip.getItemCount() == 0) return "";
        CharSequence text = clip.getItemAt(0).getText();
        if (text == null) return "";
        String value = text.toString();
        return value.length() > MAX ? value.substring(0, MAX) : value;
    }
}
