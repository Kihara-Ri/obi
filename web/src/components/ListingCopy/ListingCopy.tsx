// 文案是上架页主内容：默认阅读态，明确点“编辑”才出现输入框，复制操作始终在底栏。
import {useCallback, useId, useLayoutEffect, useRef, useState} from 'react';
import type {ListingDraft} from '../../core/listing';
import {AutoTextarea} from '../ui/AutoTextarea';
import {ListingCopyReader} from './ListingCopyReader';
import './ListingCopy.css';

type Props = {draft: ListingDraft; saved: boolean; candidate: boolean; busy: boolean;
  onChange: (value: ListingDraft) => void; onGenerate: () => void; onSave: () => void; ready: boolean};
export function ListingCopy({draft, saved, candidate, busy, onChange, onGenerate, onSave, ready}: Props) {
  const [editing, setEditing] = useState(false);
  const root = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const [long, setLong] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const readerId = useId();
  const closeReader = useCallback(() => setHost(null), []);
  useLayoutEffect(() => {
    const element = content.current;
    if (!element) {setLong(false); return;}
    const check = () => setLong(element.scrollHeight > element.clientHeight + 1);
    check();
    const observer = new ResizeObserver(check); observer.observe(element);
    return () => observer.disconnect();
  }, [draft.title, draft.description, editing, candidate]);
  const expand = () => {
    if (!long || window.getSelection()?.toString().trim()) return;
    const target = root.current?.closest('form')?.querySelector<HTMLElement>('.listing-reading-host');
    if (target) {preview.current?.focus({preventScroll: true}); setHost(target);}
  };
  return <section className="listing-copy" ref={root} aria-label={candidate ? '新文案候选' : '售卖文案'}>
    <header className="listing-copy-head"><h4>售卖文案{saved && !candidate ? ' · 已保存' : ''}</h4>
      <div className="listing-copy-tools">
        {draft.description ? <button type="button" disabled={busy || !ready} onClick={onGenerate}>重新生成</button> : null}
        {!candidate ? <button type="button" disabled={busy} onClick={() => setEditing(value => !value)}>{editing ? '预览' : '编辑'}</button> : null}
      </div>
    </header>
    {candidate ? <p className="listing-copy-status">新文案 · 原稿已保留</p> : null}
    {editing && !candidate ? <div className="listing-copy-editor">
      <label>售卖标题<input aria-label="售卖标题" value={draft.title} maxLength={500} disabled={busy}
        onChange={e => onChange({...draft, title: e.target.value})}/></label>
      <label>售卖正文<AutoTextarea aria-label="售卖正文" value={draft.description} maxLength={50000} disabled={busy}
        onChange={e => onChange({...draft, description: e.target.value})}/></label>
      <button type="button" disabled={busy} onClick={onSave}>保存草稿</button>
    </div> : <div className={`listing-copy-preview${long ? ' is-long' : ''}`} ref={preview}
      role={long ? 'button' : undefined} tabIndex={long ? 0 : undefined} aria-label={long ? '展开全文' : undefined}
      aria-expanded={long ? !!host : undefined} aria-controls={long ? readerId : undefined} onClick={expand}
      onKeyDown={event => {if (long && (event.key === 'Enter' || event.key === ' ')) {event.preventDefault(); expand();}}}>
      {draft.description ? <div className="listing-copy-text listing-copy-clipped" ref={content}>
        <h3>{draft.title}</h3><p>{draft.description}</p>
      </div> : <div className="listing-copy-text"><h3>{draft.title}</h3><div className="listing-copy-empty">还没有售卖文案<span>点下方生成，完成后直接复制到闲鱼。</span></div></div>}
      {long ? <span className="listing-copy-expand">展开全文</span> : null}
    </div>}
    {host && root.current ? <ListingCopyReader host={host} origin={root.current} draft={draft} saved={saved}
      candidate={candidate} id={readerId} onClose={closeReader}/> : null}
  </section>;
}
