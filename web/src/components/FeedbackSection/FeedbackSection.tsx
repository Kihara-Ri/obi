// 反馈问题：打开 GitHub 的新建 issue 页，只预填版本与运行环境（不带任何账本数据），用户在 GitHub 上核对后再提交。
import {isLocalSite} from '../../core/backend';
import {useApp} from '../../state/AppContext';

export const ISSUES_URL = 'https://github.com/Kihara-Ri/obi/issues';

export function runtimeLabel(): string {
  if ('ObiAndroid' in window) return '安卓应用';
  return isLocalSite() ? '本机模式（浏览器）' : '服务器';
}

export function issueUrl(version: string): string {
  const body = [
    '## 发生了什么', '', '', '## 期望的结果', '', '', '## 复现步骤', '1. ', '',
    '## 环境', `- 版本：${version}`, `- 运行方式：${runtimeLabel()}`, `- 浏览器：${navigator.userAgent}`,
  ].join('\n');
  return `${ISSUES_URL}/new?body=${encodeURIComponent(body)}`;
}

export function FeedbackSection() {
  const {state} = useApp();
  return <section className="settings-section">
    <h3>反馈问题</h3>
    <p className="small-note">遇到问题或有建议，可以在 GitHub 提交 issue。会预填版本与运行环境，不会附带你的任何收藏或交易数据；提交前可在页面上修改。需要 GitHub 账号。</p>
    <div className="inline-actions">
      <a className="link-button" href={issueUrl(state.service?.version || 'dev')} target="_blank" rel="noopener noreferrer">提交问题 ↗</a>
      <a className="link-button" href={ISSUES_URL} target="_blank" rel="noopener noreferrer">查看已有问题 ↗</a>
    </div>
  </section>;
}
