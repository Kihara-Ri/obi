// 发行版卡片：名称 + 来源 → 关键信息网格 → 可展开的曲目与版本资料 → 调用方给的操作区。
// 「查询」页（复制 / 入库）与专辑表单（选用此版本）共用；详情按需请求，摘要里已有的字段不在详情重复。
import {useEffect, useLayoutEffect, useRef, useState, type ReactNode} from 'react';
import {api} from '../../core/api';
import {dedupeCatalog, regionName} from '../../core/release-metadata';
import type {ReleaseCandidate, ReleaseInfo} from '../../types';
import {Tracklist} from '../Tracklist';
import {useArtExpand} from './useArtExpand';
import {burnReveal} from '../../core/burn-reveal';
import './ReleaseCandidateCard.css';

const sourceName = (info: {musicBrainzReleaseId?: string; discogsReleaseId?: string}, discogs?: boolean) =>
  discogs || (info.discogsReleaseId && !info.musicBrainzReleaseId) ? 'Discogs' : 'MusicBrainz';

/** 头部（名称、艺人、来源）+ 关键信息网格；表单里已确认的版本直接用它。 */
export function ReleaseSummary({title, artist, info, source, url, art, headless}: {
  title: string; artist: string; info: ReleaseInfo; source?: string; url?: string; art?: string; headless?: boolean;
}) {
  const facts: [string, string | undefined][] = [
    ['唱片编号', dedupeCatalog(info.catalogNumber)], ['条码', info.barcode], ['厂牌', info.label],
    ['发行地区', regionName(info.country)], ['发行日', info.releaseDate]];
  return <>
    {headless ? null : <header className="rcc-head">
      {art ? <img className="rcc-art" src={art} alt="封面"/> : null}
      <div className="rcc-main"><strong>{title}</strong><span>{artist}</span></div>
      {source ? url ? <a className="rcc-source" href={url} target="_blank" rel="noopener noreferrer"
        aria-label={`在 ${source} 查看`}>{source} ↗</a> : <span className="rcc-source">{source}</span> : null}
    </header>}
    <dl className="rcc-facts">
      {facts.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="num">{v}</dd></div>)}
    </dl>
  </>;
}

export interface CardCtx {info: ReleaseInfo; load: () => Promise<ReleaseInfo>; busy: boolean}

/** fold：默认只显示一行关键信息（编号、地区、日期、条码），点开才出完整资料和操作（查询页用，省纵向空间）。 */
export function ReleaseCandidateCard({c, fold, tag, fallbackArt, children}: {c: ReleaseCandidate; fold?: boolean; tag?: string; fallbackArt?: string; children?: (ctx: CardCtx) => ReactNode}) {
  const expand = useArtExpand();
  const [folded, setFolded] = useState(!!fold);  // 折叠卡片：头部一行始终在原位 + 可展开的主体
  const [full, setFull] = useState<ReleaseInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // 此版本自己的正面图（Cover Art Archive）：浏览器直接取 front-250（一次请求、不经本机服务、浏览器自带缓存）；
  // 404 = 这个版本没有正面图。Discogs 版本不带图。放大时换 front-1200。
  const own = c.source !== 'discogs' && /^[0-9a-f-]{36}$/.test(c.id) ? 'https://coverartarchive.org/release/' + c.id + '/' : '';
  // 这个版本自己没有正面图时，退而用同一张专辑（release group）的封面——版本对得上最重要，封面可以妥协
  const spare = fallbackArt ? fallbackArt.replace(/front-\d+$/, '') : '';
  const [useSpare, setUseSpare] = useState(false);
  const caa = !useSpare && own ? own : spare;
  const [artState, setArtState] = useState<'loading' | 'none' | 'ok'>(caa ? 'loading' : 'none');
  useEffect(() => { setUseSpare(false); }, [own, spare]);
  useEffect(() => { setArtState(caa ? 'loading' : 'none'); }, [caa]);
  // 封面请求偶尔挂住（CAA 两次跳转，手机网络下既不 load 也不 error）：先看图是否其实已就绪，
  // 8 秒仍无结果就换 key 并加 ?r=n 重挂 <img> 重新请求（相同网址会被浏览器并入那条挂住的请求），最多 3 次，之后按没有封面处理。
  const [tries, setTries] = useState(0);
  useEffect(() => { setTries(0); }, [caa]);
  useEffect(() => {
    if (artState !== 'loading') return;
    const t = window.setTimeout(() => { if (tries < 3) setTries(tries + 1); else if (!useSpare && own && spare) setUseSpare(true); else setArtState('none'); }, 8000);
    return () => window.clearTimeout(t);
  }, [artState, tries, caa]);   // 超时也先试备用封面
  // 燃烧显现要稳定：动画不跟「加载完成」的瞬间走，而是「已加载 + 至少露出占位 450ms + 头部已在可视范围内」才开始，
  // 缓存命中的图、还没滚进视野或正在展开的卡片也都能完整看到；每个 <img>（key = 地址 + 重试次数）只显现一次。
  const [loaded, setLoaded] = useState(false);
  const mountedAt = useRef(0);
  useEffect(() => { setLoaded(false); mountedAt.current = performance.now(); }, [caa, tries]);
  useEffect(() => { const el = expand.art.current; if (el?.complete && el.naturalWidth) setLoaded(true); }, [caa, tries]);
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
  }, [loaded, artState, caa, tries]);
  useLayoutEffect(() => { if (artState === 'ok' && expand.art.current) burnReveal(expand.art.current); }, [artState]);
  const art = artState === 'ok' ? caa + 'front-250' : '';
  const artImg = caa ? <img key={caa + tries} className={'rcc-art rcc-art-img' + (artState !== 'ok' ? ' is-pending' : '')} ref={expand.art} src={caa + (expand.big ? 'front-500' : 'front-250') + (tries ? '?r=' + tries : '')} alt="封面"
    style={expand.big ? {backgroundImage: `url(${caa}front-250)`} : undefined}
    onClick={fold ? expand.toggle : undefined} onLoad={() => setLoaded(true)} onError={() => { if (!useSpare && own && spare) setUseSpare(true); else setArtState('none'); }}/> : null;

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
    <ReleaseSummary title={c.title} artist={c.artist} info={c.releaseInfo} source={sourceName({}, c.source === 'discogs')} url={c.url} art={art} headless={fold}/>
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
    {fold && artState === 'ok' && spare && caa === spare ? <p className="rcc-msg">这个版本自己没有封面，先用同一张专辑的封面，不一定是这个版本的包装。</p> : null}
    {fold && artState === 'none' ? <p className="rcc-msg">资料库里暂时没有这个版本的封面，不代表拿不到：入库后在表单里点「换一张封面」继续查找。</p> : null}
    {children?.({info, load, busy})}
  </>;
  if (!fold) return <li className="rcc">{body}</li>;
  return <li className={'rcc is-fold' + (!folded ? ' is-open' : '')}>
    <button type="button" className={'rcc-fold' + (expand.big ? ' is-big' : '')} ref={expand.head} aria-expanded={!folded}
      onClick={e => { if (!(e.target as Element).closest('.rcc-art-img')) setFolded(!folded); }}>
      {artImg}
      <span className="rcc-break" aria-hidden="true"/>
      {artState !== 'ok' ? <span className={'rcc-art is-' + artState} aria-hidden="true">{artState === 'none' ? '无封面' : '找封面…'}</span> : null}
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

export {sourceName};
