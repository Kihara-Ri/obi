// 库存页（海外 / 国内 / 回收站共用）：搜索、排序、时间线/艺人分组、批量操作条。
import {useRef, useState} from 'react';
import {useApp} from '../state/AppContext';
import type {ShelfSortChoice} from '../state/AppContext';
import type {AlbumRecord, SortMode} from '../types';
import {onShelf} from '../core/modules';
import {shelfRecords} from '../core/shelf-records';
import {CardViewIco, ListViewIco} from '../components/icons';
import {PageHead} from '../components/PageHead';
import {BulkBar} from './BulkBar';
import {ShelfSummary} from './ShelfSummary';
import {AlbumCard} from '../components/Cards';
import {ShelfResults} from './ShelfResults';
import {Dropdown} from '../components/ui/Dropdown';
import {Seg} from '../components/ui/Seg';
import type {SwipeAction} from '../components/ui/SwipeRow';
import {TabPanel} from '../components/ui/TabPanel';
import {useShelfFlip} from './useShelfFlip';
import {destOfStatus, useListFlip} from './useListFlip';
import {useSwipeHint} from './useSwipeHint';
import {SearchField} from '../components/ui/SearchField';
import {ShowcaseSwitch, useShowcaseSwitch} from '../components/ShowcaseSwitch';
import {useSlidingThumb} from '../components/ui/SlidingThumb';
import {openRecordForm} from '../forms/RecordForm';
import {openSaleForm} from '../forms/SaleForm';
import {openListingForm} from '../forms/ListingForm';
import {openDetail} from '../forms/DetailDrawer';
import {openArtistDrawer} from '../forms/ArtistDrawer';
import {bulkAction} from '../forms/shared';
import {queueLookup} from '../core/lookup-handoff';
import {recordMedium} from '../core/medium';
import {prefs} from '../core/prefs';

const SORTS = [
  {value: 'new', label: '最近买入'},
  {value: 'old', label: '最早买入'},   // = 「最近买入」+ 倒序（flip）；原来的 ⇅ 按钮并进这里（2026-11-19）
  {value: 'cost', label: '成本从高到低'},
  {value: 'artist', label: '按艺人'},
];
const COLLECTION_SORTS = [{value: 'new', label: '最近添加'}, {value: 'artist', label: '按艺人'}];
const LISTING_SORTS = [
  {value: 'listed', label: '最近上架'},
  {value: 'listed-old', label: '最早上架'},
];

// 介质筛选（D-055）：库里有黑胶才出现；「其他」介质只在全部里
const MEDIUM_FILTERS = [{value: 'all', label: '全部介质'}, {value: 'cd', label: 'CD'}, {value: 'vinyl', label: '黑胶'}];

const LISTED_FILTERS = [
  {value: 'all', label: '全部专辑'},
  {value: 'listed', label: '已上架'},
  {value: 'unlisted', label: '未上架'},
];

