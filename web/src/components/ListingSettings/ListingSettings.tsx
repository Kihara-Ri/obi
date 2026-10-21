// 服务商列表：每行显示连接/测试/在用状态，点进详情页完成密钥、模型、测试（D-013）。
import {useEffect, useState} from 'react';
import {api} from '../../core/api';
import type {ListingProvider} from '../../core/listing';
import {useApp} from '../../state/AppContext';
import {PROVIDER_NAMES} from './providerNames';
import {ProviderIcon} from './ProviderIcon';
import {ProviderPage} from './ProviderPage';
import {onListingChanged} from './useProvider';
import './ListingSettings.css';

type Row = ListingProvider['providers'][number];

export function ListingSettings() {
  const app = useApp();
  const [provider, setProvider] = useState<ListingProvider>();
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = () => api<ListingProvider>('listing/status').then(v => {if (alive) setProvider(v);}, e => {if (alive) setError(e.message);});
    void load();
    const off = onListingChanged(() => {void load();});
    return () => {alive = false; off();};
  }, []);
  const rows = provider?.providers ?? [];
  const current = rows.find(row => row.inUse && row.connected) ?? rows.find(row => row.connected);
  const others = rows.filter(row => row !== current);
  const Row = ({row}: {row: Row}) => {
    const meta = PROVIDER_NAMES[row.id];
    return <li><button type="button" className="provider-item"
      onClick={() => app.openDrawer({title: meta.name, content: <ProviderPage id={row.id}/>})}>
      <ProviderIcon id={row.id}/>
      <span className="provider-item-main"><b>{meta.name}</b><small>{meta.note}</small>
        <span className="provider-badges">
          {row.inUse ? <span className="badge-use">分析在用</span> : null}
          <span className={row.tested ? 'badge-ok' : row.connected ? 'badge-warn' : 'badge-off'}>
            {row.tested ? '已通过测试' : row.connected ? '未测试' : '未连接'}</span>
        </span></span>
      <span aria-hidden="true">›</span>
    </button></li>;
  };
  return <section className="settings-section listing-settings" aria-label="视觉模型接口设置">
    <h3>视觉模型接口</h3>
    <p className="small-note">可同时保留各服务商连接，分别设置模型。分析仅发送本副本照片、专辑名与艺人，且只在你点击分析时调用。</p>
    <p role="alert" className="error">{error}</p>
    {provider ? <>
      {current ? <ul className="provider-list"><Row row={current}/></ul> : null}
      {others.length ? <>
        {current ? <button type="button" className="provider-stack" aria-expanded={open}
          onClick={() => setOpen(!open)}>
          <span className="provider-stack-icons" aria-hidden="true">
            {others.map(row => <ProviderIcon key={row.id} id={row.id} size={26}/>)}</span>
          <span>{open ? '收起其他服务商' : `切换或添加服务商（${others.length}）`}</span>
          <span aria-hidden="true">{open ? '⌃' : '⌄'}</span>
        </button> : null}
        {open || !current ? <ul className="provider-list">{others.map(row => <Row key={row.id} row={row}/>)}</ul> : null}
      </> : null}
    </> : <p role="status">正在读取识别配置…</p>}
  </section>;
}
