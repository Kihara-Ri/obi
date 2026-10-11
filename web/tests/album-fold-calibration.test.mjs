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
const output = mkdtempSync(join(tmpdir(), 'diedu-fold-calibration-'));
const source = fileURLToPath(new URL('../src/', import.meta.url));
const sourcePath = join(source, 'core/album-fold-calibration.ts');
let calibrateFold, spineCalibrationFit, compactPaperPocket, resizePaperShell;
try {
  const program = ts.createProgram([sourcePath, join(source, 'core/album-spine-fit.ts')], {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022,
    moduleResolution: ts.ModuleResolutionKind.Bundler, strict: true, skipLibCheck: true, types: [], rootDir: source, outDir: output});
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {getCurrentDirectory: () => source, getCanonicalFileName: name => name, getNewLine: () => '\n'}));
  assert.equal(program.emit().emitSkipped, false);
  writeFileSync(join(output, 'package.json'), '{"type":"module"}');
  symlinkSync(fileURLToPath(new URL('../node_modules', import.meta.url)), join(output, 'node_modules'), 'dir');
  ({calibrateFold, compactPaperPocket, resizePaperShell} = await import(pathToFileURL(join(output, 'core/album-fold-calibration.js')).href));
  // The fit helper and its two pure dependencies emit extensionless imports.
  for (const name of ['album-spine-fit', 'album-model-assets', 'album-packaging']) {
    const path = join(output, 'core', name + '.js');
    const {readFileSync} = await import('node:fs');
    writeFileSync(path, readFileSync(path, 'utf8').replace(/from '(\.[^']+)'/g, "from '$1.js'"));
  }
  ({spineCalibrationFit} = await import(pathToFileURL(join(output, 'core/album-spine-fit.js')).href));
} catch (error) {rmSync(output, {recursive: true, force: true}); throw error;}
after(() => rmSync(output, {recursive: true, force: true}));
async function load(name) {
  const raw = await readFile(new URL('../../static/models/packaging/' + name + '.glb', import.meta.url));
  return new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '');
}
function animation(gltf) {
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const actions = gltf.animations.map(clip => {const action = mixer.clipAction(clip).play(); action.paused = true;
    action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; return action;});
  return progress => {for (const action of actions) {action.enabled = true; action.time = action.getClip().duration * progress;}
    mixer.update(0); gltf.scene.updateMatrixWorld(true);};
}
const record = {version: '', packaging: {structure: 'gatefold', panels: 2, pockets: 'right', miniLP: true, discs: 1},
  modelCalibration: {spine: {widthRatio: .04, basis: 'image-estimate', asset: 'spread.jpg', sourceUrl: 'https://example.com/spread', origin: 'reference', reliefMm: [0, .15, -.15, .1, 0]}}};

test('宽度遵守 CD 实际容纳间隙，图像估计遇到下限时明确报告限制', () => {
  const fit = spineCalibrationFit(record);
  assert.equal(fit.basis, 'image-estimate');
  assert.equal(fit.status, 'applied');
  assert.ok(Math.abs(fit.requestedMm - 5.4) < 1e-9);
  assert.ok(Math.abs(fit.appliedMm - fit.requestedMm) < 1e-9);
  const thin = spineCalibrationFit({...record, modelCalibration: {spine: {...record.modelCalibration.spine, widthRatio: .002}}});
  assert.equal(thin.status, 'minimum-cd-fit');
  assert.ok(thin.appliedMm > thin.requestedMm);
  assert.equal(spineCalibrationFit({...record, modelCalibration: undefined}), null);
  assert.equal(spineCalibrationFit({...record, packaging: {structure: 'jewel'}}), null);
});

