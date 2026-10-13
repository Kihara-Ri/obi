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
import type {AlbumRecord, Currency, Status, RecognitionResult, RecognitionFields, ReleaseInfo, ReleaseCandidate, VisionConfig, PackagingSpec} from '../types';
import {remapPackagingPhotos} from '../core/album-packaging';
import {TwinControls} from '../components/TwinControls';
import {EditionArtwork} from '../components/EditionArtwork';
import {twinBusy} from '../core/digital-twins';
import {listingText} from '../core/recognition';
import {MAX_PHOTOS} from '../core/photos';
import {RecognitionReview} from '../components/Recognition';
import {statusName} from '../core/modules';
import {Seg} from '../components/ui/Seg';
import {ShopField} from '../components/ShopField';
import {CamIco} from '../components/icons';
import {Field, TextareaField} from './fields';
import {usePhotoSlots, PhotoThumbs} from './PhotoSlots';
import {useFormSubmit} from './shared';

interface CoverCandidate {
  token: string; title: string; artist: string; year?: string;
  thumbnail: string; exact: boolean;
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
    title: base.current.title || '',
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
  // 新建时先以真实条码确定发行版。名称/艺人/曲目由 MusicBrainz 填充，
  // 多个候选必须由用户选择，不推断精确版次。
  const [barcode, setBarcode] = useState(r?.releaseInfo?.barcode || '');
  const [barcodeCandidates, setBarcodeCandidates] = useState<ReleaseCandidate[]>([]);
  const [barcodeBusy, setBarcodeBusy] = useState(false);
  const [barcodeMessage, setBarcodeMessage] = useState('');
  const lookupSequence = useRef(0);
  const lookupBarcode = async () => {
    const value = barcode.trim();
    const seq = ++lookupSequence.current;
    if (!/^(?:\d{8}|\d{12,14})$/.test(value)) {
      setBarcodeCandidates([]); setBarcodeMessage('请输入完整的 8、12、13 或 14 位数字条形码'); return;
    }
    setBarcodeBusy(true); setBarcodeMessage('正在从 MusicBrainz 检索 CD 发行版…');
    setBarcodeCandidates([]);
    try {
      const result = await api<{candidates: ReleaseCandidate[]}>('catalog/barcode', {barcode: value});
      if (seq !== lookupSequence.current || !formRef.current?.isConnected) return;
      setBarcodeCandidates(result.candidates);
      setBarcodeMessage(result.candidates.length
        ? `找到 ${result.candidates.length} 个匹配发行版，请确认后带入`
        : 'MusicBrainz 没有找到对应的 CD 发行版。请核对条码，无法精确匹配时暂不自动创建。');
    } catch (err) {
      if (seq === lookupSequence.current) setBarcodeMessage(err instanceof Error ? err.message : String(err));
    } finally {
      if (seq === lookupSequence.current) setBarcodeBusy(false);
    }
  };
  const chooseRelease = async (candidate: ReleaseCandidate) => {
    const seq = ++lookupSequence.current;
    setBarcodeBusy(true); setBarcodeMessage('正在补全发行资料与曲目…');
    try {
      let releaseInfo: ReleaseInfo = {...candidate.releaseInfo, barcode: barcode.trim(), musicBrainzReleaseId: candidate.id};
      let detailUnavailable = false;
      try {
        const detail = await api<{releaseInfo: ReleaseInfo}>('vision/release?id=' + encodeURIComponent(candidate.id));
        releaseInfo = {...releaseInfo, ...detail.releaseInfo, barcode: barcode.trim(), musicBrainzReleaseId: candidate.id};
      } catch { detailUnavailable = true; } // 曲目请求失败时保留精确匹配的基本资料。
      if (seq !== lookupSequence.current || !formRef.current?.isConnected) return;
      set({title: candidate.title, artist: candidate.artist, releaseInfo});
      setBarcodeCandidates([]);
      setBarcodeMessage(`已确认发行版，保存后会记住此版本${detailUnavailable ? '（曲目详情暂不可用）' : ''}`);
      // Front cover and the digital twin must derive from the same selected release UUID.
      // A same-title release is NOT necessarily the same edition.
      if (candidate.id !== v.releaseInfo.musicBrainzReleaseId || !hasCover) {
        base.current = {...base.current, cover: '', coverSource: undefined};
        setHasCover(false);
        lastQuery.current = null;
        setCandidates([]);
        setCoverStatus('正在获取已确认发行版的正面封面…');
        try {
          const selected = await api<{cover: string; coverSource?: {title: string; artist: string}}>(
            'catalog/front-cover?id=' + encodeURIComponent(candidate.id));
          if (seq !== lookupSequence.current) return;
          if (selected.cover) {
            base.current = {...base.current, cover: selected.cover,
              coverSource: {title: candidate.title, artist: candidate.artist}};
            setHasCover(true);
            setCoverStatus('已带入此发行版的正面封面');
          } else setCoverStatus('此发行版没有正面图，可手动查找封面并核对');
        } catch {setCoverStatus('此发行版封面暂不可用，可手动查找；发行资料仍能保存');}
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

  const [visionConfigured, setVisionConfigured] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [recognitionMessage, setRecognitionMessage] = useState('');
  const [recognition, setRecognition] = useState<RecognitionResult | null>(null);
  const liveRecognition = useRef(recognition); liveRecognition.current = recognition;
  const livePhotos = useRef(photos.slots); livePhotos.current = photos.slots;
  const clearRecognition = () => {setRecognition(null);delete base.current.recognition;setRecognitionMessage('');};
  useEffect(() => { api<VisionConfig>('vision').then(c => setVisionConfigured(c.configured)).catch(() => {}); }, []);
  const recognize = async () => {
    const picked = photos.slots;
    setRecognizing(true); setRecognitionMessage('正在识别照片并核对发行资料…');
    try {
      const result = await api<RecognitionResult>('recognize', {recordId:id,
        photos:picked.filter(p => !('error' in p)).map(p => 'existing' in p ? p.existing : 'data' in p ? p.data : '')});
      if (!formRef.current?.isConnected) return;
      if (livePhotos.current !== picked) {setRecognitionMessage('照片已变化，请重新识别。');return;}
      setRecognition(result); applyRecognition(result.fields); setRecognitionMessage('已补全空白字段，请核对专辑与发行资料。');
    } catch(err) {setRecognitionMessage(err instanceof Error ? err.message : String(err));}
    finally {setRecognizing(false);}
  };
  const applyRecognition = (fields: RecognitionFields) => {
    setV(prev => {
      const next = {...prev};
      for (const key of ['title','artist','version','pressing','obi'] as const)
        if (!next[key] && fields[key] && (key!=='obi' || next.pressing==='日版')) next[key] = fields[key]!;
      next.releaseInfo = {...prev.releaseInfo};
      for (const [key,value] of Object.entries(fields.releaseInfo ?? {}))
        if (!next.releaseInfo[key as keyof ReleaseInfo] || (Array.isArray(next.releaseInfo[key as keyof ReleaseInfo]) && !next.releaseInfo.tracklist?.length))
          Object.assign(next.releaseInfo,{[key]:value});
      if (!next.listingDescription) next.listingDescription = listingText(next);
      return next;
    });
    const latest=liveValues.current;
    if (!hasCover && fields.cover && (!latest.title || latest.title === fields.title) && (!latest.artist || latest.artist === fields.artist)) {
      base.current.cover = fields.cover; base.current.coverSource = fields.coverSource;
      setHasCover(true); setCoverStatus('已匹配识别作品的封面');
    }
    dirty();
  };

  // 是否有实际改动：与打开表单时的快照逐字比对，改回原值会自动回到「未修改」态。
  // 照片槽只记序号/长度（data URL 太长），失败槽与保存口径一致地忽略。
  const sign = () => JSON.stringify([v, base.current.cover || '',
    photos.slots.map(p => 'existing' in p ? `e${p.existing}` : 'pending' in p ? 'p' : 'error' in p ? '' : `d${p.data.length}`),
    recognition ? {model:recognition.model,at:recognition.at,evidence:recognition.evidence,sources:recognition.sources,warnings:recognition.warnings} : base.current.recognition]);
  const pristine = useRef(sign());
  const edited = sign() !== pristine.current;
  useEffect(() => { app.setDrawerDirty(edited); }, [edited]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const names: [string, string][] = [['title', '专辑名'], ['artist', '艺人']];
    const miss = names.filter(([k]) => !String((v as Record<string, unknown>)[k] ?? '').trim());
    if (miss.length) { setError(id ? '请先补全：' + miss.map(([, n]) => n).join('、') : '请先通过条形码匹配发行版'); return; }
    if (!id && !v.releaseInfo.musicBrainzReleaseId) {setError('请先通过条形码确认发行版本');return;}
    if (barcode !== (v.releaseInfo.barcode || '') || (v.releaseInfo.barcode && !v.releaseInfo.musicBrainzReleaseId && barcode !== (r?.releaseInfo?.barcode || ''))) {
      setError('条形码已修改，请先确认对应的发行版本');return;
    }
    if (barcodeBusy) {setError('正在检索发行资料或封面，请稍候');return;}
    if (photos.hasPending) { setError('还有照片在处理中，等缩略图就绪后再保存'); return; }
    run(app, async () => {
      const payload: Record<string, unknown> = {...base.current, ...v, status: v.status || where || base.current.status};
      delete payload.cost;
      delete payload.rate;
      if (recognition) payload.recognition = {model:recognition.model,at:recognition.at,evidence:recognition.evidence,sources:recognition.sources,warnings:recognition.warnings};
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
        <section className="record-photo-entry" onDragOver={e => e.preventDefault()}
          onDrop={e => {e.preventDefault();const files=[...e.dataTransfer.files];if(files.length){photos.addFiles(files);clearRecognition();dirty();}}}>
          <div className="record-photo-head"><strong>实物照片</strong><small>可拖入或多选 · 每张副本最多 {MAX_PHOTOS} 张</small></div>
          <PhotoThumbs slots={photos.slots} recordId={r?.id ?? null} onRemove={i => {
            set({packaging: remapPackagingPhotos(v.packaging, photos.slots.map((_, k) => k).filter(k => k !== i))});
            photos.remove(i);clearRecognition();dirty();
          }}/>
          <div className="photo-actions">
            <button type="button" onClick={() => fileInput.current?.click()}>{CamIco}<span>添加照片</span></button>
            <button type="button" className="primary" disabled={!visionConfigured || !photos.slots.length || photos.hasPending || recognizing}
              onClick={recognize}>{recognizing ? '识别中…' : '识别并补全'}</button>
          </div>
          <p className="small-note" role="status">{recognitionMessage || (visionConfigured ? '正面、背面、侧标和内圈照片有助于核对版本。' : '无需 AI 模型即可通过下方条形码匹配发行版本；如需照片识别，可在设置的高级功能中配置。')}</p>
          <input ref={fileInput} type="file" accept="image/*,.heic,.heif" multiple hidden
            onChange={e => {const files=[...(e.target.files ?? [])];e.target.value='';if(files.length){photos.addFiles(files);clearRecognition();dirty();}}}/>
          {recognition ? <details className="adv"><summary>识别结果与依据{recognition.candidates.length ? ` · ${recognition.candidates.length} 个发行候选` : ''}{recognition.warnings.length ? ' · 有待核对项' : ''}</summary>
            <RecognitionReview result={recognition} onApply={applyRecognition} onRelease={(release,source) => {
              if(!formRef.current?.isConnected || liveRecognition.current!==recognition)return;
              setV(prev => {
                const next={...prev,releaseInfo:{...prev.releaseInfo,...Object.fromEntries(Object.entries(release).filter(([,val]) => Array.isArray(val) ? val.length : val))}};
                if(!prev.listingDescription || prev.listingDescription===listingText(prev))next.listingDescription=listingText(next);
                return next;
              });
              setRecognition({...recognition,sources:[...recognition.sources,source]});dirty();
            }}/></details> : null}
        </section>
        <section className="record-barcode-entry form-section">
          <label htmlFor="record-barcode">条形码编号</label>
          <div className="record-barcode-row">
            <input id="record-barcode" type="text" inputMode="numeric" autoComplete="off"
              placeholder="输入 CD 包装背面的条形码" value={barcode}
              onChange={e => {
                const next = e.target.value.replace(/[^\d]/g, '');
                ++lookupSequence.current;
                setBarcode(next); setBarcodeCandidates([]); setBarcodeMessage('');
                if (next !== v.releaseInfo.barcode) {
                  set({releaseInfo: {...v.releaseInfo, barcode: '', musicBrainzReleaseId: '', tracklist: []}});
                  setCoverStatus('条形码已更改，等待确认新版封面'); dirty();
                }
              }}
              onKeyDown={e => {if (e.key === 'Enter') {e.preventDefault();void lookupBarcode();}}}/>
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
            {v.releaseInfo.musicBrainzReleaseId && v.releaseInfo.barcode === barcode ? <>
              <small>✓ 已确认发行版 · {v.releaseInfo.country || '地区未收录'} · {v.releaseInfo.releaseDate || '日期未收录'}
                {v.releaseInfo.catalogNumber ? ' · ' + v.releaseInfo.catalogNumber : ''}</small>
              <a href={'https://musicbrainz.org/release/' + v.releaseInfo.musicBrainzReleaseId}
                target="_blank" rel="noopener noreferrer">MusicBrainz 发行资料 ↗</a>
            </> : <small>尚未确认发行版，请先查询并选择</small>}
          </div> : null}
        </section>
        {id && !v.releaseInfo.musicBrainzReleaseId ? <div className="form-grid form-section">
          <Field label="专辑名（更正用）" name="title" required autoComplete="off" value={v.title}
                 onChange={e => onTitleInput(e.target.value)} onBlur={scheduleCover}/>
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
                <small>{c.artist} · {c.year}</small>
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
          <summary>数字实体 · 同版 Cover Art Archive 图集{r && twinBusy(app.twins.jobs[r.id]) ? ' · 任务进行中' : r && app.twins.jobs[r.id]?.status === 'succeeded' ? ' · 已生成' : ''}</summary>
          {v.releaseInfo.musicBrainzReleaseId && v.releaseInfo.barcode === barcode
            ? <EditionArtwork releaseId={v.releaseInfo.musicBrainzReleaseId}/>
            : <p className="small-note">请先在上方输入条形码并确认 MusicBrainz 发行版本。</p>}
          {r && ['domestic', 'overseas', 'transit'].includes(r.status) ? <TwinControls record={r}
            releaseId={v.releaseInfo.barcode === barcode ? v.releaseInfo.musicBrainzReleaseId || '' : ''}
            unsaved={edited || photos.hasPending} saving={saving}
            stale={r.revision !== base.current.revision}/> : null}
          {!r && v.releaseInfo.musicBrainzReleaseId ? <p className="small-note">保存入库后可根据已确认的发行版本生成数字实体，无需重复选版。</p> : null}
        </details> : null}
        <div className="form-grid form-section record-remarks">
          <TextareaField label="备注 · 这张副本" name="note" value={v.note}
            onChange={val => {set({note: val});dirty();}}/>
          <TextareaField label="备注 · 这张专辑（所有副本共享）" name="noteAlbum" value={v.noteAlbum}
            onChange={val => {set({noteAlbum: val});dirty();}}/>
        </div>
      </div>
      <div className="drawer-footer">
        <button type="button" onClick={() => app.closeDrawer()}>取消</button>
        <button type="submit" className="primary" disabled={saving || !edited}>{id ? '保存修改' : '保存并入库'}</button>
      </div>
    </form>
  );
}
