import {CanvasTexture} from 'three';
import type {MeshPhysicalMaterial} from 'three';

/** Smooth radial directions, rather than literal microscopic grooves that alias. */
export function discAnisotropy(): CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d')!, pixels = context.createImageData(128, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const dx = x - 63.5, dy = y - 63.5, length = Math.max(.01, Math.hypot(dx, dy)), i = (y * 128 + x) * 4;
    pixels.data[i] = Math.round((dx / length * .5 + .5) * 255);
    pixels.data[i + 1] = Math.round((dy / length * .5 + .5) * 255);
    pixels.data[i + 2] = pixels.data[i + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  const texture = new CanvasTexture(canvas); texture.flipY = false; return texture;
}

/** An optical approximation of the data ring's broad diffraction highlights. */
export function discDiffraction(material: MeshPhysicalMaterial) {
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      vec2 cdUv = vAnisotropyMapUv - vec2(0.5);
      float cdRadius = length(cdUv);
      vec2 cdRadial = cdUv / max(cdRadius, 0.001);
      vec3 cdView = normalize(vViewPosition);
      vec2 cdLight = normalize(vec2(0.42, 0.65) + cdView.xy * 1.4);
      float cdOrder = dot(cdRadial, cdLight);
      float cdBand = pow(abs(cdOrder), 16.0);
      float cdData = smoothstep(0.19, 0.23, cdRadius) * (1.0 - smoothstep(0.48, 0.50, cdRadius));
      float cdPhase = cdRadius * 1.7 + cdView.x * 0.9 + cdOrder * 0.18;
      vec3 cdSpectrum = vec3(0.65) + vec3(0.55) * cos(6.2831853 * (cdPhase + vec3(0.0, 0.333, 0.667)));
      outgoingLight *= mix(vec3(1.0), cdSpectrum, cdBand * cdData * 0.8);
      #include <opaque_fragment>
    `);
  };
  material.customProgramCacheKey = () => 'cd-data-ring-v1';
}
