// Uses the shared --with-models sample library, never creates ledger records.
import {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AlbumModel} from '../../src/components/AlbumModel';
import {CSSAlbumModel} from '../../src/components/CSSAlbumModel';
import {twinViewerRecord} from '../../src/core/digital-twins';
import type {AlbumRecord, TwinIndex} from '../../src/types';
import '../../src/styles/tokens.css';
import '../../src/styles/base.css';
import '../../src/styles/album-model.css';
import './album-model.css';

const permission = Promise.resolve('unavailable' as const);
function Check() {
  const [record, setRecord] = useState<AlbumRecord | null>(null);
  const [simple, setSimple] = useState(false);
  const [mounted, setMounted] = useState(true);
  const [refreshes, setRefreshes] = useState(0);
  const [photoCovered, setPhotoCovered] = useState(false);
  const [drawerCovered, setDrawerCovered] = useState(false);
  async function refresh() {
    const state = await (await fetch('/api/state')).json();
    const index: TwinIndex = await (await fetch('/api/twins')).json();
    const sample = state.records.find((r: AlbumRecord) => r.title === 'Lift Your Skinny Fists Like Antennas to Heaven');
    setRecord(twinViewerRecord(sample, index.jobs[sample.id])); setRefreshes(n => n + 1);
  }
  useEffect(() => {void refresh();}, []);
  return <><nav><button onClick={() => {void refresh();}}>重新获取副本</button>
    <button onClick={() => setSimple(n => !n)}>切换备用模型</button>
    <button onClick={() => setMounted(n => !n)}>关闭或重开模型</button>
    <button onClick={() => document.querySelector<HTMLCanvasElement>('.album-webgl-canvas')?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext()}>使 WebGL 上下文丢失</button>
    <button onClick={() => setPhotoCovered(value => !value)}>切换照片遮挡</button>
    <button onClick={() => setDrawerCovered(value => !value)}>切换抽屉收起遮挡</button>
    <output>刷新次数 {refreshes}</output></nav>
    {photoCovered ? <div id="lightbox" hidden/> : null}
    {drawerCovered ? <div className="drawer closing" hidden/> : null}
    {mounted && record ? simple ? <CSSAlbumModel record={record} permission={permission} onDismiss={() => {}}/>
      : <AlbumModel record={record} permission={permission} onDismiss={() => {}}/> : '加载样本'}</>;
}
createRoot(document.getElementById('root')!).render(<Check/>);
