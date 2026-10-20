// 设置 · 数据 · 进出：导出 CSV，以及 albums.json 导入（选文件 → 预览新增/跳过 → 确认或取消，三步可见）。
import {useState} from 'react';
import {api} from '../../core/api';
import {useApp} from '../../state/AppContext';
import {DownloadButton} from '../../components/DownloadButton';

interface ImportPreview {count: number; skipped: number; errors: string[]; titles: string[]}

export function ImportSection() {
  const app = useApp();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [data, setData] = useState<unknown[] | null>(null);
  const [error, setError] = useState('');
  const [committing, setCommitting] = useState(false);
  const reset = () => { setPreview(null); setData(null); setError(''); };

  const onFile = async (file: File) => {
    setError('');
    try {
      const parsed = JSON.parse(await file.text());
      setPreview(await api<ImportPreview>('import-preview', {albums: parsed}));
      setData(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  const commit = async () => {
    if (data === null) return;
    setCommitting(true);
    try {
      const r = await api<{count: number}>('import', {albums: data});
      await app.refresh();
      app.toast(`已导入 ${r.count} 条`);
      reset();
    } catch (err) {
      app.toast(err instanceof Error ? err.message : String(err), 'err');
    } finally {
      setCommitting(false);
    }
  };
  const step = preview ? 2 : 1;

  return <section className="settings-section data-block">
    <h3>导入与导出</h3>
    <div className="inline-actions">
      <DownloadButton path="export" fileName="albums.csv">导出专辑 CSV</DownloadButton>
    </div>
    <h4 className="data-sub">导入专辑资料</h4>
    <ol className="data-steps" aria-label="导入步骤">
      <li className={step === 1 ? 'on' : 'done'}>选择文件</li>
      <li className={step === 2 ? 'on' : ''}>预览并确认</li>
    </ol>
    {!preview ? <>
      <div className="inline-actions">
        <label className="file-label">选择 albums.json
          <input type="file" accept=".json,application/json" aria-label="选择专辑导入文件" hidden
                 onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}/>
        </label>
      </div>
      <p className="small-note">先预览再导入，重复来源自动跳过。{app.modules.circulation ? '按买入币种进入海外或国内库存。' : '导入后进入我的收藏，原始购买资料会保留。'}</p>
    </> : null}
    {error ? <p className="error" role="alert">{error}</p> : null}
    {preview ? <div className="import-preview">
      <strong>新增 {preview.count} 条 · 已存在 {preview.skipped} 条</strong>
      {preview.errors.length ? <p className="error">{preview.errors.join('\n')}</p>
        : <ul>{preview.titles.map(t => <li key={t}>{t}</li>)}</ul>}
      <div className="inline-actions">
        {!preview.errors.length ? <button className="primary" disabled={!preview.count || committing} onClick={commit}>导入 {preview.count} 条</button> : null}
        <button type="button" disabled={committing} onClick={reset}>取消</button>
      </div>
    </div> : null}
  </section>;
}
