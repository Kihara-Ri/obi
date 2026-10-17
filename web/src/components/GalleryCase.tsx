import type {AlbumRecord} from '../types';
import {GalleryArtwork} from './GalleryMedia';

/** Layouts arrange flat covers in space; packaging geometry belongs to the engine. */
export function GalleryCase({record}: {record: AlbumRecord; spatial?: boolean}) {
  return <span className="gallery-case gallery-case--flat">
    <span className="gallery-case-shadow" aria-hidden="true"/>
    <span className="gallery-case-body"><GalleryArtwork record={record}/></span>
  </span>;
}
