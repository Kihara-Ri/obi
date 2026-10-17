// 购买渠道字段：聚焦列出全部历史店铺（图标 + 归并写法 + 次数排序），
// 输入即过滤，可自由输入新店名。交互由 ui/Combobox 提供，这里只负责店铺数据、
// 品牌图标（见 shopIcons.ts）与图标识别状态提示。
import {useEffect, useMemo, useState} from 'react';
import type {AlbumRecord} from '../types';
import {SHOP_ICONS} from './shopIcons';
import {api} from '../core/api';
import {Combobox} from './ui/Combobox';
import './ShopField.css';

type ShopBrand = {status: 'pending' | 'found' | 'no-icon' | 'unavailable'; name: string; icon?: string; domain?: string};
const normShop = (s: string) => s.toLocaleLowerCase().replace(/[\s\u3000]+/g, '');

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

// 同店不同写法归并（Disk union/disk union、SHIBUYA 109/SHIBUYA109…）：
// 键为小写去空白，展示名取该店出现最多的写法；排序按归并后的总购买次数降序
function mergeShops(records: AlbumRecord[], defaultShop: string) {
  const groups = new Map<string, {spell: Map<string, number>; total: number}>();
  const add = (s: string, n: number) => {
    if (!s) return;
    const k = normShop(s);
    let g = groups.get(k);
    if (!g) { g = {spell: new Map(), total: 0}; groups.set(k, g); }
    g.spell.set(s, (g.spell.get(s) || 0) + n);
    g.total += n;
  };
  records.forEach(r => add((r.location || '').trim(), 1));
  if (defaultShop && !groups.has(normShop(defaultShop.trim()))) add(defaultShop.trim(), 0);
  return [...groups.values()].map(g => {
    let name = '', best = -1;
    for (const [s, c] of g.spell) if (c > best) { name = s; best = c; }
    return {name, count: g.total};
  }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh'));
}

export function ShopField({value, records, defaultShop, onChange}: {
  value: string;
  records: AlbumRecord[];
  defaultShop: string;
  onChange: (v: string) => void;
}) {
  const shops = useMemo(() => mergeShops(records, defaultShop), [records, defaultShop]);
  const [brands, setBrands] = useState<Record<string, ShopBrand>>({});
  const [reloadKey, setReloadKey] = useState(0);
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

  const options = useMemo(
    () => shops.map(s => ({value: s.name, label: s.name, leading: <ShopMark name={s.name} brands={brands}/>})),
    [shops, brands]);

  return (
    <div className="field shop-field">
      <label htmlFor="f-location">购买渠道</label>
      <Combobox id="f-location" value={value} onChange={onChange} options={options}
                placeholder="选择已有店铺，或输入新店铺" listLabel="已有店铺" toggleLabel="展开已有店铺"
                leading={<ShopMark name={value} brands={brands}/>}
                emptyHint={shops.length ? '没有匹配店铺，保存后将尝试补全商家图标。' : '输入店铺名称，保存后将尝试识别商家及其图标。'}/>
      {brands[normShop(value)]?.status === 'pending' ? <small className="shop-discovery-hint">正在识别新渠道图标…</small> : null}
      {brands[normShop(value)]?.status === 'found' ? <small className="shop-discovery-hint">已获取候选商家图标 · {brands[normShop(value)].domain}</small> : null}
      {brands[normShop(value)]?.status === 'unavailable' ? <button type="button" className="shop-discovery-retry quiet" onClick={() => void retry()}>模型暂不可用 · 重试识别图标</button> : null}
    </div>
  );
}
