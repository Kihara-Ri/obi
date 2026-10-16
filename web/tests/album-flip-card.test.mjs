import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const card = readFileSync(new URL('../src/components/AlbumFlipCard.tsx', import.meta.url), 'utf8');
const metal = readFileSync(new URL('../src/components/MetalBackCanvas.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles/album-flip-card.css', import.meta.url), 'utf8');
const gallery = readFileSync(new URL('../src/components/GalleryFocus.tsx', import.meta.url), 'utf8');
const editor = readFileSync(new URL('../src/forms/RecordForm.tsx', import.meta.url), 'utf8');

test('gallery preserves front/reverse flip and the existing 3D viewer', () => {
  assert.match(gallery, /AlbumFlipCard/);
  assert.match(gallery, /setFlipped\(false\)/);
  assert.match(gallery, /AlbumModel/);
  assert.match(gallery, /coverRectFrames\(currentRect, thumbnail\)/);
  assert.match(gallery, /gallery-focus-shade/);
  assert.match(card, /onClick={onFlip}/);
  assert.match(card, /Collected on/);
});

test('favorites use gold, other albums silver; preference edits stay in album form', () => {
  assert.match(css, /\.album-flip-card\.is-liked \.album-flip-back/);
  assert.match(css, /linear-gradient\(90deg,#74532e/);
  assert.match(css, /linear-gradient\(90deg,#52606d/);
  assert.match(editor, /album-like-toggle/);
  assert.match(editor, /aria-pressed={liked}/);
  assert.doesNotMatch(card, /album-flip-like|onToggleLiked/);
});

test('brushed metal uses PBR textures, weak studio HDR and no spotlight', () => {
  assert.match(metal, /MeshPhysicalMaterial/);
  assert.match(metal, /metalness: 1/);
  assert.match(metal, /map: brushed\.color/);
  assert.match(metal, /roughnessMap: brushed\.roughness/);
  assert.match(metal, /anisotropyMap: brushed\.anisotropy/);
  assert.match(metal, /studio_small_05_1k\.hdr/);
  assert.match(metal, /scene\.environmentRotation\.set/);
  assert.doesNotMatch(metal, /new THREE\.SpotLight|focusLight|setPointer/);
  assert.doesNotMatch(css, /repeating-linear-gradient|--pointer-strength/);
});

test('mouse adjusts tilt only; the front is not covered by pointer glare', () => {
  assert.match(card, /metal\.current\?\.setTilt\(flipped \? -x : x, y\)/);
  assert.match(card, /metal\.current\?\.setTilt\(0, 0\)/);
  assert.doesNotMatch(card, /setPointer|--pointer-[xy]|lastPointer|album-flip-front-gloss/);
  assert.doesNotMatch(css, /\.album-flip-back::before|\.album-flip-front-gloss/);
});

test('WebGL surfaces survive flips and GPU resources are freed on closing', () => {
  assert.match(card, /if \(flipped\) setMetalMounted\(true\)/);
  assert.match(metal, /resizeObserver\?\.disconnect/);
  assert.match(metal, /geometry\.dispose\(\)/);
  assert.match(metal, /material\.dispose\(\)/);
  assert.match(metal, /brushed\.dispose\(\)/);
  assert.match(metal, /renderer\.forceContextLoss\(\)/);
  assert.match(metal, /cancelAnimationFrame\(frame\)/);
});
