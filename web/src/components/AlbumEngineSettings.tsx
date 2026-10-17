import {useRef, useState} from 'react';
import {useApp} from '../state/AppContext';
import {Disclosure} from './ui/Disclosure';

export function AlbumEngineSettings() {
  const app = useApp(), engine = app.albumEngine;
  const [error, setError] = useState('');
  const gate = useRef(false);
  const status = engine.status;
  const change = async () => {
    if (gate.current || !status) return;
    gate.current = true; setError('');
    try {
      await (status.installed ? engine.uninstall() : engine.install());
      app.toast(status.installed ? 'Album Engine 已卸载，实体资料与素材已保留' : 'Album Engine 已安装');
      await app.refreshTwins().catch(() => {});
    } catch (exc) {setError(exc instanceof Error ? exc.message : '操作失败，请重试');}
    finally {gate.current = false;}
  };
  return <section className="settings-section" aria-label="Album Engine 插件">
    <h3>Album Engine · 3D 数字实体</h3>
    <p role="status">{status ? status.installed ? '已安装 ' + status.version : '未安装' : '正在读取引擎状态…'}
      {status?.availableVersion ? ' · 可安装版本 ' + status.availableVersion : ''}</p>
    {status?.busy ? <p className="small-note">数字实体任务正在运行，结束后可卸载。</p> : null}
    {error || engine.error || status?.error ? <p className="error" role="alert">{error || engine.error || status?.error}</p> : null}
    <Disclosure>
      <p>安装后可生成、编辑与查看 3D 实体。基础收藏、发行资料与 2D 封面始终可用。</p>
      <p>卸载保留已有实体、照片、模型素材与展示设置；重新安装后可继续查看。</p>
    </Disclosure>
    <div className="inline-actions">
      <button type="button" disabled={!status || engine.changing || status.busy || (!status.installed && !status.available)}
        className={status?.installed ? 'quiet' : 'primary'} onClick={() => void change()}>
        {engine.changing ? '正在处理…' : status?.installed ? '卸载 Album Engine' : '安装 Album Engine'}</button>
      {engine.error ? <button type="button" disabled={engine.changing} onClick={() => void engine.retry()}>刷新状态</button> : null}
    </div>
  </section>;
}
