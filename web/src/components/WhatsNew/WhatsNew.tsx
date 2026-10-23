// 更新后第一次打开应用时的「更新说明」弹窗：列出上次看过的版本之后的改动（core/whats-new.ts）。
// 原生 <dialog>：焦点、Esc、背景遮罩由浏览器处理；关闭即记下当前版本。
import {useContext, useEffect, useRef, useState} from 'react';
import {AppContext} from '../../state/AppContext';
import {markSeen, parseChangelog, unseenNotes} from '../../core/whats-new';
import type {ReleaseNote} from '../../core/whats-new';
import './WhatsNew.css';

export function WhatsNew() {
  const version = useContext(AppContext)?.state.service?.version;
  const [notes, setNotes] = useState<ReleaseNote[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!version) return;
    let alive = true;
    void import('../../../../CHANGELOG.md?raw').then(m => {
      const found = alive ? unseenNotes(version, parseChangelog(m.default)) : [];
      if (found.length) setNotes(found);
    }).catch(() => { /* 没有更新说明就不弹 */ });
    return () => { alive = false; };
  }, [version]);
  useEffect(() => { if (notes.length && dialog.current && !dialog.current.open) dialog.current.showModal(); }, [notes]);
  if (!notes.length || !version) return null;
  const close = () => { markSeen(version); setNotes([]); };
  return <dialog ref={dialog} className="whats-new" aria-labelledby="whats-new-title" onClose={close}>
    <h2 id="whats-new-title">更新说明</h2>
    <div className="whats-new-body">
      {notes.map(n => <section key={n.version}>
        <h3>{n.version}{n.date ? <time> · {n.date}</time> : null}</h3>
        <ul>{n.items.map((t, i) => <li key={i}>{t}</li>)}</ul>
      </section>)}
    </div>
    <button type="button" className="whats-new-ok" autoFocus onClick={() => dialog.current?.close()}>知道了</button>
  </dialog>;
}
