import type * as THREE from 'three';

export type BrushedMetalTone = 'silver' | 'gold';

export interface BrushedMetalMaps {
  color: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
  anisotropy: THREE.CanvasTexture;
  dispose(): void;
}

/**
 * Procedural, radial brushed-metal stock.
 *
 * The highlight is baked into the material rather than tied to the pointer:
 * a broad vertical satin sheen, top-center reflected sky light, darkened
 * margins and hairline concentric tooling marks whose centre is above
 * the plate. PBR contributes only subtle angle-dependent environment sheen.
 *
 * Keep generated textures out of React state so mouse movement never
 * rerasterizes the metal. No network or synthetic test image is required.
 */
export function createBrushedMetalMaps(
  three: typeof THREE,
  tone: BrushedMetalTone,
  size = 1024,
): BrushedMetalMaps {
  const albedoCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  const directionCanvas = document.createElement('canvas');
  albedoCanvas.width = roughCanvas.width = directionCanvas.width = size;
  albedoCanvas.height = roughCanvas.height = directionCanvas.height = size;
  const albedoContext = albedoCanvas.getContext('2d');
  const roughContext = roughCanvas.getContext('2d');
  const directionContext = directionCanvas.getContext('2d');
  if (!albedoContext || !roughContext || !directionContext) {
    throw new Error('Canvas 2D is unavailable for brushed metal textures');
  }
  const pixels = albedoContext.createImageData(size, size);
  const roughPixels = roughContext.createImageData(size, size);
  const directionPixels = directionContext.createImageData(size, size);

  // Small, seeded 1-D noise lattice: interpolation yields flowing circular
  // scratches, not independent white-noise pixels or horizontal CSS lines.
  const lattice = new Float32Array(8192);
  let seed = 0x6c8e9cf5;
  for (let i = 0; i < lattice.length; i++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    lattice[i] = (seed >>> 0) / 0xffffffff;
  }
  const brushedNoise = (v: number) => {
    const cell = Math.floor(v);
    const t = v - cell;
    const eased = t * t * (3 - 2 * t);
    const a = lattice[cell & 8191];
    const b = lattice[(cell + 1) & 8191];
    return a + (b - a) * eased - 0.5;
  };
  const clampByte = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const gaussian = (distance: number) => Math.exp(-0.5 * distance * distance);
  const gold = tone === 'gold';
  const base = gold ? [225, 194, 128] : [222, 228, 237];

  const cx = size * 0.50;
  const cy = -size * 0.32;
  for (let y = 0; y < size; y++) {
    const ny = (y + 0.5) / size;
    for (let x = 0; x < size; x++) {
      const nx = (x + 0.5) / size;
      const dx = x - cx;
      const dy = y - cy;
      const radial = Math.hypot(dx, dy);

      // Printed/stamped curves are centred above the metal sheet. Because
      // scratches follow radial distance, their curvature survives scaling.
      // Tooling marks exist primarily at the microfacet level. A faint,
      // non-periodic 1-D height profile follows each circular tool path;
      // most of its signal belongs to surface roughness, not paint colour.
      const microGrooves = brushedNoise(radial * 1.80) * .055
        + brushedNoise(radial * 4.40 + 187) * .025
        + brushedNoise(radial * .42 + 53) * .012;
      const grain = ((x * 29 + y * 71 + ((x ^ y) * 11)) & 31) / 31 - .5;
      const micro = grain * .006;
      // Almost no visible striping in albedo; the substrate still has a
      // measurable machining profile for its PBR microfacet simulation.
      const arc = microGrooves * .18;

      const middle = gaussian((nx - .50) / .225);
      const top = gaussian((nx - .50) / .31)
        * gaussian((ny + .06) / .285);
      const longSatin = gaussian((nx - .565) / .18);
      const edge = Math.pow(Math.abs(nx - .5) * 2, 1.5);
      const lowerVignette = Math.max(0, ny - .55) * .13;

      // Tone data is sRGB; the broad light-dark composition comes from
      // the satin metallic substrate, not dark stripes painted over it.
      const brightness = Math.max(.20, Math.min(1.19,
        .41 + .46 * middle + .31 * top + .12 * longSatin
        - .22 * edge - lowerVignette + arc + micro * .35));
      const i = (y * size + x) * 4;
      pixels.data[i] = clampByte(base[0] * brightness);
      pixels.data[i + 1] = clampByte(base[1] * brightness);
      pixels.data[i + 2] = clampByte(base[2] * brightness);
      pixels.data[i + 3] = 255;

      // Roughness fluctuations are shallow (as for satin-finished stock);
      // they must not read as relief carving from normal viewing distance.
      const rough = clampByte(255 * Math.max(.70, Math.min(.93,
        .82 - .075 * middle + microGrooves * .78 + micro * .7)));
      roughPixels.data[i] = roughPixels.data[i + 1] = roughPixels.data[i + 2] = rough;
      roughPixels.data[i + 3] = 255;

      // A real directional microfacet model: orient the anisotropic reflection
      // tangent to each machining arc. Three.js expects [-1,1] packed in RG
      // and anisotropy strength in B. No visible stroke is drawn here.
      const inverseRadius = 1 / Math.max(1, radial);
      const tangentX = -dy * inverseRadius;
      const tangentY = dx * inverseRadius;
      directionPixels.data[i] = clampByte((tangentX * .5 + .5) * 255);
      directionPixels.data[i + 1] = clampByte((tangentY * .5 + .5) * 255);
      directionPixels.data[i + 2] = 168;
      directionPixels.data[i + 3] = 255;
    }
  }

  albedoContext.putImageData(pixels, 0, 0);
  roughContext.putImageData(roughPixels, 0, 0);
  directionContext.putImageData(directionPixels, 0, 0);
  const color = new three.CanvasTexture(albedoCanvas);
  color.colorSpace = three.SRGBColorSpace;
  const roughness = new three.CanvasTexture(roughCanvas);
  roughness.colorSpace = three.NoColorSpace;
  const anisotropy = new three.CanvasTexture(directionCanvas);
  anisotropy.colorSpace = three.NoColorSpace;
  for (const map of [color, roughness, anisotropy]) {
    map.wrapS = map.wrapT = three.ClampToEdgeWrapping;
    map.minFilter = three.LinearMipmapLinearFilter;
    map.magFilter = three.LinearFilter;
    map.generateMipmaps = true;
    map.anisotropy = 4;
    map.needsUpdate = true;
  }
  return {
    color, roughness, anisotropy,
    dispose() {
      color.dispose();
      roughness.dispose();
      anisotropy.dispose();
    },
  };
}