test('窄脊与微小起伏在任意开合保持全部纵向接缝，CD 固定 120mm 不受缩放', async () => {
  const gltf = await load('gatefold-2-mini-lp'), set = animation(gltf);
  const sheet = gltf.scene.getObjectByName('Paper_fold_0'), joint = gltf.scene.getObjectByName('Fold_Joint_0');
  const beforeDiscs = [];
  gltf.scene.traverse(o => {if (o.userData.discSlot === 0) beforeDiscs.push(o.scale.clone());});
  const fit = spineCalibrationFit(record);
  const update = calibrateFold(sheet, joint, fit.factor, record.modelCalibration.spine.reliefMm);
  assert.equal(typeof update, 'function');
  let longitudinalRows = new Set();
  sheet.traverse(mesh => {if (mesh instanceof THREE.Mesh) {
    const uv = mesh.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) longitudinalRows.add(uv.getY(i).toFixed(5));
  }});
  assert.ok(longitudinalRows.size >= 17, 'relief needs longitudinal geometry rather than a single long quad');
  for (const progress of [0, .073, .27, .501, .79, 1, .63, .21, 0]) {
    set(progress); joint.position.x *= fit.factor; joint.position.y *= fit.factor;
    update(); gltf.scene.updateMatrixWorld(true);
    const endpoint = joint.getWorldPosition(new THREE.Vector3()), positionsByRow = new Map();
    sheet.traverse(mesh => {if (!(mesh instanceof THREE.Mesh)) return;
      const uv = mesh.geometry.attributes.uv;
      const end = mesh.material.name.startsWith('Print_spine') ? 0 : 1;
      for (let i = 0; i < uv.count; i++) if (Math.abs(uv.getX(i) - end) < 1e-6) {
        const row = uv.getY(i).toFixed(5); const points = positionsByRow.get(row) ?? [];
        points.push(mesh.localToWorld(mesh.getVertexPosition(i, new THREE.Vector3()))); positionsByRow.set(row, points);
      }
    });
    for (const [row, values] of positionsByRow) {
      const points = [...new Map(values.map(v => [v.toArray().map(n => n.toFixed(8)).join(), v])).values()];
      assert.equal(points.length, 2, 'both thickness surfaces share the seam');
      const center = points[0].clone().add(points[1]).multiplyScalar(.5);
      const expected = endpoint.clone().add(new THREE.Vector3(0, 0, (Number(row) - .5) * .135));
      assert.ok(center.distanceTo(expected) < 1e-7, 'calibrated endpoint row follows joint at ' + progress);
      assert.ok(Math.abs(points[0].distanceTo(points[1]) - .00038) < 1e-7, 'paper gauge independent of observed spine width');
    }
  }
  let i = 0;
  gltf.scene.traverse(o => {if (o.userData.discSlot === 0) assert.ok(o.scale.equals(beforeDiscs[i++]));});
  const cd = gltf.scene.getObjectByName('Disc_1_0');
  const size = new THREE.Box3().setFromObject(cd).getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x - .120) < 1e-7 && Math.abs(size.z - .120) < 1e-7);
});

test('Mini LP 单盘既有纸袋缩紧后，CD、内衬与纸袋表面仍互不相交', async () => {
  const gltf = await load('gatefold-2-mini-lp'), set = animation(gltf); set(1);
  const pocket = gltf.scene.getObjectByName('Pocket_1');
  compactPaperPocket(pocket); gltf.scene.updateMatrixWorld(true);
  const cd = pocket.children.find(o => o.userData.discSlot === 0);
  const cdBox = new THREE.Box3();
  cd.traverse(mesh => {if (mesh instanceof THREE.Mesh) for (let i = 0; i < mesh.geometry.attributes.position.count; i++)
    cdBox.expandByPoint(pocket.worldToLocal(mesh.localToWorld(mesh.getVertexPosition(i, new THREE.Vector3()))));});
  const lip = pocket.children.find(o => o.userData.pocketLip), lipBox = new THREE.Box3();
  lip.traverse(mesh => {if (mesh instanceof THREE.Mesh) for (let i = 0; i < mesh.geometry.attributes.position.count; i++)
    lipBox.expandByPoint(pocket.worldToLocal(mesh.localToWorld(mesh.getVertexPosition(i, new THREE.Vector3()))));});
  assert.ok(lipBox.min.y - cdBox.max.y >= .00015 - 1e-7, JSON.stringify({cd: cdBox, lip: lipBox}));
  assert.ok(cdBox.min.y >= .00030 - 1e-7);
  assert.ok(lipBox.max.y <= .00201 + 1e-7);
  assert.ok(Math.abs(cdBox.max.y - cdBox.min.y - .0012) < 1e-7, 'disc thickness remains 1.2mm');
});


