import type {MeshStandardMaterial} from 'three';

export interface SpineRibs {ribWidth_mm: number; ribPitch_mm: number; ribStart_mm: number; ribEnd_mm: number}

/** Pixel footprint filters the moulded relief before lighting, including when
 * a Retina canvas is reduced to CSS pixels in screenshots or browser zoom. */
export function filterSpineRibs(material: MeshStandardMaterial, ribs: SpineRibs, pixelRatio: number) {
  material.onBeforeCompile = shader => {
    shader.uniforms.spineWidth = {value: ribs.ribWidth_mm};
    shader.uniforms.spinePitch = {value: ribs.ribPitch_mm};
    shader.uniforms.spineStart = {value: ribs.ribStart_mm};
    shader.uniforms.spineEnd = {value: ribs.ribEnd_mm};
    shader.uniforms.spineSamplingScale = {value: pixelRatio};
    shader.vertexShader = 'varying vec2 vSpineRibUv;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>',
      '#include <uv_vertex>\nvSpineRibUv = uv;');
    shader.fragmentShader = `
      varying vec2 vSpineRibUv;
      uniform float spineWidth;
      uniform float spinePitch;
      uniform float spineStart;
      uniform float spineEnd;
      uniform float spineSamplingScale;
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
      #include <normal_fragment_maps>
      float ribPosition = vSpineRibUv.x * spineWidth;
      float ribPhase = (ribPosition - spineStart) / spinePitch;
      float ribFootprint = max(fwidth(ribPhase) * spineSamplingScale, 0.00001);
      // Suppress the relief smoothly before it exceeds the Nyquist frequency.
      float ribResolved = 1.0 - smoothstep(0.15, 0.45, ribFootprint);
      float ribEdge = max(fwidth(ribPosition) * spineSamplingScale, 0.00001);
      float ribMask = smoothstep(spineStart - ribEdge, spineStart + ribEdge, ribPosition)
        * (1.0 - smoothstep(spineEnd - ribEdge, spineEnd + ribEdge, ribPosition));
      vec3 ribDx = dFdx(-vViewPosition), ribDy = dFdy(-vViewPosition);
      vec3 ribCrossX = cross(ribDy, normal), ribCrossY = cross(normal, ribDx);
      float ribDeterminant = dot(ribDx, ribCrossX);
      vec3 ribGradient = sign(ribDeterminant)
        * (ribCrossX * dFdx(ribPhase) + ribCrossY * dFdy(ribPhase));
      float ribLength = length(ribGradient);
      if (ribLength > 0.0000001) {
        float ribSlope = 0.45 * sin(6.28318530718 * ribPhase) * ribResolved * ribMask;
        normal = normalize(normal - ribGradient / ribLength * ribSlope);
      }
    `);
  };
  // All rib materials share a program; physical widths remain per-material uniforms.
  material.customProgramCacheKey = () => 'filtered-spine-relief-v1';
}
