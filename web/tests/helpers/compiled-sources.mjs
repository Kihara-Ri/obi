import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

export const source = fileURLToPath(new URL('../../src/', import.meta.url));
// One compiler program for the test run, using the real source dependency graph.
const entries = ['core/published-album.ts', 'core/gallery-motion.ts',
  'components/GalleryRoamingControls.tsx', 'core/gallery.ts', 'core/digital-twins.ts',
  'core/album-model-assets.ts', 'core/album-packaging.ts', 'components/CopyEditionFields.tsx',
  'core/copy-edition.ts', 'components/TwinControls.tsx', 'components/VisionSettings.tsx',
  'core/album-entity.ts', 'core/gallery-zoom.ts', 'core/release-metadata.ts', 'components/Tracklist.tsx'];

export function compileSources() {
  const output = mkdtempSync(join(tmpdir(), 'diedu-web-tests-'));
  try {
    const program = ts.createProgram(entries.map(file => join(source, file)), {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10, jsx: ts.JsxEmit.ReactJSX,
      strict: true, skipLibCheck: true, types: [], esModuleInterop: true,
      rootDir: source, outDir: output,
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: () => source, getCanonicalFileName: name => name, getNewLine: () => '\n',
    }));
    assert.equal(program.emit().emitSkipped, false);
    writeFileSync(join(output, 'package.json'), '{"type":"commonjs"}');
    symlinkSync(fileURLToPath(new URL('../../node_modules', import.meta.url)), join(output, 'node_modules'), 'dir');
    return output;
  } catch (error) {rmSync(output, {recursive: true, force: true}); throw error;}
}
let localOutput;
export function compiledSources() {
  const output = process.env.DIEDU_TEST_COMPILED || (localOutput ??= compileSources());
  return {output, source, require: createRequire(import.meta.url)};
}
process.once('exit', () => {if (localOutput) rmSync(localOutput, {recursive: true, force: true});});
