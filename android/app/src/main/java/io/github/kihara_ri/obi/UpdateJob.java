package io.github.kihara_ri.obi;

import android.app.job.JobParameters;
import android.app.job.JobService;

/** 后台定期检查更新（Updater.schedule 每 30 分钟一次，需联网）；应用不在前台时能静默装就直接装。 */
public class UpdateJob extends JobService {
    @Override
    public boolean onStartJob(JobParameters params) {
        Updater.check(this, false, () -> jobFinished(params, false));
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return false;
    }
}
