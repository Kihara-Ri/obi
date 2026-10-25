// 发行版卡片：封面（带来源角标）+ 名称 + 来源 → 关键信息网格 → 可展开的曲目与版本资料 → 调用方给的操作区。
// 「查询」页（复制 / 入库）与专辑表单（选用此版本）共用；详情按需请求，摘要里已有的字段不在详情重复。
import {useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {api} from '../../core/api';
import {dedupeCatalog, regionName} from '../../core/release-metadata';
import {OriginTag, ReleaseSummary, sourceName} from './ReleaseSummary';
import type {ReleaseCandidate, ReleaseInfo} from '../../types';
import {Tracklist} from '../Tracklist';
import {useArtExpand} from './useArtExpand';
import {burnReveal} from '../../core/burn-reveal';
import {BORROWED_NOTE, borrowedCover, ownCoverBase, type BorrowedCover, type CoverOrigin} from '../../core/version-cover';
import './ReleaseCandidateCard.css';

export interface CardCtx {info: ReleaseInfo; load: () => Promise<ReleaseInfo>; busy: boolean}

/** fold：默认只显示一行关键信息（编号、地区、日期、条码），点开才出完整资料和操作（查询页用，省纵向空间）。 */
// 本次运行里已成功加载过的封面（地址 → 保活的 Image）：折叠 / 展开会卸载再挂载卡片，
// 没有这份记录每次都要重新「找封面…」并重播燃烧；保活 Image 让浏览器内存缓存里的解码结果不被回收。
const loadedArt = new Map<string, HTMLImageElement>();
const rememberArt = (url: string) => {
  if (loadedArt.has(url)) return;
  const im = new Image(); im.src = url;
  loadedArt.set(url, im);
  if (loadedArt.size > 120) loadedArt.delete(loadedArt.keys().next().value as string);
};

/** 卡片上的一张候选封面：小图 / 放大图地址，以及它是不是这个版本自己的 */
interface Art {small: string; big: string; kind: 'own' | BorrowedCover['kind']}
const caaArt = (base: string, kind: Art['kind']): Art => ({small: base + 'front-250', big: base + 'front-500', kind});
const urlArt = (url: string, kind: Art['kind']): Art => ({small: url.replace(/\/\d+x\d+bb\./, '/300x300bb.'), big: url.replace(/\/\d+x\d+bb\./, '/600x600bb.'), kind});

export function ReleaseCandidateCard({c, fold, tag, fallbackArt, children}: {c: ReleaseCandidate; fold?: boolean; tag?: string; fallbackArt?: string; children?: (ctx: CardCtx) => ReactNode}) {
  const expand = useArtExpand();
  const [folded, setFolded] = useState(!!fold);  // 折叠卡片：头部一行始终在原位 + 可展开的主体
  const [full, setFull] = useState<ReleaseInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // 封面按 core/version-cover.ts 的顺序找：此版本自己的正面图 → 同一张专辑的封面（调用方给的 fallbackArt，或向服务端要）
  // → 同名 iTunes 数字封面。CAA 图由浏览器直接取（一次请求、不经本机服务、浏览器自带缓存），404 = 没有，换下一个来源。
  const chain = useMemo(() => {
    const own = ownCoverBase(c);
    const list: Art[] = own ? [caaArt(own, 'own')] : [];
    if (fallbackArt) list.push(/front-\d+$/.test(fallbackArt) ? caaArt(fallbackArt.replace(/front-\d+$/, ''), 'album') : urlArt(fallbackArt, 'album'));
    return list;
  }, [c.id, c.source, fallbackArt]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [arts, setArts] = useState(chain);
  const [idx, setIdx] = useState(0);
  const asked = useRef(false);
  const cur: Art | undefined = arts[idx];
  const known = (a?: Art) => !!a && loadedArt.has(a.small);
  const cachedAtMount = useRef(known(cur));   // 挂载时就已加载过：直接显示，不再等待、不再燃烧
  const [artState, setArtState] = useState<'loading' | 'none' | 'ok'>(known(cur) ? 'ok' : 'loading');
  /** 当前来源没有图：换链上的下一个；链走完再向服务端要一次更宽泛的封面，仍没有才算无封面 */
  // 等服务端回答期间 idx 停在链尾之后（cur 为空）：不挂 <img>、不计超时，免得旧图的重试把卡片提前判成「无封面」
  const next = () => {
    if (idx + 1 < arts.length) { setIdx(idx + 1); return; }
    if (!asked.current) {
      asked.current = true;
      const end = arts.length;
      setIdx(end);
      void borrowedCover(c).then(found => {
        const add = found ? urlArt(found.thumbnail, found.kind) : null;
        if (!add || arts.some(a => a.small === add.small)) { setArtState('none'); return; }
        setArts(prev => [...prev.slice(0, end), add]);
      });
      return;
    }
    if (cur) setArtState('none');   // 借来的图也加载不出来
  };
  useEffect(() => { setArts(chain); setIdx(0); asked.current = false; }, [chain]);
  useEffect(() => { cachedAtMount.current = known(cur); setArtState(known(cur) ? 'ok' : 'loading'); }, [cur?.small]);
  useEffect(() => { if (!cur && !asked.current && artState === 'loading') next(); }, [cur, artState]);   // 链一开始就是空的（Discogs 版本）
  // 封面请求偶尔挂住（CAA 两次跳转，手机网络下既不 load 也不 error）：先看图是否其实已就绪，
  // 8 秒仍无结果就换 key 并加 ?r=n 重挂 <img> 重新请求（相同网址会被浏览器并入那条挂住的请求），最多 3 次，之后换下一个来源。
  const [tries, setTries] = useState(0);
  useEffect(() => { setTries(0); }, [cur?.small]);
  useEffect(() => {
    if (artState !== 'loading' || !cur) return;
    const t = window.setTimeout(() => { if (tries < 3) setTries(tries + 1); else next(); }, 8000);
    return () => window.clearTimeout(t);
  }, [artState, tries, cur?.small]);
  // 燃烧显现要稳定：动画不跟「加载完成」的瞬间走，而是「已加载 + 至少露出占位 450ms + 头部已在可视范围内」才开始，
  // 缓存命中的图、还没滚进视野或正在展开的卡片也都能完整看到；每个 <img>（key = 地址 + 重试次数）只显现一次。
  const [loaded, setLoaded] = useState(false);
  const mountedAt = useRef(0);
  useEffect(() => { setLoaded(false); mountedAt.current = performance.now(); }, [cur?.small, tries]);
  useEffect(() => { const el = expand.art.current; if (el?.complete && el.naturalWidth) setLoaded(true); }, [cur?.small, tries]);
  useEffect(() => {
    if (!loaded || artState !== 'loading') return;
    let timer = 0, observer: IntersectionObserver | undefined, done = false;
    const go = () => { if (!done) { done = true; setArtState('ok'); } };
    const start = () => {
      const head = expand.head.current;
      if (!head || typeof IntersectionObserver === 'undefined') { go(); return; }
      observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) go(); }, {threshold: .6});
      observer.observe(head);
    };
    timer = window.setTimeout(start, Math.max(0, 450 - (performance.now() - mountedAt.current)));
    return () => { done = true; window.clearTimeout(timer); observer?.disconnect(); };
  }, [loaded, artState, cur?.small, tries]);
  useLayoutEffect(() => {
    const el = expand.art.current;
    if (artState !== 'ok' || !el || !cur) return;
    if (cachedAtMount.current) el.dataset.burned = '1';
    else rememberArt(cur.small);
    burnReveal(el);
  }, [artState]);
  const art = artState === 'ok' && cur ? cur.small : '';
  const origin: CoverOrigin | null = cur ? (/mzstatic\.com/.test(cur.small) ? 'digital' : cur.kind) : null;
  const artImg = cur && artState !== 'none' ? <img key={cur.small + tries} className={'rcc-art rcc-art-img' + (artState !== 'ok' ? ' is-pending' : '')} ref={expand.art} src={(expand.big ? cur.big : cur.small) + (tries ? (cur.small.includes('?') ? '&' : '?') + 'r=' + tries : '')} alt="封面"
    style={expand.big ? {backgroundImage: `url(${cur.small})`} : undefined}
    onClick={fold ? expand.toggle : undefined} onLoad={() => setLoaded(true)} onError={next}/> : null;

  /** 取详情；失败时回退到精确匹配的基本资料，并说明曲目暂不可用。 */
  const load = async (): Promise<ReleaseInfo> => {
    if (full) return full;
    setBusy(true); setError('');
    try {
      const detail = (await api<{releaseInfo: ReleaseInfo}>('release-details?id=' + encodeURIComponent(c.id))).releaseInfo;
      const merged = {...c.releaseInfo, ...detail};
      setFull(merged);
      return merged;
    } catch (err) {
      setError((err instanceof Error ? err.message : String(err)) + '（曲目暂不可用，已显示基本资料）');
      return c.releaseInfo;
    } finally { setBusy(false); }
  };
  const toggle = () => { const next = !open; setOpen(next); if (next) void load(); };
  const info = full ?? c.releaseInfo;
  const extra: [string, string | undefined][] = [
    ['包装', info.packaging], ['版次说明', info.edition], ['介质', info.format],
    ['碟数', info.discCount ? info.discCount + ' 张' : '']];

  const i0 = c.releaseInfo;
  const body = <>
    <ReleaseSummary title={c.title} artist={c.artist} info={c.releaseInfo} source={sourceName({}, c.source === 'discogs')} url={c.url} art={art} origin={artState === 'ok' ? origin : null} headless={fold}/>
    <button type="button" className="rcc-more" aria-expanded={open} onClick={toggle}>
      <span>曲目与版本资料</span><i aria-hidden="true">{open ? '−' : '+'}</i>
    </button>
    {open ? <div className="rcc-detail">
      {busy ? <p className="rcc-msg" role="status">读取详情中…</p> : null}
      {error ? <p className="rcc-msg">{error}</p> : null}
      <dl className="rcc-facts">
        {extra.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
      <Tracklist releaseInfo={info}/>
    </div> : null}
    {artState === 'loading' ? <p className="rcc-msg" role="status">封面查找中…</p> : null}
    {fold && artState === 'ok' && cur && cur.kind !== 'own' ? <p className="rcc-msg">{BORROWED_NOTE[cur.kind]}</p> : null}
    {fold && artState === 'none' ? <p className="rcc-msg">暂时找不到这张专辑的封面：入库后可在表单里点「换一张封面」继续查找，或上传自己拍的。</p> : null}
    {children?.({info, load, busy})}
  </>;
  if (!fold) return <li className="rcc">{body}</li>;
  return <li className={'rcc is-fold' + (!folded ? ' is-open' : '')}>
    <button type="button" className={'rcc-fold' + (expand.big ? ' is-big' : '')} ref={expand.head} aria-expanded={!folded}
      onClick={e => { if (!(e.target as Element).closest('.rcc-art-img')) setFolded(!folded); }}>
      <span className="rcc-art-frame">
        {artImg}
        {artState !== 'ok' ? <span className={'rcc-art is-' + artState} aria-hidden="true">{artState === 'none' ? '无封面' : '找封面…'}</span> : null}
        {artState === 'ok' ? <OriginTag origin={origin}/> : null}
      </span>
      <span className="rcc-break" aria-hidden="true"/>
      <span className="rcc-main">
        <strong>{dedupeCatalog(i0.catalogNumber) || c.title}{tag ? <em className="rcc-tag">{tag}</em> : null}</strong>
        <span>{[regionName(i0.country), i0.releaseDate, i0.label].filter(Boolean).join(' · ')}</span>
        {i0.barcode ? <span className="num">{i0.barcode}</span> : null}
      </span>
      <i className="rcc-toggle" aria-hidden="true"/>
    </button>
    <div className="rcc-collapse"><div className="rcc-collapse-in" inert={folded}>{body}</div></div>
  </li>;
}

export {OriginTag, ReleaseSummary, sourceName};
