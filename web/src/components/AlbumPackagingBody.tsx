import {useState} from 'react';
import type {ReactNode} from 'react';
import type {AlbumRecord, PackagingPhotoRole} from '../types';
import type {AlbumPackaging} from '../core/album-packaging';
import {albumTextureSource} from '../core/album-model-assets';
import {GalleryArtwork} from './GalleryMedia';

/** A texture is always a specific photo of this copy, never a repeated front cover. */
function Texture({record, role}: {record: AlbumRecord; role: PackagingPhotoRole}) {
  const index = record.packaging?.photos?.[role];
  const source = record.modelTextures ? albumTextureSource(record, role) : index !== undefined && index < record.photoCount
    ? '/api/photo/' + record.id + '/' + index + '?v=' + record.revision : '';
  const [failed, setFailed] = useState('');
  if (source && failed !== source) return <img className="album-texture" src={source} alt="" draggable={false} onError={() => setFailed(source)}/>;
  if (role === 'front' && !source) return <GalleryArtwork record={record}/>;
  return <span className="album-surface-note">{source ? '贴图载入失败' : role.startsWith('disc') ? '' : role === 'back' ? '示意背面' : role === 'spine' ? '' : '示意中面'}</span>;
}

function Shine() {return <span className="album-part-shine"/>;}

/** Local edge layers stay attached to their own moving leaf or lid. */
function Edge({texture}: {texture?: ReactNode}) {
  return <><span className="album-edge-skin">{texture}</span><span className="album-edge-channel"/><span className="album-edge-glint"/></>;
}

function Spine({record}: {record: AlbumRecord}) {
  return record.modelTextures?.spine || record.packaging?.photos?.spine !== undefined ? <Texture record={record} role="spine"/> : null;
}

/** Outward-facing cuboid faces in local coordinates; each part owns its thickness. */
function Part({name, className = '', front, back, spine, frontContent, backContent}: {
  name: string; className?: string; front?: ReactNode; back?: ReactNode; spine?: ReactNode; frontContent?: ReactNode; backContent?: ReactNode;
}) {
  return <div className={'album-part ' + className} data-part={name}>
    <div className="album-part-face album-part-front">{front}<Shine/></div>
    <div className="album-part-face album-part-back">{back}<Shine/></div>
    <div className="album-part-face album-part-left album-edge"><Edge texture={spine}/></div>
    <div className="album-part-face album-part-right album-edge"><Edge/></div>
    <div className="album-part-face album-part-top album-edge"><Edge/></div>
    <div className="album-part-face album-part-bottom album-edge"><Edge/></div>
    {frontContent ? <div className="album-part-front-content">{frontContent}</div> : null}
    {backContent ? <div className="album-part-back-content">{backContent}</div> : null}
  </div>;
}

function Disc({record, index = 0}: {record: AlbumRecord; index?: number}) {
  const role = index === 0 ? 'disc' : 'disc' + (index + 1) as PackagingPhotoRole;
  return <div className="album-disc" data-part="disc" data-disc={index + 1}><Texture record={record} role={role}/><span className="album-disc-shine"/><span className="album-disc-hub"/></div>;
}

function Pocket({record, side, discs = [0]}: {record: AlbumRecord; side: 'left' | 'right'; discs?: number[]}) {
  const textured = record.packaging?.photos?.[side === 'left' ? 'insideLeft' : 'insideRight'] !== undefined;
  return <div className={'album-pocket album-pocket--' + side + (textured ? ' has-texture' : '')} data-part="pocket">
    <span className="album-pocket-inner"><span className="album-inner-sleeve"/>{discs.map(index => <span className="album-pocket-disc" key={index}><Disc record={record} index={index}/></span>)}</span>
    <span className="album-pocket-lip"/>
    {record.packaging?.miniLP ? <span className="album-pocket-flap"/> : null}
  </div>;
}

function Tray({record, model, index = 0}: {record: AlbumRecord; model: AlbumPackaging; index?: number}) {
  return <div className={'album-tray album-tray--' + model.tray} data-part="tray">
    <span className="album-tray-ring"/><Disc record={record} index={index}/><span className="album-tray-tabs"/>
  </div>;
}

