// 查询页的结果卡片 = 共用发行版卡片 + 复制 / 入库操作（复制前先取全详情）。
import {useState} from 'react';
import {useApp} from '../state/AppContext';
import {copyText} from '../core/clipboard';
import {askText, releaseText} from '../core/lookup-text';
import {ReleaseCandidateCard} from '../components/ReleaseCandidateCard/ReleaseCandidateCard';
import {Seg} from '../components/ui/Seg';
import {isMedium, MEDIUM_OPTIONS, reportedMedium, withLookupMedium, type LookupMedium, type Medium} from '../core/medium';
import type {ReleaseCandidate, ReleaseInfo} from '../types';

export function LookupCard({c, owned, tag, fallbackArt, medium, confirming, onAdd}: {
  c: ReleaseCandidate; owned: string; tag?: string; fallbackArt?: string; medium: LookupMedium;
  confirming?: boolean; onAdd: (info: ReleaseInfo) => void;
}) {
  const app = useApp();
  const [needsMedium, setNeedsMedium] = useState(false);
  const [chosen, setChosen] = useState<Medium | ''>('');
  return <ReleaseCandidateCard c={c} fold tag={tag} fallbackArt={fallbackArt}>{({load, busy}) => {
    const copy = async (ask: boolean) => {
      const info = await load(), text = releaseText(c, info, owned);
      app.toast(await copyText(ask ? askText(text, info) : text) ? (ask ? '已复制，连同提问' : '资料已复制') : '复制失败，请手动选择文字', 'warn');
    };
    const add = async () => {
      const info = withLookupMedium(await load(), chosen || medium);
      if (confirming && !reportedMedium(info)) { setNeedsMedium(true); return; }
      onAdd(info);
    };
    return <>
      <div className="rcc-actions">
        <button type="button" onClick={() => void copy(false)} disabled={busy}>复制资料</button>
        <button type="button" onClick={() => void copy(true)} disabled={busy}>复制为提问</button>
      </div>
      {confirming && needsMedium ? <Seg ariaLabel="实物介质" options={MEDIUM_OPTIONS} value={chosen}
        onValue={value => { if (isMedium(value)) setChosen(value); }}/> : null}
      <button type="button" className="primary rcc-add" onClick={() => void add()} disabled={busy || (confirming && needsMedium && !chosen)}>
        {busy ? '读取中…' : confirming ? '确认为这张的版本' : '以此入库'}
      </button>
    </>;
  }}</ReleaseCandidateCard>;
}
