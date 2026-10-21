// 发行资料页（详情的二级页）：这张专辑的全部发行信息，分「身份」「规格」「曲目」三块；空字段整行隐藏，编号 / 条码 / 刻码可复制。
import {useApp} from '../../state/AppContext';
import type {AppCtx} from '../../state/AppContext';
import {formatPackagingName} from '../../core/album-packaging';
import {dedupeCatalog, displayRegion, regionName} from '../../core/release-metadata';
import {Tracklist} from '../../components/Tracklist';
import {Rows} from './Rows';

export function openReleasePage(app: AppCtx, id: string) {
  app.openDrawer({title: '发行资料', content: <ReleaseBody id={id}/>,
    // 返回 = 弹栈露出下面那一层详情（它一直挂载着），不是重新打开一个新详情页：不会重新加载
    back: {label: '返回专辑详情', run: () => { app.backDrawer(); }}});
}

function ReleaseBody({id}: {id: string}) {
  const app = useApp();
  const r = app.rec(id);
  if (!r) return null;
  const info = r.releaseInfo ?? {};
  const code = info.country;
  const source = info.musicBrainzReleaseId
    ? {name: 'MusicBrainz', url: 'https://musicbrainz.org/release/' + info.musicBrainzReleaseId}
    : info.discogsReleaseId ? {name: 'Discogs', url: 'https://www.discogs.com/release/' + info.discogsReleaseId} : null;
  const pkg = info.packaging || formatPackagingName(r.version, r.packaging);
  const catalog = dedupeCatalog(info.catalogNumber);
  return <div className="detail-page">
    <h3 className="section-title">身份</h3>
    <Rows rows={[
      info.unofficial === '1' && {label: '来源', value: '非官方发行（私版）· 无资料库条目'},
      source && {label: '来源', value: <a href={source.url} target="_blank" rel="noopener noreferrer">{source.name} ↗</a>},
      {label: '地区', value: code ? `${regionName(code)}（${code.toUpperCase()}）` : displayRegion(code, r.pressing)},
      info.releaseDate && {label: '发行日期', value: info.releaseDate},
      info.label && {label: '厂牌', value: info.label},
      catalog && {label: '唱片编号', value: catalog, copy: info.catalogNumber},
      info.barcode && {label: '条码', value: info.barcode, copy: info.barcode},
    ]}/>
    <h3 className="section-title">规格</h3>
    <Rows rows={[
      pkg && {label: '包装', value: pkg},
      info.edition && {label: '版次', value: info.edition},
      info.format && {label: '介质', value: info.format},
      info.discCount && {label: '碟数', value: info.discCount},
      info.matrix && {label: '内圈刻码', value: info.matrix, copy: info.matrix},
      info.extras && {label: '附件与特典', value: info.extras},
      info.observations && {label: '照片可见情况', value: info.observations},
    ]}/>
    {r.releaseInfo ? <Tracklist releaseInfo={r.releaseInfo}/> : null}
  </div>;
}
