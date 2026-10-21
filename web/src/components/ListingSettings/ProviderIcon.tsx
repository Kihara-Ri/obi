// 服务商品牌图标：按 id 取 brandIcons 里的 SVG 片段，尺寸可调。
import type {ListingProviderId} from '../../core/listing';
import {BRAND_SVG} from './brandIcons';

export function ProviderIcon({id, size = 40}: {id: ListingProviderId; size?: number}) {
  return <span className="provider-tile" aria-hidden="true" style={{width: size, height: size}}>
    <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="currentColor" dangerouslySetInnerHTML={{__html: BRAND_SVG[id]}}/>
  </span>;
}