export function ShelfPage() {
  const app = useApp();
  const {state, modules, page, query, selected, shelfFilter} = app;
  const isTrash = page === 'trash';
  const canSortByListing = !isTrash && modules.trading && shelfFilter === 'listed';
  const sortScope = canSortByListing ? 'listed' : 'base';
  const chosenSort = app.shelfSort[sortScope];
  const sortValue = !modules.acquisition && (chosenSort === 'old' || chosenSort === 'cost') ? 'new' : chosenSort;
  const sort: SortMode = sortValue === 'old' ? 'new' : sortValue === 'listed-old' ? 'listed' : sortValue;
  const flip = sortValue === 'old' || sortValue === 'listed-old';
  const baseSorts = modules.acquisition ? SORTS : COLLECTION_SORTS;
  const [medium, setMedium] = useState(() => prefs.get('shelf-medium', 'all'));
  const hasVinyl = state.records.some(r => recordMedium(r.releaseInfo) === 'vinyl');
  const all = state.records.filter(r => onShelf(r.status, page, modules)
    && (!hasVinyl || medium === 'all' || recordMedium(r.releaseInfo) === medium));
  const rs = shelfRecords(all, {page, query, sort, flip, shelfFilter, modules});
  const selectable = rs.filter(r => r.status !== 'transit');
  const searching = query.trim() !== '';

  // 选择集只在当前可见结果内生效
  const visible = new Set(selectable.map(r => r.id));
  const curSelected = new Set([...selected].filter(id => visible.has(id)));
  const toggleSelect = (id: string, on: boolean) => {
    const next = new Set(app.selected);
    if (on) next.add(id); else next.delete(id);
    app.setSelected(next);
  };

  // 国内/海外的滑动下划线：与 Seg 共用 useSlidingThumb（测量选中项平移，首次不滑入，跨重挂保持）。
  const scopeNavRef = useRef<HTMLElement>(null);
  useSlidingThumb(scopeNavRef, {thumb: '.shelf-tab-thumb', active: 'a[aria-current=page]', persistKey: 'shelf-location'});

  const pageRef = useRef<HTMLDivElement>(null);
  const snapshotFlip = useShelfFlip(pageRef, app.shelfView);
  useListFlip(pageRef, rs.map(r => r.id).join(','), `${page}|${app.shelfView}`, {destOf: id => destOfStatus(app.rec(id)?.status)});

  const title = page === 'domestic' && !modules.circulation ? '我的收藏' : page === 'overseas' ? '海外库存' : page === 'domestic' ? '国内库存' : '回收站';
  const desc = !modules.circulation && !isTrash ? '整理每张实物的版本和照片。'
    : page === 'overseas' ? (modules.trading ? '在日本持有的专辑，可标记上架（如メルカリ）或直接记录售出；选中多张可打包运输。' : '在海外持有的专辑，选中多张可打包运输。')
    : page === 'domestic' ? (modules.trading ? '已运回国；标记「已上架」的正在闲鱼出售，其余暂未上架，随时可记录售出。' : '已运回的专辑，记录版本和照片。')
      : '移除的专辑保留在这里，随时可以恢复。';
  // 页头说明小字只保留在回收站与单库模式（我的收藏）；国内/海外库存按用户要求去掉。
  const keepDesc = isTrash || (page === 'domestic' && !modules.circulation);
  // 与在途/售出中/已交易共用 align-list：内容列右缘统一 1147px，页头/汇总条/工具条跨页零位移。
  const alignList = !isTrash && modules.circulation;
  const switchOn = useShowcaseSwitch() && !isTrash;
  const baseTitle = modules.circulation && !isTrash ? <><span className="desktop-shelf-title">{title}</span><span className="mobile-shelf-title">库存</span></> : title;
  // 以管理为主的用户：手机顶栏中间是「库存｜展示」切换（桌面仍是文字标题）
  const titleNode = switchOn ? <><span className="head-title-text">{baseTitle}</span><span className="title-switch"><ShowcaseSwitch current="manage"/></span></> : baseTitle;

  const cardActions = (r: AlbumRecord) => {
    if (page === 'trash') return <button onClick={() => bulkAction(app, 'restore', [r.id])}>恢复</button>;
    return (
      <>
        {modules.trading && r.status !== 'transit' ? <button className="primary" aria-label={`记录售出：${r.title}`} onClick={() => openSaleForm(app, [r.id])}>记录售出</button> : null}
        <button className="card-edit" aria-label={`编辑：${r.title}`} onClick={() => openRecordForm(app, r.id)}>编辑</button>
      </>
    );
  };

  // 手机列表行左滑：上架 / 下架 + 记录售出（行内按钮在手机上随之收起）
  const swipeActions = (r: AlbumRecord): SwipeAction[] => page === 'trash' || !modules.trading || r.status === 'transit' ? [] : [
    {label: r.listed ? '下架' : '上架', ariaLabel: `${r.listed ? '取消上架' : '标记上架'}：${r.title}`,
     onClick: () => r.listed ? bulkAction(app, 'unlist', [r.id], '已取消上架') : openListingForm(app, [r.id])},
    {label: '记录售出', tone: 'primary', ariaLabel: `记录售出：${r.title}`, onClick: () => openSaleForm(app, [r.id])},
  ];

  const swipeHint = useSwipeHint();
  const selecting = app.mobileSelecting || curSelected.size > 0;
  const firstSwipe = app.shelfView === 'list' && !selecting ? rs.find(r => swipeActions(r).length)?.id : undefined;

  const renderCard = (r: AlbumRecord) => (
    <AlbumCard key={r.id} r={r} page={page} checked={curSelected.has(r.id)}
               onSelect={isTrash || r.status === 'transit' ? undefined : toggleSelect}
               onDetail={id => openDetail(app, id)}
               onArtist={page === 'trash' ? undefined : name => openArtistDrawer(app, name)}
               actions={cardActions(r)} swipeActions={swipeActions(r)}
               selecting={selecting} swipeHint={swipeHint.isHint(r.id, firstSwipe)} onSwipeHint={swipeHint.shown}/>
  );

  return (
    <div ref={pageRef} className={`shelf-page shelf-${app.shelfView}${alignList ? ' align-list' : ''}${app.mobileSelecting || curSelected.size ? ' is-selecting' : ''}`}>
      {/* 手机「选择」在顶栏左侧（与右侧「＋」对称）；进入选择后顶栏由 BulkBar 换成「取消｜已选 N 张｜全选」 */}
      <PageHead title={titleNode} desc={keepDesc ? desc : undefined} label="COLLECTION"
        lead={!isTrash && selectable.length ? <button className="mobile-select-toggle" onClick={() => app.setMobileSelecting(true)}>选择</button> : null}
        actions={isTrash ? null : (
        <>
          {modules.showcase ? <a className="link-button gallery-link" href="#gallery">展示收藏</a> : null}
          <button className="primary head-add" aria-label="添加专辑" onClick={() => openRecordForm(app)}>
            <span className="btn-long">＋ 添加专辑</span><span className="btn-short" aria-hidden="true">＋</span></button>
        </>
      )}/>
      {modules.circulation && !isTrash ? (
        <nav className="shelf-location" aria-label="库存地区" ref={scopeNavRef}>
          <span className="shelf-tab-thumb" aria-hidden="true"/>
          {(['domestic', 'overseas'] as const).map(p => (
            <a key={p} href={`#${p}`} aria-current={page === p ? 'page' : 'false'}>
              {p === 'domestic' ? '国内' : '海外'}<b>{state.records.filter(r => r.status === p).length}</b>
            </a>
          ))}
        </nav>
      ) : null}
      <ShelfSummary all={all} modules={modules} page={page}/>
      <div className={hasVinyl ? 'toolbar has-medium' : 'toolbar'}>
        {!isTrash && (
          <label className="select-all" title="全选当前结果">
            <input type="checkbox" aria-label="全选当前结果"
                   checked={!!curSelected.size && curSelected.size === selectable.length}
                   onChange={e => app.setSelected(e.target.checked ? new Set(selectable.map(r => r.id)) : new Set())}/>
            全选
          </label>
        )}
        <SearchField ariaLabel="搜索专辑" placeholder={modules.acquisition ? '搜索专辑、艺人或渠道…' : '搜索专辑或艺人…'}
                     value={query} onChange={app.setQuery}/>
        {!isTrash && modules.trading ? (
          <Seg className="filter-seg" persistKey="shelf-listed" ariaLabel="上架筛选" options={LISTED_FILTERS}
               value={shelfFilter} onValue={app.setShelfFilter}/>
        ) : null}
        {hasVinyl ? <Dropdown id="medium" value={medium} label="介质" options={MEDIUM_FILTERS}
          onPick={m => { setMedium(m); prefs.set('shelf-medium', m); }}/> : null}
        <Dropdown id="sort" value={sortValue} label="排序方式"
                  options={canSortByListing ? [...LISTING_SORTS, ...baseSorts] : baseSorts}
                  onPick={v => app.setShelfSort({...app.shelfSort, [sortScope]: v as ShelfSortChoice})}/>
        <Seg className="view-seg" persistKey="shelf-view" ariaLabel="库存显示方式" value={app.shelfView}
             options={[{value: 'list', label: <>{ListViewIco}<span className="view-text">列表</span></>, ariaLabel: '列表视图'}, {value: 'cards', label: <>{CardViewIco}<span className="view-text">卡片</span></>, ariaLabel: '卡片视图'}]}
             onValue={v => { snapshotFlip(); app.setShelfView(v as 'list' | 'cards'); }}/>
      </div>
      <BulkBar page={page} ids={[...curSelected]} allIds={selectable.map(r => r.id)} isTrash={isTrash}/>
      {/* 库存里搜不到或想看别的版本：同一个词直接带去「查询」页查资料库（条码、编号、专辑名都行） */}
      {searching && !isTrash ? <a className="shelf-lookup-row" href="#lookup" onClick={() => queueLookup(query.trim())}>
        <span>在资料库查「<b>{query.trim()}</b>」</span><i aria-hidden="true">›</i></a> : null}
      <TabPanel value={page} order={['domestic', 'overseas']}>
        <ShelfResults records={rs} sort={sort} flip={flip} renderCard={renderCard}
          medium={hasVinyl && medium !== 'all' ? MEDIUM_FILTERS.find(m => m.value === medium)?.label : undefined}
          clearMedium={() => { setMedium('all'); prefs.set('shelf-medium', 'all'); }}/>
      </TabPanel>
    </div>
  );
}
