import {Matrix3, ShaderChunk} from 'three';
import type {MeshStandardMaterial} from 'three';
import {photoProjection} from './album-photo-projection';

/** Projection runs at the fragment, so a photographed trapezoid stays continuous
 * across both triangles and rounded cutouts without baking edited image pixels. */
export function projectPackagingPhoto(material: MeshStandardMaterial, region: readonly number[]) {
  const projection = photoProjection(region);
  if (!projection) return;
  const previous = material.onBeforeCompile, cacheKey = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.uniforms.packagingPhotoProjection = {value: new Matrix3().set(...projection)};
    shader.fragmentShader = `
      uniform mat3 packagingPhotoProjection;
      vec2 projectedPackagingUv(vec2 uv) {
        vec3 point = packagingPhotoProjection * vec3(uv, 1.0);
        return point.xy / point.z;
      }
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
      ShaderChunk.map_fragment.replace(/vMapUv/g, 'projectedPackagingUv(vMapUv)'));
  };
  material.customProgramCacheKey = () => 'packaging-photo-projection-v1/' + cacheKey;
}
