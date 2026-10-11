import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const directory = new URL('../../static/models/packaging/', import.meta.url);
async function load(name) {
  const raw = await readFile(new URL(name + '.glb', directory));
  assert.equal(raw.readUInt32LE(0), 0x46546c67);
  assert.equal(raw.readUInt32LE(4), 2);
  assert.equal(raw.readUInt32LE(8), raw.length);
  const doc = JSON.parse(raw.subarray(20, 20 + raw.readUInt32LE(12)).toString());
  assert.equal(doc.images?.length ?? 0, 0, 'shared models contain no personal or fixture images');
  return new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '');
}
function animation(gltf) {
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const actions = gltf.animations.map(clip => {
    const action = mixer.clipAction(clip).play();
    action.paused = true; action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true;
    return action;
  });
  return progress => {
    for (const action of actions) {action.enabled = true; action.time = action.getClip().duration * progress;}
    mixer.update(0); gltf.scene.updateMatrixWorld(true);
  };
}

test('模型库完整且所有部署模型不含贴图或外部资源', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'));
  assert.equal(Object.keys(manifest.models).length, 21);
  for (const [name, report] of Object.entries(manifest.models)) {
    const gltf = await load(name);
    assert.equal(gltf.animations.length > 0, report.animated, name);
    const root = gltf.scene.children.find(child => child.userData.nominal_mm);
    assert.deepEqual(root.userData.nominal_mm, report.nominal_mm, name);
  }
});

test('标准 Jewel Case 齿纹固定在托盘，盒盖转动始终围绕真实轴心', async () => {
  const gltf = await load('jewel-case');
  const set = animation(gltf);
  const base = gltf.scene.getObjectByName('Fixed_Base_And_Tray');
  const hinge = gltf.scene.getObjectByName('Lid_Hinge_Y');
  const rib = base.children.find(child => child.material?.name.startsWith('Tray_Graphite'));
  assert.ok(rib);
  const origin = hinge.getWorldPosition(new THREE.Vector3());
  const fixed = rib.getWorldPosition(new THREE.Vector3());
  for (const progress of [0, .13, .5, .83, 1, .4, 0]) {
    set(progress);
    assert.ok(hinge.getWorldPosition(new THREE.Vector3()).distanceTo(origin) < 1e-8);
    assert.ok(rib.getWorldPosition(new THREE.Vector3()).distanceTo(fixed) < 1e-8);
  }
});

test('细齿纹使用连续托盘表面，缩小时不再光栅化重复的亚像素棱柱', async () => {
  for (const name of ['jewel-case', 'jewel-swing-2', 'jewel-swing-4', 'jewel-fat']) {
    const gltf = await load(name);
    gltf.scene.updateMatrixWorld(true);
    let tinyFaces = 0;
    gltf.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (!materials.some(material => material.name.startsWith('Tray_Graphite'))) return;
      const indices = object.geometry.index;
      for (let i = 0; i < indices.count; i += 3) {
        const center = new THREE.Vector3();
        for (let j = 0; j < 3; j++) center.add(object.getVertexPosition(indices.getX(i + j), new THREE.Vector3()).applyMatrix4(object.matrixWorld));
        center.divideScalar(3);
        if (center.x > -.0699 && center.x < -.0581 && center.y > .00435 && Math.abs(center.z) < .05) tinyFaces++;
      }
    });
    // The bevelled foundation has six exposed faces here. The old micro-ridges
    // added 540 faces to this narrow band, causing unresolved periodic coverage.
    assert.ok(tinyFaces < 64, name + ' retains alias-prone micro-ridge geometry');
    const surfaces = [];
    gltf.scene.traverse(object => {if (object.userData.ribbedSpine) surfaces.push(object);});
    assert.equal(surfaces.length, name === 'jewel-fat' ? 2 : 1, name);
    for (const surface of surfaces) {
      assert.ok(surface.userData.ribPitch_mm > 0);
      let found = false;
      surface.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        if (!materials.some(material => material.name.startsWith('Tray_Graphite_Ribbed'))) return;
        found = true;
        const uv = object.geometry.attributes.uv;
        assert.ok(uv, 'filtered relief needs continuous UV coordinates');
        assert.ok(object.geometry.index.count <= 12, 'front relief is one surface, not thirty repeated ridges');
      });
      assert.ok(found, name + ' filtered rib material');
    }
  }
});

