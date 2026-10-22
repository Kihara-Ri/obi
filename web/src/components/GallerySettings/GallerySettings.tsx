// 展示设置（抽屉内容）：展示顺序、封面大小、显示标题与艺术家、漫游速度 / 切换间隔。
// 抽屉内容是打开时的快照，所以这里用本地 state 镜像选项，改动同时回写页面偏好（onChange）。
import {useState} from 'react';
import {Seg} from '../ui/Seg';
import {GalleryRoamingSpeed} from '../GalleryRoamingControls';
import type {GalleryDensity, GalleryMode, GallerySort} from '../../core/gallery';
import './GallerySettings.css';

export interface GallerySettingsValues {
  sort: GallerySort; density: GalleryDensity; showTitles: boolean; seconds: number;
}

const SORTS = [{value: 'recent', label: '最近加入'}, {value: 'artist', label: '按艺人'}, {value: 'title', label: '按专辑名'}];
const SIZED: GalleryMode[] = ['tiles', 'waterfall', 'film', 'table', 'isometric'];

export function GallerySettings({mode, inGroup, roaming, discrete, initial, onChange, onSpeed}: {
  mode: GalleryMode; inGroup: boolean; roaming: boolean; discrete: boolean;
  initial: GallerySettingsValues;
  onChange: (patch: Partial<Omit<GallerySettingsValues, 'seconds'>>) => void;
  onSpeed: (seconds: number) => void;
}) {
  const [v, setV] = useState(initial);
  const set = (patch: Partial<Omit<GallerySettingsValues, 'seconds'>>) => { setV(p => ({...p, ...patch})); onChange(patch); };
  const sorts = inGroup ? [{value: 'group', label: '组内顺序'}, ...SORTS] : SORTS;
  return <div className="gallery-settings">
    <section><h3>展示顺序</h3>
      <Seg options={sorts} value={v.sort === 'group' && !inGroup ? 'recent' : v.sort} ariaLabel="展示顺序"
        onValue={sort => set({sort: sort as GallerySort})}/></section>
    {SIZED.includes(mode) ? <section><h3>封面大小</h3>
      <Seg options={[{value: 'small', label: '小'}, {value: 'medium', label: '中'}, {value: 'large', label: '大'}]}
        value={v.density} ariaLabel="封面大小" onValue={density => set({density: density as GalleryDensity})}/></section> : null}
    {mode === 'tiles' || mode === 'table'
      ? <section className="gallery-settings-row"><div><h3>显示标题与艺术家</h3><p>在封面下方显示专辑名、艺术家等信息</p></div>
        <input type="checkbox" role="switch" aria-label="显示标题与艺术家" checked={v.showTitles}
          onChange={e => set({showTitles: e.target.checked})}/></section>
      : mode === 'waterfall' ? <p className="gallery-settings-note">瀑布流里标题随封面错落排列，始终显示。</p> : null}
    {roaming ? <section className="gallery-settings-row"><h3>{discrete ? '切换间隔' : '漫游速度'}</h3>
      <GalleryRoamingSpeed seconds={v.seconds} discrete={discrete} isometric={mode === 'isometric'}
        onSpeedChange={seconds => { setV(p => ({...p, seconds})); onSpeed(seconds); }}/></section> : null}
  </div>;
}
