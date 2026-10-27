// 布局选择抽屉的内容：三列卡片，每张用当前范围的真实封面摆出该布局的缩略样子。
import {GALLERY_MODES} from '../core/gallery';
import type {GalleryMode} from '../core/gallery';
import type {AlbumRecord} from '../types';

const PREVIEW_COUNT = 9;

/** 布局缩略图用当前范围里的前几张真实封面摆出各布局的造型；没有封面的位置保持中性色块。 */
export function GalleryModePicker({mode, records, onSelect}: {
  mode: GalleryMode; records: AlbumRecord[]; onSelect: (mode: GalleryMode) => void;
}) {
  const covers = records.filter(record => record.cover).slice(0, PREVIEW_COUNT).map(record => record.cover);
  return <div className="gallery-mode-picker">
    <div className="gallery-mode-grid" aria-label="展示方式">
      {GALLERY_MODES.map(option => <button key={option.value} type="button"
        className="gallery-mode-choice" aria-pressed={mode === option.value} title={option.description}
        aria-description={option.description} onClick={() => onSelect(option.value)}>
        <span className={`gallery-mode-preview gallery-mode-preview--${option.value}`} aria-hidden="true">
          {Array.from({length: PREVIEW_COUNT}, (_, i) => <i key={i}>
            {covers.length ? <img src={covers[i % covers.length]} alt="" loading="lazy" decoding="async"/> : null}
          </i>)}
        </span>
        <span className="gallery-mode-name">{option.label}{mode === option.value ? <span aria-hidden="true"> ✓</span> : null}</span>
      </button>)}
    </div>
  </div>;
}
