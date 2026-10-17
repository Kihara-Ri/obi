// 添加 / 编辑专辑表单：封面自动抓取（唯一精确匹配自动带入）、日元成本实时折算、
// 库内模糊匹配带入（含重复提示与艺人纠错；输入比库内标题长时不覆盖，只建议）、
// 实物照片（HEIC 压缩）、碟盒/版次/侧标联动。
import {useEffect, useRef, useState} from 'react';
import {api} from '../core/api';
import {today, yuan, fmtJPY} from '../core/format';
import {prefs} from '../core/prefs';
import {matchRecords, norm, artistSuggestions} from '../core/search';
import {useApp} from '../state/AppContext';
import type {AppCtx} from '../state/AppContext';
import type {AlbumRecord, Currency, Status, ReleaseInfo, ReleaseCandidate, PackagingSpec} from '../types';
import {remapPackagingPhotos, PACKAGING_PRESETS} from '../core/album-packaging';
import {TwinControls} from '../components/TwinControls';
import {CopyEditionFields} from '../components/CopyEditionFields';
import {ReleaseMetadataFields} from '../components/ReleaseMetadataFields';
import {displayReleaseTitle, exactDigitalCover, releaseRegion} from '../core/release-metadata';
import {twinBusy} from '../core/digital-twins';
import {MAX_PHOTOS} from '../core/photos';
import {statusName} from '../core/modules';
import {Seg} from '../components/ui/Seg';
import {Dropdown} from '../components/ui/Dropdown';
import {ShopField} from '../components/ShopField';
import {CamIco} from '../components/icons';
import {Field, TextareaField} from './fields';
import {usePhotoSlots, PhotoThumbs} from './PhotoSlots';
import {useFormSubmit} from './shared';

interface CoverCandidate {
  token: string; title: string; artist: string; year?: string;
  thumbnail: string; exact: boolean; provider?: string;
}


export function openRecordForm(app: AppCtx, id?: string) {
  app.openDrawer({title: id ? '编辑专辑' : '添加专辑', asForm: true, content: <RecordForm id={id}/>});
}

