// 文案是上架页主内容，一张卡片三种状态：空态（就地生成）、阅读（始终全文，可正常选字）、编辑（输入框，完成/保存在底栏）。
// 编辑就地进行（data-native-input）：长文要对照上下文改，不走手机抽屉的聚焦输入层。
// 生成设置（风格、本次补充）跟着生成走：空态里直接摆在生成按钮上方；已有文案时点「重新生成」在标题下展开面板，
// 调好再点「开始生成」（2026-11-20：原先是页面底部单独的折叠项，与重新生成离得远、看不出关系）。
import {useState} from 'react';
import type {ReactNode} from 'react';
import type {ListingDraft} from '../../core/listing';
import {AutoTextarea} from '../ui/AutoTextarea';
import {Collapse} from '../ui/Collapse';
import './ListingCopy.css';

type Props = {draft: ListingDraft; saved: boolean; candidate: boolean; busy: boolean; ready: boolean;
  editing: boolean; generating?: string; streaming?: {title?: string; description?: string};
  settings: ReactNode; onEditing: (value: boolean) => void;
  onChange: (value: ListingDraft) => void; onGenerate: () => void};
export function ListingCopy({draft, saved, candidate, busy, ready, editing, generating, streaming, settings, onEditing, onChange, onGenerate}: Props) {
  const [panel, setPanel] = useState(false);
  const isStreaming = !!(streaming && (streaming.title || streaming.description));
  const activeTitle = isStreaming ? (streaming.title || '正在构思标题…') : draft.title;
  const activeDescription = isStreaming ? streaming.description : draft.description;
  const hasText = isStreaming || !!draft.description.trim();
  const badge = isStreaming ? '生成中' : editing ? '编辑中' : candidate ? '新文案' : hasText ? (saved ? '已保存' : '未保存') : '';
  const showText = hasText && (!editing || candidate || isStreaming);
  const canPanel = hasText && !isStreaming;
  const start = () => {setPanel(false); onGenerate();};
  return <section className="listing-copy" aria-label={candidate ? '新文案候选' : '售卖文案'}>
    <header className="listing-copy-head">
      <h4>售卖文案{badge ? <span className={`listing-copy-badge${badge === '未保存' || badge === '编辑中' || isStreaming ? ' is-pending' : ''}`}> · {badge}</span> : null}</h4>
      <div className="listing-copy-tools">
        {canPanel ? <button type="button" aria-expanded={panel} disabled={busy} onClick={() => setPanel(v => !v)}>重新生成</button> : null}
        {!candidate && !editing && hasText && !isStreaming ? <button type="button" className="listing-copy-edit" disabled={busy} onClick={() => onEditing(true)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/></svg>编辑</button> : null}
      </div>
    </header>
    {hasText ? <Collapse open={panel && canPanel && !generating}>
      <div className="listing-copy-panel" aria-label="重新生成设置">
        {settings}
        <div className="listing-copy-panel-actions">
          <button type="button" onClick={() => setPanel(false)}>取消</button>
          <button type="button" className="primary" disabled={busy || !ready} onClick={start}>开始生成</button>
        </div>
      </div>
    </Collapse> : null}
    {candidate && !isStreaming ? <p className="listing-copy-status">新文案 · 原稿已保留，采用后才会替换</p> : null}
    {editing && !candidate && !isStreaming ? <div className="listing-copy-editor" data-native-input>
      <label>售卖标题<input aria-label="售卖标题" value={draft.title} maxLength={500} disabled={busy}
        onChange={e => onChange({...draft, title: e.target.value})}/></label>
      <label>售卖正文<AutoTextarea aria-label="售卖正文" value={draft.description} maxLength={50000} disabled={busy}
        onChange={e => onChange({...draft, description: e.target.value})}/></label>
    </div> : showText ? <div className="listing-copy-preview">
      <div className="listing-copy-text">
        <h3>{activeTitle}</h3>
        <p>{activeDescription}{isStreaming ? <span className="listing-cursor">▍</span> : null}</p>
      </div>
    </div> : <div className="listing-copy-empty">
      <strong>还没有售卖文案</strong>
      <span>AI 会核对资料与照片后写好，完成后可直接复制到闲鱼。</span>
      {generating ? null : <div className="listing-copy-panel">{settings}</div>}
      <button type="button" className="primary" aria-busy={!!generating} disabled={busy || !ready} onClick={onGenerate}>
        {generating || 'AI 生成上架资料'}</button>
      <button type="button" className="listing-copy-manual" disabled={busy} onClick={() => onEditing(true)}>或手动编写</button>
    </div>}
  </section>;
}
