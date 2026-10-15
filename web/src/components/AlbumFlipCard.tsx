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
  const lastPointer = useRef({x: 0, y: 0, active: false});
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
    // Both faces read the same pointer-space light position and fade. The
    // reverse additionally uses it for physical metal reflections.
    lastPointer.current = {x, y, active: true};
    event.currentTarget.style.setProperty('--pointer-x', ((x + .5) * 100).toFixed(1) + '%');
    event.currentTarget.style.setProperty('--pointer-y', ((y + .5) * 100).toFixed(1) + '%');
    event.currentTarget.style.setProperty('--pointer-strength', '1');
    if (flipped) metal.current?.setPointer(x, y, true);
  };
  const reset = () => {
    if (!card.current) return;
    card.current.style.setProperty('--card-tilt-x', '0deg');
    card.current.style.setProperty('--card-tilt-y', '0deg');
    lastPointer.current.active = false;
    card.current.style.setProperty('--pointer-strength', '0');
    metal.current?.setTilt(0, 0);
    metal.current?.setPointer(0, 0, false);
  };
  const date = collectedAt ? collectedAt.replace(/-/g, '.') : '日期未记录';
  return <div ref={card}
      className={'album-flip-card' + (flipped ? ' is-flipped' : '') + (liked ? ' is-liked' : '')}
      onPointerMove={move} onPointerLeave={reset}>
    <button className="album-flip-rotor" type="button"
      aria-label={flipped ? '翻回专辑正面' : '翻到专辑背面'} aria-pressed={flipped}
      title={flipped ? '翻回封面' : '查看收藏卡背面'}
      onClick={() => {
        // Keep the visible spotlight continuous when flipping, but do not
        // leave the WebGL light on after the reverse face goes out of view.
        const pointer = lastPointer.current;
        if (flipped) {
          metal.current?.setPointer(0, 0, false);
        } else {
          metal.current?.setPointer(pointer.x, pointer.y, pointer.active);
        }
        onFlip();
      }}>
      <span className="album-flip-face album-flip-front" aria-hidden={flipped}>
        {record.cover ? <img className="gallery-focus-cover" src={record.cover}
          alt={record.title + '封面'} draggable={false}/>
          : <span className="gallery-focus-cover gallery-artwork"><span className="cover-fallback">暂无封面</span></span>}
        <span className="album-flip-front-gloss" aria-hidden="true"/>
      </span>
      <span className="album-flip-face album-flip-back" aria-hidden={!flipped}>
        {metalMounted ? <MetalBackCanvas liked={liked} onController={instance => {
          metal.current = instance;
          if (instance) {
            // First flip may already have a pointer without any subsequent
            // move event; initialize the GPU lighting to the current position.
            const pointer = lastPointer.current;
            instance.setTilt(flipped ? -pointer.x : pointer.x, pointer.y);
            instance.setPointer(pointer.x, pointer.y, pointer.active && flipped);
          }
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
