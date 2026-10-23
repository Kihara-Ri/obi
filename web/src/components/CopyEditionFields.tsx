import {Seg} from './ui/Seg';

/** 日版副本的实物侧标：MusicBrainz 无法推断是否带侧标，必须由用户二选一（未选时两段都不高亮）。 */
export function CopyEditionFields({obi, onChange}: {
  obi: string;
  onChange: (change: {obi: string}) => void;
}) {
  return <section className="record-copy-edition form-section" aria-label="实物侧标">
    <div className="record-copy-edition-head">
      <strong>侧标（OBI）</strong>
      <span>日版必填</span>
    </div>
    <Seg ariaLabel="侧标状态" options={[
      {value: '带侧标', label: '带侧标'}, {value: '无侧标', label: '无侧标'},
    ]} value={obi} onValue={value => onChange({obi: value})}/>
  </section>;
}
