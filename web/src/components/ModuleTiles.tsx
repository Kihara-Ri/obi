// 功能模块图标开关：四块方砖（展示 / 购入 / 交易 / 海外周转），点一下开或关。
// 开启：强调色填充 + 实心对勾；关闭：空心圆 + 图标变淡（不只靠颜色）。状态每次变化图标轻弹一下，
// 联动（开海外周转自动带上购入、关购入同时关海外周转）时被带动的那块也会弹，直观看出依赖。
import {MODULES} from '../core/modules';
import type {ModuleFlags} from '../types';
import {CheckIco} from './icons';
import {ModuleIcon} from './moduleIcons';

export interface ModuleTilesProps {
  value: ModuleFlags;
  disabled?: boolean;
  onToggle: (id: keyof ModuleFlags, on: boolean) => void;
}

export function ModuleTiles({value, disabled, onToggle}: ModuleTilesProps) {
  return <div className="module-tiles" role="group" aria-label="功能模块">
    {MODULES.map(m => {
      const on = value[m.id];
      const needs = m.id === 'circulation' && !value.acquisition;
      return <button type="button" key={m.id} className="module-tile" role="switch" aria-checked={on}
                     disabled={disabled} title={m.desc} onClick={() => onToggle(m.id, !on)}>
        <span className="module-tile-ico" key={String(on)}><ModuleIcon name={m.icon} size={26}/></span>
        <strong>{m.name}</strong>
        {needs ? <small>含购入</small> : null}
        <span className="module-tile-mark" aria-hidden="true">{on ? CheckIco : null}</span>
      </button>;
    })}
  </div>;
}
