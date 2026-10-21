// 查询页的结果卡片 = 共用发行版卡片 + 复制 / 入库操作（复制前先取全详情）。
import {useApp} from '../state/AppContext';
import {copyText} from '../core/clipboard';
import {askText, releaseText} from '../core/lookup-text';
import {ReleaseCandidateCard} from '../components/ReleaseCandidateCard/ReleaseCandidateCard';
import type {ReleaseCandidate, ReleaseInfo} from '../types';

export function LookupCard({c, owned, onAdd}: {
  c: ReleaseCandidate; owned: string; onAdd: (info: ReleaseInfo) => void;
}) {
  const app = useApp();
  return <ReleaseCandidateCard c={c} fold>{({load, busy}) => {
    const copy = async (ask: boolean) => {
      const text = releaseText(c, await load(), owned);
      app.toast(await copyText(ask ? askText(text) : text) ? (ask ? '已复制，连同提问' : '资料已复制') : '复制失败，请手动选择文字', 'warn');
    };
    return <>
      <div className="rcc-actions">
        <button type="button" onClick={() => void copy(false)} disabled={busy}>复制资料</button>
        <button type="button" onClick={() => void copy(true)} disabled={busy}>复制为提问</button>
      </div>
      <button type="button" className="primary rcc-add" onClick={async () => onAdd(await load())} disabled={busy}>
        {busy ? '读取中…' : '以此入库'}
      </button>
    </>;
  }}</ReleaseCandidateCard>;
}
