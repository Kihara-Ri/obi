// 发行资料编辑区：「发行资料 · 查看及更正」折叠区（专辑层）；包装结构「待核对」的确认下拉是副本层，单独导出 PackageReview。
import {Dropdown} from '../../components/ui/Dropdown';
import {ReleaseMetadataFields} from '../../components/ReleaseMetadataFields';
import {PACKAGING_PRESETS} from '../../core/album-packaging';
import {releaseRegion} from '../../core/release-metadata';
import type {AlbumRecord} from '../../types';
import type {FormCtx} from './context';

export function ReleaseDetails({ctx, show, onUnofficial}: {ctx: FormCtx; show: boolean; onUnofficial: (on: boolean) => void}) {
  const {v, set, dirty} = ctx;
  return <>
    {show ? <ReleaseMetadataFields info={v.releaseInfo} oldPressing={v.pressing}
      omit={['barcode', 'catalogNumber']} onUnofficial={onUnofficial} onChange={(key, value) => {
      const next = {...v.releaseInfo, [key]: value};
      const preset = key === 'packaging' ? PACKAGING_PRESETS.find(p => p.label === value) : undefined;
      set({releaseInfo: next,
        ...(key === 'packaging' ? {version: value,
          ...(preset ? {packaging: {...v.packaging, ...preset.spec}} : {})} : {}),
        ...(key === 'country' ? {pressing: releaseRegion(value)} : {})});
      dirty();
    }}/> : null}
  </>;
}

/** 包装结构仍是「待核对」时，让用户确认实际包装（不猜测折叠结构）；属于「这一张」。 */
export function PackageReview({ctx, record}: {ctx: FormCtx; record?: AlbumRecord}) {
  const {v, set, dirty} = ctx;
  return <>
    {(v.version === '待核对' || v.packaging?.structure === 'unknown') ? (
      <div className="form-section field record-package-review">
        <span className="field-label">包装结构待核对 · 原记录：{record?.legacyPackaging || record?.version || '未知'}</span>
        <Dropdown id="record-package-review" value="__unknown" label="确认实际包装结构"
          options={[{value: '__unknown', label: '待核对（不猜测折叠结构）'},
            ...PACKAGING_PRESETS.map(p => ({value: p.value, label: p.label}))]}
          onPick={code => {
            const preset = PACKAGING_PRESETS.find(p => p.value === code);
            if (!preset) return;
            set({version: preset.label, packaging: {...v.packaging, ...preset.spec},
              releaseInfo: {...v.releaseInfo, packaging: preset.label}});
            dirty();
          }}/>
      </div>
    ) : null}
  </>;
}
