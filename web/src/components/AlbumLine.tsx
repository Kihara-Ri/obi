// 合单售出 / 打包 / 销售费用表单里共用的专辑行：封面、标题、艺人与标签，可选显示成本。
import type {AlbumRecord} from '../types';
import {labelTags} from '../types';
import {yuan} from '../core/format';
import {Cover} from './Cover';

export function AlbumLine({r, showCost = true}: {r: AlbumRecord; showCost?: boolean}) {
  const tags = labelTags(r);
  return (
    <div className="sale-album">
      <div className="thumb"><Cover r={r}/></div>
      <div>
        <strong>{r.title}</strong>
        <div className="a">
          {r.artist}{tags.length ? ` · ${tags.join(' · ')}` : ''}
          {showCost ? (r.cost === null ? ' · 成本待补' : ` · 成本 ${yuan(r.cost)}`) : ''}
        </div>
      </div>
    </div>
  );
}
