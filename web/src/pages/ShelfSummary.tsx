// 库存页顶部统计卡：总成本做主数字（下附成本待补），右侧张数 / 已上架；底部一行「待确认版本」可点进查询页。
// 待确认版本只数当前地区（国内 / 海外）的专辑，点进查询页逐张确认；确认或标为无资料后，app.refresh 会让这里的数字跟着变。
import {sum, yuan} from '../core/format';
import {releasePending} from '../core/lookup';
import type {AlbumRecord, ModuleFlags} from '../types';
import './ShelfSummary.css';

interface Props {
  all: AlbumRecord[];
  modules: ModuleFlags;
  page: string;
}

export function ShelfSummary({all, modules, page}: Props) {
  const known = all.filter(r => r.cost !== null);
  if (page === 'trash') {
    return <div className="summary shelf-summary"><div className="shelf-sum-main"><span>回收站</span><strong>{all.length} 张</strong></div></div>;
  }
  const pending = all.filter(releasePending).length;
  const costTodo = modules.acquisition ? all.length - known.length : 0;
  const listed = all.filter(r => r.listed).length;
  return (
    <div className="summary shelf-summary">
      {modules.acquisition ? (
        <div className="shelf-sum-main">
          <span>总成本</span>
          <strong>{known.length ? yuan(sum(known, 'cost')) : '—'}</strong>
          {costTodo ? <small>另有 {costTodo} 张成本待补，未计入</small> : null}
        </div>
      ) : (
        <div className="shelf-sum-main"><span>专辑</span><strong>{all.length} 张</strong></div>
      )}
      <div className="shelf-sum-side">
        {modules.acquisition ? <span><b>{all.length}</b> 张</span> : null}
        {modules.trading ? <span>已上架 <b>{listed}</b></span> : null}
      </div>
      {pending ? (
        <a className="shelf-sum-todo" href="#lookup"><span><b>{pending}</b> 张待确认版本</span><i>去确认 ›</i></a>
      ) : null}
      {page === 'overseas' ? <p className="shelf-sum-tip">✈ 勾选多张可打包为一趟运输</p> : null}
    </div>
  );
}
