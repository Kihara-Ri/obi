import type {AlbumRecord} from '../types';
import {GalleryArtwork} from './GalleryMedia';
import {albumPackaging} from '../core/album-packaging';

/** The rail moves the button; this inner body handles only contact lift. */
export function GalleryCase({record, spatial = false}: {record: AlbumRecord; spatial?: boolean}) {
  const kind = albumPackaging(record.version, record.packaging).kind;
  const sleeve = ['card-sleeve', 'gatefold', 'digipak', 'digibook'].includes(kind);
  return <span className={`gallery-case gallery-case--${spatial ? 'spatial' : 'flat'} gallery-case--${kind}${sleeve ? ' gallery-case--sleeve' : ''}`}>
    <span className="gallery-case-shadow" aria-hidden="true"/>
    <span className="gallery-case-body">
      {spatial ? <>
        <span className="gallery-case-face gallery-case-face--rear" aria-hidden="true"/>
        <span className="gallery-case-face gallery-case-face--left" aria-hidden="true"/>
        <span className="gallery-case-face gallery-case-face--right" aria-hidden="true"/>
        <span className="gallery-case-face gallery-case-face--top" aria-hidden="true"/>
        <span className="gallery-case-face gallery-case-face--bottom" aria-hidden="true"/>
        <span className="gallery-case-face gallery-case-face--front"><GalleryArtwork record={record}/></span>
      </> : <GalleryArtwork record={record}/>}
    </span>
  </span>;
}
