// 表单共享：提交流程（禁用按钮 → API → 关抽屉或回到上一层 → 刷新 → toast → 错误就地显示）、
// 汇率获取与批量操作 helper。
import {useEffect, useState} from 'react';
import {api} from '../core/api';
import {today} from '../core/format';
import type {AppCtx} from '../state/AppContext';

// 当日汇率（每 100 円兑人民币）；无数据返回 null，由调用方提示「暂无当日汇率」。
export function useRate(date: string) {
  const [rate, setRate] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    api<{rate: number | null}>('rate?date=' + (date || today()))
      .then(res => { if (!cancelled) setRate(res.rate); })
      .catch(() => { if (!cancelled) setRate(null); });
    return () => { cancelled = true; };
  }, [date]);
  return rate;
}

export function useFormSubmit() {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // backOnSave：编辑类表单（编辑专辑、上架资料）保存后回到打开它的那一层并显示更新后的内容；
  // 其余（记录售出、运输、确认类…）保存后专辑状态可能已变，仍关闭整个抽屉。
  const run = async (app: AppCtx, fn: () => Promise<unknown>, successMsg = '已保存', opts?: {backOnSave?: boolean}) => {
    setSaving(true); setError('');
    try {
      await fn();
      app.setSelected(new Set());
      if (opts?.backOnSave) {
        await app.refresh(); // 先刷新再回上一层，上一层（详情 / 管理页）出现时就是新内容
        app.backDrawer(true);
      } else {
        app.closeDrawer(true);
        await app.refresh();
      }
      app.toast(successMsg);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };
  return {error, saving, run, setError};
}

export async function bulkAction(app: AppCtx, action: string, ids: string[], successMsg = '已更新', undo?: {action: string; label?: string}) {
  try {
    await api('bulk', {action, ids});
  } catch (e) {
    app.toast(e instanceof Error ? e.message : String(e), 'err');
    return;
  }
  app.setSelected(new Set());
  app.closeDrawer(true);
  await app.refresh();
  app.toast(successMsg, 'ok', undo ? {label: undo.label ?? '撤销', run: () => { void bulkAction(app, undo.action, ids, '已撤销'); }} : undefined);
}
