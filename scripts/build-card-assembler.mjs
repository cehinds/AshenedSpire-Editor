import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {build} from 'esbuild';
import {ASSETS} from '../public/parts/card-assembler/catalog.mjs';

const root = fileURLToPath(new URL('../public/parts/card-assembler/', import.meta.url));
const ids = new Set();
const sources = Object.fromEntries(await Promise.all(ASSETS.map(async asset => {
 if (!asset.id || ids.has(asset.id)) throw new Error(`Duplicate or missing card asset ID: ${asset.id}`);
 ids.add(asset.id);
 const filename = path.resolve(root, asset.src);
 const relative = path.relative(root, filename);
 if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Card asset escapes its source directory: ${asset.id}`);
 const bytes = await readFile(filename);
 if (!bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error(`Card asset must be a PNG: ${asset.id}`);
 return [asset.id, 'data:image/png;base64,' + bytes.toString('base64')];
})));
const bundle = await build({entryPoints:[path.join(root, 'app.mjs')], bundle:true, format:'esm', write:false, minify:true, target:'es2022'});
let html = await readFile(path.join(root, 'index.html'), 'utf8');
const stylesheet = '<link rel="stylesheet" href="style.css">';
const script = '<script type="module" src="app.mjs"></script>';
if (!html.includes(stylesheet) || !html.includes(script)) throw new Error('Card Assembler source must contain its stylesheet and module entry tags');
const css = await readFile(path.join(root, 'style.css'), 'utf8');
html = html.replace(stylesheet, () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`);
html = html.replace(script, () => `<script>globalThis.CARD_ASSEMBLER_ASSETS=${JSON.stringify(sources).replace(/</g,'\\u003c')}</script><script type="module">${bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')}</script>`);
await writeFile(new URL('../public/card-assembler.html', import.meta.url), html);
console.log(`Built portable Card Assembler (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MiB), including ${ids.size} component images.`);
