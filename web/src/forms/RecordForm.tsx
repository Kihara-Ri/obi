// 添加 / 编辑专辑表单：先以条码 / 唱片编号确定发行版（查不到可手动录入未收录版本），
// 封面自动抓取（唯一精确匹配自动带入）、日元成本实时折算、库内模糊匹配带入、
// 实物照片（HEIC 压缩）、碟盒/版次/侧标联动。各区块与逻辑拆在 forms/record/。
import {useEffect, useRef, useState} from 'react';
import {api} from '../core/api';
import {today} from '../core/format';
import {prefs} from '../core/prefs';
import {useApp} from '../state/AppContext';
import type {AppCtx} from '../state/AppContext';
import type {AlbumRecord, Currency, Status} from '../types';
import {CopyEditionFields} from '../components/CopyEditionFields';
import {Seg} from '../components/ui/Seg';
import {ShopField} from '../components/ShopField';
import {Field, TextareaField} from './fields';
import {usePhotoSlots} from './PhotoSlots';
import {useFormSubmit} from './shared';
import {buildPayload} from './record/buildPayload';
import {initialValues, type FormCtx, type RecordValues} from './record/context';
import {CoverPanel} from './record/CoverPanel';
import {MoneySection} from './record/MoneySection';
import {PhotoEntry} from './record/PhotoEntry';
import {PackageReview, ReleaseDetails} from './record/ReleaseDetails';
import {ReleaseLookupSection} from './record/ReleaseLookupSection';
import {useCostPreview} from './record/useCostPreview';
import {useCoverSearch} from './record/useCoverSearch';
import {useRecordHints} from './record/useRecordHints';
import {useReleaseLookup} from './record/useReleaseLookup';

export function openRecordForm(app: AppCtx, id?: string) {
  app.openDrawer({title: id ? '编辑专辑' : '添加专辑', asForm: true, content: <RecordForm id={id}/>});
}

