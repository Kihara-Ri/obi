package io.github.kihara_ri.obi;

import android.content.Context;
import android.content.pm.PackageManager;

/** 安装包的 versionName（由 tag 决定，见 app/build.gradle）。 */
final class BuildConfigVersion {
    private BuildConfigVersion() {}

    static String name(Context context) {
        try {
            return ContentPatch.version(context, context.getPackageManager().getPackageInfo(context.getPackageName(), 0).versionName);
        } catch (PackageManager.NameNotFoundException e) {
            return "unknown";
        }
    }
}
