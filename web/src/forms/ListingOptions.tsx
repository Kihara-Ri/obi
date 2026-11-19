// 生成设置：文案风格（含自定义）与本次补充。放在文案卡片的生成面板里，跟着「生成 / 重新生成」出现。
import type {ListingPreferences as Preferences} from '../core/listing';
import {ListingPreferences} from '../components/ListingPreferences/ListingPreferences';
import {TextareaField} from './fields';

type Props = {value?: Preferences; busy: boolean; supplement: string; onSupplement: (value: string) => void;
  onSave: (value: Preferences) => Promise<void>};
export function ListingOptions({value, busy, supplement, onSupplement, onSave}: Props) {
  return <fieldset className="listing-fields" disabled={busy}>
    {value ? <ListingPreferences value={value} onSave={onSave}/> : null}
    <TextareaField label="本次补充（只用于这一次生成）" name="listing-supplement" value={supplement} onChange={onSupplement}/>
  </fieldset>;
}
