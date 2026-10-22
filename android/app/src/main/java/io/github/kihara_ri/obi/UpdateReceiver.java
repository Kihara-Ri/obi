package io.github.kihara_ri.obi;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;

/** PackageInstaller 的安装结果；需要用户确认时只在应用前台弹出系统确认页。 */
public class UpdateReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Context c = context.getApplicationContext();
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        switch (status) {
            case PackageInstaller.STATUS_PENDING_USER_ACTION: {
                @SuppressWarnings("deprecation") Intent confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT); // 带类型的重载要 API 33
                MainActivity activity = MainActivity.current();
                if (confirm != null && activity != null) {
                    activity.startActivity(confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                    Updater.state(c, "confirming");
                } else {
                    Updater.state(c, "ready");
                }
                break;
            }
            case PackageInstaller.STATUS_SUCCESS:
                Updater.clearDownload(c);
                Updater.state(c, "current");
                break;
            case PackageInstaller.STATUS_FAILURE_ABORTED:
                // 用户在系统确认页点了取消：一天内不再主动询问（「检查更新」仍可手动触发）
                Updater.prefs(c).edit().putLong("declinedAt", System.currentTimeMillis()).apply();
                Updater.state(c, "ready");
                break;
            default: {
                String message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
                Updater.prefs(c).edit().putString("error", "安装失败：" + (message == null ? status : message)).apply();
                Updater.state(c, "error");
            }
        }
    }
}
