// 设置 · 数据 · 保护：备份状态（最近备份、专辑数）、下载完整备份（zip，含照片与封面，D-026）、备份范围清单，
// 以及单独成块的「恢复」危险操作。范围清单直接展示（不折叠），让人一眼看出哪些随备份走。
// 恢复入口先认文件（core/backup-file.ts）：选错成 CSV 表格或旧 albums.json 时直接说明，不进确认框。
import {useApp} from '../../state/AppContext';
import {inspectBackup} from '../../core/backup-file';
import {DownloadButton} from '../../components/DownloadButton';
import {CONFIRM_TITLES, ConfirmForm} from '../../forms/ConfirmForm';
import {isLocalSite} from '../../core/backend';

export function BackupSection() {
  const app = useApp();
  const {state} = app;
  const backup = state.service?.backup;
  const albums = state.records.filter(r => r.status !== 'trash').length;
  const ok = !!backup?.last && !backup.error;
  // 本机模式（浏览器 / 安卓应用）没有服务器快照，也没有可单独复制的数据目录
  const local = isLocalSite();

  const onRestoreFile = async (file: File) => {
    try {
      const found = await inspectBackup(file);
      if (found.kind === 'wrong') { app.toast(found.message, 'err'); return; }
      app.openDrawer({title: CONFIRM_TITLES.restore, asForm: true, compact: true,
        content: <ConfirmForm kind="restore" restoreData={found.ledger} restoreFile={found.kind === 'archive' ? file : undefined}/>});
    } catch (err) {
      app.toast(err instanceof Error ? err.message : String(err), 'err');
    }
  };

  return <>
    <section className="settings-section data-block">
      <h3>备份</h3>
      <p className={`data-status ${ok ? 'is-ok' : 'is-warn'}`} role="status">
        {local ? <>
          <b>! 数据只在这台设备上</b>
          <span>没有自动快照；请定期下载完整备份，另存到电脑或网盘（换手机时用它整份搬过去）</span>
        </> : <>
          <b>{ok ? '✓ 已有备份' : '! 还没有自动备份'}</b>
          <span>{backup?.last ? `服务器每日快照，最近一次：${backup.last}` : '服务器每天自动生成账本快照；也可以现在手动下载一份'}</span>
        </>}
      </p>
      {backup?.error ? <p className="error" role="alert">{backup.error}</p> : null}
      <dl className="settings-stats">
        <div><dt>当前专辑</dt><dd>{albums} 张</dd></div>
        {local ? null : <div><dt>服务器快照</dt><dd>{backup?.count ?? 0} 份</dd></div>}
      </dl>
      <div className="inline-actions">
        <DownloadButton path="backup" fileName="obi-backup.zip">下载完整备份</DownloadButton>
      </div>
      <p className="small-note">得到一个 .zip，含全部照片，可能有几百 MB；手机上可存到「文件」或网盘。</p>
      <div className="data-scope">
        <div><h4>备份里有</h4><ul>
          <li>专辑、发行资料与上架描述</li><li>包裹与交易记录</li><li>实物照片、封面（含自己上传的）</li><li>数字实体文件</li></ul></div>
        <div><h4>备份里没有</h4><ul>
          <li>登录密码与模型授权</li><li>插件程序（在设置里重新安装）</li></ul></div>
      </div>
    </section>

    <section className="settings-section data-block is-danger">
      <h3>恢复备份</h3>
      <p>恢复会<b>替换当前账本和照片</b>。恢复前会自动保存一份当前状态，之后仍可回到现在。</p>
      <div className="inline-actions">
        <label className="file-label">选择备份文件恢复…
          <input type="file" accept=".zip,application/zip,.json,application/json" aria-label="选择完整备份" hidden
                 onChange={e => { const f = e.target.files?.[0]; if (f) onRestoreFile(f); e.target.value = ''; }}/>
        </label>
      </div>
    </section>
  </>;
}
