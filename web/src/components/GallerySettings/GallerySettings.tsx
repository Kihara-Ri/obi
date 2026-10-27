// 展示设置（抽屉内容）：展示顺序、封面大小、封面间距、滑动方向、显示标题与艺术家，每项一行（左标题、右分段控件）。
// 巡游速度在工具区的速度胶囊里调，不在这里。
// 抽屉内容是打开时的快照，所以这里用本地 state 镜像选项，改动同时回写页面偏好（onChange）。
import {useState} from 'react';
import type {ReactNode} from 'react';
import {Seg} from '../ui/Seg';
import {Switch} from '../ui/Switch';
import {galleryHasAxis} from '../../core/gallery';
import type {GalleryAxis, GalleryDensity, GalleryMode, GallerySort, GallerySpacing} from '../../core/gallery';
import './GallerySettings.css';

export interface GallerySettingsValues {
  sort: GallerySort; density: GalleryDensity; spacing: GallerySpacing; axis: GalleryAxis; showTitles: boolean;
}

const SORTS = [{value: 'recent', label: '最近加入'}, {value: 'artist', label: '按艺人'}, {value: 'title', label: '按专辑名'}];
const SIZED: GalleryMode[] = ['tiles', 'waterfall', 'film', 'table', 'isometric'];

function Row({title, children}: {title: string; children: ReactNode}) {
  return <section className="gallery-settings-row"><h3>{title}</h3>{children}</section>;
}

export function GallerySettings({mode, inGroup, initial, onChange}: {
  mode: GalleryMode; inGroup: boolean;
  initial: GallerySettingsValues;
  onChange: (patch: Partial<GallerySettingsValues>) => void;
}) {
  const [v, setV] = useState(initial);
  const set = (patch: Partial<GallerySettingsValues>) => { setV(p => ({...p, ...patch})); onChange(patch); };
  const sorts = inGroup ? [{value: 'group', label: '组内顺序'}, ...SORTS] : SORTS;
  return <div className="gallery-settings">
    <Row title="顺序">
      <Seg options={sorts} value={v.sort === 'group' && !inGroup ? 'recent' : v.sort} ariaLabel="展示顺序"
        onValue={sort => set({sort: sort as GallerySort})}/></Row>
    {SIZED.includes(mode) ? <Row title="封面大小">
      <Seg options={[{value: 'small', label: '小'}, {value: 'medium', label: '中'}, {value: 'large', label: '大'}]}
        value={v.density} ariaLabel="封面大小" onValue={density => set({density: density as GalleryDensity})}/></Row> : null}
    {mode === 'tiles' || mode === 'waterfall' ? <Row title="间距">
      <Seg options={[{value: 'none', label: '贴紧'}, {value: 'tight', label: '小'}, {value: 'normal', label: '标准'}, {value: 'wide', label: '大'}]}
        value={v.spacing} ariaLabel="封面间距" onValue={spacing => set({spacing: spacing as GallerySpacing})}/></Row> : null}
    {galleryHasAxis(mode) ? <Row title="滑动方向">
      <Seg options={[{value: 'vertical', label: '垂直'}, {value: 'horizontal', label: '水平'}]}
        value={v.axis} ariaLabel="滑动方向" onValue={axis => set({axis: axis as GalleryAxis})}/></Row> : null}
    {mode === 'tiles' || mode === 'table'
      ? <Row title="显示标题与艺术家">
        <Switch on={v.showTitles} label="显示标题与艺术家" onToggle={() => set({showTitles: !v.showTitles})}/></Row>
      : mode === 'waterfall' ? <p className="gallery-settings-note">瀑布流里标题随封面错落排列，始终显示。</p> : null}
  </div>;
}
