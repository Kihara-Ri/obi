// 服务商列表：每行显示连接/测试/在用状态，点进详情页完成密钥、模型、测试（D-013）。
import {useEffect, useState} from 'react';
import {api} from '../../core/api';
import type {ListingProvider} from '../../core/listing';
import {useApp} from '../../state/AppContext';
import {PROVIDER_NAMES} from './providerNames';
import {ProviderPage} from './ProviderPage';
import {onListingChanged} from './useProvider';
import './ListingSettings.css';

export function ListingSettings() {
  const app = useApp();
  const [provider, setProvider] = useState<ListingProvider>();
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    const load = () => api<ListingProvider>('listing/status').then(v => {if (alive) setProvider(v);}, e => {if (alive) setError(e.message);});
    void load();
    const off = onListingChanged(() => {void load();});
    return () => {alive = false; off();};
  }, []);
  return <section className="settings-section listing-settings" aria-label="售卖照片识别设置">
    <h3>售卖照片识别</h3>
    <p className="small-note">可同时保留各服务商连接，分别设置模型。分析仅发送本副本照片、专辑名与艺人，且只在你点击分析时调用。</p>
    <p role="alert" className="error">{error}</p>
    {provider ? <ul className="provider-list">
      {provider.providers.map(row => {
        const meta = PROVIDER_NAMES[row.id];
        return <li key={row.id}><button type="button" className="provider-item"
          onClick={() => app.openDrawer({title: meta.name, content: <ProviderPage id={row.id}/>})}>
          <span className="provider-tile" aria-hidden="true">{meta.mark}</span>
          <span className="provider-item-main"><b>{meta.name}</b><small>{meta.note}</small></span>
          <span className="provider-badges">
            {row.inUse ? <span className="badge-use">分析在用</span> : null}
            <span className={row.tested ? 'badge-ok' : row.connected ? 'badge-warn' : 'badge-off'}>
              {row.tested ? '已通过测试' : row.connected ? '未测试' : '未连接'}</span>
          </span>
          <span aria-hidden="true">›</span>
        </button></li>;
      })}
    </ul> : <p role="status">正在读取识别配置…</p>}
  </section>;
}
