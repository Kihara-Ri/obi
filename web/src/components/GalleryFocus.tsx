import {useEffect, useMemo, useRef} from 'react';
import {createPortal} from 'react-dom';
import type {AlbumRecord} from '../types';
import {AlbumModel} from './AlbumModel';
import type {AlbumOrientationPermission} from './useAlbumOrientation';
import {useApp} from '../state/AppContext';
import {twinViewerRecord} from '../core/digital-twins';

/** Photo-style focus: flat cover until generation, model and title after publication. */
export function GalleryFocus({record, permission, onClose}: {
  record: AlbumRecord;
  permission: Promise<AlbumOrientationPermission>;
  onClose(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const app = useApp(), job = app.twins.jobs[record.id];
  const modelRecord = useMemo(() => twinViewerRecord(record, job), [record, job]);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const html = document.documentElement;
    const overflow = html.style.overflow;
    const x = window.scrollX, y = window.scrollY;
    html.style.overflow = 'hidden';
    element.showModal();
    element.querySelector<HTMLElement>('.album-model-scene, .gallery-focus-cover')?.focus({preventScroll: true});
    const lock = () => {if (window.scrollX !== x || window.scrollY !== y) window.scrollTo(x, y);};
    window.addEventListener('scroll', lock, {passive: true});
    return () => {
      window.removeEventListener('scroll', lock);
      element.close();
      html.style.overflow = overflow;
      window.scrollTo(x, y);
      if (focused?.isConnected) focused.focus({preventScroll: true});
    };
  }, []);

  return createPortal(<dialog id="gallery-focus" className="gallery-focus" ref={dialog}
    aria-labelledby="gallery-focus-title" data-task-id={job?.id ?? ''} onCancel={event => {event.preventDefault(); onClose();}}
    onKeyDown={event => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); onClose();}
      else if (event.key === 'Tab') {
        const nodes = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href], summary, [tabindex="0"]') ?? [])
          .filter(node => node.getClientRects().length > 0);
        if (!nodes.length) return;
        const index = nodes.indexOf(document.activeElement as HTMLElement);
        event.preventDefault(); nodes[(index + (event.shiftKey ? -1 : 1) + nodes.length) % nodes.length].focus();
      }
    }} onClick={event => {
      if (!(event.target instanceof Element) || !event.target.closest('.gallery-focus-visual')) onClose();
    }}>
    <div className="gallery-focus-visual">
      {modelRecord ? <AlbumModel key={job?.id} record={modelRecord} permission={permission} onDismiss={onClose}/>
        : <div className="gallery-focus-cover" tabIndex={0} role="group" aria-label={'专辑封面：' + record.title}>
          {record.cover ? <img src={record.cover} alt={record.title + '封面'}/> : <span>暂无封面</span>}
        </div>}
      <h2 id="gallery-focus-title">{record.title}</h2>
    </div>
  </dialog>, document.body);
}
