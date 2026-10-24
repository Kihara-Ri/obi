// 展示设置（抽屉内容）：展示顺序、封面大小、显示标题与艺术家、巡游速度 / 切换间隔。
// 抽屉内容是打开时的快照，所以这里用本地 state 镜像选项，改动同时回写页面偏好（onChange）。
import {useState} from 'react';
import {OptionCards} from '../ui/OptionCards';
import {Switch} from '../ui/Switch';
import {AXIS_ICONS, SIZE_ICONS, SORT_ICONS, SPACING_ICONS} from './icons';
import {GalleryRoamingSpeed} from '../GalleryRoamingControls';
import {galleryHasAxis} from '../../core/gallery';
import type {GalleryAxis, GalleryDensity, GalleryMode, GallerySort, GallerySpacing} from '../../core/gallery';
import './GallerySettings.css';

export interface GallerySettingsValues {
  sort: GallerySort; density: GalleryDensity; spacing: GallerySpacing; axis: GalleryAxis; showTitles: boolean; seconds: number;
}

const SORTS = [{value: 'recent', label: '最近加入', icon: SORT_ICONS.recent}, {value: 'artist', label: '按艺人', icon: SORT_ICONS.artist}, {value: 'title', label: '按专辑名', icon: SORT_ICONS.title}];
const SIZED: GalleryMode[] = ['tiles', 'waterfall', 'film', 'table', 'isometric'];

export function GallerySettings({mode, inGroup, roaming, discrete, initial, onChange, onSpeed}: {
  mode: GalleryMode; inGroup: boolean; roaming: boolean; discrete: boolean;
  initial: GallerySettingsValues;
  onChange: (patch: Partial<Omit<GallerySettingsValues, 'seconds'>>) => void;
  onSpeed: (seconds: number) => void;
}) {
  const [v, setV] = useState(initial);
  const set = (patch: Partial<Omit<GallerySettingsValues, 'seconds'>>) => { setV(p => ({...p, ...patch})); onChange(patch); };
  const sorts = inGroup ? [{value: 'group', label: '组内顺序', icon: SORT_ICONS.group}, ...SORTS] : SORTS;
  return <div className="gallery-settings">
    <section><h3>展示顺序</h3>
      <OptionCards options={sorts} value={v.sort === 'group' && !inGroup ? 'recent' : v.sort} ariaLabel="展示顺序"
        onValue={sort => set({sort: sort as GallerySort})}/></section>
    {SIZED.includes(mode) ? <section><h3>封面大小</h3>
      <OptionCards options={[{value: 'small', label: '小', icon: SIZE_ICONS.small}, {value: 'medium', label: '中', icon: SIZE_ICONS.medium}, {value: 'large', label: '大', icon: SIZE_ICONS.large}]}
        value={v.density} ariaLabel="封面大小" onValue={density => set({density: density as GalleryDensity})}/></section> : null}
    {mode === 'tiles' || mode === 'waterfall' ? <section><h3>封面间距</h3>
      <OptionCards options={[{value: 'none', label: '贴紧', icon: SPACING_ICONS.none}, {value: 'tight', label: '小', icon: SPACING_ICONS.tight}, {value: 'normal', label: '标准', icon: SPACING_ICONS.normal}, {value: 'wide', label: '大', icon: SPACING_ICONS.wide}]}
        value={v.spacing} ariaLabel="封面间距" onValue={spacing => set({spacing: spacing as GallerySpacing})}/></section> : null}
    {galleryHasAxis(mode) ? <section><h3>滑动方向</h3>
      <OptionCards options={[{value: 'vertical', label: '垂直滑动', icon: AXIS_ICONS.vertical}, {value: 'horizontal', label: '水平滑动', icon: AXIS_ICONS.horizontal}]}
        value={v.axis} ariaLabel="滑动方向" onValue={axis => set({axis: axis as GalleryAxis})}/></section> : null}
    {mode === 'tiles' || mode === 'table'
      ? <section className="gallery-settings-row"><div><h3>显示标题与艺术家</h3><p>在封面下方显示专辑名、艺术家等信息</p></div>
        <Switch on={v.showTitles} label="显示标题与艺术家" onToggle={() => set({showTitles: !v.showTitles})}/></section>
      : mode === 'waterfall' ? <p className="gallery-settings-note">瀑布流里标题随封面错落排列，始终显示。</p> : null}
    {roaming ? <section className="gallery-settings-row"><h3>{discrete ? '切换间隔' : '巡游速度'}</h3>
      <GalleryRoamingSpeed seconds={v.seconds} discrete={discrete} isometric={mode === 'isometric'}
        onSpeedChange={seconds => { setV(p => ({...p, seconds})); onSpeed(seconds); }}/></section> : null}
  </div>;
}
