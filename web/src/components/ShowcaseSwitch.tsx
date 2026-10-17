// 「库存｜展示」切换：以管理为主的用户（默认首页是收藏管理），展示不占底栏标签，
// 而是在库存页与展示页的手机顶栏中间用分段切换互相进入；以展示为主的用户（默认首页是收藏展示）
// 展示是底栏第一个标签，不需要这个切换。是否显示由 useShowcaseSwitch 统一判断。
import {homePage} from '../core/modules';
import {useApp} from '../state/AppContext';
import {Seg} from './ui/Seg';

export function useShowcaseSwitch(): boolean {
  const {modules, state} = useApp();
  return modules.showcase && homePage(state.modules?.startPage, modules) !== 'gallery';
}

export function ShowcaseSwitch({current}: {current: 'manage' | 'gallery'}) {
  if (!useShowcaseSwitch()) return null;
  return <Seg className="showcase-switch" persistKey="showcase-switch" ariaLabel="库存与展示" value={current}
    options={[{value: 'manage', label: '库存'}, {value: 'gallery', label: '展示'}]}
    onValue={v => { location.hash = v === 'gallery' ? '#gallery' : '#domestic'; }}/>;
}
