// 库存结果随排序使用时间线、艺人分组或顺序列表，卡片复用同一渲染入口。
import type {ReactNode} from 'react';
import type {AlbumRecord, SortMode} from '../types';
import {fmtMonth, sum, yuan} from '../core/format';
import {CardGrid} from '../components/Cards';
import {useApp} from '../state/AppContext';
import {openRecordForm} from '../forms/RecordForm';
import {openArtistDrawer} from '../forms/ArtistDrawer';

export function ShelfResults({records: rs, sort, flip, renderCard}: {
  records: AlbumRecord[]; sort: SortMode; flip: boolean; renderCard: (record: AlbumRecord) => ReactNode;
}) {
  const app = useApp();
  const {page, query, modules} = app;
  const isTrash = page === 'trash';
  const searching = query.trim() !== '';
  const timeline = !searching && sort === 'new' && modules.acquisition;
  if (!rs.length) {
    return (
      <div className="empty">
        <div className="empty-symbol">{isTrash ? '◎' : '◫'}</div>
        <h3>{query ? '没有找到匹配的专辑' : !modules.circulation && !isTrash ? '从第一张专辑开始' : page === 'overseas' ? '海外库存是空的' : isTrash ? '回收站是空的' : '库存是空的'}</h3>
        <p>{query ? '试试其他关键词。'
          : !modules.circulation && !isTrash ? '只需填写专辑名和艺人，其他资料可以慢慢补。'
            : page === 'overseas' ? '录入在海外买入的专辑，或把国内库存调回海外。'
            : isTrash ? '移除的专辑会出现在这里。'
              : '记录一次买入，封面会自动从公开音乐资料库抓取。'}</p>
        {query
          ? <button onClick={() => app.setQuery('')}>清除搜索</button>
          : !isTrash ? <button className="primary" onClick={() => openRecordForm(app)}>＋ 添加专辑</button> : null}
      </div>
    );
  }
  if (timeline) {
    // 按月时间线
    const sorted = [...rs].sort((a, b) => flip
      ? (a.date || '9999').localeCompare(b.date || '9999')
      : (b.date || '').localeCompare(a.date || ''));
    const groups = new Map<string, AlbumRecord[]>();
    for (const r of sorted) {
      const k = r.date ? r.date.slice(0, 7) : '';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(r);
    }
    return [...groups.entries()].map(([m, list]) => (
      <section className="tl-group" key={m}>
        <div className="tl-label"><b>{fmtMonth(m)}</b><span>{list.length} 张</span></div>
        <div className="tl-rail"/>
        <div className="tl-cards"><CardGrid records={list} renderCard={renderCard}/></div>
      </section>
    ));
  }
  if (!searching && sort === 'artist') {
    // 按艺人分组
    const map = new Map<string, AlbumRecord[]>();
    for (const r of [...rs].sort((a, b) => (b.date || '').localeCompare(a.date || ''))) {
      const a = r.artist || '未知艺人';
      if (!map.has(a)) map.set(a, []);
      map.get(a)!.push(r);
    }
    return [...map.keys()].sort((a, b) => a.localeCompare(b)).map(a => {
      const list = map.get(a)!;
      const knownList = list.filter(r => r.cost !== null);
      const total = knownList.length ? yuan(sum(knownList, 'cost')) : null;
      return (
        <section className="artist-group" key={a}>
          <header className="artist-head">
            {a === '未知艺人'
              ? <span className="artist-name">{a}</span>
              : <button type="button" className="artist-name"
                        aria-haspopup="dialog"
                        title={`查看 ${a} 的资料与作品`}
                        onClick={() => openArtistDrawer(app, a)}>{a}</button>}
            <span className="artist-meta">
              {list.length} 张{modules.acquisition && total ? ` · 总成本 ${total}` : ''}
              {modules.acquisition && knownList.length < list.length ? ` · ${list.length - knownList.length} 张成本待补` : ''}
            </span>
          </header>
          <CardGrid records={list} renderCard={renderCard}/>
        </section>
      );
    });
  }
  return <CardGrid records={rs} renderCard={renderCard} groupCopies={sort !== 'listed'}/>;
}
