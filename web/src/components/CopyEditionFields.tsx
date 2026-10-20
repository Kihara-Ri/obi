import {Seg} from './ui/Seg';

/** Obi is a condition of the actual copy; MusicBrainz cannot infer its presence. */
export function CopyEditionFields({obi, onChange}: {
  obi: string;
  onChange: (change: {obi: string}) => void;
}) {
  return <section className="record-copy-edition form-section" aria-label="实物侧标">
    <div className="record-copy-edition-head">
      <strong>侧标（OBI）</strong>
    </div>
    <Seg ariaLabel="侧标状态" options={[
      {value: '', label: '未记录'}, {value: '带侧标', label: '带侧标'}, {value: '无侧标', label: '无侧标'},
    ]} value={obi} onValue={value => onChange({obi: value})}/>
  </section>;
}