test('Jewel Case 上下挡边避让 CD，盘槽外圈收在托盘边界以内', async () => {
  const gltf = await load('jewel-case'), set = animation(gltf);
  set(0);
  const dimensions = new THREE.Box3().setFromObject(gltf.scene.getObjectByName('CD_120mm')).getSize(new THREE.Vector3());
  assert.ok(Math.abs(dimensions.x - .120) < 1e-6 && Math.abs(dimensions.z - .120) < 1e-6,
    'fix the tray clearance without shrinking the 120-mm disc');
  const tray = [], disc = [];
  gltf.scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const material = object.material;
    if (material.name === 'Tray_Graphite') tray.push(object);
    if (material.name === 'Print_disc') disc.push(object);
  });
  assert.ok(tray.length && disc.length);
  for (const [x, height] of [[7, 30], [65, 45], [-50, 45]]) {
    const ray = new THREE.Raycaster(new THREE.Vector3(x * .001, .020, height * .001), new THREE.Vector3(0, -1, 0));
    const floor = ray.intersectObjects(tray, false)[0];
    assert.ok(floor && floor.point.y > -.0016 && floor.point.y < -.001,
      `tray floor missing at ${x},${height} mm`);
  }
  const rim = new THREE.Raycaster(new THREE.Vector3(.0674, .020, 0), new THREE.Vector3(0, -1, 0))
    .intersectObjects(tray, false)[0];
  assert.ok(rim && rim.point.y > -.001 && rim.point.y < 0, 'raised rim must remain anchored above the tray floor');
  for (const progress of [0, .25, .5, 1, .4]) {
    set(progress);
    for (const height of [-59.8, -59.5, -58.8, -58.4, 58.4, 58.8, 59.5, 59.8]) {
      for (const offset of [-3, 0, 3]) {
        const ray = new THREE.Raycaster(new THREE.Vector3(.007 + offset * .001, .020, height * .001), new THREE.Vector3(0, -1, 0));
        const surface = ray.intersectObjects(disc, false)[0];
        assert.ok(surface, 'probe is inside the actual disc');
        for (const hit of ray.intersectObjects(tray, false)) {
          assert.ok(hit.point.y < surface.point.y - .0013,
            `top/bottom shoulder intersects disc at ${offset},${height} mm, progress ${progress}`);
        }
      }
    }
  }
  // Check the round rim's triangles near the tray front, excluding the fixed
  // spine and centre rosette. The old rim extended to +/-60.8 mm in a 120.5 mm tray.
  for (const mesh of tray) {
    const positions = mesh.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const point = mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
      const radius = Math.hypot(point.x - .007, point.z);
      if (point.y > -.001 && point.y < 0 && radius > .060 && radius < .061)
        assert.ok(Math.abs(point.z) <= .060251, 'disc rim protrudes outside the tray');
    }
  }
});

test('Fatbox 后室外盖使用背面角色，Blender 自动材料编号不改变照片身份', async () => {
  const gltf = await load('jewel-fat');
  const rear = gltf.scene.getObjectByName('Fatbox_rear_chamber');
  assert.ok(rear?.userData.rearChamber);
  let back = 0;
  rear.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      assert.ok(!material.name.startsWith('Print_front'), 'rear chamber must not reuse the front photograph');
      if (material.name.startsWith('Print_back')) back++;
    }
  });
  assert.ok(back > 0);
});

