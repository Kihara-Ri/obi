// 把查询页选中的版本绑定到库里已有的一张专辑（没有条码的专辑靠文字搜索确认版本）。
// 只改发行资料，专辑名 / 艺人 / 封面 / 成本等不动；用户自己写的刻码、附件、观察记录保留。
import {api} from '../core/api';
import {identityFromCandidate} from '../core/release-source';
import type {AppCtx} from '../state/AppContext';
import type {AlbumRecord, ReleaseCandidate, ReleaseInfo} from '../types';

const KEEP = ['matrix', 'extras', 'observations'] as const;

async function saveInfo(app: AppCtx, r: AlbumRecord, info: ReleaseInfo, done: string): Promise<boolean> {
  try {
    await api('records', {id: r.id, revision: r.revision, releaseInfo: info});
  } catch (err) {
    app.toast(err instanceof Error ? err.message : String(err), 'err');
    return false;
  }
  await app.refresh();
  app.toast(done, 'ok');
  return true;
}

export function confirmRelease(app: AppCtx, r: AlbumRecord, c: ReleaseCandidate, info: ReleaseInfo) {
  const identity = identityFromCandidate(c);
  const kept = Object.fromEntries(KEEP.map(k => [k, r.releaseInfo?.[k] ?? '']));
  return saveInfo(app, r, {...info, ...identity, ...kept}, '已确认发行版');
}

/** 两个资料库都查不到：标为已处理，不再提醒（沿用手动录入标记）。 */
export const markHandled = (app: AppCtx, r: AlbumRecord) =>
  saveInfo(app, r, {...(r.releaseInfo as ReleaseInfo), manualRelease: '1'}, '已标为无资料，不再提醒');
