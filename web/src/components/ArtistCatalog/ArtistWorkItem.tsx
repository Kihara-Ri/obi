// 目录里的一部作品：封面 + 标题 + 日期类型 + 收藏状态角标；点开就地显示关联副本、建议关联与手动关联。
// 已收藏的作品突出，没收藏的整体变淡，不再给每行挂「未关联」。
import type {ReactNode} from 'react';
import {workTypeText} from '../../core/artists';
import type {ArtistWork, CollectionRecord, WorkLinkInfo} from '../../core/artists';
import {statusName} from '../../core/modules';
import {labelTags, type ModuleFlags} from '../../types';
import {WorkCover} from './WorkCover';
import type {ArtworkGate} from './WorkCover';

export interface WorkLinkRow { record: CollectionRecord; link: WorkLinkInfo }
export interface SuggestionRow { work: ArtistWork; records: CollectionRecord[] }

export interface WorkItemShared {
  modules: ModuleFlags;
  unlinked: CollectionRecord[];
  linking: boolean;
  busy: string | null;
  gate: ArtworkGate;
  onToggleWork(mbid: string): void;
  onToggleLinker(): void;
  onOpenRecord(id: string): void;
  onLink(record: CollectionRecord, work: ArtistWork): void;
  onUnlink(record: CollectionRecord): void;
}

export interface ArtistWorkItemProps extends WorkItemShared {
  work: ArtistWork;
  rows: WorkLinkRow[];
  suggestion?: SuggestionRow;
  open: boolean;
}

function badgeOf(rows: WorkLinkRow[], suggestion?: SuggestionRow): [string, string] | null {
  const confirmed = rows.filter(r => r.link.state === 'confirmed');
  if (confirmed.length) {
    return confirmed.some(r => r.record.status !== 'sold')
      ? ['owned', `已收藏 ${confirmed.length} 张`] : ['was', '曾收藏'];
  }
  if (rows.length) return ['maybe', '关联待核对'];
  if (suggestion) return ['maybe', `可能已收藏 · ${suggestion.records.length} 张`];
  return null;
}

function CopyRow({record, modules, children}: {record: CollectionRecord; modules: ModuleFlags; children: ReactNode}) {
  return (
    <li className="copy-row">
      <span className="copy-info"><b>{record.title}</b>
        <small>{[statusName(record.status, modules), ...labelTags(record)].join(' · ')}</small></span>
      {children}
    </li>
  );
}

export function ArtistWorkItem(props: ArtistWorkItemProps) {
  const {work: w, rows, suggestion, open, modules, unlinked, linking, busy, gate} = props;
  const badge = badgeOf(rows, suggestion);
  const localCover = rows.find(r => r.link.state === 'confirmed' && r.record.cover)?.record.cover ?? null;
  return (
    <li className={`artist-work${open ? ' expanded' : ''}${badge ? '' : ' is-unowned'}`}>
      <button type="button" className="work-row" aria-expanded={open} onClick={() => props.onToggleWork(w.mbid)}>
        <WorkCover work={w} localCover={localCover} gate={gate}/>
        <span className="work-main">
          <span className="work-title">{w.title}</span>
          <span className="work-meta">{w.firstReleaseDate ?? '日期未知'}{workTypeText(w) ? ` · ${workTypeText(w)}` : ''}</span>
        </span>
        {badge ? <span className={`work-state ${badge[0]}`}>{badge[1]}</span> : null}
      </button>
      {open ? (
        <div className="work-detail">
          {rows.length ? (
            <ul className="copy-list">
              {rows.map(({record}) => (
                <CopyRow key={record.id} record={record} modules={modules}>
                  <span className="copy-actions">
                    <button type="button" onClick={() => props.onOpenRecord(record.id)}>详情</button>
                    <button type="button" className="quiet" disabled={busy === record.id}
                            onClick={() => props.onUnlink(record)}>取消关联</button>
                  </span>
                </CopyRow>
              ))}
            </ul>
          ) : <p className="small-note">还没有确认关联的副本。</p>}
          {suggestion ? (
            <div className="suggest-box">
              <p className="small-note">本地有标题相同的副本，可能是这部作品：</p>
              <ul className="copy-list">
                {suggestion.records.map(r => (
                  <CopyRow key={r.id} record={r} modules={modules}>
                    <button type="button" disabled={busy === r.id} onClick={() => props.onLink(r, w)}>确认关联</button>
                  </CopyRow>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="linker">
            <button type="button" className="quiet" aria-expanded={linking} onClick={props.onToggleLinker}>
              {linking ? '收起' : '关联我的副本'}
            </button>
            {linking ? (unlinked.length ? (
              <ul className="copy-list">
                {unlinked.map(r => (
                  <CopyRow key={r.id} record={r} modules={modules}>
                    <button type="button" disabled={busy === r.id} onClick={() => props.onLink(r, w)}>确认关联</button>
                  </CopyRow>
                ))}
              </ul>
            ) : <p className="small-note">这位艺人名下没有可关联的副本。</p>) : null}
          </div>
          <p className="small-note">
            <a href={w.sourceUrl} target="_blank" rel="noopener noreferrer">在 MusicBrainz 打开这部作品 ↗</a>
          </p>
        </div>
      ) : null}
    </li>
  );
}
