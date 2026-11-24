// 包装类型示意图：线性、currentColor，画「这种包装拿在手里长什么样」（塑料盒看身后叠了几层、纸套看开口、折页看面数）。
// kind 为 PACKAGING_PRESETS 的 value、'other' 或 ''（未填写）。PackagingLabel = 图标 + 中文名 + 原术语，详情页用。
import type {ReactNode} from 'react';
import {PACKAGING_PRESETS, PACKAGING_ZH, packagingDisplay, packagingKind} from '../core/album-packaging';
import {OptionCards} from './ui/OptionCards';
import './PackagingIcon.css';

// 塑料盒：和纸套一样画正面——左侧铰链条 + 透过盒盖看到的光盘。厚度用身后错开的边表示（同 digibook 的书背）：
// 薄盒（slimline）没有，普通盒一层，多碟盒每多一层托盘再错开一层。整体在画布里居中。
const jewel = (layers: number) => {
  const s = 20, step = 2.4, ext = s + step * layers;
  const x = (36 - ext) / 2, y = (28 - ext) / 2, hinge = x + 3.5;
  const cx = hinge + (s - 3.5) / 2, cy = y + s / 2;
  return <>
    <rect x={x} y={y} width={s} height={s} rx="1"/>
    <path d={`M${hinge} ${y}v${s}`}/>
    <circle cx={cx} cy={cy} r="5.6"/><circle cx={cx} cy={cy} r="1.4"/>
    {Array.from({length: layers}, (_, i) => {
      const o = step * (i + 1);
      return <path key={i} d={`M${x + s + o - step} ${y + o}h${step}v${s}H${x + o}V${y + s + o - step}`}/>;
    })}</>;
};
// 硬纸盒：天地盖，盖子略宽出一圈，前沿有开盖缺口
const rigidBox = <>
  <rect x="5" y="15" width="22" height="11" rx="1"/><path d="M27 15l4-4v11l-4 4"/>
  <rect x="3.5" y="8" width="25" height="7.5" rx="1"/><path d="M3.5 8l4-4h25l-4 4M32.5 4v7.5l-4 4"/>
  <path d="M13 20.5h6"/>
</>;
// 从上沿露出半张碟（纸套口袋）
const peek = (cx: number, top: number, r: number) => {
  const dx = Math.sqrt(r * r - (r - 2.5) * (r - 2.5));
  return <path d={`M${cx - dx} ${top}A${r} ${r} 0 0 1 ${cx + dx} ${top}`}/>;
};

const ICONS: Record<string, ReactNode> = {
  'jewel': jewel(1),
  'slimline': jewel(0),
  'multi': jewel(2),
  'card-sleeve': <><rect x="5" y="4" width="20" height="21" rx="1"/>
    <path d="M25 6.2A9 9 0 0 1 25 22.8"/><path d="M25 12a2.6 2.6 0 0 1 0 5"/></>,
  'mini-lp': <><rect x="5" y="4" width="20" height="21" rx="1"/><path d="M8.5 4v21"/>
    <path d="M25 6.2A9 9 0 0 1 25 22.8"/><path d="M25 9.5a5.6 5.6 0 0 1 0 10"/></>,
  'gatefold': <><rect x="3" y="7" width="15" height="18" rx="1"/><rect x="18" y="7" width="15" height="18" rx="1"/>
    {peek(25.5, 7, 5.5)}</>,
  'digisleeve': <><rect x="2" y="7" width="10.7" height="18" rx="1"/><rect x="12.7" y="7" width="10.7" height="18" rx="1"/>
    <rect x="23.4" y="7" width="10.6" height="18" rx="1"/>{peek(28.7, 7, 4.2)}</>,
  'digipak': <><rect x="3" y="5" width="15" height="18" rx="1"/><rect x="18" y="5" width="15" height="18" rx="1"/>
    <circle cx="25.5" cy="14" r="5.5"/><circle cx="25.5" cy="14" r="1.4"/></>,
  'digibook': <><rect x="8" y="3" width="19" height="21" rx="1"/><path d="M11.5 3v21"/>
    <path d="M27 5.5h2.5v21H10.5V24"/></>,
  'rigid-box': rigidBox,
  'other': <><rect x="6" y="3" width="22" height="22" rx="1.5" strokeDasharray="3 2.5"/><circle cx="17" cy="14" r="5.5"/>
    <circle cx="17" cy="14" r="1.2"/></>,
  '': <><rect x="6" y="3" width="22" height="22" rx="1.5" strokeDasharray="3 2.5"/><path d="M13.5 10.5a3.5 3.5 0 1 1 4.5 3.4c-.6.2-1 .7-1 1.3v.8"/>
    <circle cx="17" cy="19.6" r=".4"/></>,
};

export function PackagingIcon({kind, height = 28}: {kind: string; height?: number}) {
  return <svg viewBox="0 0 36 28" width={height * 36 / 28} height={height} fill="none" stroke="currentColor" strokeWidth="1.6"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{ICONS[kind] ?? ICONS.other}</svg>;
}

/** 详情里的包装值：图标 + 中文名，原英文术语小字跟在后面。 */
export function PackagingLabel({text}: {text: string}) {
  const {kind, name, term} = packagingDisplay(text);
  return <span className="pkg-label">
    <PackagingIcon kind={kind} height={22}/>
    <span className="pkg-label-text">{name}{term ? <small>{term}</small> : null}</span>
  </span>;
}

/**
 * 表单里的包装选择：预设点选后存预设的英文术语；归不进任何预设的选「其他」，存为 Other（不套结构、不生成 3D）。
 * 资料库带来的认不出的原值也归在「其他」下，选中它不会覆盖原值。
 */
export function PackagingPicker({value, onPick, required = false}: {value: string; onPick: (label: string) => void; required?: boolean}) {
  const kind = packagingKind(value);
  const options = [
    ...PACKAGING_PRESETS.map(p => ({value: p.value, label: PACKAGING_ZH[p.value], icon: <PackagingIcon kind={p.value}/>})),
    {value: 'other', label: '其他', icon: <PackagingIcon kind="other"/>},
    ...(required ? [] : [{value: '', label: '不清楚', icon: <PackagingIcon kind=""/>}]),
  ];
  return <OptionCards className="pkg-picker" ariaLabel="包装" columns={3} options={options} value={kind}
    onValue={code => {
      if (code === 'other') { if (kind !== 'other') onPick('Other'); return; }
      onPick(PACKAGING_PRESETS.find(p => p.value === code)?.label ?? '');
    }}/>;
}
