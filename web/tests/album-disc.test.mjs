import assert from 'node:assert/strict';
import {after, test} from 'node:test';
import {mkdtempSync, rmSync, writeFileSync, symlinkSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const output = mkdtempSync(join(tmpdir(), 'diedu-disc-test-'));
const source = fileURLToPath(new URL('../src/', import.meta.url));
const program = ts.createProgram([join(source, 'core/album-disc.ts')], {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, strict: true, moduleResolution: ts.ModuleResolutionKind.Bundler,
  skipLibCheck: true, types: [], rootDir: source, outDir: output,
});
assert.equal(ts.getPreEmitDiagnostics(program).length, 0);
assert.equal(program.emit().emitSkipped, false);
writeFileSync(join(output, 'package.json'), '{"type":"module"}');
symlinkSync(fileURLToPath(new URL('../node_modules/', import.meta.url)), join(output, 'node_modules'));
const {AlbumDiscs, discTravel} = await import(pathToFileURL(join(output, 'core/album-disc.js')).href);
after(() => rmSync(output, {recursive: true, force: true}));

async function wallet() {
  const raw = await readFile(new URL('../../static/models/packaging/gatefold-2-inner.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '');
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const actions = gltf.animations.map(clip => {
    const action = mixer.clipAction(clip).play(); action.paused = true;
    action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; return action;
  });
  function fold(progress) {
    for (const action of actions) {action.enabled = true; action.time = action.getClip().duration * progress;}
    mixer.update(0); gltf.scene.updateMatrixWorld(true);
  }
  gltf.scene.traverse(object => {
    if (object.userData.holder) object.visible = object.userData.holder === 'pocket';
    if (typeof object.userData.discSlot === 'number') object.visible = object.userData.discSlot === 0;
  });
  const visible = object => {for (let node = object; node; node = node.parent) if (!node.visible) return false; return true;};
  const discs = new AlbumDiscs(gltf.scene, object => object.userData.panel, visible);
  return {root: gltf.scene, discs, fold};
}

test('取碟先经过袋口，再进入查看位置；动画中间位置连续可逆', () => {
  assert.deepEqual(discTravel(0, true), {slide: 0, lift: 0, inspect: 0});
  assert.deepEqual(discTravel(.52, true), {slide: 1, lift: .018, inspect: 0});
  assert.equal(discTravel(1, true).inspect, 1);
  assert.equal(discTravel(.3, false).slide, 0, 'tray discs lift instead of passing through a wall');
  let previous = discTravel(0, true);
  for (let i = 1; i <= 1000; i++) {
    const next = discTravel(i / 1000, true);
    for (const key of ['slide', 'lift', 'inspect']) {
      assert.ok(next[key] >= previous[key]); assert.ok(next[key] - previous[key] < .004);
    }
    previous = next;
  }
});

test('左右袋口取出方向相反，盘面和透明中心圈始终一同移动', async () => {
  const {root, discs, fold} = await wallet(); fold(1);
  assert.deepEqual(discs.indices, [0, 1]);
  for (const index of discs.indices) {
    discs.reset(); root.updateMatrixWorld(true);
    const pivot = root.getObjectByName('Inspectable_CD_' + (index + 1));
    const before = pivot.getWorldPosition(new THREE.Vector3());
    let hub; pivot.traverse(object => {if (object.name.startsWith('Clear_hub')) hub = object;});
    assert.ok(hub);
    const separation = hub.getWorldPosition(new THREE.Vector3()).distanceTo(before);
    discs.paint({index, out: .52, x: 0, y: 0}, .6);
    const after = pivot.getWorldPosition(new THREE.Vector3());
    assert.ok(index === 0 ? after.x > before.x + .12 : after.x < before.x - .12);
    assert.ok(Math.abs(hub.getWorldPosition(new THREE.Vector3()).distanceTo(after) - separation) < 1e-8);
    hub.traverse(object => assert.equal(discs.owner(object), index));
  }
});

test('反向取放恢复当时折页中的原位，反复绘制没有累积漂移', async () => {
  const {root, discs, fold} = await wallet();
  for (const open of [1, .63, 1, .31, 1]) {
    fold(open); discs.reset(); root.updateMatrixWorld(true);
    const pivot = root.getObjectByName('Inspectable_CD_1');
    const rest = pivot.matrixWorld.clone();
    for (const out of [0, .2, .6, 1, .6, .2, 0]) {
      discs.reset(); root.updateMatrixWorld(true); discs.paint({index: 0, out, x: 12, y: 175}, .6);
      root.updateMatrixWorld(true);
      if (out === 0) pivot.matrixWorld.elements.forEach((n, i) => assert.ok(Math.abs(n - rest.elements[i]) < 1e-8));
      const once = pivot.matrixWorld.clone();
      discs.reset(); root.updateMatrixWorld(true); discs.paint({index: 0, out, x: 12, y: 175}, .6);
      root.updateMatrixWorld(true);
      pivot.matrixWorld.elements.forEach((n, i) => assert.ok(Math.abs(n - once.elements[i]) < 1e-8));
    }
  }
});

test('纸袋悬停只沿相反袋口轻探出，盘体不抬穿纸面且移开后回到原位', async () => {
  const {root, discs, fold} = await wallet(); fold(1);
  for (const index of discs.indices) {
    const pivot = root.getObjectByName('Inspectable_CD_' + (index + 1));
    const rest = pivot.position.clone(), quaternion = pivot.quaternion.clone();
    for (const amount of [0, .3, .7, 1, .7, .3, 0, 1, 0]) {
      discs.reset(); discs.paint({index: -1, out: 0, x: 0, y: 0}, .6, undefined, {index, amount});
      const delta = pivot.position.clone().sub(rest);
      assert.ok(Math.abs(delta.x - (index === 0 ? .008 : -.008) * amount) < 1e-8);
      assert.equal(delta.y, 0); assert.equal(delta.z, 0); assert.ok(pivot.quaternion.equals(quaternion));
      const once = pivot.position.clone();
      discs.reset(); discs.paint({index: -1, out: 0, x: 0, y: 0}, .6, undefined, {index, amount});
      assert.ok(pivot.position.distanceTo(once) < 1e-8, 'hint does not drift on repeated paints');
    }
  }
});

test('点击从纸袋探出的当前姿态继续取出，没有回原位的跳切', async () => {
  const {root, discs, fold} = await wallet(); fold(1);
  const pivot = root.getObjectByName('Inspectable_CD_1');
  for (const out of [0, .0001, .2, .52, 1, .52, .2, 0]) {
    discs.reset(); root.updateMatrixWorld(true);
    discs.paint({index: 0, out, x: 0, y: 0}, .6, undefined, {index: 0, amount: 1});
    const hinted = pivot.position.clone();
    discs.reset(); root.updateMatrixWorld(true); discs.paint({index: 0, out, x: 0, y: 0}, .6);
    const delta = hinted.clone().sub(pivot.position);
    if (out === 0 || out === .0001) assert.ok(delta.x > .00799, 'early takeout retains the visible peek');
    if (out >= .52) assert.ok(delta.length() < 1e-8, 'hint fully merges into takeout before inspection');
    assert.ok(Math.abs(delta.y) + Math.abs(delta.z) < 1e-8);
  }
});

test('托盘悬停沿各自印刷面的法线轻抬，包括翻转托盘背侧的 CD', async () => {
  for (const asset of ['jewel-case', 'jewel-swing-2']) {
    const raw = await readFile(new URL('../../static/models/packaging/' + asset + '.glb', import.meta.url));
    const gltf = await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '');
    const discs = new AlbumDiscs(gltf.scene, object => object.userData.discSlot, () => true);
    for (const index of discs.indices) {
      const pivot = gltf.scene.getObjectByName('Inspectable_CD_' + (index + 1));
      const rest = pivot.position.clone();
      const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(pivot.quaternion);
      for (const amount of [0, .4, 1, .4, 0]) {
        discs.reset(); discs.paint({index: -1, out: 0, x: 0, y: 0}, .6, undefined, {index, amount});
        const delta = pivot.position.clone().sub(rest);
        assert.ok(Math.abs(delta.dot(normal) - .0024 * amount) < 1e-8);
        assert.ok(delta.clone().cross(normal).length() < 1e-8, 'no lateral slide through tray walls');
      }
    }
  }
});

test('内外折脊使用独立印刷面，纸边没有书脊文字', async () => {
  const {root, fold} = await wallet(); fold(1);
  const sheet = root.getObjectByName('Paper_fold_0');
  const names = new Set(); sheet.traverse(object => {
    if (!object.isMesh) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) names.add(material.name.split('.')[0]);
  });
  assert.ok(names.has('Print_spine')); assert.ok(names.has('Print_insideSpine')); assert.ok(names.has('Paper_Cut'));
});

test('扫描白底不覆盖透明夹持圈，15 mm 孔贯穿盘体', async () => {
  const {root, fold} = await wallet(); fold(1);
  const pivot = root.getObjectByName('Inspectable_CD_1');
  const meshes = []; pivot.traverse(object => {if (object.isMesh) meshes.push(object);});
  root.updateMatrixWorld(true);
  const probe = x => {
    const origin = pivot.localToWorld(new THREE.Vector3(x, .01, 0));
    const direction = new THREE.Vector3(0, -1, 0).transformDirection(pivot.matrixWorld);
    return new THREE.Raycaster(origin, direction).intersectObjects(meshes, false);
  };
  assert.equal(probe(0).length, 0);
  const hub = probe(.01); assert.ok(hub.length > 0);
  assert.ok(hub.every(hit => hit.object.material.name.startsWith('Tray_Clear')), 'hub stays physical clear material');
  assert.ok(probe(.04).some(hit => hit.object.material.name.startsWith('Print_disc')), 'real label artwork covers the printed ring');
});

test('双袋纸脊参考宽度贴合展开比例，闭合后两张 CD 仍有间隙', async () => {
  const {root, fold} = await wallet(); fold(0);
  const sheet = root.getObjectByName('Paper_fold_0');
  assert.equal(sheet.userData.foldGap, 4.6);
  const nominal = root.children.find(child => child.userData.nominal_mm).userData.nominal_mm;
  assert.ok(sheet.userData.foldGap / nominal[1] > .035 && sheet.userData.foldGap / nominal[1] < .039);
  const right = new THREE.Box3().setFromObject(root.getObjectByName('Inspectable_CD_2'));
  const left = new THREE.Box3().setFromObject(root.getObjectByName('Inspectable_CD_1'));
  assert.ok(left.min.y - right.max.y > .001, 'closed discs do not intersect');
});

test('双面翻转托盘的两张 CD 取出后均朝印刷面，托盘不残留旧中心圈', async () => {
  const raw = await readFile(new URL('../../static/models/packaging/jewel-swing-2.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '');
  const discs = new AlbumDiscs(gltf.scene, object => object.userData.discSlot, () => true);
  assert.deepEqual(discs.indices, [0, 1]);
  assert.equal(gltf.scene.getObjectByName('Disc_translucent_hub'), undefined);
  for (const index of discs.indices) {
    discs.reset(); gltf.scene.updateMatrixWorld(true); discs.paint({index, out: 1, x: 0, y: 0}, .6);
    gltf.scene.updateMatrixWorld(true);
    const pivot = gltf.scene.getObjectByName('Inspectable_CD_' + (index + 1));
    let checked = 0;
    pivot.traverse(object => {
      if (!object.isMesh || !object.material.name.startsWith('Print_disc')) return;
      const normal = new THREE.Vector3().fromBufferAttribute(object.geometry.attributes.normal, 0).transformDirection(object.matrixWorld);
      assert.ok(normal.z > .99, 'printed face looks towards inspection camera'); checked++;
    });
    assert.ok(checked > 0);
  }
});
