import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const maps = readFileSync(new URL('../src/components/BrushedMetalTexture.ts', import.meta.url), 'utf8');
const material = readFileSync(new URL('../src/components/MetalBackCanvas.tsx', import.meta.url), 'utf8');
const card = readFileSync(new URL('../src/components/AlbumFlipCard.tsx', import.meta.url), 'utf8');

test('brushed stock uses a generated texture rather than a fixed lightbox gradient', () => {
  assert.match(maps, /createBrushedMetalMaps/);
  assert.match(maps, /createImageData\(size, size\)/);
  assert.match(maps, /const radial = Math\.hypot\(dx, dy\)/);
  assert.match(maps, /const middle = gaussian/);
  assert.match(maps, /const top = gaussian/);
  assert.match(maps, /const edge = Math\.pow/);
  assert.match(maps, /const microGrooves = brushedNoise/);
  assert.match(maps, /const arc = microGrooves \* \.18/);
  assert.match(maps, /microGrooves \* \.78/);
  assert.match(maps, /const lattice = new Float32Array\(8192\)/);
  assert.match(maps, /const base = gold \?/);
  assert.match(maps, /new three\.CanvasTexture/);
  assert.match(maps, /const tangentX = -dy \* inverseRadius/);
  assert.match(maps, /const tangentY = dx \* inverseRadius/);
  assert.match(maps, /directionPixels\.data\[i \+ 2\] = 168/);
  assert.match(maps, /three\.SRGBColorSpace/);
  assert.match(maps, /three\.NoColorSpace/);
});

test('PBR map is primary, studio HDR is auxiliary, no cursor spotlight', () => {
  assert.match(material, /map: brushed\.color/);
  assert.match(material, /roughnessMap: brushed\.roughness/);
  assert.match(material, /anisotropyMap: brushed\.anisotropy/);
  assert.match(material, /emissiveMap: brushed\.color/);
  assert.match(material, /anisotropy: 0\.48/);
  assert.match(material, /roughness: 0\.40/);
  assert.match(material, /scene\.environmentIntensity = 0\.20/);
  assert.match(material, /envMapIntensity: 0\.17/);
  assert.match(material, /emissiveIntensity: 1\.12/);
  assert.match(material, /environmentRotation\.set/);
  assert.doesNotMatch(material, /new THREE\.SpotLight|focusLight|setPointer/);
  assert.match(card, /metal\.current\?\.setTilt/);
  assert.doesNotMatch(card, /setPointer|--pointer-strength/);
});

test('switching album like state updates both texture channels and frees old GPU maps', () => {
  assert.match(material, /createBrushedMetalMaps\(THREE, liked \? 'gold' : 'silver'\)/);
  assert.match(material, /createBrushedMetalMaps\(THREE, gold \? 'gold' : 'silver'\)/);
  assert.match(material, /material\.map = next\.color/);
  assert.match(material, /material\.roughnessMap = next\.roughness/);
  assert.match(material, /material\.anisotropyMap = next\.anisotropy/);
  assert.match(material, /material\.emissiveMap = next\.color/);
  assert.match(material, /previous\.dispose\(\)/);
  assert.match(material, /brushed\.dispose\(\)/);
  assert.match(material, /renderer\.forceContextLoss\(\)/);
  assert.match(maps, /color\.dispose\(\)/);
  assert.match(maps, /roughness\.dispose\(\)/);
  assert.match(maps, /anisotropy\.dispose\(\)/);
});

test('tool marks mostly influence optical properties, not visible paint', () => {
  assert.match(maps, /const arc = microGrooves \* \.18/);
  assert.match(maps, /const rough = clampByte/);
  assert.match(maps, /roughContext\.putImageData\(roughPixels/);
  assert.match(maps, /directionContext\.putImageData\(directionPixels/);
  assert.match(maps, /anisotropy\.colorSpace = three\.NoColorSpace/);
  assert.doesNotMatch(material, /new THREE\.SpotLight|setPointer/);
});
