// 服务商详情页：头部状态 + 三步进度，下分「密钥/授权」「模型」「测试」三块，各自可单独操作。
import {api} from '../../core/api';
import type {ListingProviderId} from '../../core/listing';
import {ListingSteps} from '../ListingSteps/ListingSteps';
import {Dropdown} from '../ui/Dropdown';
import {ProviderIcon} from './ProviderIcon';
import {ProviderAccess} from './ProviderAccess';
import {PROVIDER_NAMES} from './providerNames';
import {useProvider} from './useProvider';

const efforts: Record<string, string> = {none: '关闭思考', minimal: '最低', low: '低', medium: '中',
  high: '高', xhigh: '更高', max: '最高', ultra: '超高'};
const stamp = (at: number) => new Date(at * 1000).toLocaleString('zh-CN', {hour12: false});

export function ProviderPage({id}: {id: ListingProviderId}) {
  const {provider, error, busy, run, configure, login} = useProvider(id);
  const meta = PROVIDER_NAMES[id];
  if (!provider) return <p role="status">{error || '正在读取服务商配置…'}</p>;
  const selected = provider.models.find(row => row.value === provider.model);
  const tested = provider.tested;
  const steps = [{label: meta.access, done: provider.connected}, {label: '选模型', done: !!selected || (id === 'api' && !!provider.model)},
    {label: '测试连接', done: !!tested?.ok}];
  return <div className="provider-page">
    <header className="provider-head">
      <ProviderIcon id={id}/>
      <div>
        <h3>{meta.name}</h3>
        <div className="provider-badges">
          {tested ? <span className={tested.ok ? 'badge-ok' : 'badge-bad'}>{tested.ok ? '已通过连接测试' : '连接测试未通过'}</span> : null}
          {provider.inUse ? <span className="badge-use">分析在用</span> : null}
        </div>
        <p className="small-note">{meta.note}{selected ? ` · 当前模型 ${selected.label}` : ''}</p>
      </div>
    </header>
    <ListingSteps steps={steps}/>
    <p role="alert" className="error">{error}</p>
    <section className="provider-section"><h4>{meta.access}</h4>
      <ProviderAccess provider={provider} busy={busy} run={run} configure={configure} login={login}/></section>
    <section className="provider-section"><h4>模型</h4>
      {provider.connected ? <>
        <div className="provider-keyrow">
          <button type="button" disabled={busy} onClick={() => {void run(() => api(`listing/models?provider=${id}`));}}>
            {provider.models.length ? '刷新模型列表' : '读取可用模型'}</button>
          <span className="small-note">{provider.models.length ? `共 ${provider.models.length} 个` : provider.model ? `当前：${provider.model}` : '尚未读取'}</span>
        </div>
        {provider.models.length ? <Dropdown label="照片分析模型" disabled={busy} value={provider.model}
          options={[{value: '', label: '请选择模型'}, ...provider.models.map(row => ({value: row.value,
            label: row.label + (row.vision === false ? ' · 仅文字' : ''), disabled: row.vision === false}))]}
          onPick={model => {void configure({model});}}/> : null}
        {selected ? <Dropdown label="思考强度" disabled={busy} value={provider.effort}
          options={[{value: '', label: '模型默认'}, ...selected.efforts.map(value => ({value, label: efforts[value] || value}))]}
          onPick={effort => {void configure({model: provider.model, effort});}}/> : null}
        {selected?.vision === null ? <p className="small-note">目录未声明图片能力，实际可用性以服务商响应为准。</p> : null}
      </> : <p className="small-note">先完成{meta.access}，再读取模型。</p>}
    </section>
    <section className="provider-section"><h4>测试</h4>
      <div className="provider-keyrow">
        <button type="button" disabled={busy || !provider.connected} onClick={() => {void run(() => api('listing/test', {provider: id}));}}>测试连接</button>
        {tested ? <span className="small-note" role="status">{tested.ok ? '读取模型目录成功' : tested.error} · {stamp(tested.at)}</span> : null}
      </div>
    </section>
    {provider.inUse ? null : <button type="button" className="primary provider-use" disabled={busy || !provider.ready}
      onClick={() => {void configure({});}}>设为分析在用</button>}
    {!provider.inUse && !provider.ready ? <p className="small-note">连接并选好支持图片的模型后，才能设为分析在用。</p> : null}
  </div>;
}
