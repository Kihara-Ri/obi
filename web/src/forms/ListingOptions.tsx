// 次要生成选项统一折叠：文案风格（含自定义）与本次补充，不占用文案首屏。
import type {ListingPreferences as Preferences} from '../core/listing';
import {ListingPreferences} from '../components/ListingPreferences/ListingPreferences';
import {Details} from '../components/ui/Details';
import {TextareaField} from './fields';

type Props = {value?: Preferences; busy: boolean; supplement: string; onSupplement: (value: string) => void;
  onSave: (value: Preferences) => Promise<void>};
export function ListingOptions({value, busy, supplement, onSupplement, onSave}: Props) {
  return <Details className="listing-options" summary="生成设置">
    <fieldset className="listing-fields" disabled={busy}>
      {value ? <ListingPreferences value={value} onSave={onSave}/> : null}
      <TextareaField label="本次补充（只用于这一次生成）" name="listing-supplement" value={supplement} onChange={onSupplement}/>
    </fieldset>
  </Details>;
}
