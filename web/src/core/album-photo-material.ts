import {Matrix3, ShaderChunk, Vector4} from 'three';
import type {MeshStandardMaterial} from 'three';
import {photoProjection, validPhotoWarpRows} from './album-photo-projection';

/** Projection runs at the fragment. Every adjacent curved strip shares the
 * exact same edge row and u interpolation, preserving printed lines at joins. */
export function projectPackagingPhoto(material: MeshStandardMaterial, region?: readonly number[], warpRows?: readonly (readonly number[])[]) {
  const rows = warpRows && validPhotoWarpRows(warpRows) ? warpRows : undefined;
  const projection = region ? photoProjection(region) : null;
  if (!rows && !projection) return;
  const previous = material.onBeforeCompile, cacheKey = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    if (rows) {
      shader.uniforms.packagingPhotoRows = {value: Array.from({length: 17}, (_, i) => new Vector4(...rows[Math.min(i, rows.length - 1)] as [number, number, number, number]))};
      shader.uniforms.packagingPhotoRowCount = {value: rows.length};
      shader.fragmentShader = `
        uniform vec4 packagingPhotoRows[17];
        uniform int packagingPhotoRowCount;
        vec2 projectedPackagingUv(vec2 uv) {
          float rowPosition = clamp(uv.y, 0.0, 1.0) * float(packagingPhotoRowCount - 1);
          int row = min(packagingPhotoRowCount - 2, int(floor(rowPosition)));
          vec4 top = packagingPhotoRows[row], bottom = packagingPhotoRows[row + 1];
          return mix(mix(top.xy, top.zw, uv.x), mix(bottom.xy, bottom.zw, uv.x), rowPosition - float(row));
        }
      ` + shader.fragmentShader;
    } else {
      shader.uniforms.packagingPhotoProjection = {value: new Matrix3().set(...projection!)};
      shader.fragmentShader = `
        uniform mat3 packagingPhotoProjection;
        vec2 projectedPackagingUv(vec2 uv) {
          vec3 point = packagingPhotoProjection * vec3(uv, 1.0);
          return point.xy / point.z;
        }
      ` + shader.fragmentShader;
    }
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
      ShaderChunk.map_fragment.replace(/vMapUv/g, 'projectedPackagingUv(vMapUv)'));
  };
  material.customProgramCacheKey = () => (rows ? 'packaging-photo-rows-v1/' : 'packaging-photo-projection-v1/') + cacheKey;
}