function foldedDiscs(model: AlbumPackaging): number[][] {
  const result: number[][] = Array.from({length: model.panels}, () => []);
  if (model.discs === 1) {result[1] = [0]; return result;}
  const count = Math.min(model.panels, model.discs);
  let index = 0;
  for (let position = 0; position < count; position++) {
    const amount = Math.floor(model.discs / count) + (position >= count - model.discs % count ? 1 : 0);
    result[position] = Array.from({length: amount}, () => index++);
  }
  return result;
}

function TrayPack({record, model, indices}: {record: AlbumRecord; model: AlbumPackaging; indices: number[]}) {
  if (!indices.length) return null;
  if (indices.length === 1) return <Tray record={record} model={model} index={indices[0]}/>;
  return <><div className="album-swing-tray"><Part name="folded-swing-tray" className="album-tray-board"
    frontContent={<Tray record={record} model={model} index={indices[0]}/>} backContent={<Tray record={record} model={model} index={indices[1]}/>}/></div>
    {indices.length > 2 ? <div className="album-swing-tray album-swing-tray--second"><Part name="extra-folded-swing-tray" className="album-tray-board"
      frontContent={<Tray record={record} model={model} index={indices[2]}/>} backContent={indices.length > 3 ? <Tray record={record} model={model} index={indices[3]}/> : undefined}/></div> : null}</>;
}

function Holder({record, model, side}: {record: AlbumRecord; model: AlbumPackaging; side: 'left' | 'right'}) {
  const discs = foldedDiscs(model)[side === 'left' ? 0 : 1];
  if (model.holder === 'tray') return <TrayPack record={record} model={model} indices={discs}/>;
  const indices = model.pockets === 'both' ? discs : Array.from({length: model.discs}, (_, i) => i);
  return model.pockets === side || model.pockets === 'both' ? <Pocket record={record} side={side} discs={indices}/> : null;
}

function JewelCase({record, model}: {record: AlbumRecord; model: AlbumPackaging}) {
  const swing = model.discs > 1;
  return <>
    <Part name="jewel-base" className="album-jewel-base"
      front={<Texture record={record} role="insideRight"/>} frontContent={!swing ? <Tray record={record} model={model}/> : null}
      spine={<Spine record={record}/>}
      back={<Texture record={record} role="back"/>}/>
    {swing ? <>
      <div className="album-swing-tray"><Part name="swing-tray" className="album-tray-board"
        frontContent={<Tray record={record} model={model}/>} backContent={<Tray record={record} model={model} index={1}/>}/></div>
      {model.discs > 2 ? <div className="album-swing-tray album-swing-tray--second"><Part name="second-swing-tray" className="album-tray-board"
        frontContent={<Tray record={record} model={model} index={2}/>} backContent={model.discs > 3 ? <Tray record={record} model={model} index={3}/> : undefined}/></div> : null}
    </> : null}
    <div className="album-front-hinge"><Part name="jewel-lid" className="album-jewel-lid"
      front={<><span className="album-jewel-ridges"/><span className="album-jewel-paper"><Texture record={record} role="front"/></span><span className="album-jewel-clips"/></>}
      back={<Texture record={record} role="insideLeft"/>}/></div>
    <Part name="upper-hinge-pin" className="album-hinge-pin album-hinge-pin--top"/>
    <Part name="lower-hinge-pin" className="album-hinge-pin album-hinge-pin--bottom"/>
  </>;
}

