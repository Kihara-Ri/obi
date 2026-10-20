// 使用方式卡片：按「你是哪种用户」选一套功能组合（整理 / 展示 / 购入 / 交易 / 海外周转）。
// 选中项用边框 + 「当前」文字标记；手动微调后不匹配任何一套时，提示「自定义组合」。
import {PRESETS, sameModules} from '../core/modules';
import type {ModuleFlags} from '../types';

export function ModulePresets({value, disabled, onPick}: {value: ModuleFlags; disabled?: boolean; onPick: (flags: ModuleFlags) => void}) {
  const hit = PRESETS.some(p => sameModules(value, p.enabled));
  return <div className="module-presets-wrap">
    <div className="module-presets" role="group" aria-label="使用方式">
      {PRESETS.map(p => {
        const on = sameModules(value, p.enabled);
        return <button type="button" key={p.id} className="module-preset" aria-pressed={on} disabled={disabled}
                       onClick={() => onPick({...p.enabled})}>
          <strong>{p.name}{on ? <i>当前选择</i> : null}</strong>
          <span className="who">适合：{p.who}</span>
          <span>{p.desc}</span>
        </button>;
      })}
    </div>
    {!hit ? <p className="small-note">当前是自定义组合（在下面的「逐项微调」里改过）。</p> : null}
  </div>;
}
