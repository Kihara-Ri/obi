// 文案是上架页主内容，一张卡片三种状态：空态（就地生成）、阅读（限高渐隐，就地展开/收起）、编辑（输入框，完成/保存在底栏）。
// 展开只增高卡片本身，下方内容顺势推下；收起条吸附在可视区底部，长文读到哪都能收。
import {useLayoutEffect, useRef, useState} from 'react';
import type {ListingDraft} from '../../core/listing';
import {AutoTextarea} from '../ui/AutoTextarea';
import {ChevDownIco} from '../icons';
import './ListingCopy.css';

type Props = {draft: ListingDraft; saved: boolean; candidate: boolean; busy: boolean; ready: boolean;
  editing: boolean; generating?: string; onEditing: (value: boolean) => void;
  onChange: (value: ListingDraft) => void; onGenerate: () => void};
export function ListingCopy({draft, saved, candidate, busy, ready, editing, generating, onEditing, onChange, onGenerate}: Props) {
  const clip = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const [long, setLong] = useState(false);
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(0);
  const hasText = !!draft.description.trim();
  useLayoutEffect(() => {
    const element = text.current, box = clip.current;
    if (!element || !box) {setLong(false); setOpen(false); return;}
    const check = () => {
      setFull(element.offsetHeight);
      // 用正文自然高度对比限高：不读 clip 的当前高度，免得动画途中被误判为不超长。
      const cap = parseFloat(getComputedStyle(box).getPropertyValue('--listing-preview-max')) * parseFloat(getComputedStyle(document.documentElement).fontSize);
      setLong(element.offsetHeight > cap + 1);
    };
    check();
    const observer = new ResizeObserver(check); observer.observe(element);
    return () => observer.disconnect();
  }, [draft.title, draft.description, editing, candidate, hasText]);
  const toggle = () => {
    if (!long || window.getSelection()?.toString().trim()) return;
    setOpen(value => !value);
  };
  const badge = editing ? '编辑中' : candidate ? '新文案' : hasText ? (saved ? '已保存' : '未保存') : '';
  const showText = hasText && (!editing || candidate);
  return <section className={`listing-copy${open ? ' is-open' : ''}`} aria-label={candidate ? '新文案候选' : '售卖文案'}>
    <header className="listing-copy-head">
      <h4>售卖文案{badge ? <span className={`listing-copy-badge${badge === '未保存' || badge === '编辑中' ? ' is-pending' : ''}`}> · {badge}</span> : null}</h4>
      <div className="listing-copy-tools">
        {hasText ? <button type="button" disabled={busy || !ready} onClick={onGenerate}>重新生成</button> : null}
        {!candidate && !editing && hasText ? <button type="button" className="listing-copy-edit" disabled={busy} onClick={() => onEditing(true)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/></svg>编辑</button> : null}
      </div>
    </header>
    {candidate ? <p className="listing-copy-status">新文案 · 原稿已保留，采用后才会替换</p> : null}
    {editing && !candidate ? <div className="listing-copy-editor">
      <label>售卖标题<input aria-label="售卖标题" value={draft.title} maxLength={500} disabled={busy}
        onChange={e => onChange({...draft, title: e.target.value})}/></label>
      <label>售卖正文<AutoTextarea aria-label="售卖正文" value={draft.description} maxLength={50000} disabled={busy}
        onChange={e => onChange({...draft, description: e.target.value})}/></label>
    </div> : showText ? <div className={`listing-copy-preview${long ? ' is-long' : ''}`}>
      <div className="listing-copy-clip" ref={clip} style={open ? {maxHeight: `${full}px`} : undefined} onClick={toggle}>
        <div className="listing-copy-text" ref={text}><h3>{draft.title}</h3><p>{draft.description}</p></div>
      </div>
      {long ? <button type="button" className="listing-copy-toggle" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        {open ? '收起全文' : '展开全文'}<span className="listing-copy-chev" aria-hidden="true">{ChevDownIco}</span></button> : null}
    </div> : <div className="listing-copy-empty">
      <strong>还没有售卖文案</strong>
      <span>AI 会核对资料与照片后写好，完成后可直接复制到闲鱼。</span>
      <button type="button" className="primary" aria-busy={!!generating} disabled={busy || !ready} onClick={onGenerate}>
        {generating || 'AI 生成上架资料'}</button>
      <button type="button" className="listing-copy-manual" disabled={busy} onClick={() => onEditing(true)}>或手动编写</button>
    </div>}
  </section>;
}
