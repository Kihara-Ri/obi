// 用户确认候选发行版：并行取详情与封面，把版本身份、资料与封面带入表单（旧查询结果随序号作废）。
import type {Dispatch, MutableRefObject, SetStateAction} from 'react';
import {api} from '../../core/api';
import {displayReleaseTitle, releaseRegion} from '../../core/release-metadata';
import {SOURCE_LABEL, identityFromCandidate, identityOf} from '../../core/release-source';
import type {ReleaseCandidate, ReleaseInfo} from '../../types';
import type {FormCtx} from './context';
import {matchReleaseCover} from './releaseCover';
import type {CoverSearch} from './useCoverSearch';

const SOURCE_NAME: Record<string, string> = {...SOURCE_LABEL};

/** 只列出出错的来源；都正常（found / none）返回空串。 */
export function failedSources(sources: Record<string, string> = {}) {
  return Object.entries(sources).filter(([, s]) => s !== 'none' && s !== 'found')
    .map(([name, s]) => `${SOURCE_NAME[name] ?? name}：${s}`).join('；');
}
export {identityOf};


/** 只补当前缺失的字段，已有（含人工修改）的值保持不变。 */
export function fillMissing(current: ReleaseInfo, incoming: ReleaseInfo): ReleaseInfo {
  const merged = {...current};
  for (const [key, value] of Object.entries(incoming)) {
    const prior = merged[key as keyof ReleaseInfo];
    if ((!prior || Array.isArray(prior) && prior.length === 0) && value) Object.assign(merged, {[key]: value});
  }
  return merged;
}

export interface PickDeps {
  ctx: FormCtx; cover: CoverSearch;
  sequence: MutableRefObject<number>; verified: MutableRefObject<string>;
  setBusy: Dispatch<SetStateAction<boolean>>;
  setMessage: Dispatch<SetStateAction<string>>; setBarcode: Dispatch<SetStateAction<string>>;
  setCatalogNumber: Dispatch<SetStateAction<string>>; setCandidates: Dispatch<SetStateAction<ReleaseCandidate[]>>;
  setVerification: Dispatch<SetStateAction<'verified' | 'pending' | 'failed'>>;
}

export async function pickRelease(candidate: ReleaseCandidate, d: PickDeps) {
  const {ctx, cover, sequence, verified} = d;
  const {v, set, dirty, formRef} = ctx;
  const seq = ++sequence.current;
  const current = () => seq === sequence.current && !!formRef.current?.isConnected;
  const identity = identityFromCandidate(candidate);
  const changed = candidate.id !== identityOf(v.releaseInfo);
  // 封面只依赖候选的标题与艺人，与曲目详情并行查找，不必等详情返回。
  // 已有封面（含旧记录里本来就正确的封面）一律保留：只在没有封面时自动匹配，想换封面由用户点「重新匹配」。
  const coverTask = !cover.hasCover
    ? matchReleaseCover(candidate, () => seq === sequence.current) : null;
  d.setBusy(true); d.setMessage('读取曲目与资料…');
  let releaseInfo: ReleaseInfo = {...candidate.releaseInfo, ...identity};
  let detailUnavailable = false;
  try {
    const detail = await api<{releaseInfo: ReleaseInfo}>('release-details?id=' + encodeURIComponent(candidate.id));
    releaseInfo = {...releaseInfo, ...detail.releaseInfo, ...identity};
  } catch { detailUnavailable = true; } // 曲目请求失败时保留精确匹配的基本资料。
  if (!current()) return;
  d.setBarcode(releaseInfo.barcode || '');
  d.setCatalogNumber(releaseInfo.catalogNumber || '');
  verified.current = candidate.id;
  d.setVerification('verified');
  set({title: displayReleaseTitle(candidate.title), artist: candidate.artist,
    version: releaseInfo.packaging || '',
    // 地区归类只是元数据；侧标仍是副本实物属性。
    pressing: releaseRegion(releaseInfo.country), releaseInfo,
    ...(changed ? {packaging: null} : {})});
  d.setCandidates([]);
  d.setMessage(detailUnavailable ? '曲目详情暂不可用' : '');
  d.setBusy(false);
  if (!coverTask) cover.setCoverStatus('保留现有封面');
  else if (!await applyCover(coverTask, ctx, cover, current)) return;
  dirty();
}

/** 把自动匹配到的封面写进表单：只有找到新封面才写入，没找到时保持无封面，不会动任何已有封面。
 * 「选用此版本」与从查询页「以此入库」带入的新表单共用。返回 false 表示表单已换了别的版本或已关闭。 */
export async function applyCover(task: ReturnType<typeof matchReleaseCover>, ctx: FormCtx, cover: CoverSearch,
                                 current: () => boolean): Promise<boolean> {
  cover.setCandidates([]);
  cover.setCoverStatus('查找中…');
  cover.setBusy(true);
  const found = await task;
  if (!current()) return false;
  cover.setBusy(false);
  if (found) {
    if (found.cover) {
      ctx.base.current = {...ctx.base.current, cover: found.cover, coverSource: found.coverSource};
      cover.setHasCover(true);
    }
    cover.setCoverStatus(found.status);
  }
  return true;
}