export function RecordForm({id}: {id?: string}) {
  const app = useApp();
  const {modules} = app;
  const r = id ? app.rec(id) : undefined;
  const {error, saving, run, setError} = useFormSubmit();
  const formRef = useRef<HTMLFormElement>(null);

  const base = useRef<Partial<AlbumRecord>>(r ? {...r} : {
    title: '', artist: '', price: '', date: modules.acquisition ? today() : '',
    currency: (prefs.get('currency', modules.circulation ? 'JPY' : 'CNY') as Currency) || 'CNY',
    location: modules.acquisition ? prefs.get('location', '') : '', fees: '0', actual: '', note: '',
  });
  const where: Status | null = r ? null : !modules.circulation ? 'domestic' : (base.current.currency === 'CNY' ? 'domestic' : 'overseas');

  const [v, setV] = useState(() => ({
    title: displayReleaseTitle(base.current.title || ''),
    artist: base.current.artist || '',
    price: base.current.currency === 'JPY' && base.current.price !== ''
      ? String(Math.round(Number(base.current.price))) : (base.current.price || ''),
    date: base.current.date ?? '',
    currency: (base.current.currency || 'JPY') as Currency,
    location: base.current.location || '',
    fees: base.current.fees || '0',
    version: base.current.version || '',
    packaging: base.current.packaging ?? null as PackagingSpec | null,
    pressing: base.current.pressing || '',
    obi: base.current.obi || '',
    note: base.current.note || '',
    noteAlbum: base.current.noteAlbum || '',
    storage: base.current.storage || '',
    status: (where ?? base.current.status) as Status | undefined,
    releaseInfo: base.current.releaseInfo ?? {} as ReleaseInfo,
    listingDescription: base.current.listingDescription ?? '',
  }));
  const set = (patch: Partial<typeof v>) => setV(prev => ({...prev, ...patch}));
  const liveValues = useRef(v); liveValues.current = v;
  const dirty = () => app.setDrawerDirty(true);
  // Work-level preference: deliberately separate from the copy's save payload.
  // The user changes it only in album editing; all copies of the work share it.
  const [liked, setLiked] = useState(false);
  const [likedLoading, setLikedLoading] = useState(Boolean(id));
  const [likedSaving, setLikedSaving] = useState(false);
  const [likedError, setLikedError] = useState('');
  useEffect(() => {
    if (!id) return;
    let alive = true;
    void api<{favorites: Record<string, boolean>}>('album-favorites')
      .then(data => {if (alive) setLiked(Boolean(data.favorites[id]));})
      .catch(error => {if (alive) setLikedError(error instanceof Error ? error.message : String(error));})
      .finally(() => {if (alive) setLikedLoading(false);});
    return () => {alive = false;};
  }, [id]);
  const toggleLiked = async () => {
    if (!id || likedSaving || likedLoading) return;
    setLikedSaving(true); setLikedError('');
    try {
      const data = await api<{favorites: Record<string, boolean>}>('album-favorites',
        {recordId: id, liked: !liked});
      setLiked(Boolean(data.favorites[id]));
    } catch (error) {
      setLikedError(error instanceof Error ? error.message : String(error));
    } finally {setLikedSaving(false);}
  };
  // 新建时先以真实条码确定发行版。名称/艺人/曲目由 MusicBrainz 填充，
  // 多个候选必须由用户选择，不推断精确版次。
  const [barcode, setBarcode] = useState(r?.releaseInfo?.barcode || '');
  const [catalogNumber, setCatalogNumber] = useState(r?.releaseInfo?.catalogNumber || '');
  const [lookupMode, setLookupMode] = useState<'barcode' | 'catalog'>(
    r?.releaseInfo?.catalogNumber && !r?.releaseInfo?.barcode ? 'catalog' : 'barcode');
  const [barcodeCandidates, setBarcodeCandidates] = useState<ReleaseCandidate[]>([]);
  const [barcodeBusy, setBarcodeBusy] = useState(false);
  const [barcodeMessage, setBarcodeMessage] = useState('');
  const lookupSequence = useRef(0);
  // A modified barcode has no trusted release identity until MusicBrainz verifies
  // the old UUID or the user confirms a candidate from the new barcode search.
  const verifiedRelease = useRef(r?.releaseInfo?.musicBrainzReleaseId || '');
  const [barcodeVerification, setBarcodeVerification] =
    useState<'verified' | 'pending' | 'failed'>('verified');
  const changeBarcode = (raw: string) => {
    const next = raw.replace(/[^0-9]/g, '');
    ++lookupSequence.current;
    setBarcode(next);
    setBarcodeCandidates([]);
    setBarcodeVerification('pending');
    setBarcodeMessage('条码已更改，正在校验 MusicBrainz 发行资料…');
    // Preserve existing track metadata while this barcode is being checked;
    // choosing another release replaces it with the new release's own tracks.
    set({releaseInfo: {...liveValues.current.releaseInfo, barcode: next,
      musicBrainzReleaseId: ''}});
    dirty();
  };
  useEffect(() => {
    if (barcodeVerification !== 'pending') return;
    const number = barcode;
    const releaseId = verifiedRelease.current;
    const seq = ++lookupSequence.current;
    const timer = window.setTimeout(async () => {
      if (!number) {
        setBarcodeVerification('failed');
        setBarcodeMessage('条码已清空。如果此版本确实没有条码，请用唱片编号重新确认发行版本。');
        return;
      }
      setBarcodeBusy(true);
      try {
        // Prefer exact-MBID comparison: correcting a typo that matches the
        // existing edition must not silently reset the selected release.
        if (releaseId) {
          try {
            await api('catalog/barcode/verify', {barcode: number, releaseId});
            if (lookupSequence.current !== seq) return;
            setV(prev => ({...prev, releaseInfo: {...prev.releaseInfo, barcode: number,
              musicBrainzReleaseId: releaseId}}));
            setBarcodeVerification('verified');
            setBarcodeMessage('✓ 已通过 MusicBrainz 校验，条码属于当前发行版本');
            return;
          } catch {
            // Different release, invalid checksum or temporarily unavailable:
            // none can be saved as verified; query candidate editions next.
          }
        }
        const result = await api<{candidates: ReleaseCandidate[]}>('catalog/barcode',
          {barcode: number});
        if (lookupSequence.current !== seq) return;
        setBarcodeCandidates(result.candidates);
        setBarcodeVerification('failed');
        setBarcodeMessage(result.candidates.length
          ? '当前条码需要重新确认发行版；请从下面的 MusicBrainz 候选中选择'
          : '条码格式、校验位或 MusicBrainz 查询未通过；不能保存此条码');
      } catch (error) {
        if (lookupSequence.current === seq) {
          setBarcodeVerification('failed');
          setBarcodeMessage(error instanceof Error ? error.message : String(error));
        }
      } finally { if (lookupSequence.current === seq) setBarcodeBusy(false); }
    }, 550);
    return () => window.clearTimeout(timer);
  }, [barcode, barcodeVerification]);
  const lookupBarcode = async () => {
    const value = (lookupMode === 'barcode' ? barcode : catalogNumber).trim();
    const seq = ++lookupSequence.current;
    if (lookupMode === 'barcode' && !/^(?:\d{8}|\d{12,14})$/.test(value)) {
      setBarcodeCandidates([]); setBarcodeMessage('请输入完整的 8、12、13 或 14 位数字条形码'); return;
    }
    if (lookupMode === 'catalog' && (value.length < 2 || value.length > 80)) {
      setBarcodeCandidates([]); setBarcodeMessage('请输入完整的唱片编号'); return;
    }
    setBarcodeBusy(true); setBarcodeMessage('正在从 MusicBrainz 检索 CD 发行版…');
    setBarcodeCandidates([]);
    try {
      const result = await api<{candidates: ReleaseCandidate[]}>(
        lookupMode === 'barcode' ? 'catalog/barcode' : 'catalog/number',
        lookupMode === 'barcode' ? {barcode: value} : {catalogNumber: value});
      if (seq !== lookupSequence.current || !formRef.current?.isConnected) return;
      setBarcodeCandidates(result.candidates);
      setBarcodeMessage(result.candidates.length
        ? `找到 ${result.candidates.length} 个匹配发行版，请确认后带入`
        : 'MusicBrainz 没有找到精确匹配的 CD 发行版。请核对编号，也可切换另一种方式查找。');
    } catch (err) {
      if (seq === lookupSequence.current) setBarcodeMessage(err instanceof Error ? err.message : String(err));
    } finally {
      if (seq === lookupSequence.current) setBarcodeBusy(false);
    }
  };
  const refreshReleaseMetadata = async () => {
    const id = v.releaseInfo.musicBrainzReleaseId;
    if (!id) return;
    setBarcodeBusy(true); setBarcodeMessage('正在补全已确认发行版的元数据…');
    try {
      const result = await api<{releaseInfo: ReleaseInfo}>('release-details?id=' + encodeURIComponent(id));
      if (!formRef.current?.isConnected || liveValues.current.releaseInfo.musicBrainzReleaseId !== id) return;
      const current = liveValues.current;
      const merged = {...current.releaseInfo};
      for (const [key, value] of Object.entries(result.releaseInfo)) {
        const prior = merged[key as keyof ReleaseInfo];
        if ((!prior || Array.isArray(prior) && prior.length === 0) && value)
          Object.assign(merged, {[key]: value});
      }
      setBarcode(merged.barcode || '');
      setCatalogNumber(merged.catalogNumber || '');
      set({releaseInfo: merged, version: current.version || merged.packaging || '',
        pressing: releaseRegion(merged.country, current.pressing)});
      setBarcodeMessage('已补全缺失的元数据，已有人工修改的内容保持不变。请保存修改。');
      dirty();
    } catch (error) {
      setBarcodeMessage(error instanceof Error ? error.message : String(error));
    } finally { setBarcodeBusy(false); }
  };
    const chooseRelease = async (candidate: ReleaseCandidate) => {
    const seq = ++lookupSequence.current;
    setBarcodeBusy(true); setBarcodeMessage('正在补全发行资料与曲目…');
    try {
      let releaseInfo: ReleaseInfo = {...candidate.releaseInfo, musicBrainzReleaseId: candidate.id};
      let detailUnavailable = false;
      try {
        const detail = await api<{releaseInfo: ReleaseInfo}>('release-details?id=' + encodeURIComponent(candidate.id));
        releaseInfo = {...releaseInfo, ...detail.releaseInfo, musicBrainzReleaseId: candidate.id};
      } catch { detailUnavailable = true; } // 曲目请求失败时保留精确匹配的基本资料。
      if (seq !== lookupSequence.current || !formRef.current?.isConnected) return;
      setBarcode(releaseInfo.barcode || '');
      setCatalogNumber(releaseInfo.catalogNumber || '');
      verifiedRelease.current = candidate.id;
      setBarcodeVerification('verified');
      set({title: displayReleaseTitle(candidate.title), artist: candidate.artist,
        version: releaseInfo.packaging || '',
        // Region classification is metadata; OBI remains a physical-copy property.
        pressing: releaseRegion(releaseInfo.country), releaseInfo,
        ...(candidate.id !== v.releaseInfo.musicBrainzReleaseId ? {packaging: null} : {})});
      setBarcodeCandidates([]);
      setBarcodeMessage(`已确认发行版，保存后会记住此版本${detailUnavailable ? '（曲目详情暂不可用）' : ''}`);
      // Front cover and the digital twin must derive from the same selected release UUID.
      // A same-title release is NOT necessarily the same edition.
      if (candidate.id !== v.releaseInfo.musicBrainzReleaseId || !hasCover) {
        base.current = {...base.current, cover: '', coverSource: undefined};
        setHasCover(false);
        lastQuery.current = null;
        setCandidates([]);
        setCoverStatus('优先查找 iTunes 数字封面…');
        // Cover art is a display image, not proof of a physical pressing.
        // Edition metadata and the digital twin still use the confirmed MBID.
        let digitalCover = false;
        try {
          const found = await api<{candidates: CoverCandidate[]}>('covers/search',
            {title: displayReleaseTitle(candidate.title), artist: candidate.artist, country: 'AUTO'});
          if (seq !== lookupSequence.current) return;
          const exact = exactDigitalCover(found.candidates);
          if (exact) {
            const image = await api<{cover: string; coverSource: AlbumRecord['coverSource']}>(
              'covers/download', {token: exact.token});
            if (seq !== lookupSequence.current) return;
            if (image.cover) {
              base.current = {...base.current, cover: image.cover, coverSource: image.coverSource};
              setHasCover(true);
              setCoverStatus('已匹配 iTunes 数字封面');
              digitalCover = true;
            }
          }
        } catch {
          // Network or artwork errors do not invalidate an already-verified MBID.
        }
        if (!digitalCover) {
          setCoverStatus('iTunes 没有准确的数字封面，尝试此版 Cover Art Archive…');
          try {
            const selected = await api<{cover: string; coverSource?: AlbumRecord['coverSource']}>(
              'catalog/front-cover?id=' + encodeURIComponent(candidate.id));
            if (seq !== lookupSequence.current) return;
            if (selected.cover) {
              base.current = {...base.current, cover: selected.cover,
                coverSource: {title: candidate.title, artist: candidate.artist}};
              setHasCover(true);
              setCoverStatus('已带入此版 Cover Art Archive 封面');
            } else setCoverStatus('暂未找到封面，可手动查找并核对');
          } catch {setCoverStatus('封面暂不可用，可手动查找；发行资料仍能保存');}
        }
      }
      dirty();
    } catch (err) {
      if (seq === lookupSequence.current) setBarcodeMessage(err instanceof Error ? err.message : String(err));
    } finally {
      if (seq === lookupSequence.current) setBarcodeBusy(false);
    }
  };


  // ── 封面 ──
  const [coverStatus, setCoverStatus] = useState(r?.cover ? '已自动匹配' : '填写后自动抓取');
  const [candidates, setCandidates] = useState<CoverCandidate[]>([]);
  const [hasCover, setHasCover] = useState(!!r?.cover);
  const lastQuery = useRef<string | null>(null);
  const coverTimer = useRef<number | undefined>(undefined);

  const coverKey = () => `${v.title.trim()}\n${v.artist.trim()}`;
  const stillCurrent = (key: string) => formRef.current?.isConnected && coverKey() === key;

  async function chooseCover(token: string, key: string) {
    setCoverStatus('正在抓取封面…');
    try {
      const result = await api<{cover: string; coverSource: {title: string; artist: string}}>(
        'covers/download', {token});
      if (!stillCurrent(key)) return;
      base.current = {...base.current, cover: result.cover, coverSource: result.coverSource};
      setHasCover(true);
      setCoverStatus(`已匹配：${result.coverSource.title} · ${result.coverSource.artist}`);
      setCandidates([]);
      dirty();
    } catch (err) {
      if (stillCurrent(key)) setCoverStatus(err instanceof Error ? err.message : String(err));
    }
  }

  async function findCover(automatic: boolean) {
    const key = coverKey();
    const title = v.title.trim(), artist = v.artist.trim();
    if (!title || !artist) {
      if (!automatic) setCoverStatus('请先填写专辑名和艺人。');
      return;
    }
    if (automatic && (hasCover || lastQuery.current === key)) return;
    lastQuery.current = key;
    setCoverStatus('正在查找封面…');
    setCandidates([]);
    try {
      const result = await api<{candidates: CoverCandidate[]; warnings?: string[]}>(
        'covers/search', {title, artist, country: 'AUTO'});
      if (!stillCurrent(key)) return;
      const cs = result.candidates;
      const exact = cs.filter(c => c.exact);
      if (automatic && !hasCover && exact.length === 1) {
        await chooseCover(exact[0].token, key);
        return;
      }
      let status = cs.length ? '找到多个候选，点击选择：' : '未找到，调整名称后可重试';
      if (result.warnings?.length) status += ' 部分资料库暂不可用。';
      setCoverStatus(status);
      setCandidates(cs);
    } catch (err) {
      if (stillCurrent(key)) setCoverStatus(err instanceof Error ? err.message : String(err));
    }
  }

  const scheduleCover = () => {
    clearTimeout(coverTimer.current);
    coverTimer.current = window.setTimeout(() => findCover(true), 450);
  };
  useEffect(() => () => { clearTimeout(coverTimer.current); }, []);

  // ── 库内匹配 / 重复提示 / 艺人纠错 ──
  const [hints, setHints] = useState<{label: string; items: {id: string; text: string}[]}>({label: '', items: []});
  const [dupHint, setDupHint] = useState('');
  const artistAuto = useRef(false);
  const hintTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => { clearTimeout(hintTimer.current); }, []);

  function applyMatch(m: AlbumRecord) {
    let artist = v.artist;
    if (!artist || artistAuto.current || norm(artist) !== norm(m.artist)) {
      artist = m.artist;
      artistAuto.current = true;
    }
    set({title: m.title, artist});
    if (m.cover) { base.current = {...base.current, cover: m.cover}; setHasCover(true); }
    setCoverStatus(m.cover ? '已带入库内封面' : '填写后自动抓取');
    setHints({label: '已带入库内资料，可继续修改。', items: []});
    dirty();
  }

  const onTitleInput = (value: string) => {
    if (norm(value) !== norm(base.current.title || '')) artistAuto.current = false;
    set({title: value});
    dirty();
    lastQuery.current = null;
    setCoverStatus(hasCover ? '已有封面' : '填写后自动抓取');
    clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => {
      const q = value.trim();
      const dup = app.state.records.filter(x => q && norm(x.title) === norm(q) && x.id !== base.current.id);
      setDupHint(dup.length
        ? `库中已有 ${dup.length} 张这张专辑（${dup.map(x => statusName(x.status, modules)).join('、')}）。同一张买了多个版本就分别保存，保存后可在版本里注明区别。`
        : '');
      if (q.length < 2) { setHints({label: '', items: []}); return; }
      const hits = matchRecords(q, app.state.records);
      if (!hits.length) { setHints({label: '', items: []}); return; }
      // 输入比库内标题更长＝在刻意添加内容（续作编号、版本注记等），不自动覆盖标题，
      // 只给点击建议；打错字 / 打到一半 / 全名命中仍自动带入
      const adding = norm(q).length > norm(hits[0].r.title).length;
      if (!adding && (hits.length === 1 || hits[0].sc - hits[1].sc >= 0.12)) {
        applyMatch(hits[0].r);
      } else {
        setHints({label: '找到相似专辑，点击带入：', items: hits.map(h => ({id: h.r.id, text: `${h.r.title} — ${h.r.artist}`}))});
      }
    }, 300);
  };

  const onArtistInput = (value: string) => {
    artistAuto.current = false;
    set({artist: value});
    dirty();
    clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => {
      const q = norm(value.trim());
      if (q.length < 1) { setHints({label: '', items: []}); return; }
      const hits = artistSuggestions(q, app.state.records);
      const exactExists = app.state.records.some(x => norm(x.artist) === q);
      setHints({
        label: exactExists ? '' : '没有完全匹配的艺人，你是想输入：',
        items: hits.map(a => ({id: 'artist:' + a, text: a})),
      });
    }, 300);
  };

  const applyHint = (hid: string) => {
    if (hid.startsWith('artist:')) {
      set({artist: hid.slice(7)});
      setHints({label: '已更正艺人名。', items: []});
      dirty();
      return;
    }
    const m = app.rec(hid);
    if (m) applyMatch(m);
  };

  // ── 成本折算预览（按日期缓存当日汇率） ──
  const rateCache = useRef<{date: string; rate: number | null} | null>(null);
  const [preview, setPreview] = useState<{hidden: boolean; text: string}>({hidden: true, text: ''});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!modules.acquisition || v.currency === 'CNY') { if (!cancelled) setPreview({hidden: true, text: ''}); return; }
      let rate: number | null = null;
      if (v.price !== '') {
        if (rateCache.current?.date === v.date) {
          rate = rateCache.current.rate;
        } else {
          try {
            const res = await api<{rate: number | null}>('rate?date=' + (v.date || today()));
            rate = res.rate;
          } catch { rate = null; }
          rateCache.current = {date: v.date, rate};
        }
      }
      if (cancelled) return;
      const fees = Number(v.fees || 0);
      const cost = rate ? Number(v.price) * Number(rate) / 100 + fees : null;
      let text = `折合成本 ${v.price === '' ? '—' : cost === null ? '待定' : yuan(Number(cost.toFixed(2)))}`;
      if (v.price !== '' && cost === null) text += ' · 暂无当日汇率';
      if (rate) text += ` · 100 円 = ¥${Number(rate).toFixed(2)}`;
      setPreview({hidden: false, text});
    })();
    return () => { cancelled = true; };
  }, [v.currency, v.price, v.date, v.fees, modules.acquisition]);

  // ── 照片 ──
  const photos = usePhotoSlots(
    r ? Array.from({length: r.photoCount || 0}, (_, i) => ({existing: i})) : [],
    app.toast);
  const fileInput = useRef<HTMLInputElement>(null);

  // 该副本若在日元运单里分摊过运费，费用字段下注明日元原额与折算
  const shipItem = (() => {
    const s = r?.shipmentId ? app.state.shipments.find(x => x.id === r.shipmentId) : undefined;
    return s && s.currency === 'JPY' ? s.items.find(i => i.recordId === id) : undefined;
  })();

  // 是否有实际改动：与打开表单时的快照逐字比对，改回原值会自动回到「未修改」态。
  // 照片槽只记序号/长度（data URL 太长），失败槽与保存口径一致地忽略。
  const sign = () => JSON.stringify([v, base.current.cover || '',
    photos.slots.map(p => 'existing' in p ? `e${p.existing}` : 'pending' in p ? 'p' : 'error' in p ? '' : `d${p.data.length}`)]);
  const pristine = useRef(sign());
  const edited = sign() !== pristine.current;
  useEffect(() => { app.setDrawerDirty(edited); }, [edited]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const names: [string, string][] = [['title', '专辑名'], ['artist', '艺人']];
    const miss = names.filter(([k]) => !String((v as Record<string, unknown>)[k] ?? '').trim());
    if (miss.length) { setError(id ? '请先补全：' + miss.map(([, n]) => n).join('、') : '请先通过条码或唱片编号匹配发行版'); return; }
    if (!id && !v.releaseInfo.musicBrainzReleaseId) {setError('请先确认 MusicBrainz 发行版本');return;}
    if (barcodeVerification !== 'verified' || barcode !== (v.releaseInfo.barcode || '')) {
      setError('条码尚未通过 MusicBrainz 校验，请确认对应发行版本后保存');return;
    }
    if ((r?.releaseInfo?.musicBrainzReleaseId || '') && !v.releaseInfo.musicBrainzReleaseId) {
      setError('发行版本已改变，请重新查询并选择 MusicBrainz 发行版');return;
    }
    if (barcodeBusy) {setError('正在检索发行资料或封面，请稍候');return;}
    if (photos.hasPending) { setError('还有照片在处理中，等缩略图就绪后再保存'); return; }
    run(app, async () => {
      const payload: Record<string, unknown> = {...base.current, ...v, status: v.status || where || base.current.status};
      delete payload.cost;
      delete payload.rate;
      const openedPrice = base.current.currency === 'JPY' && base.current.price !== ''
        ? String(Math.round(Number(base.current.price))) : (base.current.price || '');
      if (modules.acquisition && (v.price !== openedPrice || v.currency !== base.current.currency || v.date !== base.current.date)) payload.actual = '';
      if (!modules.acquisition) {
        // 隐藏的购买信息沿用原值；编辑收藏资料不能补日期或清空原金额。
        for (const key of ['price', 'date', 'currency', 'location', 'fees', 'actual'] as const)
          payload[key] = base.current[key] ?? (key === 'currency' ? 'CNY' : key === 'fees' ? '0' : '');
      }
      payload.photos = photos.slots.filter(p => !('error' in p))
        .map(p => 'existing' in p ? p.existing : (p as {data: string}).data);
      payload.packaging = remapPackagingPhotos(v.packaging, photos.slots.map((_, i) => i).filter(i => !('error' in photos.slots[i])));
      if (modules.acquisition) {
        prefs.set('location', v.location);
        prefs.set('currency', v.currency);
      }
      await api('records', payload);
    });
  };

  return (
    <form id="record-form" ref={formRef} onSubmit={submit} noValidate
          data-status={where || r?.status} data-cur={v.currency}>
      <div className="drawer-body">
        <div className="error" role="alert">{error}</div>
        {id ? <section className="album-preference-editor form-section" aria-label="专辑偏好">
          <div className="album-preference-copy">
            <strong>专辑偏好</strong>
            <small>对整张专辑生效，所有副本共享。切换后立即保存。</small>
          </div>
          <button type="button" className={'album-like-toggle'+(liked ? ' is-liked' : '')}
            aria-pressed={liked} aria-label={liked ? '取消我喜欢' : '将专辑标记为我喜欢'}
            disabled={likedLoading || likedSaving} onClick={() => void toggleLiked()}>
            <span className="album-like-heart" aria-hidden="true">{liked ? '♥' : '♡'}</span>
            <span>我喜欢</span>
            <span className="album-like-switch" aria-hidden="true"><span/></span>
          </button>
          {likedError ? <p className="album-preference-error" role="alert">{likedError}</p> : null}
        </section> : null}
        <section className="record-photo-entry" onDragOver={e => e.preventDefault()}
          onDrop={e => {e.preventDefault();const files=[...e.dataTransfer.files];if(files.length){photos.addFiles(files);dirty();}}}>
          <div className="record-photo-head"><strong>实物照片</strong><small>可拖入或多选 · 每张副本最多 {MAX_PHOTOS} 张</small></div>
          <PhotoThumbs slots={photos.slots} recordId={r?.id ?? null} onRemove={i => {
            set({packaging: remapPackagingPhotos(v.packaging, photos.slots.map((_, k) => k).filter(k => k !== i))});
            photos.remove(i);dirty();
          }}/>
          <div className="photo-actions">
            <button type="button" onClick={() => fileInput.current?.click()}>{CamIco}<span>添加照片</span></button>
          </div>
          <p className="small-note">正面、背面、侧标和内圈照片有助于日后核对版本；发行版本请用下方条形码匹配。</p>
          <input ref={fileInput} type="file" accept="image/*,.heic,.heif" multiple hidden
            onChange={e => {const files=[...(e.target.files ?? [])];e.target.value='';if(files.length){photos.addFiles(files);dirty();}}}/>
        </section>
        <section className="record-barcode-entry form-section">
          <label>查找 MusicBrainz 发行版</label>
          <Seg ariaLabel="发行版检索方式" value={lookupMode} onValue={mode => {
            ++lookupSequence.current; setLookupMode(mode as 'barcode' | 'catalog');
            setBarcodeCandidates([]); setBarcodeMessage('');
          }} options={[{value: 'barcode', label: '条码'}, {value: 'catalog', label: '唱片编号（无条码）'}]}/>
          <div className="record-barcode-row">
            {lookupMode === 'barcode' ? <input id="record-barcode" aria-label="条码" type="text" inputMode="numeric" autoComplete="off"
              placeholder="输入 CD 包装背面的条形码" value={barcode}
              onChange={e => changeBarcode(e.target.value)}
              onKeyDown={e => {if (e.key === 'Enter') {e.preventDefault();void lookupBarcode();}}}/>
            : <input id="record-catalog-number" aria-label="唱片编号" type="text" autoComplete="off"
              placeholder="例如 AMCY-2434" value={catalogNumber}
              onChange={e => {
                ++lookupSequence.current;
                setCatalogNumber(e.target.value); setBarcodeCandidates([]); setBarcodeMessage('');
                if (e.target.value !== v.releaseInfo.catalogNumber) {
                  set({releaseInfo: {...v.releaseInfo, musicBrainzReleaseId: '', tracklist: [], media: []}});
                  dirty();
                }
              }}
              onKeyDown={e => {if (e.key === 'Enter') {e.preventDefault();void lookupBarcode();}}}/>}
            <button type="button" className="primary" onClick={() => void lookupBarcode()} disabled={barcodeBusy}>
              {barcodeBusy ? '查询中…' : '查询发行版'}
            </button>
          </div>
          {barcodeMessage ? <p className="small-note" role="status">{barcodeMessage}</p> : null}
          {barcodeCandidates.length ? <div className="record-barcode-candidates" role="group" aria-label="选择精确条码对应的发行版本">
            {barcodeCandidates.map(c => <button type="button" key={c.id} disabled={barcodeBusy}
              onClick={() => void chooseRelease(c)}>
              <strong>{c.title}</strong><span>{c.artist} · {c.releaseInfo.releaseDate || '日期未知'} · {c.releaseInfo.country || '地区未知'}
                {c.releaseInfo.catalogNumber ? ' · ' + c.releaseInfo.catalogNumber : ''}</span>
            </button>)}
          </div> : null}
          {v.title && v.artist ? <div className="record-barcode-result">
            <strong>{v.title}</strong><span>{v.artist}</span>
            {v.releaseInfo.musicBrainzReleaseId ? <>
              <small>✓ 已确认发行版 · {v.releaseInfo.country || '地区未收录'} · {v.releaseInfo.releaseDate || '日期未收录'}
                {v.releaseInfo.catalogNumber ? ' · ' + v.releaseInfo.catalogNumber : ''}</small>
              <a href={'https://musicbrainz.org/release/' + v.releaseInfo.musicBrainzReleaseId}
                target="_blank" rel="noopener noreferrer">MusicBrainz 发行资料 ↗</a>
            </> : <small>尚未确认发行版，请先查询并选择</small>}
          </div> : null}
        </section>
        {id && v.releaseInfo.musicBrainzReleaseId ? <button type="button" className="quiet record-refresh-release"
          disabled={barcodeBusy} onClick={() => void refreshReleaseMetadata()}>从 MusicBrainz 补全缺失发行资料</button> : null}
        {(id || v.releaseInfo.musicBrainzReleaseId) ? <ReleaseMetadataFields info={v.releaseInfo}
          oldPressing={v.pressing} onChange={(key, value) => {
            const next = {...v.releaseInfo, [key]: value};
            if (key === 'barcode') { changeBarcode(value); return; }
            if (key === 'catalogNumber') setCatalogNumber(value);
            const preset = key === 'packaging' ? PACKAGING_PRESETS.find(p => p.label === value) : undefined;
            set({releaseInfo: next,
              ...(key === 'packaging' ? {version: value,
                ...(preset ? {packaging: {...v.packaging, ...preset.spec}} : {})} : {}),
              ...(key === 'country' ? {pressing: releaseRegion(value)} : {})});
            dirty();
          }}/> : null}
        {(v.version === '待核对' || v.packaging?.structure === 'unknown') ? (
          <div className="form-section field record-package-review">
            <span className="field-label">包装结构待核对 · 原记录：{r?.legacyPackaging || r?.version || '未知'}</span>
            <Dropdown id="record-package-review" value="__unknown"
              label="确认实际包装结构"
              options={[{value:'__unknown',label:'待核对（不猜测折叠结构）'},
                ...PACKAGING_PRESETS.map(p => ({value:p.value,label:p.label}))]}
              onPick={code => {
                const preset=PACKAGING_PRESETS.find(p => p.value === code);
                if (!preset) return;
                const packaging={...v.packaging, ...preset.spec};
                set({version:preset.label,packaging,
                  releaseInfo:{...v.releaseInfo, packaging:preset.label}});
                dirty();
              }}/>
          </div>
        ) : null}
        <CopyEditionFields obi={v.obi} onChange={change => {
          set(change); dirty();
        }}/>
        {id ? <div className="form-grid form-section">
          <Field label="专辑名（更正用）" name="title" required autoComplete="off" value={v.title}
                 onChange={e => v.releaseInfo.musicBrainzReleaseId
                   ? (set({title: e.target.value}), dirty()) : onTitleInput(e.target.value)}
                 onBlur={scheduleCover}/>
          <Field label="艺人" name="artist" required autoComplete="off" value={v.artist}
                 onChange={e => onArtistInput(e.target.value)} onBlur={scheduleCover}/>
        </div> : null}
        {id && !v.releaseInfo.musicBrainzReleaseId ? <div id="ta-hints" className="suggestions">
          {hints.label ? <small>{hints.label}</small> : null}
          {hints.items.map(h => (
            <button key={h.id} type="button" className="quiet"
                    onClick={() => applyHint(h.id)}>{h.text}</button>
          ))}
        </div> : null}
        {id && !v.releaseInfo.musicBrainzReleaseId && dupHint ? <p className="dup-hint">{dupHint}</p> : null}

        {id || v.releaseInfo.musicBrainzReleaseId || candidates.length ? <section className="cover-search">
          <div className="cover-search-head">
            <strong>封面</strong>
            <span className="cover-status" role="status">{coverStatus}</span>
            <button type="button" onClick={() => findCover(false)}>重新查找</button>
          </div>
          <div className="cover-candidates">
            {candidates.map(c => (
              <button key={c.token} type="button" className="cover-choice"
                      onClick={() => chooseCover(c.token, coverKey())}>
                <img src={c.thumbnail} alt=""/>
                <span>{c.title}</span>
                <small>{c.artist} · {c.year}{c.provider ? ' · ' + c.provider : ''}</small>
              </button>
            ))}
          </div>
        </section> : null}

        {modules.acquisition ? <section className="money-block form-section">
          <div className="money-row">
            <div className="field">
              <label htmlFor="f-price">买入金额（选填）</label>
              <div className="amount-group">
                <Seg className="seg-cur" ariaLabel="币种"
                     options={[{value: 'JPY', label: '日元'}, {value: 'CNY', label: '人民币'}]}
                     value={v.currency}
                     onValue={c => set({
                       currency: c as Currency,
                       price: c === 'JPY' && v.price !== '' ? String(Math.round(Number(v.price))) : v.price,
                     })}/>
                <input id="f-price" name="price" type="number" min="0"
                       /* 日元不设步进限制：step 会把 1145 円这类非整十金额判为无效，编辑历史数据时保存被静默拦截 */
                       step={v.currency === 'JPY' ? 'any' : '0.01'}
                       inputMode={v.currency === 'JPY' ? 'numeric' : 'decimal'}
                       placeholder="按币种填写" value={v.price}
                       onChange={e => {
                         set({price: v.currency === 'JPY' ? e.target.value.replace(/[^\d]/g, '') : e.target.value});
                         dirty();
                       }}/>
              </div>
            </div>
            <Field label="买入日期（选填）" name="date" type="date" value={v.date}
                   onChange={e => { set({date: e.target.value}); dirty(); }}/>
          </div>
          <div className="record-fees field">
            <label htmlFor="f-fees">额外买入费用 · 运费等（人民币）</label>
            <div className="amount-group">
              <span className="cur-static">¥</span>
              <input id="f-fees" name="fees" type="number" min="0" step="0.01"
                inputMode="decimal" value={v.fees} onChange={e => {set({fees: e.target.value});dirty();}}/>
            </div>
            {shipItem?.feeOriginal ? <small>含国际运费 {fmtJPY(shipItem.feeOriginal)} 円 ≈ {yuan(shipItem.fee)}</small> : null}
          </div>
          {!preview.hidden && <div className="cost-line">{preview.text}</div>}
        </section> : null}

        <div className="form-grid form-section">
          {modules.acquisition ? <ShopField value={v.location} records={app.state.records}
                     defaultShop={prefs.get('location', '')}
                     onChange={val => { set({location: val}); dirty(); }}/> : null}
          {!id && modules.circulation && (
            <div className="field">
              <span className="field-label"><label>入库位置</label></span>
              <Seg ariaLabel="入库位置"
                   options={[{value: 'overseas', label: '◧ 海外库存'}, {value: 'domestic', label: '▤ 国内库存'}]}
                   value={v.status || ''} onValue={s => { set({status: s as Status}); dirty(); }}/>
            </div>
          )}
        </div>

        {modules.showcase ? <details className="adv record-twin-entry">
          <summary>数字实体{r && twinBusy(app.twins.jobs[r.id]) ? ' · 处理中' : r && app.twins.jobs[r.id]?.status === 'succeeded' ? ' · 已有' : ''}</summary>
          {r && ['domestic', 'overseas', 'transit'].includes(r.status) ? <TwinControls record={r}
            releaseId={v.releaseInfo.musicBrainzReleaseId || ''}
            unsaved={edited || photos.hasPending} saving={saving}
            stale={r.revision !== base.current.revision}/> : null}
        </details> : null}
        <div className="form-grid form-section record-remarks">
          <TextareaField label="备注 · 这张副本" name="note" value={v.note}
            onChange={val => {set({note: val});dirty();}}/>
          <TextareaField label="备注 · 这张专辑（所有副本共享）" name="noteAlbum" value={v.noteAlbum}
            onChange={val => {set({noteAlbum: val});dirty();}}/>
        </div>
      </div>
      <div className="drawer-footer">
        {!id && !v.releaseInfo.musicBrainzReleaseId ? <p className="footer-hint">先用条码匹配发行版，才能保存入库</p> : null}
        <button type="button" onClick={() => app.closeDrawer()}>取消</button>
        <button type="submit" className="primary" disabled={saving || !edited}>{id ? '保存修改' : '保存并入库'}</button>
      </div>
    </form>
  );
}
