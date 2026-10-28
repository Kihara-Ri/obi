// 发行版摘要：头部（封面 + 来源角标、名称、艺人、资料来源小字）+ 关键信息网格。
// 版本卡片展开后与专辑表单里的已确认版本共用。
import {dedupeCatalog, regionName} from '../../core/release-metadata';
import {ORIGIN_LABEL, type CoverOrigin} from '../../core/version-cover';
import {SOURCE_LABEL, sourceName, type ReleaseSource} from '../../core/release-source';
import type {ReleaseCandidate, ReleaseInfo} from '../../types';
import {useArtExpand} from './useArtExpand';

/** 来源显示名由 core/release-source 统一决定；这里重新导出，保持既有调用点的导入路径。 */
export {sourceName};

/** 封面右下角的来源角标（此版本 / 同专辑 / iTunes / 上传），版本卡片与表单的封面共用 */
export const OriginTag = ({origin}: {origin?: CoverOrigin | null}) =>
  origin ? <i className="cover-origin" title={'封面来源：' + ORIGIN_LABEL[origin]}>{ORIGIN_LABEL[origin]}</i> : null;

/** 头部（封面、名称、艺人，来源作为艺人下的一行小字链接）+ 关键信息网格；表单里已确认的版本直接用它。 */
export function ReleaseSummary({title, artist, info, source, url, art, origin, headless, alsoIn}: {
  title: string; artist: string; info: ReleaseInfo; source?: string; url?: string; art?: string;
  origin?: CoverOrigin | null; headless?: boolean; alsoIn?: ReleaseCandidate['alsoIn'];
}) {
  const expand = useArtExpand<HTMLElement>();
  const link = (label: string, href?: string) => href
    ? <a href={href} target="_blank" rel="noopener noreferrer">{label} ↗</a> : label;
  // 并发检索合并：同一版本在其他资料库的条目（折叠卡片没有头部，就单独一行，连同主来源）
  const also = alsoIn?.length ? alsoIn.map((ref, i) => <span key={ref.id}>{i ? ' · ' : ''}
    {link(SOURCE_LABEL[ref.source as ReleaseSource] ?? ref.source, ref.url)}</span>) : null;
  const facts: [string, string | undefined][] = [
    ['唱片编号', dedupeCatalog(info.catalogNumber)], ['条码', info.barcode], ['厂牌', info.label],
    ['发行地区', regionName(info.country)], ['发行日', info.releaseDate]];
  return <>
    {headless ? null : <header className={'rcc-head' + (expand.big ? ' is-big' : '')} ref={expand.head}>
      {art ? <span className="rcc-art-frame">
        <img className="rcc-art rcc-art-zoom" ref={expand.art} src={art} alt="封面" onClick={expand.toggle}/>
        <OriginTag origin={origin}/></span> : null}
      <span className="rcc-break" aria-hidden="true"/>
      <div className="rcc-main"><strong>{title}</strong><span>{artist}</span>
        {source ? url ? <a className="rcc-source" href={url} target="_blank" rel="noopener noreferrer"
          aria-label={`在 ${source} 查看`}>{source} ↗</a> : <small className="rcc-source">{source}</small> : null}
        {also ? <small className="rcc-source rcc-also">另见 {also}</small> : null}</div>
    </header>}
    {headless && also ? <p className="rcc-also rcc-also-line">资料来源 {link(source || '', url)} · 另见 {also}</p> : null}
    <dl className="rcc-facts">
      {facts.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="num">{v}</dd></div>)}
    </dl>
  </>;
}
