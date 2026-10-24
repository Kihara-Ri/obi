// 使用方式：一排图标卡（整理 / 展示 / 购入 / 交易 / 海外周转），点一下套用整套功能组合。
// 选中项：填充底 + 粗边 + 角上对勾（不只靠颜色）；下方一行说明当前这套适合谁，改过开关后换成该组合的调侃说法（core/modules.ts comboWho）。
import {PRESETS, comboWho, sameModules} from '../core/modules';
import type {ModuleFlags} from '../types';
import {CheckIco} from './icons';
import {ModuleIcon} from './moduleIcons';

export function ModulePresets({value, disabled, onPick}: {value: ModuleFlags; disabled?: boolean; onPick: (flags: ModuleFlags) => void}) {
  const hit = PRESETS.find(p => sameModules(value, p.enabled));
  return <div className="module-presets-wrap">
    <div className="module-presets" role="group" aria-label="使用方式">
      {PRESETS.map(p => {
        const on = hit === p;
        return <button type="button" key={p.id} className="module-preset" aria-pressed={on} disabled={disabled}
                       title={p.desc} onClick={() => onPick({...p.enabled})}>
          <span className="module-preset-ico"><ModuleIcon name={p.icon} size={24}/></span>
          <strong>{p.name}</strong>
          {on ? <span className="module-preset-check">{CheckIco}</span> : null}
        </button>;
      })}
    </div>
    <p className="module-presets-who" aria-live="polite">{comboWho(value)}</p>
  </div>;
}
