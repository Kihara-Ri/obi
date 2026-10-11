import * as THREE from 'three';

export interface AlbumDiscPose {index: number; out: number; x: number; y: number}
export interface AlbumDiscHint {index: number; amount: number}
export interface DiscTravel {slide: number; lift: number; inspect: number}
const smooth = (n: number) => {const t = Math.max(0, Math.min(1, n)); return t * t * (3 - 2 * t);};

/** Withdraw through the holder's mouth, then bring the free disc towards the viewer. */
export function discTravel(out: number, pocket: boolean): DiscTravel {
  const withdrawal = smooth(out / .52);
  return {slide: pocket ? withdrawal : 0, lift: (pocket ? .018 : .025) * withdrawal,
    inspect: smooth((out - .52) / .48)};
}

interface Disc {
  index: number; object: THREE.Group; parent: THREE.Object3D; position: THREE.Vector3;
  quaternion: THREE.Quaternion; scale: THREE.Vector3; normal: THREE.Vector3;
  pocket: boolean; mouth: number; distance: number;
}

/** Disc pivots stay attached to their holders, including when a fold is moving. */
export class AlbumDiscs {
  private readonly discs: Disc[] = [];
  private readonly owners = new Map<THREE.Object3D, number>();
  private readonly point = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3();
  private readonly matrix = new THREE.Matrix4();
  private readonly desired = new THREE.Matrix4();

  constructor(root: THREE.Object3D, indexOf: (object: THREE.Object3D) => number,
              visible: (object: THREE.Object3D) => boolean, singlePocket = false) {
    root.updateMatrixWorld(true);
    const candidates: THREE.Object3D[] = [];
    root.traverse(object => {
      if (typeof object.userData.discSlot === 'number' && visible(object) && indexOf(object) >= 0) candidates.push(object);
    });
    for (const object of candidates) {
      const parent = object.parent!;
      const position = parent.worldToLocal(new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()));
      const pivot = new THREE.Group(); pivot.name = 'Inspectable_CD_' + (indexOf(object) + 1);
      pivot.quaternion.copy(object.quaternion); pivot.scale.copy(object.scale);
      const hubs = parent.children.filter(child => child.name.startsWith('Disc_translucent_hub')
        && parent.worldToLocal(new THREE.Box3().setFromObject(child).getCenter(new THREE.Vector3())).distanceTo(position) < .003);
      pivot.position.copy(position); parent.add(pivot); parent.updateMatrixWorld(true); pivot.attach(object);
      for (const hub of hubs) pivot.attach(hub);
      let holder: THREE.Object3D | null = parent;
      while (holder && !holder.userData.holder && !holder.userData.sleeveFront) holder = holder.parent;
      const pocket = holder?.userData.holder === 'pocket' || singlePocket;
      const mouth = holder?.userData.mouthSide ?? 1;
      const width = new THREE.Box3().setFromObject(parent).getSize(new THREE.Vector3()).x;
      const index = indexOf(object);
      pivot.traverse(child => this.owners.set(child, index));
      this.discs.push({index, object: pivot, parent, position, pocket, mouth,
        quaternion: pivot.quaternion.clone(), scale: pivot.scale.clone(),
        normal: new THREE.Vector3(0, 1, 0).applyQuaternion(pivot.quaternion),
        distance: Math.max(.13, width / 2 + .061 - mouth * position.x)});
    }
  }

  get indices(): number[] {return this.discs.map(disc => disc.index).sort((a, b) => a - b);}
  owner(object: THREE.Object3D): number | undefined {return this.owners.get(object);}

  /** Enlarge the small exposed edge to a 44 px touch target without a visible control. */
  gripAt(x: number, y: number, camera: THREE.Camera, width: number, height: number,
         radius = 22, preferred = -1): number | undefined {
    let chosen: number | undefined, nearest = radius * radius;
    const eye = camera.getWorldPosition(new THREE.Vector3());
    for (const disc of this.discs) {
      if (!disc.pocket) continue;
      const grip = disc.parent.localToWorld(new THREE.Vector3(disc.position.x + disc.mouth * .055, disc.position.y, disc.position.z));
      const normal = new THREE.Vector3(0, 1, 0).transformDirection(disc.parent.matrixWorld);
      if (normal.dot(eye.clone().sub(grip).normalize()) < .15) continue;
      const point = grip.project(camera);
      if (point.z < -1 || point.z > 1) continue;
      const squared = ((point.x + 1) * width / 2 - x) ** 2 + ((1 - point.y) * height / 2 - y) ** 2;
      // Keep the same pocket through a small boundary band while the case tilts.
      if (disc.index === preferred && squared <= (radius + 8) ** 2) return disc.index;
      if (squared <= nearest) {chosen = disc.index; nearest = squared;}
    }
    return chosen;
  }

  reset() {
    for (const disc of this.discs) {
      disc.object.position.copy(disc.position); disc.object.quaternion.copy(disc.quaternion); disc.object.scale.copy(disc.scale);
    }
  }

  paint(pose: AlbumDiscPose, distance: number, view?: {slope: number; aspect: number}, hint?: AlbumDiscHint) {
    const hinted = hint && this.discs.find(item => item.index === hint.index);
    const amount = hint ? Math.max(0, Math.min(1, hint.amount)) : 0;
    if (hinted && amount > 0 && (pose.index !== hinted.index || pose.out <= 0)) {
      // Paper pockets must stay flat; lifting here would cut through the lip.
      hinted.object.position.copy(hinted.position);
      if (hinted.pocket) hinted.object.position.x += hinted.mouth * .008 * amount;
      else hinted.object.position.addScaledVector(hinted.normal, .0024 * amount);
      hinted.object.updateMatrixWorld(true);
    }
    if (pose.index < 0 || pose.out <= 0) return;
    const disc = this.discs.find(item => item.index === pose.index);
    if (!disc) return;
    const travel = discTravel(pose.out, disc.pocket);
    disc.parent.updateWorldMatrix(true, false);
    const remainingHint = hinted === disc ? amount * (1 - smooth(pose.out / .52)) : 0;
    this.point.copy(disc.position);
    this.point.x += disc.mouth * (disc.distance * travel.slide + (disc.pocket ? .008 * remainingHint : 0));
    this.point.addScaledVector(disc.normal, travel.lift + (disc.pocket ? 0 : .0024 * remainingHint));
    this.point.applyMatrix4(disc.parent.matrixWorld);
    disc.object.getWorldQuaternion(this.rotation); disc.object.getWorldScale(this.scale);
    // The inspection pose is camera-facing, independent of the packaging's
    // rotation. Its silver reverse remains accessible by rotating the disc.
    const halfView = view ? view.slope * Math.min(1, view.aspect) * .84 : 0;
    const radius = .06 * Math.max(this.scale.x, this.scale.z);
    const fit = view ? Math.min(1.08, distance * .85 * halfView / radius) : 1.08;
    const inspectionDepth = view ? distance - radius * fit / halfView : distance * .15;
    this.point.lerp(new THREE.Vector3(0, 0, inspectionDepth), travel.inspect);
    const inspection = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      THREE.MathUtils.degToRad(-pose.x), THREE.MathUtils.degToRad(pose.y), 0))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
    this.rotation.slerp(inspection, travel.inspect);
    this.scale.multiplyScalar(1 + travel.inspect * (fit - 1));
    this.desired.compose(this.point, this.rotation, this.scale);
    this.matrix.copy(disc.parent.matrixWorld).invert().multiply(this.desired)
      .decompose(disc.object.position, disc.object.quaternion, disc.object.scale);
    disc.object.updateMatrixWorld(true);
  }
}