function FoldedCover({record, model, book = false}: {record: AlbumRecord; model: AlbumPackaging; book?: boolean}) {
  return <>
    <Part name={book ? 'book-back' : 'paper-back-panel'} className={book ? 'album-book-back' : 'album-paper-base'}
      front={<Texture record={record} role="insideRight"/>} frontContent={<>{book ? <span className="album-book-pages" data-part="page-block">
        <span className="album-part-face album-part-top album-edge"><Edge/></span>
        <span className="album-part-face album-part-right album-edge"><Edge/></span>
        <span className="album-part-face album-part-bottom album-edge"><Edge/></span>
      </span> : null}<Holder record={record} model={model} side="right"/></>}
      back={<Texture record={record} role="back"/>}/>
    <span className="album-book-spine album-part-face album-edge"><Edge texture={<Spine record={record}/>}/></span>
    <div className="album-front-hinge"><Part name={book ? 'book-cover' : 'paper-front-panel'} className={book ? 'album-book-cover' : 'album-paper-cover'}
      front={<Texture record={record} role="front"/>}
      back={<Texture record={record} role="insideLeft"/>} backContent={<Holder record={record} model={model} side="left"/>}/></div>
    {!book && model.panels > 2 ? <div className="album-extra-fold"><Part name="third-fold-panel" className="album-paper-cover"
      front={<Texture record={record} role="insideCenter"/>} frontContent={model.holder === 'tray' ? <TrayPack record={record} model={model} indices={foldedDiscs(model)[2]}/> : null}/>
      {model.panels > 3 ? <div className="album-extra-fold"><Part name="fourth-fold-panel" className="album-paper-cover"
        front={<Texture record={record} role="insideExtra"/>} frontContent={model.holder === 'tray' ? <TrayPack record={record} model={model} indices={foldedDiscs(model)[3]}/> : null}/></div> : null}
    </div> : null}
  </>;
}

function CardSleeve({record, model}: {record: AlbumRecord; model: AlbumPackaging}) {
  return <div className="album-single-pocket" data-part="single-pocket">
    <div className="album-part-face album-pocket-sheet album-pocket-sheet--rear"><Texture record={record} role="back"/><Shine/></div>
    <div className="album-pocket-cavity"><span className="album-inner-sleeve"/>{Array.from({length: model.discs}, (_, index) => <span className="album-pocket-disc" key={index}><Disc record={record} index={index}/></span>)}</div>
    <div className="album-part-face album-pocket-sheet album-pocket-sheet--front"><Texture record={record} role="front"/><Shine/></div>
    <span className="album-pocket-seam album-pocket-seam--top album-part-face album-edge"><Edge/></span>
    <span className="album-pocket-seam album-pocket-seam--bottom album-part-face album-edge"><Edge/></span>
    <span className="album-pocket-seam album-pocket-seam--spine album-part-face album-edge"><Edge texture={<Spine record={record}/>}/></span>
    <span className="album-pocket-mouth album-part-face"/>
  </div>;
}

function RigidBox({record, model}: {record: AlbumRecord; model: AlbumPackaging}) {
  const indices = Array.from({length: model.discs}, (_, i) => i);
  return <>
    <Part name="rigid-box-base" className="album-rigid-base" front={<Texture record={record} role="insideRight"/>}
      frontContent={model.holder === 'tray' ? <TrayPack record={record} model={model} indices={indices}/> : <Pocket record={record} side={model.pockets === 'left' ? 'left' : 'right'} discs={indices}/>}
      back={<Texture record={record} role="back"/>}/>
    <span className="album-rigid-rim"/>
    <div className="album-box-lid"><Part name="rigid-box-lid" className="album-rigid-lid"
      front={<Texture record={record} role="front"/>} back={<Texture record={record} role="insideLeft"/>}/></div>
  </>;
}

export function AlbumPackagingBody({record, model}: {record: AlbumRecord; model: AlbumPackaging}) {
  return <>
    {model.kind === 'jewel' ? <JewelCase record={record} model={model}/>
      : model.kind === 'card-sleeve' ? <CardSleeve record={record} model={model}/>
        : model.kind === 'gatefold' || model.kind === 'digipak' ? <FoldedCover record={record} model={model}/>
          : model.kind === 'digibook' ? <FoldedCover record={record} model={model} book/>
            : model.kind === 'rigid-box' ? <RigidBox record={record} model={model}/>
              : <Part name="unspecified-packaging" className="album-unspecified" front={<Texture record={record} role="front"/>} back={<Texture record={record} role="back"/>}/>}
    {model.slipcase ? <div className="album-slipcase" data-part="slipcase">
      <div className="album-slipcase-front album-part-face"><Texture record={record} role="outer"/><Shine/></div>
      <div className="album-slipcase-back album-part-face"><span className="album-surface-note">示意外套背面</span><Shine/></div>
      <span className="album-part-face album-part-left album-edge"><Edge/></span>
      <span className="album-part-face album-part-top album-edge"><Edge/></span>
      <span className="album-part-face album-part-bottom album-edge"><Edge/></span>
      <span className="album-slipcase-mouth album-part-face"/>
    </div> : null}
  </>;
}
