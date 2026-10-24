// 专辑详情（摘要层）：身份 → 状态行 → 关键信息（≤6 项）→ 照片 → 备注摘要 → 「发行资料」「管理」入口；底栏只放主要操作。
// 更详细的内容在二级页：发行资料页（forms/detail/ReleasePage）与管理页（forms/detail/ManagePage），决定见 D-015。
// 备注在这里只截两行，全文在管理页；调回海外 / 移除等流转操作也在管理页。
import {useEffect, useLayoutEffect, useRef} from 'react';
import {flyIn, flyOut} from '../core/cover-fly';
import {Chevron} from '../components/ui/Chevron';
import {ArtistButton} from '../components/ArtistButton';
import {openArtistDrawer} from './ArtistDrawer';
import {useApp} from '../state/AppContext';
import type {AppCtx} from '../state/AppContext';
import {fmt, fmtJPY, jpyCost, rmb} from '../core/format';
import {statusName} from '../core/modules';
import {Cover} from '../components/Cover';
import {useArtExpand} from '../components/ReleaseCandidateCard/useArtExpand';
import {openRecordForm} from './RecordForm';
import {openSaleForm} from './SaleForm';
import {PhotoDownload} from '../components/PhotoDownload';
import {LikeHeart} from '../components/LikeHeart';
import {CopyButton} from '../components/CopyButton';
import {NavRow} from '../components/ui/NavRow';
import {InfoIco, SlidersIco} from '../components/icons';
import {bulkAction} from './shared';
import {formatPackagingName} from '../core/album-packaging';
import {dedupeCatalog, displayRegion, displayReleaseTitle} from '../core/release-metadata';
import {Rows} from './detail/Rows';
import {openReleasePage} from './detail/ReleasePage';
import {openManagePage} from './detail/ManagePage';

export interface DetailBack {
  label?: string;
  artist?: string;
  run: () => void;
}

export function openDetail(app: AppCtx, id: string, back?: DetailBack, direction?: 'back') {
  const r = app.rec(id);
  if (!r) { app.toast('记录不存在，请刷新页面', 'err'); return; }
  app.openDrawer({title: '专辑详情', direction, back: back && {label: back.label ?? '返回', run: back.run}, content: <DetailBody id={id} back={back}/>, footer: <DetailFooter id={id}/>});
}

