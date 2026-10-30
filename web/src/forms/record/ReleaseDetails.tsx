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
    if (!preset) return;
    set({version: preset.label, packaging: {...v.packaging, ...preset.spec},
      releaseInfo: {...v.releaseInfo, packaging: preset.label}});
    setExpanded(true);
    dirty();
  }}/>;
  return <section id="record-packaging" className="form-section field record-package-review" tabIndex={-1}>
    {!name ? <><span className="field-label">请选择实物包装 · 必选</span>{picker}</>
      : <Details summary={<>实物包装 · {packagingDisplay(name).name}</>} open={expanded} onOpenChange={setExpanded}>
        {picker}
      </Details>}
  </section>;
}
