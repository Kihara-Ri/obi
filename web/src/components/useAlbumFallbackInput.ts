import {useEffect, useState} from 'react';

/** Preserve the host's photo-lightbox and closing-drawer input guard. */
export function useAlbumFallbackInput(): boolean {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    const covered = () => setEnabled(!document.getElementById('lightbox') && !document.querySelector('.drawer.closing'));
    const observer = new MutationObserver(covered);
    observer.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['class']});
    covered();
    return () => observer.disconnect();
  }, []);
  return enabled;
}
