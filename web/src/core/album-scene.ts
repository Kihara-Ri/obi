/** Loaded only by the focused lightbox. No shared renderer, cache or mutable singleton. */
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import type {AlbumRecord, PackagingPhotoRole} from '../types';
import type {AlbumPackaging} from './album-packaging';
import {albumModelAsset, albumPanelDiscs, albumTextureSource} from './album-model-assets';
import {filterSpineRibs, type SpineRibs} from './album-rib-material';
import {projectPackagingPhoto} from './album-photo-material';
import {photoProjection, photoTextureCrop, photoWarpPoint} from './album-photo-projection';
import {spineCalibrationFit} from './album-spine-fit';
import {calibrateFold, compactPaperPocket, resizePaperShell} from './album-fold-calibration';
import {paperGrain} from './album-paper-material';
import {AlbumDiscs, type AlbumDiscPose, type AlbumDiscHint} from './album-disc';
import {discAnisotropy, discDiffraction} from './album-disc-material';

export interface AlbumScenePose {x: number; y: number; open: number; zoom: number; disc: AlbumDiscPose; hint: AlbumDiscHint}

export class AlbumScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly world = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(36, 1, .002, 5);
  private readonly spin = new THREE.Group();
  private readonly conversion = new THREE.Group();
  private readonly environmentMap: THREE.WebGLRenderTarget;
  private readonly abort = new AbortController();
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly materials = new Set<THREE.Material>();
  private readonly textures = new Set<THREE.Texture>();
  private readonly photoBitmaps = new Map<string, Promise<ImageBitmap>>();
  private readonly decodedPhotos = new Set<ImageBitmap>();
  private readonly assets: THREE.Object3D[] = [];
  private readonly mixers: {mixer: THREE.AnimationMixer; actions: THREE.AnimationAction[]}[] = [];
  private readonly folds: {object: THREE.Object3D; factor: number; position: THREE.Vector3}[] = [];
  private readonly visibleMeshes: THREE.Mesh[] = [];
  private readonly calibratedFolds: (() => void)[] = [];
  private readonly box = new THREE.Box3();
  private readonly center = new THREE.Vector3();
  private readonly size = new THREE.Vector3();
  private readonly mouse = new THREE.Vector2();
  private readonly ray = new THREE.Raycaster();
  private readonly observer: ResizeObserver;
  private slip: THREE.Group | null = null;
  private discs: AlbumDiscs | null = null;
  private discDirections: THREE.Texture | null = null;
  private disposed = false;
  private ready = false;
  private pose: AlbumScenePose = {x: -8, y: -16, open: 0, zoom: 1, disc: {index: -1, out: 0, x: 0, y: 0}, hint: {index: -1, amount: 0}};
  private slipWidth = .15;
  private slipHeight = .15;

  constructor(private readonly stage: HTMLElement, canvas: HTMLCanvasElement,
              private readonly record: AlbumRecord, private readonly model: AlbumPackaging) {
    this.renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = .9;
    const environment = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environmentMap = pmrem.fromScene(environment, .025);
    environment.dispose(); pmrem.dispose();
    this.world.environment = this.environmentMap.texture;
    this.world.environmentIntensity = .5;
    this.world.add(this.spin);
    this.conversion.rotation.x = Math.PI / 2;
    this.spin.add(this.conversion);
    const light = new THREE.DirectionalLight(0xffffff, .35);
    light.position.set(-.3, .5, .5);
    this.world.add(light, new THREE.AmbientLight(0xffffff, .12));
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(stage);
    this.resize();
  }

  async load(): Promise<void> {
    const asset = await this.loadAsset(albumModelAsset(this.model, !!this.record.modelCalibration));
    if (this.disposed) return;
    this.conversion.add(asset);
    const root = asset.children.find(child => Array.isArray(child.userData.nominal_mm));
    const nominal: number[] = root?.userData.nominal_mm ?? [135, 135, 2];
    const measured = this.record.packaging?.size;
    // glTF is Y-up: scale axes before converting back to the printed XY plane.
    if (measured) {
      if (spineCalibrationFit(this.record)) resizePaperShell(asset, measured.width / nominal[0], measured.height / nominal[1]);
      else this.conversion.scale.set(measured.width / nominal[0], measured.depth / nominal[2], measured.height / nominal[1]);
    }
    this.configure(asset);
    if (this.model.slipcase) {
      const outside = await this.loadAsset('/models/packaging/slipcase.glb');
      if (this.disposed) return;
      this.configure(outside, true);
      this.slip = new THREE.Group();
      this.slip.scale.set((nominal[0] + 2) / 150, (nominal[2] + 1.8) / 30, (nominal[1] + 2) / 150);
      this.slip.add(outside); this.conversion.add(this.slip);
      this.slipWidth = (nominal[0] + 5) * .001;
      this.slipHeight = (nominal[1] + 4) * .001;
    }
    await this.applyTextures();
    if (this.disposed) return;
    this.discs = new AlbumDiscs(asset, object => this.discIndex(object), object => this.isVisible(object), this.model.kind === 'card-sleeve');
    this.conversion.traverse(object => {
      if (object instanceof THREE.Mesh && this.isVisible(object)) this.visibleMeshes.push(object);
    });
    this.ready = true;
    this.stage.dataset.modelAsset = albumModelAsset(this.model, !!this.record.modelCalibration);
    this.stage.dataset.renderer = 'webgl'; this.stage.dataset.ready = 'true';
    this.paint(this.pose);
  }

  private async loadAsset(url: string): Promise<THREE.Group> {
    const response = await fetch(url, {signal: this.abort.signal});
    if (!response.ok) throw new Error('Packaging model unavailable');
    const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), '/models/packaging/');
    this.assets.push(gltf.scene);
    gltf.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      this.geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) this.materials.add(material);
    });
    if (this.disposed) {this.releaseAssets(); throw new Error('Viewer closed');}
    if (gltf.animations.length) {
      const mixer = new THREE.AnimationMixer(gltf.scene);
      const actions = gltf.animations.map(clip => {
        const action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true;
        action.play(); action.paused = true;
        return action;
      });
      this.mixers.push({mixer, actions});
    }
    return gltf.scene;
  }

  private isVisible(object: THREE.Object3D): boolean {
    for (let item: THREE.Object3D | null = object; item; item = item.parent) if (!item.visible) return false;
    return true;
  }

  private configure(asset: THREE.Object3D, outside = false) {
    const fit = spineCalibrationFit(this.record);
    const calibratedSheets: THREE.Object3D[] = [];
    asset.traverse(object => {
      const extras = object.userData;
      const stack = Math.max(0, albumPanelDiscs(this.model, extras.panel ?? object.parent?.userData.panel ?? 1).length - 1) * .00125;
      if (extras.pocketLip) object.position.y += stack;
      if (extras.pocketWall) {object.scale.y *= 1 + stack / ((extras.wallHeight ?? 2.5) * .001); object.position.y += stack / 2;}
      if (extras.sleeveFront) object.position.y += stack;
      if (extras.sleeveWall) {object.scale.y *= 1 + stack / .0032; object.position.y += stack / 2;}
      if (extras.foldSheet || extras.foldJoint) {
        const holderDepth = (panel: number) => {
          const count = albumPanelDiscs(this.model, panel).length;
          return count ? (this.model.holder === 'pocket'
            ? (this.model.kind === 'gatefold' && this.model.pocketOpening === 'inner' ? 2.07 : 3.8) + (count - 1) * 1.25
            : 4.8 + (count - 1) * 1.8) : 0;
        };
        const needed = extras.foldIndex === 0 ? Array.from({length: this.model.panels}, (_, panel) => holderDepth(panel)).reduce((a, b) => a + b,
          this.model.kind === 'gatefold' && this.model.pocketOpening === 'inner' ? .12 : .7)
          : holderDepth(extras.foldIndex + 1) + holderDepth(1) + .7;
        const calibrated = fit && extras.foldIndex === 0;
        const factor = calibrated ? fit.factor : Math.max(1, needed / extras.foldGap);
        if (extras.foldSheet) {
          if (calibrated) calibratedSheets.push(object);
          else {object.scale.x *= factor; object.scale.y *= factor;}
        } else this.folds.push({object, factor, position: object.position.clone()});
      }
      if (extras.holder) {
        const expected = this.model.kind === 'jewel' ? 'tray' : this.model.holder;
        object.visible = extras.holder === expected && albumPanelDiscs(this.model, extras.panel).length > 0;
        if (object.visible && extras.holder === 'pocket' && fit?.compactPockets) compactPaperPocket(object);
      }
      if (extras.extraDisc) object.visible = albumPanelDiscs(this.model, extras.panel).length > 1;
      if (typeof extras.discSlot === 'number') object.visible = this.discIndex(object) >= 0;
      if (!(object instanceof THREE.Mesh)) return;
      const dimensions = new THREE.Box3().setFromBufferAttribute(object.geometry.attributes.position as THREE.BufferAttribute)
        .getSize(new THREE.Vector3());
      const originals = Array.isArray(object.material) ? object.material : [object.material];
      const next = originals.map(original => {
        const material = original as THREE.MeshStandardMaterial;
        let clone = material.clone();
        const print = /^Print_([^\.]+)/.exec(material.name)?.[1];
        if (print) {
          let role = print as PackagingPhotoRole;
          if (role === 'disc') {
            let item: THREE.Object3D | null = object;
            while (item && typeof item.userData.discSlot !== 'number') item = item.parent;
            const index = item ? Math.max(0, this.discIndex(item)) : 0;
            role = index === 0 ? 'disc' : ('disc' + (index + 1)) as PackagingPhotoRole;
          }
          const ratio = (role === 'spine' && !object.morphTargetInfluences?.length ? dimensions.y : dimensions.x) / Math.max(.00001, dimensions.z);
          clone.userData = {role, outside, ratio};
          clone.roughness = role.startsWith('disc') ? .42 : this.model.finish === 'uncoated' ? .86 : this.model.finish === 'gloss' ? .24 : .66;
        }
        if (/Tray_Graphite/.test(material.name) && this.model.tray !== 'black') {
          clone = new THREE.MeshPhysicalMaterial({name: material.name,
            color: this.model.tray === 'white' ? 0xd8d8d2 : 0xf4f9fc,
            roughness: this.model.tray === 'white' ? .42 : .12,
            transmission: this.model.tray === 'clear' ? .94 : 0, ior: 1.59});
        }
        if (/Disc_Aluminium/.test(material.name)) {
          if (!this.discDirections) {this.discDirections = discAnisotropy(); this.textures.add(this.discDirections);}
          const reflector = new THREE.MeshPhysicalMaterial({name: material.name, color: material.color,
            roughness: .12, metalness: 1, anisotropy: .85, anisotropyMap: this.discDirections,
            iridescence: .45, iridescenceIOR: 1.35, envMapIntensity: 1.3});
          discDiffraction(reflector); clone = reflector;
        }
        if (/Tray_Graphite_Ribbed/.test(material.name)) {
          let surface: THREE.Object3D | null = object;
          while (surface && !surface.userData.ribbedSpine) surface = surface.parent;
          if (surface) filterSpineRibs(clone, surface.userData as SpineRibs, this.renderer.getPixelRatio());
        }
        if (fit && (/^Paper_/.test(material.name) || print && !print.startsWith('disc'))) {
          let fold: THREE.Object3D | null = object;
          while (fold && !fold.userData.foldSheet) fold = fold.parent;
          paperGrain(clone, [fold?.userData.foldLengthMm ? fold.userData.foldLengthMm * (fold.userData.foldIndex === 0 ? fit.factor : 1) : dimensions.x * 1000,
            fold?.userData.foldHeightMm ?? dimensions.z * 1000], this.model.finish, this.renderer.getPixelRatio());
        }
        this.materials.add(clone);
        return clone;
      });
      object.material = Array.isArray(object.material) ? next : next[0];
    });
    for (const sheet of calibratedSheets) {
      const joint = sheet.parent?.children.find(object => object.userData.foldJoint && object.userData.foldIndex === sheet.userData.foldIndex);
      if (joint) this.calibratedFolds.push(calibrateFold(sheet, joint, fit!.factor, this.record.modelCalibration?.spine.reliefMm));
    }
    if (fit && !outside) {
      this.stage.dataset.spineCalibration = fit.status;
      this.stage.dataset.spineRequestedMm = fit.requestedMm.toFixed(3);
      this.stage.dataset.spineAppliedMm = fit.appliedMm.toFixed(3);
      this.stage.dataset.spineBasis = fit.basis;
    }
  }

  private discIndex(object: THREE.Object3D): number {
    let slot = object.userData.discSlot as number;
    if (this.model.label.startsWith('Multi-CD')) {
      let rear = false;
      for (let node: THREE.Object3D | null = object; node; node = node.parent) if (node.userData.rearChamber) rear = true;
      const frontCount = Math.ceil(this.model.discs / 2);
      if (rear) {slot -= 2; return slot < this.model.discs - frontCount ? slot + frontCount : -1;}
      return slot < frontCount ? slot : -1;
    }
    return albumPanelDiscs(this.model, object.userData.panel ?? 1)[slot] ?? -1;
  }

  private placeholder(role: PackagingPhotoRole, failed: boolean): THREE.CanvasTexture | null {
    if (role.startsWith('disc') || role === 'spine' || role === 'insideSpine') return null;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const swatch = document.createElement('span'); swatch.className = 'album-surface-note'; swatch.hidden = true;
    this.stage.append(swatch);
    const colors = getComputedStyle(swatch), background = colors.backgroundColor, foreground = colors.color;
    swatch.remove();
    context.fillStyle = background; context.fillRect(0, 0, 512, 512);
    context.fillStyle = foreground; context.font = '22px sans-serif'; context.textAlign = 'center';
    const text = failed ? '贴图载入失败' : role === 'front' ? '暂无封面'
      : role === 'back' ? '示意背面' : role === 'outer' ? '示意外套' : '示意中面';
    context.fillText(text, 256, 267);
    const texture = new THREE.CanvasTexture(canvas);
    texture.flipY = false; texture.colorSpace = THREE.SRGBColorSpace;
    this.textures.add(texture);
    return texture;
  }

  private async texture(role: PackagingPhotoRole): Promise<THREE.Texture | null> {
    const source = albumTextureSource(this.record, role);
    if (!source) return this.placeholder(role, false);
    try {
      if (!this.photoBitmaps.has(source)) this.photoBitmaps.set(source, (async () => {
        const response = await fetch(source, {signal: this.abort.signal});
        if (!response.ok) throw new Error('Photograph unavailable');
        const bitmap = await createImageBitmap(await response.blob());
        if (this.disposed) {bitmap.close(); throw new Error('Viewer closed');}
        this.decodedPhotos.add(bitmap); return bitmap;
      })());
      const original = await this.photoBitmaps.get(source)!;
      let bitmap = original;
      if (this.disposed) return null;
      let region: readonly number[] | undefined = this.record.packaging?.photoRegions?.[role];
      let warpRows: readonly (readonly number[])[] | undefined = this.record.modelWarpRows?.[role];
      // Crop each face's whole curved ROI in memory. Original source pixels and
      // task assets remain untouched; narrow spines get their own GPU budget.
      const crop = photoTextureCrop(bitmap.width, bitmap.height, region, warpRows);
      if (crop) {
        bitmap = await createImageBitmap(bitmap, crop.x, crop.y, crop.width, crop.height);
        region = crop.region; warpRows = crop.warpRows;
      }
      const limit = this.stage.clientWidth < 600 ? 1024 : 1536;
      const scale = Math.min(1, limit / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      // Halftone print scans alias when a large photograph is reduced in one
      // bilinear step. Filter at each half-size before the final GPU texture.
      let input: ImageBitmap | HTMLCanvasElement = bitmap;
      while (input.width > canvas.width * 2 || input.height > canvas.height * 2) {
        const half = document.createElement('canvas');
        half.width = Math.max(1, Math.ceil(input.width / 2)); half.height = Math.max(1, Math.ceil(input.height / 2));
        const context = half.getContext('2d')!; context.imageSmoothingQuality = 'high';
        context.drawImage(input, 0, 0, half.width, half.height);
        if (input instanceof HTMLCanvasElement) input.width = input.height = 1;
        input = half;
      }
      const context = canvas.getContext('2d')!; context.imageSmoothingQuality = 'high';
      context.drawImage(input, 0, 0, canvas.width, canvas.height);
      if (input instanceof HTMLCanvasElement) input.width = input.height = 1;
      if (bitmap !== original) bitmap.close();
      const texture = new THREE.CanvasTexture(canvas);
      texture.flipY = false; texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
      texture.userData.photoSource = true;
      texture.userData.photoRegion = region;
      texture.userData.photoWarpRows = warpRows;
      this.textures.add(texture);
      return texture;
    } catch {return this.disposed ? null : this.placeholder(role, true);}
  }

  private async applyTextures() {
    const active = new Set<THREE.MeshStandardMaterial>();
    this.conversion.traverse(object => {
      if (!(object instanceof THREE.Mesh) || !this.isVisible(object)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        if (material instanceof THREE.MeshStandardMaterial && material.userData.role) active.add(material);
    });
    const printed = [...active];
    const roles = [...new Set(printed.map(material => material.userData.role as PackagingPhotoRole))];
    // A spread photograph can supply several calibrated faces. Decode it once
    // per lightbox; each printed material keeps its own projection matrix.
    const sources = new Map<string, Promise<THREE.Texture | null>>();
    const loaded = await Promise.all(roles.map(async role => {
      const source = albumTextureSource(this.record, role);
      if (!source) return [role, this.placeholder(role, false)] as const;
      const key = source + '/' + JSON.stringify([this.record.packaging?.photoRegions?.[role] ?? null, this.record.modelWarpRows?.[role] ?? null]);
      if (!sources.has(key)) sources.set(key, this.texture(role));
      const texture = await sources.get(key)!;
      return [role, texture?.userData.photoSource ? texture : this.disposed ? null : this.placeholder(role, true)] as const;
    }));
    for (const bitmap of this.decodedPhotos) bitmap.close(); this.decodedPhotos.clear(); this.photoBitmaps.clear();
    if (this.disposed) {this.releaseAssets(); return;}
    const maps = new Map(loaded);
    // A calibrated spread includes the exposed paper at its centre fold. Use
    // its diffuse colour for the unprinted bag lining and cut/glued edges.
    const spineRole = this.record.modelTextures?.insideSpine || this.record.packaging?.photos?.insideSpine !== undefined ? 'insideSpine' : 'spine';
    const spineSource = albumTextureSource(this.record, spineRole);
    const paperReference = maps.get(spineRole);
    const spineRegion = paperReference?.userData.photoRegion ?? this.record.packaging?.photoRegions?.[spineRole];
    const spineRows = paperReference?.userData.photoWarpRows;
    if (this.model.kind === 'gatefold' && this.model.pocketOpening === 'inner' && !this.model.slipcase
        && (spineRegion || spineRows) && paperReference?.userData.photoSource
        && spineSource === albumTextureSource(this.record, 'insideLeft')
        && spineSource === albumTextureSource(this.record, 'insideRight')) {
      const projection = spineRegion ? photoProjection(spineRegion) : null;
      const photograph = paperReference.image as HTMLCanvasElement;
      const context = photograph.getContext('2d');
      if ((projection || spineRows) && context) {
        const channels: number[][] = [[], [], []];
        for (let y = 1; y <= 5; y++) for (let x = 1; x <= 5; x++) {
          const u = x / 6, v = y / 6, q = projection ? projection[6] * u + projection[7] * v + 1 : 1;
          const point = spineRows ? photoWarpPoint(spineRows, u, v) : projection ?
            [(projection[0] * u + projection[1] * v + projection[2]) / q, (projection[3] * u + projection[4] * v + projection[5]) / q] : null;
          if (!point) continue;
          const px = Math.min(photograph.width - 1, Math.max(0, Math.round(point[0] * photograph.width)));
          const py = Math.min(photograph.height - 1, Math.max(0, Math.round(point[1] * photograph.height)));
          const sample = context.getImageData(px, py, 1, 1).data;
          channels.forEach((channel, i) => channel.push(sample[i]));
        }
        const [r, g, b] = channels.map(channel => channel.sort((a, b) => a - b)[12] / 255);
        const color = new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
        for (const material of this.materials) if (material instanceof THREE.MeshStandardMaterial && /^Paper_(Cut|Wrap)/.test(material.name))
          material.color.copy(color);
      }
    }
    for (const material of printed) {
      const role = material.userData.role as PackagingPhotoRole;
      const source = maps.get(role);
      material.map = source?.clone() ?? null;
      if (material.map) {
        const image = source!.image as HTMLCanvasElement;
        const ratio = image.width / image.height, target = material.userData.ratio;
        const region = source!.userData.photoRegion, rows = source!.userData.photoWarpRows;
        if ((region || rows) && source!.userData.photoSource) projectPackagingPhoto(material, region, rows);
        else if (ratio > target) {material.map.repeat.x = target / ratio; material.map.offset.x = (1 - material.map.repeat.x) / 2;}
        else {material.map.repeat.y = ratio / target; material.map.offset.y = (1 - material.map.repeat.y) / 2;}
        material.map.needsUpdate = true; this.textures.add(material.map);
      }
      material.color.setRGB(1, 1, 1);
      if (!material.map) material.color.setRGB(role === 'insideSpine' ? .72 : role.startsWith('disc') ? .6 : .3,
        role === 'insideSpine' ? .69 : role.startsWith('disc') ? .63 : .31, role === 'insideSpine' ? .61 : role.startsWith('disc') ? .65 : .3);
      material.needsUpdate = true;
    }
  }

  paint(pose: AlbumScenePose) {
    this.pose = {...pose, disc: {...pose.disc}, hint: {...pose.hint}};
    if (!this.ready || this.disposed || document.hidden) return;
    const progress = this.model.slipcase ? Math.max(0, (pose.open - .45) / .55) : pose.open;
    // PropertyMixer may skip writing an unchanged track. Restore its unscaled
    // value before updating, so repeated hover/resize paints never accumulate.
    for (const fold of this.folds) fold.object.position.copy(fold.position);
    for (const {mixer, actions} of this.mixers) {
      for (const action of actions) {action.enabled = true; action.time = action.getClip().duration * progress;}
      mixer.update(0);
    }
    for (const fold of this.folds) {
      fold.position.copy(fold.object.position);
      fold.object.position.x *= fold.factor; fold.object.position.y *= fold.factor;
    }
    for (const update of this.calibratedFolds) update();
    if (this.slip) {
      this.slip.position.x = -this.slipWidth * Math.min(1, pose.open / .25);
      // Set the extracted sleeve below the hinge sweep before opening the case.
      this.slip.position.z = this.slipHeight * 1.05 * Math.max(0, Math.min(1, (pose.open - .25) / .2));
    }
    this.discs?.reset();
    this.spin.position.set(0, 0, 0);
    this.spin.rotation.set(THREE.MathUtils.degToRad(-pose.x), THREE.MathUtils.degToRad(pose.y), 0);
    this.spin.updateMatrixWorld(true); this.box.makeEmpty();
    // Morph bounding boxes union every possible bend. Only the small spine
    // grids need precise current vertices; rigid parts keep their cheap bounds.
    for (const mesh of this.visibleMeshes) this.box.expandByObject(mesh, !!mesh.morphTargetInfluences?.length);
    if (this.box.isEmpty()) return;
    this.box.getCenter(this.center); this.box.getSize(this.size);
    this.spin.position.copy(this.center).multiplyScalar(-1);
    const slope = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const distance = (Math.max(this.size.x / (slope * this.camera.aspect), this.size.y / slope) * .57 + this.size.z * .5) / pose.zoom;
    this.camera.position.set(0, 0, distance);
    this.camera.near = Math.max(.002, distance * .12); this.camera.far = distance + this.size.length() * 2;
    this.camera.updateProjectionMatrix(); this.camera.lookAt(0, 0, 0); this.camera.updateMatrixWorld(true);
    this.spin.updateMatrixWorld(true);
    this.discs?.paint(pose.disc, distance * pose.zoom, {slope, aspect: this.camera.aspect}, pose.hint);
    this.renderer.render(this.world, this.camera);
    this.stage.dataset.progress = pose.open.toFixed(5);
    this.stage.dataset.yaw = pose.y.toFixed(3); this.stage.dataset.pitch = pose.x.toFixed(3);
    this.stage.dataset.disc = pose.disc.out > 0 ? String(pose.disc.index + 1) : '';
    this.stage.dataset.discProgress = pose.disc.out.toFixed(5);
    this.stage.dataset.discYaw = pose.disc.y.toFixed(3);
    this.stage.dataset.discHint = pose.hint.amount > 0 ? String(pose.hint.index + 1) : '';
    this.stage.dataset.discHintProgress = pose.hint.amount.toFixed(5);
  }

  get discIndices(): number[] {return this.discs?.indices ?? [];}

  /** Only reachable CDs react; pocket proximity uses a fixed holder anchor. */
  hoverDisc(x: number, y: number, preferred = -1): number | undefined {
    if (this.pose.disc.out > .001 || (this.model.canOpen && this.pose.open < 1)) return undefined;
    return this.pick(x, y, 34, preferred)?.disc;
  }

  pick(x: number, y: number, gripRadius = 22, preferred = -1): {disc?: number} | null {
    if (!this.ready || this.disposed) return null;
    const rect = this.stage.getBoundingClientRect();
    this.mouse.set((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2);
    this.ray.setFromCamera(this.mouse, this.camera);
    const reachable = !this.model.canOpen || this.pose.open > .9;
    const grip = reachable && this.pose.disc.out < .001
      ? this.discs?.gripAt(x - rect.left, y - rect.top, this.camera, rect.width, rect.height, gripRadius, preferred) : undefined;
    const hits = this.ray.intersectObjects(this.visibleMeshes, false);
    for (const hit of hits) {
      const disc = this.discs?.owner(hit.object);
      if (disc !== undefined && reachable) return {disc};
      const materials = (hit.object as THREE.Mesh).material;
      const material = Array.isArray(materials) ? materials[hit.face?.materialIndex ?? 0] : materials;
      if (material instanceof THREE.MeshPhysicalMaterial && material.transmission > .8) continue;
      return grip !== undefined ? {disc: grip} : {};
    }
    return grip !== undefined ? {disc: grip} : hits.length ? {} : null;
  }
  hits(x: number, y: number): boolean {return this.pick(x, y) !== null;}

  private resize() {
    const {clientWidth: width, clientHeight: height} = this.stage;
    if (!width || !height || this.disposed) return;
    this.renderer.setSize(width, height, false); this.camera.aspect = width / height; this.paint(this.pose);
  }

  private releaseAssets() {
    for (const geometry of this.geometries) geometry.dispose(); this.geometries.clear();
    for (const material of this.materials) material.dispose(); this.materials.clear();
    for (const texture of this.textures) texture.dispose(); this.textures.clear();
    for (const bitmap of this.decodedPhotos) bitmap.close(); this.decodedPhotos.clear(); this.photoBitmaps.clear();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.abort.abort(); this.observer.disconnect();
    for (const {mixer} of this.mixers) {mixer.stopAllAction(); for (const asset of this.assets) mixer.uncacheRoot(asset);}
    this.calibratedFolds.length = 0; this.releaseAssets(); this.environmentMap.dispose();
    this.world.clear(); this.renderer.dispose(); this.renderer.forceContextLoss();
  }
}