test('实测封板宽高仅调整纸壳，深度不按整组缩放，CD 任意角度仍为原尺寸', async () => {
  const gltf = await load('gatefold-2-mini-lp'), set = animation(gltf);
  const measured = {...record, packaging: {...record.packaging, size: {width: 145, height: 140, depth: 22}}};
  const fit = spineCalibrationFit(measured);
  assert.ok(Math.abs(fit.requestedMm - 5.8) < 1e-9);
  assert.ok(Math.abs(fit.minimumMm - 3.2) < 1e-9, 'CD fit does not scale with board measurements');
  resizePaperShell(gltf.scene, 145 / 135, 140 / 135);
  const sheet = gltf.scene.getObjectByName('Paper_fold_0'), joint = gltf.scene.getObjectByName('Fold_Joint_0');
  const update = calibrateFold(sheet, joint, fit.factor, [0, .1, 0]);
  const original = joint.position.clone();
  for (const progress of [0, .23, .51, .86, 1, .4]) {
    joint.position.copy(original); set(progress); original.copy(joint.position);
    joint.position.x *= fit.factor; joint.position.y *= fit.factor; update(); gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(object => {if (object.userData.discSlot === 0) {
      const scale = object.getWorldScale(new THREE.Vector3());
      assert.ok(scale.distanceTo(new THREE.Vector3(1, 1, 1)) < 1e-7, '120x1.2mm CD is never resized');
    }});
  }
  const board = gltf.scene.getObjectByName('Back_board');
  const size = new THREE.Box3().setFromObject(board).getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x - .145) < 1e-6 && Math.abs(size.z - .140) < 1e-6);
});

test('微小起伏实际改变折脊中部，形状信号与所有端点保持独立', async () => {
  const a = await load('gatefold-2-mini-lp'), b = await load('gatefold-2-mini-lp');
  animation(a)(.5); animation(b)(.5);
  const sa = a.scene.getObjectByName('Paper_fold_0'), sb = b.scene.getObjectByName('Paper_fold_0');
  const ua = calibrateFold(sa, a.scene.getObjectByName('Fold_Joint_0'), 1, [0, .15, 0]);
  const ub = calibrateFold(sb, b.scene.getObjectByName('Fold_Joint_0'), 1, [0, 0, 0]);
  ua(); ub();
  const ma = sa.children.find(o => o instanceof THREE.Mesh), mb = sb.children.find(o => o instanceof THREE.Mesh);
  let largest = 0;
  for (let i = 0; i < ma.geometry.attributes.position.count; i++) {
    const delta = ma.getVertexPosition(i, new THREE.Vector3()).distanceTo(mb.getVertexPosition(i, new THREE.Vector3()));
    largest = Math.max(largest, delta);
    assert.ok(delta <= .00015 + 1e-8);
  }
  assert.ok(largest > .00014, 'relief is geometry, independent of printed lighting');
  assert.ok(ma.material.flatShading, 'fragment normals follow the actually deformed surface');
});


for (const name of ['gatefold-2', 'gatefold-2-inner', 'digipak-2', 'digibook']) {
  test(name + '：曲线和两道压痕校准在九个形状键之间保留接缝与纸厚', async () => {
    const gltf = await load(name), set = animation(gltf);
    const sheet = gltf.scene.getObjectByName('Paper_fold_0'), joint = gltf.scene.getObjectByName('Fold_Joint_0');
    const update = calibrateFold(sheet, joint, .8, [0, -.15, .15, 0]);
    const original = joint.position.clone();
    for (const progress of [0, .071, .217, .444, .689, .936, 1, .5, .13, 0]) {
      joint.position.copy(original); set(progress); original.copy(joint.position);
      joint.position.x *= .8; joint.position.y *= .8; update(); gltf.scene.updateMatrixWorld(true);
      const points = new Map();
      sheet.traverse(mesh => {if (!(mesh instanceof THREE.Mesh)) return;
        const uv = mesh.geometry.attributes.uv, end = sheet.userData.foldFlat && mesh.material.name.startsWith('Print_spine') ? 0 : 1;
        for (let i = 0; i < uv.count; i++) if (Math.abs(uv.getX(i) - end) < 1e-6) {
          const row = uv.getY(i).toFixed(5), values = points.get(row) ?? [];
          values.push(mesh.localToWorld(mesh.getVertexPosition(i, new THREE.Vector3()))); points.set(row, values);
        }
      });
      for (const [row, values] of points) {
        const pairs = [...new Map(values.map(v => [v.toArray().map(n => n.toFixed(8)).join(), v])).values()];
        assert.equal(pairs.length, 2);
        const center = pairs[0].clone().add(pairs[1]).multiplyScalar(.5);
        const expected = joint.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0, (Number(row) - .5) * sheet.userData.foldHeightMm * .001));
        assert.ok(center.distanceTo(expected) < 1e-7, 'all intermediate seam rows are connected');
        assert.ok(Math.abs(pairs[0].distanceTo(pairs[1]) - .00038) < 1e-7);
      }
    }
  });
}