function DetailBody({id, back}: {id: string; back?: DetailBack}) {
  const app = useApp();
  const {modules} = app;
  const r = app.rec(id);
  const bigRef = useRef<HTMLDivElement>(null);
  const expand = useArtExpand<HTMLDivElement, HTMLDivElement>('.record-detail-main,.like-heart');
  // 封面从库存卡片飞进来，关闭时飞回去（core/cover-fly）。只在首次挂载时飞入；
  // 抽屉发出 drawer-closing 时，若这一页是当前顶层（可见）才飞回
  useLayoutEffect(() => { if (bigRef.current) flyIn(id, bigRef.current); }, [id]);
  useEffect(() => {
    const onClosing = () => { if (bigRef.current) flyOut(id, bigRef.current); };
    window.addEventListener('drawer-closing', onClosing);
    return () => window.removeEventListener('drawer-closing', onClosing);
  }, [id]);
  if (!r) return null;
  const info = r.releaseInfo ?? {};
  // 复制钮与标题最后一个词绑在同一个不折行的片段里：标题折行时按钮跟着末词，不会单独掉到下一行
  const shownTitle = displayReleaseTitle(r.title);
  const cut = shownTitle.search(/\s\S*$/);
  const titleHead = cut > 0 ? shownTitle.slice(0, cut + 1) : '';
  const titleTail = cut > 0 ? shownTitle.slice(cut + 1) : shownTitle;
  const year = (info.releaseDate || r.releaseYear || '').slice(0, 4);
  const sub = [displayRegion(info.country, r.pressing), /^\d{4}$/.test(year) ? year : '', info.unofficial === '1' ? '非官方' : ''].filter(Boolean).join(' · ');
  const pkg = info.packaging || formatPackagingName(r.version, r.packaging);
  const catalog = dedupeCatalog(info.catalogNumber);
  const approx = jpyCost(r);
  // 国内 / 海外库存是常态，摘要里不再显示位置标签；在途、售出中、已售、回收站才需要提示（位置在管理页）
  const special = !['overseas', 'domestic'].includes(r.status);
  const showStatus = special || (modules.trading && !!r.listed);
  const hasRelease = !!(pkg || info.barcode || info.catalogNumber || info.releaseDate || info.label || info.tracklist?.length);
  const price = r.price === '' ? '待补' : <>
    {r.currency === 'JPY' ? fmtJPY(r.price) + ' 円' : fmt(r.price) + ' 元'}
    {approx ? <> <span className="rmb">{rmb(approx)}</span></> : null}
    {r.date ? <span className="rmb"> · {r.date}</span> : null}</>;
  return (
    <div className="detail-summary">
      <div className={expand.big ? 'record-detail is-big' : 'record-detail'} ref={expand.head}>
        <div className={r.cover ? 'big big-zoom' : 'big'} ref={el => { bigRef.current = el; expand.art.current = el; }}
             {...(r.cover ? {role: 'button', tabIndex: 0, 'aria-label': expand.big ? '收起封面' : '放大封面', 'aria-expanded': expand.big,
               onClick: expand.toggle,
               onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); expand.toggle(); } }} : {})}>
          <Cover r={r}/></div>
        <span className="rcc-break"/>
        <div className="record-detail-main">
          <h2 className="record-detail-title">
            {titleHead}<span className="record-detail-tail">{titleTail}<CopyButton text={shownTitle} label="复制专辑名"/></span>
          </h2>
          {r.status === 'trash' ? <p className="artist">{r.artist}</p> : <ArtistButton artist={r.artist} onOpen={name => {
            // 从艺人页进到详情、又点同一位艺人：直接弹栈回到下面那层艺人页（它一直挂载着，不重新加载）
            if (back?.artist === name) back.run();
            else openArtistDrawer(app, name, {back: {label: '返回专辑详情', run: () => { app.backDrawer(); }}});
          }}/>}
          {sub ? <p className="record-detail-sub">{sub}</p> : null}
        </div>
        {r.status !== 'trash' ? <LikeHeart id={id}/> : null}
      </div>
      {showStatus ? <div className="detail-status">
        {special ? <span className={`pill ${r.status}`}>{statusName(r.status, modules)}</span> : null}
        {modules.trading && r.listed ? <span className="pill listed">已上架</span> : null}
      </div> : null}
      <Rows rows={[
        !!pkg && {label: '包装', value: pkg === '待核对' ? '包装待核对' : pkg},
        !!r.obi && {label: '侧标', value: r.obi},
        !!catalog && {label: '唱片编号', value: catalog, copy: info.catalogNumber},
        !!info.barcode && {label: '条码', value: info.barcode, copy: info.barcode},
        modules.acquisition && {label: '买入', value: price},
        modules.acquisition && !!r.location && {label: '渠道', value: r.location},
      ]}/>
      {r.photoCount ? <div className="detail-photos">
        <div className="photo-strip">
          {Array.from({length: r.photoCount}, (_, i) => (
            <a key={i} href={`/api/photo/${r.id}/${i}`} target="_blank" rel="noopener">
              <img src={`/api/photo/${r.id}/${i}`} loading="lazy" alt={`实物照片 ${i + 1}`}/>
            </a>
          ))}
        </div>
        {modules.trading && ['overseas', 'domestic'].includes(r.status)
          ? <PhotoDownload id={r.id} count={r.photoCount} revision={r.photoRevision ?? 0} artist={r.artist} title={r.title}/> : null}
      </div> : null}
      {r.note || r.noteAlbum ? <button type="button" className="detail-notes" aria-label="查看备注全文"
        onClick={() => openManagePage(app, id)}>
        {r.note ? <span><b>副本</b>{r.note}</span> : null}
        {r.noteAlbum ? <span><b>专辑</b>{r.noteAlbum}</span> : null}
        <Chevron dir="right"/>
      </button> : null}
      <nav className="detail-entries" aria-label="更多">
        {hasRelease ? <NavRow icon={InfoIco} title="发行资料" onClick={() => openReleasePage(app, id)}/> : null}
        <NavRow icon={SlidersIco} title="管理" onClick={() => openManagePage(app, id)}/>
      </nav>
    </div>
  );
}

function DetailFooter({id}: {id: string}) {
  const app = useApp();
  const r = app.rec(id);
  if (!r) return null;
  const inStock = ['overseas', 'domestic'].includes(r.status);
  return (
    <div className="detail-footer-row" role="group" aria-label="主要操作">
      <button type="button" onClick={() => openRecordForm(app, id)}>编辑</button>
      {app.modules.trading && inStock
        ? <button type="button" onClick={() => bulkAction(app, r.listed ? 'unlist' : 'list', [id], r.listed ? '已取消上架' : '已标记上架')}>
            {r.listed ? '取消上架' : '上架'}</button> : null}
      {app.modules.trading && inStock
        ? <button type="button" className="primary" onClick={() => openSaleForm(app, [id])}>记录售出</button> : null}
    </div>
  );
}
