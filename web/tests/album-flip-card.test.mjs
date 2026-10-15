import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const component = readFileSync(new URL('../src/components/AlbumFlipCard.tsx', import.meta.url),'utf8');
const metal = readFileSync(new URL('../src/components/MetalBackCanvas.tsx', import.meta.url),'utf8');
const css = readFileSync(new URL('../src/styles/album-flip-card.css', import.meta.url),'utf8');
const gallery = readFileSync(new URL('../src/components/GalleryFocus.tsx', import.meta.url),'utf8');
const editor = readFileSync(new URL('../src/forms/RecordForm.tsx', import.meta.url),'utf8');

test('focus supports real flip card while preserving existing 3D renderer', () => {
  assert.match(gallery, /AlbumFlipCard/);
  assert.match(gallery, /setFlipped\(false\)/);
  assert.match(gallery, /AlbumModel/);
  assert.match(gallery, /coverRectFrames\(currentRect, thumbnail\)/);
  assert.match(gallery, /gallery-focus-shade/);
  assert.match(component, /onFlip\(\)/);
  assert.match(component, /Collected on/);
  assert.match(component, /record\.cover/);
});
test('silver/gold reflect album preference, edited only in album form', () => {
  assert.match(css,/\.album-flip-card\.is-liked \.album-flip-back/);
  assert.match(css,/background:linear-gradient\(140deg,#9e752d/);
  assert.match(editor,/album-like-toggle/);
  assert.match(editor,/aria-pressed={liked}/);
  assert.doesNotMatch(component,/album-flip-like|onToggleLiked/);
});
test('PBR metal has real neutral HDR environment and local focused spot', () => {
  assert.match(metal,/MeshPhysicalMaterial/);
  assert.match(metal,/metalness: 1/);
  assert.match(metal,/anisotropy: 0\.06/);
  assert.match(metal,/studio_small_05_1k\.hdr/);
  assert.match(metal,/new THREE\.SpotLight\(0xfffaf2, 0, 8, Math\.PI \/ 12, 0\.96, 2\)/);
  assert.match(metal,/focusLight\.dispose\(\)/);
  assert.match(metal,/scene\.environmentRotation\.set/);
  assert.match(metal,/renderer\.forceContextLoss\(\)/);
  assert.doesNotMatch(css,/repeating-linear-gradient/);
});
test('front and back use one pointer-driven light position and fade', () => {
  assert.match(component,/lastPointer\.current = \{x, y, active: true\}/);
  assert.match(component,/metal\.current\?\.setPointer\(x, y, true\)/);
  assert.match(component,/instance\.setPointer\(pointer\.x, pointer\.y, pointer\.active && flipped\)/);
  assert.match(component,/metal\.current\?\.setPointer\(0, 0, false\)/);
  assert.match(css,/\.album-flip-front-gloss\{[\s\S]*?radial-gradient\(circle min\(26vw, 160px\) at var\(--pointer-x\) var\(--pointer-y\)/);
  assert.match(css,/\.album-flip-back::before\{[\s\S]*?radial-gradient\(circle min\(26vw, 160px\) at var\(--pointer-x\) var\(--pointer-y\)/);
  assert.doesNotMatch(css,/--card-light-x|--card-light-y|linear-gradient\(132deg/);
});
test('reverse side retains WebGL surface during flip, off when dialog unmounts', () => {
  assert.match(component,/if \(flipped\) setMetalMounted\(true\)/);
  assert.match(metal,/resizeObserver\?\.disconnect/);
  assert.match(metal,/geometry\.dispose\(\)/);
  assert.match(metal,/material\.dispose\(\)/);
  assert.match(metal,/cancelAnimationFrame\(frame\)/);
});
