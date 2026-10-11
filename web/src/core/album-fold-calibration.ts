import {BufferAttribute, DynamicDrawUsage, Mesh, Vector3} from 'three';
import type {BufferGeometry, Object3D} from 'three';

/** Compact only the existing single-CD cavity. The CD is translated, never scaled. */
export function compactPaperPocket(pocket: Object3D) {
  for (const object of pocket.children) {
    if (object.userData.pocketLip) object.position.y = .00183;
    else if (object.userData.pocketWall) {object.scale.y *= 1.68 / object.userData.wallHeight; object.position.y = .00099;}
    else if (object.name.startsWith('Inner_sleeve')) object.position.y = .00018;
    else if (typeof object.userData.discSlot === 'number') {
      object.traverse(mesh => {if (mesh instanceof Mesh) mesh.position.y -= .0009;});
    }
  }
}

/** Scale the crease centreline independently of its paper gauge. Small geometry
 * relief follows its own height profile; neither operation reads printed pixels.
 * Calibrated morphs are baked per paint, making normals and endpoint gauges
 * correct between exported keys as well as at every key and reverse takeover. */
export function calibrateFold(sheet: Object3D, joint: Object3D, factor: number, reliefMm: readonly number[] = []): () => void {
  const data = sheet.userData, length = data.foldLengthMm * .001, direction = data.foldDirection,
    bendSide = data.foldBendSide, flat = data.foldFlat, height = data.foldHeightMm * .001;
  const normal = new Vector3();
  const profile = (v: number) => {
    if (reliefMm.length < 3) return 0;
    const row = Math.max(0, Math.min(1, v)) * (reliefMm.length - 1), index = Math.min(reliefMm.length - 2, Math.floor(row));
    return (reliefMm[index] * (1 - row + index) + reliefMm[index + 1] * (row - index)) * .001;
  };
  const updates: (() => void)[] = [];
  sheet.traverse(mesh => {
    if (!(mesh instanceof Mesh)) return;
    const geometry = mesh.geometry as BufferGeometry, position = geometry.attributes.position as BufferAttribute;
    const basis = Float32Array.from(position.array), targets = (geometry.morphAttributes.position ?? []) as BufferAttribute[];
    const fractions = Array.from({length: position.count}, (_, i) => Math.max(0, Math.min(1, basis[i * 3] / (direction * length))));
    const reshape = (original: ArrayLike<number>, sample: number | null) => {
      const result = new Float32Array(basis.length);
      const angle = sample === null ? 0 : Math.PI - (flat ? Math.PI : Math.PI * 168 / 180) * sample / 8;
      for (let i = 0; i < position.count; i++) {
        const u = fractions[i], theta = angle * u;
        const centerX = direction * (flat ? length * u * Math.cos(angle / 2) : angle ? length / angle * Math.sin(theta) : length * u);
        const centerY = bendSide * (flat ? length * u * Math.sin(angle / 2) : angle ? length / angle * (1 - Math.cos(theta)) : 0);
        const tangent = flat && u > 0 && u < 1 ? angle / 2 : theta;
        const relief = profile(.5 - basis[i * 3 + 2] / height) * Math.sin(Math.PI * u) ** 2;
        result[i * 3] = original[i * 3] + centerX * (factor - 1) - bendSide * direction * Math.sin(tangent) * relief;
        result[i * 3 + 1] = original[i * 3 + 1] + centerY * (factor - 1) + Math.cos(tangent) * relief;
        result[i * 3 + 2] = original[i * 3 + 2];
      }
      return result;
    };
    const calibratedBasis = reshape(basis, null);
    const states = targets.map((target, sample) => {
      const absolute = Array.from({length: basis.length}, (_, i) => geometry.morphTargetsRelative ? basis[i] + target.array[i] : target.array[i]);
      const result = reshape(absolute, sample);
      return Float32Array.from(result, (value, i) => value - calibratedBasis[i]);
    });
    const shown = new BufferAttribute(new Float32Array(basis.length), 3).setUsage(DynamicDrawUsage);
    geometry.setAttribute('position', shown);
    // Animation still owns weights. Rendering/raycasting now sees only the exact
    // current surface, rather than adding the same morph twice on CPU and GPU.
    delete geometry.morphAttributes.position; delete geometry.morphAttributes.normal;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) if ('flatShading' in material) material.flatShading = true;
    updates.push(() => {
      for (let i = 0; i < shown.array.length; i++) {
        let value = calibratedBasis[i];
        for (let sample = 0; sample < states.length; sample++) value += states[sample][i] * (mesh.morphTargetInfluences?.[sample] ?? 0);
        shown.array[i] = value;
      }
      for (let i = 0; i < position.count; i++) if (fractions[i] < 1e-6 || fractions[i] > 1 - 1e-6) {
        normal.set(0, basis[i * 3 + 1], 0);
        if (fractions[i] > .5) normal.applyQuaternion(joint.quaternion).add(joint.position);
        shown.setXYZ(i, normal.x, normal.y, basis[i * 3 + 2]);
      }
      shown.needsUpdate = true; geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    });
  });
  return () => {for (const update of updates) update();};
}


/** Resize paper/holder geometry in its own frame, never a moving parent group.
 * This preserves circular CDs at every hinge angle, where inverse group scales
 * would still shear a rotated disc. Depth remains governed by the CD/crease fit. */
export function resizePaperShell(root: Object3D, widthScale: number, heightScale: number) {
  root.traverse(object => {
    for (let node: Object3D | null = object; node && node !== root; node = node.parent)
      if (typeof node.userData.discSlot === 'number') return;
    if (!object.userData.foldJoint) {object.position.x *= widthScale; object.position.z *= heightScale;}
    if (object.userData.foldSheet) object.userData.foldHeightMm *= heightScale;
    if (!(object instanceof Mesh)) return;
    let sheet: Object3D | null = object;
    while (sheet && !sheet.userData.foldSheet) sheet = sheet.parent;
    const geometry = object.geometry as BufferGeometry;
    const scale = (attribute: BufferAttribute) => {
      for (let i = 0; i < attribute.count; i++) attribute.setXYZ(i,
        attribute.getX(i) * (sheet ? 1 : widthScale), attribute.getY(i), attribute.getZ(i) * heightScale);
      attribute.needsUpdate = true;
    };
    scale(geometry.attributes.position as BufferAttribute);
    for (const attribute of geometry.morphAttributes.position ?? []) scale(attribute as BufferAttribute);
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  });
}
