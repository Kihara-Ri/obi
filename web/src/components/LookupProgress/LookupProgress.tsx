// 查询进度卡：转圈 + 标题 + 进度条 + 正在查的资料库官方图标，右侧「取消」。
// 后端一次请求并发查完再返回，没有逐个来源的进度：进度条按时间渐近填充（停在九成），结果到了卡片即被结果替换。
import {SOURCE_LABEL, type ReleaseSource} from '../../core/release-source';
import {SOURCE_ICONS} from './sourceIcons';
import './LookupProgress.css';

export function LookupProgress({sources, onCancel}: {sources: ReleaseSource[]; onCancel: () => void}) {
  return <div className="lookup-progress" role="status" aria-label={`正在查询 ${sources.map(s => SOURCE_LABEL[s]).join('、')}`}>
    <div className="lp-head">
      <span className="lp-spin" aria-hidden="true"/>
      <strong>正在查询 {sources.length} 个资料库</strong>
      <button type="button" className="lp-cancel" onClick={onCancel}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>取消
      </button>
    </div>
    {/* key 随来源变：编号查不到转文字搜索时进度条重新开始 */}
    <div className="lp-track" key={sources.join()} aria-hidden="true"><span className="lp-fill"/></div>
    <div className="lp-sources">
      <span>查找：</span>
      {sources.map(s => <img key={s} className={`lp-src is-${s}`} src={SOURCE_ICONS[s]} alt={SOURCE_LABEL[s]} title={SOURCE_LABEL[s]}/>)}
    </div>
  </div>;
}
