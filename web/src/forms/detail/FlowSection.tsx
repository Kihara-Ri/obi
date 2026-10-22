// 管理页「流转」：库存中的专辑可在海外库存 / 国内库存之间直接切换（分段控件，成功后 toast 带撤销），并可移除；
// 在途 / 售出中 / 已售出由包裹和交易决定，这里只说明状态与去哪处理，不给手动改（那会让运费分摊、售价对不上账）。
import {useState} from 'react';
import {useApp} from '../../state/AppContext';
import {api} from '../../core/api';
import {statusName} from '../../core/modules';
import {Seg} from '../../components/ui/Seg';
import {bulkAction} from '../shared';
import type {AlbumRecord} from '../../types';
import {Rows} from './Rows';

const HINT: Record<string, string> = {
  transit: '在途中，由包裹决定；到「在途」页签收后变为国内库存。',
  shipping: '已卖出、寄送中，由交易决定；到「售出中」处理。',
  sold: '已售出，由交易决定；退货 / 退款在「交易」里处理。',
};

export function FlowSection({r}: {r: AlbumRecord}) {
  const app = useApp();
  const {modules} = app;
  const [busy, setBusy] = useState(false);
  const inStock = ['overseas', 'domestic'].includes(r.status);
  const move = async (to: string) => {
    if (busy || to === r.status) return;
    const action = to === 'domestic' ? 'to_domestic' : 'to_overseas';
    const undo = to === 'domestic' ? 'undo_to_domestic' : 'undo_to_overseas';
    setBusy(true);
    try {
      await api('bulk', {action, ids: [r.id]});
      await app.refresh();
      app.toast(to === 'domestic' ? '已标为国内库存' : '已调回海外', 'ok', {label: '撤销', run: () => {
        void api('bulk', {action: undo, ids: [r.id]}).then(() => app.refresh()).catch(e => app.toast(e instanceof Error ? e.message : String(e), 'err'));
      }});
    } catch (e) {
      app.toast(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setBusy(false);
    }
  };
  return <>
    <h3 className="section-title">流转</h3>
    {inStock && modules.circulation
      ? <Seg ariaLabel="当前位置" value={r.status} onValue={v => void move(v)} disabled={busy}
          options={[{value: 'overseas', label: '海外库存'}, {value: 'domestic', label: '国内库存'}]}/>
      : <Rows rows={[{label: '当前位置', value: statusName(r.status, modules)}]}/>}
    {HINT[r.status] ? <p className="note-text">{HINT[r.status]}</p> : null}
    {inStock ? <div className="detail-flow">
      <button type="button" className="danger" onClick={() => bulkAction(app, 'delete', [r.id], '已移入回收站，可在设置中恢复')}>移除</button>
    </div> : null}
  </>;
}
