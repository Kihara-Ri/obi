// 设置 · 数据：按用途分块——保护数据（备份 / 恢复）、进出数据（导入 / 导出）、找回与记录（回收站、最近操作）。
// 各块在 BackupSection / ImportSection；说明性文字尽量就地可见，只把次要记录折叠。
import {useApp} from '../../state/AppContext';
import {Disclosure} from '../../components/ui/Disclosure';
import {NavRow} from '../../components/ui/NavRow';
import {TrashIco} from '../../components/icons';
import {BackupSection} from './BackupSection';
import {ImportSection} from './ImportSection';
import './DataSettings.css';

export function DataSettings() {
  const {state} = useApp();
  const trash = state.records.filter(r => r.status === 'trash').length;
  const recent = state.audit.slice(-10).reverse();
  return <>
    <BackupSection/>
    <ImportSection/>
    <section className="settings-section settings-rows">
      <NavRow href="#trash" icon={TrashIco} title="回收站" value={trash ? `${trash} 张` : ''}/>
    </section>
    <section className="settings-section data-block">
      <h3>最近操作</h3>
      {recent.length ? <Disclosure summary={`最近 ${recent.length} 条`}>
        {recent.map((a, i) => <p key={i}>{a.at.replace('T', ' ')} · {a.action}</p>)}
      </Disclosure> : <p className="small-note">暂无操作记录。</p>}
    </section>
  </>;
}
