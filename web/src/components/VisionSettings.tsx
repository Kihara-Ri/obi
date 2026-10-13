import {useEffect, useState} from 'react';
import {api} from '../core/api';
import type {VisionConfig} from '../types';

/** Optional legacy photo recognition and digital-twin model, independent from barcode catalog lookup. */
export function VisionSettings() {
  const [expanded, setExpanded] = useState(false);
  const [config, setConfig] = useState<VisionConfig | null>(null);
  const [key, setKey] = useState('');
  const [clear, setClear] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);

  // No credential/config request on the normal barcode-first settings screen.
  useEffect(() => {
    if (!expanded || config) return;
    let active = true;
    api<VisionConfig>('vision')
      .then(value => { if (active) { setConfig(value); setMessage(''); setFailed(false); } })
      .catch(err => { if (active) {setMessage(err instanceof Error ? err.message : String(err)); setFailed(true);} });
    return () => {active = false;};
  }, [expanded, config]);

  return <section className="settings-section">
    <details className="settings-optional" onToggle={event => setExpanded(event.currentTarget.open)}>
      <summary>高级功能：AI 照片识别与数字实体生成{config?.configured ? '（已配置）' : ''}</summary>
      <div className="settings-optional-content">
        <p>只有主动执行照片识别、批量照片识别或数字实体生成任务时，才需要设置视觉模型。日常条形码匹配和 MusicBrainz / Cover Art Archive 查询不使用此配置。</p>
        <p>这里接入的是支持图片输入的 OpenAI 兼容 API，上传的照片将发送至你填写的服务；ChatGPT OAuth 不能直接填在 API 密钥栏。</p>
        {config ? <form onSubmit={async e => {
          e.preventDefault(); setSaving(true); setMessage('');
          try {
            const saved = await api<VisionConfig>('vision/config', {...config, apiKey: key, clearKey: clear});
            setConfig(saved); setKey(''); setClear(false); setFailed(false);
            setMessage('视觉模型配置已保存，仅在主动使用照片识别或数字实体生成时调用。');
          } catch(err) {
            setFailed(true); setMessage(err instanceof Error ? err.message : String(err));
          } finally {setSaving(false);}
        }}>
          <div className="vision-config-grid">
            <label>服务地址<input type="url" aria-label="视觉服务地址" placeholder="https://your.domain/v1" value={config.baseUrl}
              onChange={e => setConfig({...config, baseUrl: e.target.value})}/></label>
            <label>模型名<input aria-label="视觉模型名" placeholder="服务支持的视觉模型名称" value={config.model}
              onChange={e => setConfig({...config, model: e.target.value})}/></label>
            <label>API 密钥<input type="password" aria-label="视觉 API 密钥" autoComplete="new-password" value={key}
              placeholder={config.hasKey ? '已保存，留空保留原密钥' : '本地服务可留空'} onChange={e => setKey(e.target.value)}/></label>
            <label>同时识别组数<input type="number" min="1" max="6" step="1" aria-label="同时识别组数" value={config.concurrency}
              onChange={e => setConfig({...config, concurrency: Number(e.target.value)})}/></label>
          </div>
          <label className="check-line"><input type="checkbox" checked={config.lookup}
            onChange={e => setConfig({...config, lookup: e.target.checked})}/>
            照片识别后再查询公开发行资料（仅影响照片识别，不影响条形码查询）
          </label>
          {config.hasKey ? <label className="check-line"><input type="checkbox" checked={clear}
            onChange={e => setClear(e.target.checked)}/>清除已保存的密钥</label> : null}
          <button className="primary" disabled={saving}>{saving ? '保存中…' : '保存视觉模型配置'}</button>
        </form> : null}
        {!config && !failed ? <p className="small-note" role="status">正在读取可选模型配置…</p> : null}
        <p className={failed ? 'error' : 'small-note'} role="status">{message}</p>
      </div>
    </details>
  </section>;
}
