// 发行版检索：条码 / 唱片编号 → MusicBrainz（备用 Discogs）→ 用户确认版本 → 带入资料与封面；
// 查不到时可按「未收录版本」手动录入。新建没有可信发行版身份，必须由用户确认候选，不按标题猜版次。
import {useEffect, useRef, useState} from 'react';
import {api} from '../../core/api';
import {gs1Valid} from '../../core/lookup';
import {releaseRegion} from '../../core/release-metadata';
import type {AlbumRecord, ReleaseCandidate, ReleaseInfo} from '../../types';
import type {FormCtx} from './context';
import {identityOf, failedSources, fillMissing, pickRelease} from './pickRelease';
import type {CoverSearch} from './useCoverSearch';

export type LookupMode = 'barcode' | 'catalog';
interface LookupResult {candidates: ReleaseCandidate[]; sources?: Record<string, string>}

const VALID_BARCODE = /^(?:\d{8}|\d{12,14})$/;

export function useReleaseLookup(ctx: FormCtx, cover: CoverSearch, r: AlbumRecord | undefined) {
  const {v, set, setV, live, dirty, formRef} = ctx;
  const initialInfo = r?.releaseInfo ?? ctx.base.current.releaseInfo;
  const [barcode, setBarcode] = useState(initialInfo?.barcode || '');
  const [catalogNumber, setCatalogNumber] = useState(initialInfo?.catalogNumber || '');
  const [mode, setModeState] = useState<LookupMode>(initialInfo?.catalogNumber && !initialInfo?.barcode ? 'catalog' : 'barcode');
  const [candidates, setCandidates] = useState<ReleaseCandidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [verification, setVerification] = useState<'verified' | 'pending' | 'failed'>('verified');
  const sequence = useRef(0);
  const inflight = useRef<{key: string; promise: Promise<void>} | null>(null);
  const abort = useRef<AbortController | null>(null);
  // 修改条码后，只有旧发行版 ID 经校验通过、或用户从新候选中确认，才有可信身份。
  const verified = useRef(initialInfo ? identityOf(initialInfo) : '');
  const manualRelease = v.releaseInfo.manualRelease === '1' && !v.releaseInfo.musicBrainzReleaseId
    && !v.releaseInfo.discogsReleaseId;
  const identified = !!(identityOf(v.releaseInfo) || manualRelease);

  const reset = () => { ++sequence.current; abort.current?.abort(); inflight.current = null; cover.setBusy(false); };
  const setMode = (next: LookupMode) => { reset(); setModeState(next); setCandidates([]); setMessage(''); setNotFound(false); };

  const changeBarcode = (raw: string) => {
    const next = raw.replace(/[^0-9]/g, '');
    reset(); setBarcode(next); setCandidates([]); setNotFound(false);
    if (manualRelease) {
      set({releaseInfo: {...live.current.releaseInfo, barcode: next}});
      dirty();
      return;
    }
    setVerification('pending');
    setMessage(next ? '校验中…' : '');
    // 校验期间保留已有曲目；选择另一个发行版会换成它自己的曲目。
    set({releaseInfo: {...live.current.releaseInfo, barcode: next, musicBrainzReleaseId: '', discogsReleaseId: ''}});
    dirty();
  };
  const changeCatalogNumber = (value: string) => {
    reset(); setCatalogNumber(value); setCandidates([]); setMessage(''); setNotFound(false);
    if (manualRelease) { set({releaseInfo: {...live.current.releaseInfo, catalogNumber: value}}); dirty(); return; }
    if (!manualRelease && value !== v.releaseInfo.catalogNumber) {
      set({releaseInfo: {...v.releaseInfo, musicBrainzReleaseId: '', discogsReleaseId: '', tracklist: [], media: []}});
      dirty();
    }
  };

  /** 统一的检索入口（按钮、回车、输入完整条码后的自动校验共用）；相同查询进行中时复用同一次请求。 */
  const search = (kind: LookupMode, raw: string, auto = false): Promise<void> => {
    const value = raw.trim();
    const key = kind + ':' + value;
    if (inflight.current?.key === key) return inflight.current.promise;
    const seq = ++sequence.current;
    abort.current?.abort();
    if (kind === 'barcode' && !(VALID_BARCODE.test(value) && gs1Valid(value))) {
      setCandidates([]); setNotFound(false);
      setMessage(VALID_BARCODE.test(value) ? '条码校验位不对，请核对是否输错了一位' : '条码需 8、12、13 或 14 位数字');
      return Promise.resolve();
    }
    if (kind === 'catalog' && (value.length < 2 || value.length > 80)) {
      setCandidates([]); setNotFound(false); setMessage('请输入完整编号'); return Promise.resolve();
    }
    const controller = abort.current = new AbortController();
    // 后端两个来源各有超时；这里再兜底，避免连接卡死时界面一直停在“查询中”。
    const timer = window.setTimeout(() => controller.abort(), 70000);
    const current = () => seq === sequence.current && !!formRef.current?.isConnected;
    setBusy(true); cover.setBusy(false); setCandidates([]); setNotFound(false);
    setMessage('查询中 · MusicBrainz，无结果时转 Discogs');
    const what = kind === 'barcode' ? '条码' : '编号';
    const promise = (async () => {
      try {
        const result = await api<LookupResult>(kind === 'barcode' ? 'catalog/barcode' : 'catalog/number',
          kind === 'barcode' ? {barcode: value} : {catalogNumber: value}, {signal: controller.signal});
        if (!current()) return;
        const note = failedSources(result.sources);
        setCandidates(result.candidates);
        if (auto) setVerification('failed');
        if (result.candidates.length) {
          const onlyDiscogs = result.candidates.every(c => c.source === 'discogs');
          setMessage(`${onlyDiscogs ? 'Discogs 找到' : '找到'} ${result.candidates.length} 个版本，请选择`);
        } else {
          setNotFound(true);
          setMessage(note
            ? `未找到，${note} 暂不可用，结果可能不全`
            : `两个资料库都没有这个${what}`);
        }
      } catch (err) {
        if (!current()) return;
        setNotFound(true);
        if (auto) setVerification('failed');
        setMessage(controller.signal.aborted ? '查询超时，可重试或手动录入'
          : err instanceof Error ? err.message : String(err));
      } finally {
        window.clearTimeout(timer);
        if (inflight.current?.key === key) inflight.current = null;
        if (seq === sequence.current) setBusy(false);
      }
    })();
    inflight.current = {key, promise};
    return promise;
  };
  const lookup = () => search(mode, mode === 'barcode' ? barcode : catalogNumber);

  // 修改条码后：先用原发行版 ID 精确校验（笔误恰好等于原版本时不能悄悄重置版本），
  // 不通过再检索候选；条码不完整时只等待继续输入。
  useEffect(() => {
    if (verification !== 'pending') return;
    const number = barcode, releaseId = verified.current;
    const timer = window.setTimeout(async () => {
      if (!number) {
        setVerification('failed');
        setMessage('条码已清空，可改用编号确认版本');
        return;
      }
      if (releaseId) {
        const seq = ++sequence.current;
        setBusy(true);
        try {
          await api('catalog/barcode/verify', {barcode: number, releaseId});
          if (sequence.current !== seq) return;
          setV(prev => ({...prev, releaseInfo: releaseId.startsWith('discogs-')
            ? {...prev.releaseInfo, barcode: number, discogsReleaseId: releaseId.slice(8)}
            : {...prev.releaseInfo, barcode: number, musicBrainzReleaseId: releaseId}}));
          setVerification('verified'); setBusy(false);
          setMessage('');
          return;
        } catch {
          // 属于别的版本、校验位错误或来源暂不可用：都不能按已校验保存，继续检索候选。
          if (sequence.current === seq) setBusy(false);
        }
      }
      if (!VALID_BARCODE.test(number) || !gs1Valid(number)) {
        setVerification('failed'); setMessage(VALID_BARCODE.test(number) ? '条码校验位不对，请核对是否输错了一位' : '请输入完整条码（8、12、13 或 14 位）');
        return;
      }
      void search('barcode', number, true);
    }, 550);
    return () => window.clearTimeout(timer);
  }, [barcode, verification]);

  /** 手动录入（资料库都查不到）：带入已输入的条码 / 编号，由用户手填名称、艺人；明确标记为未经核对。
   * unofficial：私版 / Bootleg，同样按手动录入，另有「非官方」标记。 */
  const markManual = (unofficial: boolean) => {
    reset(); verified.current = '';
    setVerification('verified'); setCandidates([]); setNotFound(false);
    set({releaseInfo: {...v.releaseInfo, barcode: barcode.trim(), catalogNumber: catalogNumber.trim(),
      musicBrainzReleaseId: '', discogsReleaseId: '', manualRelease: '1', unofficial: unofficial ? '1' : ''},
      ...(manualRelease ? {} : {packaging: null})});
    setMessage(unofficial ? '非官方发行 · 请填写专辑名、艺人，版本说明里写明来源'
      : '手动录入 · 请填专辑名、艺人');
    dirty();
  };
  const setUnofficial = (on: boolean) => {
    if (on) markManual(true); else { set({releaseInfo: {...v.releaseInfo, unofficial: ''}}); dirty(); } // 取消只去标记
  };
  const leaveManual = () => { // 退出手动录入回到查询，已填名称 / 艺人保留
    set({releaseInfo: {...v.releaseInfo, manualRelease: '', unofficial: ''}}); setMessage(''); dirty(); };
  const refreshReleaseMetadata = async () => {
    const id = v.releaseInfo.musicBrainzReleaseId;
    if (!id) return;
    setBusy(true); setMessage('补全资料中…');
    try {
      const result = await api<{releaseInfo: ReleaseInfo}>('release-details?id=' + encodeURIComponent(id));
      if (!formRef.current?.isConnected || live.current.releaseInfo.musicBrainzReleaseId !== id) return;
      const merged = fillMissing(live.current.releaseInfo, result.releaseInfo);
      setBarcode(merged.barcode || '');
      setCatalogNumber(merged.catalogNumber || '');
      set({releaseInfo: merged, version: live.current.version || merged.packaging || '',
        pressing: releaseRegion(merged.country, live.current.pressing)});
      setMessage('已补全缺失资料，人工修改保持不变');
      dirty();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally { setBusy(false); }
  };

  const chooseRelease = (candidate: ReleaseCandidate) => pickRelease(candidate, {
    ctx, cover, sequence, verified, setBusy, setMessage, setBarcode, setCatalogNumber,
    setCandidates, setVerification});

  return {mode, setMode, barcode, catalogNumber, candidates, busy, message, notFound,
    verification, manualRelease, identified, changeBarcode, changeCatalogNumber, lookup,
    enterManually: () => markManual(false), leaveManual, setUnofficial, refreshReleaseMetadata, chooseRelease, setCatalogNumber, search};
}
export type ReleaseLookup = ReturnType<typeof useReleaseLookup>;
