// 发行资料与实物包装分开：缺包装时直接展示必选图标，已知包装可就地更换。
import {useState} from 'react';
import {ReleaseMetadataFields} from '../../components/ReleaseMetadataFields';
import {PackagingPicker} from '../../components/PackagingIcon';
import {Details} from '../../components/ui/Details';
import {PACKAGING_PRESETS, confirmedPackagingName, packagingDisplay} from '../../core/album-packaging';
import {releaseRegion} from '../../core/release-metadata';
import type {FormCtx} from './context';

export function ReleaseDetails({ctx, show, onUnofficial}: {ctx: FormCtx; show: boolean; onUnofficial: (on: boolean) => void}) {
  const {v, set, dirty} = ctx;
  return <>
    {show ? <ReleaseMetadataFields info={v.releaseInfo} oldPressing={v.pressing}
      omit={['barcode', 'catalogNumber', 'packaging']} onUnofficial={onUnofficial}
      onChange={(key, value) => {
      const next = {...v.releaseInfo, [key]: value};
      set({releaseInfo: next,
        ...(key === 'country' ? {pressing: releaseRegion(value)} : {})});
      dirty();
    }}/> : null}
  </>;
}

/** 资料库缺包装与旧记录待核对都走同一必选入口，不从照片或数字发行推断。 */
export function PackageReview({ctx}: {ctx: FormCtx}) {
  const {v, set, dirty} = ctx;
  const [expanded, setExpanded] = useState(false);
  const name = confirmedPackagingName(v.version, v.packaging, v.releaseInfo.packaging);
  const picker = <PackagingPicker required value={name} onPick={label => {
    const preset = PACKAGING_PRESETS.find(p => p.label === label);
    const text = label.trim();
    if (!preset && !text) return;
    // 「其他」不带结构：去掉旧预设的结构字段，保留照片映射，3D 保持 2D。
    const {structure, thickness, panels, pockets, pocketOpening, holder, tray, discs, miniLP, slipcase, size, ...keep} = v.packaging ?? {};
    set({version: preset ? preset.label : label, packaging: preset ? {...v.packaging, ...preset.spec} : keep,
      releaseInfo: {...v.releaseInfo, packaging: preset ? preset.label : label}});
    setExpanded(true);
    dirty();
  }}/>;
  return <section id="record-packaging" className="form-section field record-package-review" tabIndex={-1}>
    {/* 始终同一棵树：自由描述输入时 name 由空变非空，不能换分支，否则输入框失焦 */}
    <Details summary={name ? <>实物包装 · {packagingDisplay(name).name}</> : <span className="field-label">请选择实物包装 · 必选</span>}
      open={!name || expanded} onOpenChange={setExpanded}>
      {picker}
    </Details>
  </section>;
}
