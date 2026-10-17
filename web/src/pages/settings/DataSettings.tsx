// 设置 · 数据：备份与恢复、导入、回收站、最近操作。说明性文字折叠，主区只留动作与数字。
import {useState} from 'react';
import {api} from '../../core/api';
import {useApp} from '../../state/AppContext';
import type {BackupFile} from '../../types';
import {Disclosure} from '../../components/ui/Disclosure';
import {NavRow} from '../../components/ui/NavRow';
import {TrashIco} from '../../components/icons';
import {CONFIRM_TITLES, ConfirmForm} from '../../forms/ConfirmForm';

interface ImportPreview {
  count: number;
  skipped: number;
  errors: string[];
  titles: string[];
}

export function DataSettings() {
  const app = useApp();
  const {state} = app;
  const trash = state.records.filter(r => r.status === 'trash').length;
  const [importResult, setImportResult] = useState<ImportPreview | null>(null);
  const [importData, setImportData] = useState<unknown[] | null>(null);
  const [importError, setImportError] = useState('');
  const [committing, setCommitting] = useState(false);

  const onImportFile = async (file: File) => {
    setImportError('');
    try {
      const data = JSON.parse(await file.text());
      const p = await api<ImportPreview>('import-preview', {albums: data});
      setImportData(data);
      setImportResult(p);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  };

  const onRestoreFile = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as BackupFile;
      if (data.format !== 'album-ledger') throw new Error('请选择通过本系统下载的完整备份');
      app.openDrawer({
        title: CONFIRM_TITLES.restore,
        asForm: true,
        compact: true,
        content: <ConfirmForm kind="restore" restoreData={data}/>,
      });
    } catch (err) {
      app.toast(err instanceof Error ? err.message : String(err), 'err');
    }
  };

  const commitImport = async () => {
    if (importData === null) return;
    setCommitting(true);
    try {
      const r = await api<{count: number}>('import', {albums: importData});
      await app.refresh();
      app.toast(`已导入 ${r.count} 条`);
      setImportResult(null);
      setImportData(null);
    } catch (err) {
      app.toast(err instanceof Error ? err.message : String(err), 'err');
    } finally {
      setCommitting(false);
    }
  };

  const recent = state.audit.slice(-10).reverse();
  return (
    <>
      <section className="settings-section">
        <h3>备份与恢复</h3>
        <div className="inline-actions">
          <a className="link-button" href="/api/backup">下载完整备份</a>
          <a className="link-button" href="/api/export">导出专辑 CSV</a>
          <label className="file-label">恢复备份
            <input type="file" accept=".json,application/json" aria-label="选择完整备份" hidden
                   onChange={e => { const f = e.target.files?.[0]; if (f) onRestoreFile(f); e.target.value = ''; }}/>
          </label>
        </div>
        <Disclosure>
          <p>备份包含所有专辑、发行资料、上架描述、封面、包裹与交易。实物照片、录入草稿与模型配置需另行备份数据目录。</p>
          <p>恢复会替换当前账本，恢复前会自动保存当前状态。</p>
        </Disclosure>
      </section>

      <section className="settings-section">
        <h3>导入专辑资料</h3>
        <div className="inline-actions">
          <label className="file-label">选择 JSON 文件
            <input type="file" accept=".json,application/json" aria-label="选择专辑导入文件" hidden
                   onChange={e => { const f = e.target.files?.[0]; if (f) onImportFile(f); e.target.value = ''; }}/>
          </label>
        </div>
        <Disclosure>
          <p>支持 albums.json 格式（先预览再导入，重复来源自动跳过）。{app.modules.circulation ? '按买入币种进入海外或国内库存。' : '导入后进入我的收藏，原始购买资料会保留。'}</p>
        </Disclosure>
        {importError ? <p className="error" role="alert">{importError}</p> : null}
        {importResult && (
          <div className="import-preview">
            <strong>新增 {importResult.count} 条 · 已存在 {importResult.skipped} 条</strong>
            {importResult.errors.length ? (
              <p className="error">{importResult.errors.join('\n')}</p>
            ) : (
              <>
                <ul>{importResult.titles.map(t => <li key={t}>{t}</li>)}</ul>
                <button className="primary" disabled={!importResult.count || committing} onClick={commitImport}>导入</button>
              </>
            )}
          </div>
        )}
      </section>

      <section className="settings-section settings-rows">
        <NavRow href="#trash" icon={TrashIco} title="回收站" value={trash ? `${trash} 张` : ''}/>
      </section>

      <section className="settings-section">
        <h3>最近操作</h3>
        {recent.length ? <Disclosure summary={`最近 ${recent.length} 条`}>
          {recent.map((a, i) => <p key={i}>{a.at.replace('T', ' ')} · {a.action}</p>)}
        </Disclosure> : <p className="small-note">暂无操作记录。</p>}
      </section>
    </>
  );
}