for (const name of ['gatefold-2', 'gatefold-3', 'gatefold-4', 'gatefold-2-inner', 'gatefold-3-inner', 'gatefold-4-inner',
  'digipak-2', 'digipak-3', 'digipak-4', 'digibook', 'gatefold-2-mini-lp']) {
  test(name + '：导出后折痕在开合中和反向接管时连续连接，封面朝外', async () => {
    const gltf = await load(name), set = animation(gltf);
    const sheets = [], leaves = [];
    gltf.scene.traverse(object => {
      if (object.userData.foldSheet) sheets.push(object);
      if (object.userData.printLeaf) leaves.push(object);
    });
    assert.ok(sheets.length > 0); assert.equal(leaves.length, 1);
    for (const progress of [0, .07, .25, .55, .9, 1, .4, 0]) {
      set(progress);
      for (const sheet of sheets) {
        const points = new Map();
        sheet.traverse(mesh => {
          if (!(mesh instanceof THREE.Mesh)) return;
          const uv = mesh.geometry.attributes.uv;
          const end = (name.endsWith('-inner') || name.endsWith('-mini-lp')) && mesh.material.name.startsWith('Print_spine') ? 0 : 1;
          for (let i = 0; i < uv.count; i++) if (Math.abs(uv.getX(i) - end) < 1e-6) {
            const point = mesh.localToWorld(mesh.getVertexPosition(i, new THREE.Vector3()));
            points.set(point.toArray().map(value => value.toFixed(8)).join(), point);
          }
        });
        const midpoint = new THREE.Vector3();
        for (const point of points.values()) midpoint.add(point);
        midpoint.divideScalar(points.size);
        const joint = sheet.parent.children.find(child => child.name.startsWith('Fold_Joint_'));
        assert.ok(joint);
        assert.ok(midpoint.distanceTo(joint.getWorldPosition(new THREE.Vector3())) < 1e-6, name + ' fold gap');
      }
      if (progress === 0 || progress === 1) leaves[0].traverse(object => {
        if (!(object instanceof THREE.Mesh) || !object.material.name.startsWith('Print_front')) return;
        const normal = new THREE.Vector3().fromBufferAttribute(object.geometry.attributes.normal, 0).transformDirection(object.matrixWorld);
        assert.ok(progress === 0 ? normal.y > .9 : normal.y < -.9, name + ' front print facing');
      });
    }
  });
}

test('内开口双袋纸套：左右独立 CD 留在袋内，缺口朝书脊且袋口没有封墙', async () => {
  const gltf = await load('gatefold-2-inner'), set = animation(gltf);
  set(1);
  for (const panel of [0, 1]) {
    const pocket = gltf.scene.getObjectByName('Pocket_' + panel);
    const side = panel === 0 ? 1 : -1;
    assert.equal(pocket.userData.mouthSide, side);
    const lip = pocket.children.find(child => child.userData.pocketLip);
    assert.ok(lip);
    const skins = lip instanceof THREE.Mesh ? [lip] : lip.children.filter(o => o instanceof THREE.Mesh);
    const origin = pocket.localToWorld(new THREE.Vector3(side * .065, .01, 0));
    const direction = new THREE.Vector3(0, -1, 0).transformDirection(pocket.matrixWorld);
    assert.equal(new THREE.Raycaster(origin, direction).intersectObjects(skins, false).length, 0, 'thumbcut remains a real aperture');
    const localBox = new THREE.Box3();
    const disc = pocket.children.find(child => child.userData.discSlot === 0);
    assert.ok(disc);
    disc.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      for (let i = 0; i < o.geometry.attributes.position.count; i++) {
        const point = pocket.worldToLocal(o.localToWorld(o.getVertexPosition(i, new THREE.Vector3())));
        localBox.expandByPoint(point);
      }
    });
    assert.ok(localBox.min.x > -.0677 && localBox.max.x < .0677, 'CD clears the closed side seam');
    assert.ok(localBox.min.z > -.0611 && localBox.max.z < .0611, '120-mm CD clears top/bottom seams');
    assert.ok(localBox.max.y < .00282, 'CD remains beneath the printed pocket lip');
  }
});

test('连续纸脊具有纵向形变行并携带独立宽度校准所需参数', async () => {
  const gltf = await load('gatefold-2');
  const sheet = gltf.scene.getObjectByName('Paper_fold_0');
  const heights = new Set();
  sheet.traverse(mesh => {if (mesh instanceof THREE.Mesh) {
    const uv = mesh.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) heights.add(uv.getY(i).toFixed(5));
  }});
  assert.ok(heights.size >= 17, 'longitudinal rows preserve the relief profile');
  assert.equal(sheet.userData.foldSegments, 24);
  assert.equal(sheet.userData.foldRows, 16);
  assert.ok(sheet.userData.foldLengthMm > 0);
});
