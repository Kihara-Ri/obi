// 侧栏与「更多」共用浏览器提供的安装入口。row = 「更多」页里的列表行形态。
import {NavRow} from './ui/NavRow';

export function InstallNavItem({evt, onInstalled, row = false}: {evt: Event; onInstalled: () => void; row?: boolean}) {
  const install = async () => {
    await (evt as Event & {prompt?: () => Promise<void>}).prompt?.();
    onInstalled();
  };
  if (row) return <NavRow icon="⤓" title="安装碟渡" onClick={() => void install()}/>;
  return <button type="button" className="install-nav" onClick={() => void install()}>
    <span className="nav-ico" aria-hidden="true">⤓</span>安装碟渡</button>;
}
