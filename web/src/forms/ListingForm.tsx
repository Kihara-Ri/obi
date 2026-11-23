// 手动登记或更正上架资料。批量登记共用平台，商品链接按实物副本填写。
import {useEffect, useState} from 'react';
import type {FormEvent} from 'react';
import {AlbumLine} from '../components/AlbumLine';
import {api} from '../core/api';
import {useApp} from '../state/AppContext';
import type {AppCtx} from '../state/AppContext';
import type {AlbumRecord} from '../types';
import {Field} from './fields';
import {FormMessage, useFormFeedback} from './form-feedback';
import {useFormSubmit} from './shared';

export function openListingForm(app: AppCtx, ids: string[], {edit = false, back}: {edit?: boolean; back?: string} = {}) {
  const records = ids.map(app.rec).filter(r => r !== undefined);
  if (!records.length || records.length !== ids.length) {
    app.toast('专辑已变更，请重新选择', 'err');
    return;
  }
  const multiple = records.length > 1;
  app.openDrawer({
    title: edit ? '编辑上架信息' : multiple ? '批量上架' : '标记上架',
    asForm: true, compact: !multiple, initialFocus: 'close',
    back: back ? {label: back, run: () => { app.backDrawer(); }} : undefined,
    content: <ListingForm records={records} edit={edit}/>,
  });
}

function ListingForm({records, edit}: {records: AlbumRecord[]; edit: boolean}) {
  const app = useApp();
  const {error, saving, run} = useFormSubmit();
  const feedback = useFormFeedback();
  const multiple = records.length > 1;
  const initialChannel = multiple ? '' : records[0].listingChannel ?? '';
  const [channel, setChannel] = useState(initialChannel);
  const [urls, setUrls] = useState(() => Object.fromEntries(records.map(r => [r.id, r.listingUrl ?? ''])));
  const edited = channel !== initialChannel || records.some(r => urls[r.id] !== (r.listingUrl ?? ''));
  useEffect(() => { app.setDrawerDirty(edited); }, [app.setDrawerDirty, edited]);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving || (edit && !edited)) return;
    const entries = records.map(r => ({id: r.id, revision: r.revision, url: urls[r.id],
      channel: multiple && !channel.trim() ? r.listingChannel ?? '' : channel}));
    const success = edit ? '上架信息已保存' : multiple ? `已标记上架 ${records.length} 张` : '已标记上架';
    void run(app, () => api('listing/details', {mode: edit ? 'edit' : 'list', entries}), success, {backOnSave: edit});
  };

  return <form id="listing-form" onSubmit={submit} noValidate onSubmitCapture={feedback.onSubmitCapture}>
    <div className="drawer-body">
      {feedback.feedback}
      {!multiple ? <AlbumLine r={records[0]} showCost={false}/> : null}
      <div className="form-section">
        <Field label="平台" name="listing-channel" value={channel} maxLength={100}
               placeholder={multiple ? '留空沿用原平台' : '选填'} onChange={e => setChannel(e.target.value)}/>
      </div>
      {records.map(r => <div key={r.id} className="form-section">
        {multiple ? <AlbumLine r={r} showCost={false}/> : null}
        <Field label="商品链接" name={`listing-url-${r.id}`} type="url" inputMode="url" value={urls[r.id]}
               maxLength={2000} placeholder="选填" autoComplete="off" autoCapitalize="off" spellCheck={false}
               onChange={e => setUrls({...urls, [r.id]: e.target.value})}/>
      </div>)}
    </div>
    <div className="drawer-footer">
      <FormMessage error={error}/>
      <button type="button" onClick={() => app.backDrawer()}>取消</button>
      <button type="submit" className="primary" aria-busy={saving} disabled={saving || (edit && !edited)}>
        {edit ? '保存' : '确认上架'}
      </button>
    </div>
  </form>;
}
