// 购买渠道字段：手机友好的标签选择（不再用下拉）。常用店铺按购买次数排成一排标签，
// 同一品牌的连锁店（如 Disk Union 新宿 / 渋谷）归成一组，点品牌展开第二层选分店；
// 「＋ 其他」展开输入框录入新店名。店铺数据与同店不同写法归并见 mergeShops，品牌图标见 shopIcons.ts。
import {Fragment, useEffect, useMemo, useState} from 'react';
import type {AlbumRecord} from '../types';
import {SHOP_ICONS} from './shopIcons';
import {branchLabel, brandsFromKeys, groupShops, mergeShops, normShop} from '../core/shop-groups';
import type {Group} from '../core/shop-groups';
import {api} from '../core/api';
import './ShopField.css';

type ShopBrand = {status: 'pending' | 'found' | 'no-icon' | 'unavailable'; name: string; icon?: string; domain?: string};
const BRANDS = brandsFromKeys(SHOP_ICONS.map(([keys]) => keys));
const TOP = 6; // 默认显示的品牌 / 店铺标签数，其余收进「更多」

export function ShopMark({name, brands}: {name: string; brands?: Record<string, ShopBrand>}) {
  const s = (name || '').toLowerCase();
  for (const [keys, src] of SHOP_ICONS) {
    if (keys.split('|').some(k => s.includes(k))) return <img src={src} alt=""/>;
  }
  const icon = brands?.[normShop(name)]?.icon;
  if (icon && icon.startsWith('/api/shop-brand-icon/')) return <img src={icon} alt=""/>;
  const ch = [...(name || '').trim()][0];
  return ch ? <span className="shop-letter">{ch.toUpperCase()}</span> : null;
}

export function ShopField({value, records, defaultShop, onChange}: {
  value: string;
  records: AlbumRecord[];
  defaultShop: string;
  onChange: (v: string) => void;
}) {
  const groups = useMemo(
    () => groupShops(mergeShops(records.map(r => r.location || ''), defaultShop), BRANDS), [records, defaultShop]);
  const [brands, setBrands] = useState<Record<string, ShopBrand>>({});
  const [reloadKey, setReloadKey] = useState(0);
  const current = normShop(value);
  const ownGroup = groups.find(g => g.shops.some(s => normShop(s.name) === current));
  const [open, setOpen] = useState<string | null>(ownGroup && ownGroup.shops.length > 1 ? ownGroup.key : null);
  const [showAll, setShowAll] = useState(false);
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    const load = async () => {
      try {
        const response = await api<{brands: Record<string, ShopBrand>}>('shop-brands');
        if (!active) return;
        setBrands(response.brands);
        // One bounded poll while background shop discovery is still running.
        if (Object.values(response.brands).some(item => item.status === 'pending')) {
          timer = window.setTimeout(() => void load(), 2500);
        }
      } catch { /* icons are optional: preserve regular shop entry if offline */ }
    };
    void load();
    return () => {active = false; window.clearTimeout(timer);};
  }, [reloadKey]);

  const retry = async () => {
    const name = value.trim();
    if (!name) return;
    try {
      const response = await api<{queued: boolean}>('shops/retry', {name});
      if (response.queued) {
        setBrands(prev => ({...prev, [normShop(name)]: {name, status: 'pending'}}));
        setReloadKey(k => k + 1);
      }
    } catch { /* Keep the name editable if background model service is offline. */ }
  };

  const pick = (name: string) => { onChange(name); setTyping(false); };
  const isOn = (g: Group) => g.shops.some(s => normShop(s.name) === current);
  // 手填的新店名不在历史里：作为已选标签排在最前，保存前也能看到当前值
  const custom = value.trim() && !ownGroup ? value.trim() : '';
  const visible = showAll ? groups : groups.slice(0, TOP);
  const status = brands[current]?.status;

  return (
    <div className="row stack shop-field">
      <label id="shop-label">购买渠道</label>
      <div className="shop-chips" role="group" aria-labelledby="shop-label">
        {custom ? <button type="button" className="chip on" aria-pressed="true" onClick={() => setTyping(true)}>
          <ShopMark name={custom} brands={brands}/>{custom}</button> : null}
        {visible.map(g => {
          const multi = g.shops.length > 1;
          const on = isOn(g);
          // 分店行紧跟在被点的品牌标签后面（占满一行），而不是等所有品牌排完再统一显示
          return <Fragment key={g.key}>
            <button type="button" className={`chip${on ? ' on' : ''}${multi ? ' has-branches' : ''}`}
              aria-pressed={on} aria-expanded={multi ? open === g.key : undefined}
              onClick={() => multi ? setOpen(open === g.key ? null : g.key) : pick(g.shops[0].name)}>
              <ShopMark name={g.label} brands={brands}/>{g.label}
              {multi ? <span className="chip-branches" aria-hidden="true">{g.shops.length}</span> : null}
            </button>
            {multi && open === g.key ? <div className="shop-branches" role="group" aria-label={`${g.label} 分店`}>
              {g.shops.map(s => <button type="button" key={s.name} className={`chip${normShop(s.name) === current ? ' on' : ''}`}
                aria-pressed={normShop(s.name) === current} onClick={() => pick(s.name)}>
                {branchLabel(s.name, g.aliases)}</button>)}
            </div> : null}
          </Fragment>;
        })}
        {groups.length > TOP ? <button type="button" className="chip quiet" onClick={() => setShowAll(v => !v)}>
          {showAll ? '收起' : `更多 ${groups.length - TOP}`}</button> : null}
        <button type="button" className={`chip quiet${typing ? ' on' : ''}`} aria-expanded={typing}
          onClick={() => setTyping(v => !v)}>＋ 其他</button>
      </div>
      {typing ? <input className="shop-input" value={value} autoComplete="off" placeholder="输入店铺名称"
        aria-label="新店铺名称" onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setTyping(false); } }}/> : null}
      {status === 'pending' ? <small className="shop-discovery-hint">识别图标中…</small> : null}
      {status === 'unavailable' ? <button type="button" className="shop-discovery-retry quiet" onClick={() => void retry()}>重试识别图标</button> : null}
    </div>
  );
}
