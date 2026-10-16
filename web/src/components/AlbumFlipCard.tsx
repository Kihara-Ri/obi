import {useEffect, useRef, useState} from 'react';
import type {PointerEvent} from 'react';
import type {AlbumRecord} from '../types';
import {MetalBackCanvas} from './MetalBackCanvas';
import type {MetalSurfaceController} from './MetalBackCanvas';

/** One physical-looking card per album, independent of copy status and edition. */
export function AlbumFlipCard({record, flipped, liked, collectedAt, onFlip}: {
  record: AlbumRecord; flipped: boolean; liked: boolean; collectedAt?: string;
  onFlip(): void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const metal = useRef<MetalSurfaceController | null>(null);
  const [metalMounted, setMetalMounted] = useState(flipped);
  useEffect(() => {if (flipped) setMetalMounted(true);}, [flipped]);
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - .5;
    const y = (event.clientY - rect.top) / rect.height - .5;
    event.currentTarget.style.setProperty('--card-tilt-x', (-y * 7).toFixed(2) + 'deg');
    event.currentTarget.style.setProperty('--card-tilt-y', (x * 7).toFixed(2) + 'deg');
    // WebGL environment rotates oppositely to CSS card orientation, producing
    // real PBR reflections while leaving card lettering in crisp DOM.
    metal.current?.setTilt(flipped ? -x : x, y);
  };
  const reset = () => {
    if (!card.current) return;
    card.current.style.setProperty('--card-tilt-x', '0deg');
    card.current.style.setProperty('--card-tilt-y', '0deg');
    metal.current?.setTilt(0, 0);
  };
  const date = collectedAt ? collectedAt.replace(/-/g, '.') : '日期未记录';
  return <div ref={card}
      className={'album-flip-card' + (flipped ? ' is-flipped' : '') + (liked ? ' is-liked' : '')}
      onPointerMove={move} onPointerLeave={reset}>
    <button className="album-flip-rotor" type="button"
      aria-label={flipped ? '翻回专辑正面' : '翻到专辑背面'} aria-pressed={flipped}
      title={flipped ? '翻回封面' : '查看收藏卡背面'}
      onClick={onFlip}>
      <span className="album-flip-face album-flip-front" aria-hidden={flipped}>
        {record.cover ? <img className="gallery-focus-cover" src={record.cover}
          alt={record.title + '封面'} draggable={false}/>
          : <span className="gallery-focus-cover gallery-artwork"><span className="cover-fallback">暂无封面</span></span>}
      </span>
      <span className="album-flip-face album-flip-back" aria-hidden={!flipped}>
        {metalMounted ? <MetalBackCanvas liked={liked} onController={instance => {
          metal.current = instance;
        }}/> : null}
        <span className="album-flip-back-center">
          <span className="album-flip-album-title">{record.title}</span>
          <span className="album-flip-artist-name">{record.artist}</span>
        </span>
        <span className="album-flip-back-bottom">
          <span className="album-flip-date-label">Collected on</span>
          <span className="album-flip-handwritten">{date}</span>
        </span>
      </span>
    </button>
    <span className="album-flip-hint" aria-hidden="true">翻转</span>
  </div>;
}
