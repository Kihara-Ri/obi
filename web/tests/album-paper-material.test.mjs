import assert from 'node:assert/strict';
import {after, test} from 'node:test';
import {mkdtempSync, rmSync, writeFileSync, symlinkSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import ts from 'typescript';
import {MeshStandardMaterial, ShaderLib} from 'three';
const output = mkdtempSync(join(tmpdir(), 'diedu-paper-material-'));
const source = fileURLToPath(new URL('../src/', import.meta.url));
const program = ts.createProgram([join(source, 'core/album-paper-material.ts'), join(source, 'core/album-photo-material.ts')], {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, strict: true, moduleResolution: ts.ModuleResolutionKind.Bundler,
  skipLibCheck: true, types: [], rootDir: source, outDir: output});
assert.equal(ts.getPreEmitDiagnostics(program).length, 0);
assert.equal(program.emit().emitSkipped, false);
writeFileSync(join(output, 'package.json'), '{"type":"module"}');
symlinkSync(fileURLToPath(new URL('../node_modules/', import.meta.url)), join(output, 'node_modules'));
const photoPath = join(output, 'core/album-photo-material.js');
writeFileSync(photoPath, readFileSync(photoPath, 'utf8').replace("'./album-photo-projection'", "'./album-photo-projection.js'"));
const {paperGrain} = await import(pathToFileURL(join(output, 'core/album-paper-material.js')).href);
const {projectPackagingPhoto} = await import(pathToFileURL(photoPath).href);
after(() => rmSync(output, {recursive: true, force: true}));

test('纸纹与连续 UV 投影组合后保留两个材质阶段；粗糙度/法线独立于印刷像素且按足迹过滤', () => {
  const material = new MeshStandardMaterial();
  paperGrain(material, [6, 135], 'uncoated', 2);
  projectPackagingPhoto(material, undefined, [[.4, .1, .6, .1], [.38, .5, .62, .5], [.4, .9, .6, .9]]);
  const shader = {uniforms: {}, vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader};
  material.onBeforeCompile(shader, {});
  assert.equal(shader.uniforms.packagingPhotoRowCount.value, 3);
  assert.deepEqual(shader.uniforms.paperDimensionsMm.value.toArray(), [6, 135]);
  assert.ok(shader.vertexShader.includes('vPaperUv = uv'));
  assert.ok(shader.fragmentShader.includes('projectedPackagingUv(vMapUv)'));
  assert.ok(shader.fragmentShader.includes('fwidth(paperPhase)'));
  assert.ok(shader.fragmentShader.includes('paperResolved'));
  assert.ok(shader.fragmentShader.includes('roughnessFactor = clamp'));
  assert.ok(shader.fragmentShader.includes('normal = normalize(normal -'));
  const grain = shader.fragmentShader.slice(shader.fragmentShader.indexOf('vec2 paperPhase'), shader.fragmentShader.indexOf('float metalnessFactor'));
  assert.ok(!grain.includes('texture2D') && !grain.includes('sampledDiffuseColor'), 'printed shadows cannot become paper relief');
});
