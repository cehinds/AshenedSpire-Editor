import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import { consolidatePages } from '../scripts/consolidate-pages.mjs';

const base = '/AshenedSpire-Editor/test/42-1/';
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'editor-single-html-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = path.join(root, 'client');
  const outputDirectory = path.join(root, 'pages');
  await mkdir(path.join(directory, 'assets'), { recursive: true });
  await mkdir(path.join(directory, 'native'));
  await writeFile(path.join(directory, 'index.html'), `<html><head><script type="module" src="${base}assets/app.js"></script><link rel="stylesheet" href="${base}assets/style.css"></head><body></body></html>`);
  await writeFile(path.join(directory, 'assets/app.js'), 'globalThis.example = "</script>";');
  await writeFile(path.join(directory, 'assets/style.css'), `@font-face{src:url('${base}assets/font.ttf')}`);
  await writeFile(path.join(directory, 'assets/font.ttf'), Buffer.from([0, 255, 1, 128]));
  await writeFile(path.join(directory, 'native/erd-workbench-0.2.4.html'), '<html><script>window.example = true;</script></html>');
  return { directory, outputDirectory, base };
}

test('Single HTML embeds executable code, CSS, binary resources, and intact native tools', async (t) => {
  const f = await fixture(t);
  await consolidatePages(f);
  assert.deepEqual(await readdir(f.outputDirectory), ['index.html']);
  const html = await readFile(path.join(f.outputDirectory, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /(?:src|href)="\//);
  assert.match(html, /url\("data:font\/ttf;base64,AP8BgA=="\)/);
  const module = html.match(/src="data:text\/javascript;base64,([^"]+)"/)[1];
  assert.equal(Buffer.from(module, 'base64').toString(), 'globalThis.example = "</script>";');
  const blobs = [];
  const context = { Uint8Array, TextDecoder, atob, Blob, URL: { createObjectURL(blob) { blobs.push(blob); return `blob:test/${blobs.length}`; } } };
  vm.runInNewContext(html.match(/<script id="editor-embedded-assets">([\s\S]*?)<\/script>/)[1], context);
  assert.equal(context.__ASHENEDSPIRE_ASSET_URL__('native/erd-workbench-0.2.4.html'), 'blob:test/1');
  assert.equal(context.__ASHENEDSPIRE_ASSET_URL__('native/erd-workbench-0.2.4.html'), 'blob:test/1');
  assert.equal(blobs[0].type, 'text/html');
  assert.equal(await blobs[0].text(), '<html><script>window.example = true;</script></html>');
  assert.equal(context.__ASHENEDSPIRE_HTML__('native/erd-workbench-0.2.4.html'), await blobs[0].text());
  context.__ASHENEDSPIRE_ASSET_URL__('assets/font.ttf');
  assert.deepEqual(new Uint8Array(await blobs[1].arrayBuffer()), new Uint8Array([0, 255, 1, 128]));
  assert.equal(context.__ASHENEDSPIRE_ASSET_URL__('assets/rogue-unavailable.webp'), 'data:application/octet-stream;base64,');
  assert.equal(context.__ASHENEDSPIRE_FRAME_URL__('assets/font.ttf'), 'data:font/ttf;base64,AP8BgA==');
  assert.equal(context.__ASHENEDSPIRE_FRAME_URL__('missing.png'), 'data:application/octet-stream;base64,');
});

test('Consolidation fails for missing assets, escaping URLs, and split JavaScript', async (t) => {
  const f = await fixture(t);
  await rm(path.join(f.directory, 'assets/font.ttf'));
  await assert.rejects(consolidatePages(f), /Missing consolidated resource/);
  await writeFile(path.join(f.directory, 'assets/style.css'), 'body{background:url(/outside.png)}');
  await assert.rejects(consolidatePages(f), /escapes build base/);
  await writeFile(path.join(f.directory, 'assets/style.css'), 'body{}');
  await writeFile(path.join(f.directory, 'assets/chunk.js'), 'export const x = 1;');
  await assert.rejects(consolidatePages(f), /Unbundled JavaScript/);
});
