// Uses the shared --with-models sample library, never creates ledger records.
import {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AppContext} from '../../src/state/AppContext';
import type {AppCtx} from '../../src/state/AppContext';
import {useAlbumEngine} from '../../src/state/useAlbumEngine';
import {AlbumModel} from '../../src/components/AlbumModel';
import {publishedAlbum} from '../../src/core/published-album';
import type {AlbumRecord, TwinIndex, TwinJob} from '../../src/types';
import '../../src/styles/tokens.css';
import '../../src/styles/base.css';
import '../../src/styles/album-model.css';
import './album-model.css';

const permission = Promise.resolve('unavailable' as const);
function Check() {
  const albumEngine = useAlbumEngine();
  const [record, setRecord] = useState<AlbumRecord | null>(null);
  const [job, setJob] = useState<TwinJob | undefined>();
  const [unavailable, setUnavailable] = useState(false);
  const [mounted, setMounted] = useState(true);
  const [refreshes, setRefreshes] = useState(0);
  const [photoCovered, setPhotoCovered] = useState(false);
  const [drawerCovered, setDrawerCovered] = useState(false);
  async function refresh() {
    const state = await (await fetch('/api/state')).json();
    const index: TwinIndex = await (await fetch('/api/twins')).json();
    const sample = state.records.find((r: AlbumRecord) => r.title === 'Lift Your Skinny Fists Like Antennas to Heaven');
    setRecord(sample); setJob(index.jobs[sample.id]); setRefreshes(n => n + 1);
  }
  useEffect(() => {void refresh();}, []);
  const published = record ? publishedAlbum(record, job, albumEngine.runtime) : null;
  return <AppContext.Provider value={{albumEngine} as AppCtx}><nav><button onClick={() => {void refresh();}}>重新获取副本</button>
    <button onClick={() => {setUnavailable(false);setMounted(n => !n);}}>关闭或重开模型</button>
    <button onClick={() => document.querySelector<HTMLCanvasElement>('.album-webgl-canvas')?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext()}>使 WebGL 上下文丢失</button>
    <button onClick={() => setPhotoCovered(value => !value)}>切换照片遮挡</button>
    <button onClick={() => setDrawerCovered(value => !value)}>切换抽屉收起遮挡</button>
    <output>刷新次数 {refreshes}</output></nav>
    {photoCovered ? <div id="lightbox" hidden/> : null}
    {drawerCovered ? <div className="drawer closing" hidden/> : null}
    {unavailable ? <p role="status">3D 不可用，返回 2D 封面</p> : mounted && published
      ? <AlbumModel entity={published.entity} resolveAsset={published.resolveAsset} modelBaseUrl={job?.models ? '/api/twin-model-assets/' + job.id + '/' : undefined} permission={permission} onDismiss={() => {}} onUnavailable={() => setUnavailable(true)}/> : '加载样本'}</AppContext.Provider>;
}
createRoot(document.getElementById('root')!).render(<Check/>);
