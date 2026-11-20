// 作品封面：优先已确认关联的本地副本封面，否则进入可见区后经闸门按需加载 Obi artwork API。
import {useEffect, useRef, useState} from 'react';
import type {ArtistWork} from '../../core/artists';

export interface ArtworkGate {
  acquire(run: () => void): void;
  release(): void;
}

export function WorkCover({work, localCover, gate}: {work: ArtistWork; localCover: string | null; gate: ArtworkGate}) {
  const [visible, setVisible] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setVisible(true); io.disconnect(); }
    }, {rootMargin: '120px'});
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const remote = localCover ? null : `/api/artists/artwork/${work.mbid}`;
  useEffect(() => {
    if (!visible || src || failed || !remote) return;
    let cancelled = false;
    gate.acquire(() => {
      if (cancelled) { gate.release(); return; }
      setSrc(remote);
    });
    return () => { cancelled = true; };
  }, [visible, src, failed, remote, gate]);

  const release = () => gate.release();
  if (localCover || src) {
    return (
      <span className="work-cover" ref={ref}>
        <img src={localCover ?? src!} alt="" loading="lazy"
             onError={() => { if (!localCover) { release(); setSrc(null); setFailed(true); } }}
             onLoad={() => { if (!localCover) release(); }}/>
      </span>
    );
  }
  if (failed) {
    return <span className="work-cover cover-fallback" ref={ref} role="img" aria-label={`${work.title}，暂无封面`}>
      <span>{work.title.slice(0, 1)}</span>
    </span>;
  }
  return <span className="work-cover cover-fallback pending" ref={ref} aria-hidden="true"><span>◌</span></span>;
}
