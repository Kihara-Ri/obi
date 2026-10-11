import {Vector2} from 'three';
import type {MeshStandardMaterial} from 'three';

/** Subtle fibres belong to the substrate, not the photograph. Their screen
 * footprint smoothly suppresses normal and roughness variation before aliasing. */
export function paperGrain(material: MeshStandardMaterial, dimensionsMm: readonly [number, number],
  finish: 'uncoated' | 'matte' | 'gloss', pixelRatio: number) {
  const previous = material.onBeforeCompile, cacheKey = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.uniforms.paperDimensionsMm = {value: new Vector2(...dimensionsMm)};
    shader.uniforms.paperSamplingScale = {value: pixelRatio};
    shader.uniforms.paperGrainStrength = {value: finish === 'uncoated' ? .018 : finish === 'matte' ? .010 : .004};
    shader.vertexShader = 'varying vec2 vPaperUv;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvPaperUv = uv;');
    shader.fragmentShader = `
      varying vec2 vPaperUv;
      uniform vec2 paperDimensionsMm;
      uniform float paperSamplingScale;
      uniform float paperGrainStrength;
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      vec2 paperPhase = vPaperUv * paperDimensionsMm * vec2(3.7, 5.1);
      vec2 paperFootprint = fwidth(paperPhase) * paperSamplingScale;
      float paperResolved = 1.0 - smoothstep(0.15, 0.45, max(paperFootprint.x, paperFootprint.y));
      float paperField = sin(6.2831853 * paperPhase.x) * sin(6.2831853 * paperPhase.y + 0.73);
      roughnessFactor = clamp(roughnessFactor + paperField * paperGrainStrength * paperResolved, 0.02, 1.0);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
      #include <normal_fragment_maps>
      vec3 paperDx = dFdx(-vViewPosition), paperDy = dFdy(-vViewPosition);
      vec3 paperCrossX = cross(paperDy, normal), paperCrossY = cross(normal, paperDx);
      float paperSign = sign(dot(paperDx, paperCrossX));
      vec3 paperU = paperSign * (paperCrossX * dFdx(paperPhase.x) + paperCrossY * dFdy(paperPhase.x));
      vec3 paperV = paperSign * (paperCrossX * dFdx(paperPhase.y) + paperCrossY * dFdy(paperPhase.y));
      vec2 paperSlope = vec2(cos(6.2831853 * paperPhase.x) * sin(6.2831853 * paperPhase.y + 0.73),
        sin(6.2831853 * paperPhase.x) * cos(6.2831853 * paperPhase.y + 0.73));
      normal = normalize(normal - (paperU / max(length(paperU), 0.0000001) * paperSlope.x
        + paperV / max(length(paperV), 0.0000001) * paperSlope.y) * paperGrainStrength * paperResolved);
    `);
  };
  material.customProgramCacheKey = () => 'filtered-paper-grain-v1/' + cacheKey;
}