export function RecordForm({id}: {id?: string}) {
  const app = useApp();
  const {modules} = app;
  const r = id ? app.rec(id) : undefined;
  const {error, saving, run, setError} = useFormSubmit();
  const formRef = useRef<HTMLFormElement>(null);
  const base = useRef<Partial<AlbumRecord>>(r ? {...r} : {
    title: '', artist: '', price: '', date: modules.acquisition ? today() : '',
    currency: (prefs.get('currency', modules.circulation ? 'JPY' : 'CNY') as Currency) || 'CNY',
    location: modules.acquisition ? prefs.get('location', '') : '', fees: '0', actual: '', note: '',
  });
  const where: Status | null = r ? null : !modules.circulation ? 'domestic' : (base.current.currency === 'CNY' ? 'domestic' : 'overseas');
  const [v, setV] = useState<RecordValues>(() => initialValues(base.current, where));
  const live = useRef(v); live.current = v;
  const dirty = () => app.setDrawerDirty(true);
  const ctx: FormCtx = {v, setV, live, base, dirty, formRef,
    set: patch => setV(prev => ({...prev, ...patch}))};
  const {set} = ctx;

  const cover = useCoverSearch(ctx, !!r?.cover);
  const lookup = useReleaseLookup(ctx, cover, r);
  const {hints, dupHint, onTitleInput, onArtistInput, applyHint} = useRecordHints(ctx, cover);
  const preview = useCostPreview(v, modules.acquisition);
  const photos = usePhotoSlots(
    r ? Array.from({length: r.photoCount || 0}, (_, i) => ({existing: i})) : [], app.toast);
  // 该副本若在日元运单里分摊过运费，费用字段下注明日元原额与折算
  const shipItem = (() => {
    const s = r?.shipmentId ? app.state.shipments.find(x => x.id === r.shipmentId) : undefined;
    return s && s.currency === 'JPY' ? s.items.find(i => i.recordId === id) : undefined;
  })();

  // 是否有实际改动：与打开表单时的快照逐字比对，改回原值会自动回到「未修改」态。
  // 照片槽只记序号/长度（data URL 太长），失败槽与保存口径一致地忽略。
  const sign = () => JSON.stringify([v, base.current.cover || '',
    photos.slots.map(p => 'existing' in p ? `e${p.existing}` : 'pending' in p ? 'p' : 'error' in p ? '' : `d${p.data.length}`)]);
  const pristine = useRef(sign());
  const edited = sign() !== pristine.current;
  useEffect(() => { app.setDrawerDirty(edited); }, [edited]);

  const {manualRelease, identified} = lookup;
  const mbId = v.releaseInfo.musicBrainzReleaseId;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const miss = ([['title', '专辑名'], ['artist', '艺人']] as const).filter(([k]) => !v[k].trim());
    if (miss.length) { setError(id || manualRelease ? '请先补全：' + miss.map(([, n]) => n).join('、') : '请先通过条码或唱片编号匹配发行版'); return; }
    if (!id && !identified) {setError('请先确认发行版本；资料库都查不到时可选择手动录入');return;}
    if (lookup.verification !== 'verified' || lookup.barcode !== (v.releaseInfo.barcode || '')) {
      setError('条码尚未通过资料库校验，请确认对应发行版本后保存');return;
    }
    if ((r?.releaseInfo?.musicBrainzReleaseId || '') && !mbId && !manualRelease) {
      setError('发行版本已改变，请重新查询并选择 MusicBrainz 发行版');return;
    }
    if (lookup.busy) {setError('正在检索发行资料，请稍候');return;}
    if (lookup.coverBusy) {setError('封面还在匹配中（通常约 10 秒），稍候再保存；也可以之后在编辑里补封面');return;}
    if (photos.hasPending) { setError('还有照片在处理中，等缩略图就绪后再保存'); return; }
    run(app, async () => {
      await api('records', buildPayload(base.current, v, where, photos.slots, modules.acquisition));
    }, '已保存', {backOnSave: !!id});
  };

  return (
    <form id="record-form" ref={formRef} onSubmit={submit} noValidate
          data-status={where || r?.status} data-cur={v.currency}>
      <div className="drawer-body">
        <div className="error" role="alert">{error}</div>
        <PhotoEntry ctx={ctx} photos={photos} recordId={r?.id ?? null}/>
        <h3 className="section-title form-group-title">专辑资料</h3>
        <ReleaseLookupSection v={v} lookup={lookup}/>
        {id && mbId ? <button type="button" className="quiet record-refresh-release"
          disabled={lookup.busy} onClick={() => void lookup.refreshReleaseMetadata()}>从 MusicBrainz 补全缺失发行资料</button> : null}
        <ReleaseDetails ctx={ctx} show={!!(id || identified)}/>
        {id || manualRelease ? <div className="form-grid form-section">
          <Field label={manualRelease && !id ? '专辑名' : '专辑名（更正用）'} name="title" required autoComplete="off" value={v.title}
                 onChange={e => mbId ? (set({title: e.target.value}), dirty()) : onTitleInput(e.target.value)}
                 onBlur={cover.scheduleCover}/>
          <Field label="艺人" name="artist" required autoComplete="off" value={v.artist}
                 onChange={e => onArtistInput(e.target.value)} onBlur={cover.scheduleCover}/>
        </div> : null}
        {id && !mbId ? <div id="ta-hints" className="suggestions">
          {hints.label ? <small>{hints.label}</small> : null}
          {hints.items.map(h => (
            <button key={h.id} type="button" className="quiet" onClick={() => applyHint(h.id)}>{h.text}</button>
          ))}
        </div> : null}
        {id && !mbId && dupHint ? <p className="dup-hint">{dupHint}</p> : null}
        {id || identified || cover.candidates.length ? <CoverPanel cover={cover} src={base.current.cover || ''} busy={lookup.coverBusy}/> : null}
        <h3 className="section-title form-group-title">这一张</h3>
        <PackageReview ctx={ctx} record={r}/>
        <CopyEditionFields obi={v.obi} onChange={change => { set(change); dirty(); }}/>
        {modules.acquisition || (!id && modules.circulation) ? <>
          <h3 className="section-title form-group-title">购买信息</h3>
          <div className="row-group">
            {modules.acquisition ? <MoneySection ctx={ctx} preview={preview} shipItem={shipItem}/> : null}
            {modules.acquisition ? <ShopField value={v.location} records={app.state.records}
                       defaultShop={prefs.get('location', '')}
                       onChange={val => { set({location: val}); dirty(); }}/> : null}
            {!id && modules.circulation ? <div className="row">
              <label>入库位置</label>
              <div className="row-value">
                <Seg ariaLabel="入库位置"
                     options={[{value: 'overseas', label: '海外库存'}, {value: 'domestic', label: '国内库存'}]}
                     value={v.status || ''} onValue={s => { set({status: s as Status}); dirty(); }}/>
              </div>
            </div> : null}
          </div>
        </> : null}
        <h3 className="section-title form-group-title">备注</h3>
        <div className="form-grid record-remarks">
          <TextareaField label="备注 · 这张副本" name="note" value={v.note}
            onChange={val => {set({note: val}); dirty();}}/>
          <TextareaField label="备注 · 这张专辑（所有副本共享）" name="noteAlbum" value={v.noteAlbum}
            onChange={val => {set({noteAlbum: val}); dirty();}}/>
        </div>
      </div>
      <div className="drawer-footer">
        {!id && !identified ? <p className="footer-hint">先查询并确认发行版，才能保存</p> : null}
        <button type="button" onClick={() => app.backDrawer()}>取消</button>
        <button type="submit" className="primary" disabled={saving || !edited}>{id ? '保存修改' : '保存并入库'}</button>
      </div>
    </form>
  );
}
