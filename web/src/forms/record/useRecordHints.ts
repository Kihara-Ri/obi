// 库内匹配 / 重复提示 / 艺人纠错：输入专辑名或艺人时给出带入建议（输入比库内标题长时只建议不覆盖）。
import {useEffect, useRef, useState} from 'react';
import {matchRecords, norm, artistSuggestions} from '../../core/search';
import {statusName} from '../../core/modules';
import {useApp} from '../../state/AppContext';
import type {AlbumRecord} from '../../types';
import type {FormCtx} from './context';
import type {CoverSearch} from './useCoverSearch';

export function useRecordHints(ctx: FormCtx, cover: CoverSearch) {
  const app = useApp();
  const {v, set, base, dirty} = ctx;
  const [hints, setHints] = useState<{label: string; items: {id: string; text: string}[]}>({label: '', items: []});
  const [dupHint, setDupHint] = useState('');
  const artistAuto = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => { clearTimeout(timer.current); }, []);

  function applyMatch(m: AlbumRecord) {
    let artist = v.artist;
    if (!artist || artistAuto.current || norm(artist) !== norm(m.artist)) {
      artist = m.artist;
      artistAuto.current = true;
    }
    set({title: m.title, artist});
    if (m.cover) { base.current = {...base.current, cover: m.cover}; cover.setHasCover(true); }
    cover.setCoverStatus(m.cover ? '已带入库内封面' : '尚无封面');
    setHints({label: '已带入库内资料，可继续修改。', items: []});
    dirty();
  }

  const onTitleInput = (value: string) => {
    if (norm(value) !== norm(base.current.title || '')) artistAuto.current = false;
    set({title: value});
    dirty();
    cover.setCoverStatus(cover.hasCover ? '使用现有封面' : '尚无封面');
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const q = value.trim();
      const dup = app.state.records.filter(x => q && norm(x.title) === norm(q) && x.id !== base.current.id);
      setDupHint(dup.length
        ? `库中已有 ${dup.length} 张这张专辑（${dup.map(x => statusName(x.status, app.modules)).join('、')}）。同一张买了多个版本就分别保存，保存后可在版本里注明区别。`
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
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
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

  return {hints, dupHint, onTitleInput, onArtistInput, applyHint};
}
