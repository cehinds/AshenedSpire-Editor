import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/plain', '.css': 'text/css', '.json': 'application/json', '.csv': 'text/plain', '.txt': 'text/plain', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };

async function filesIn(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(path.join(directory, prefix), { withFileTypes: true })) {
    const name = path.posix.join(prefix, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Consolidated assets cannot contain symbolic links');
    if (entry.isDirectory()) files.push(...await filesIn(directory, name));
    else if (entry.isFile()) files.push(name);
  }
  return files.sort();
}

// Embed publicUrl resources as lazy Blob URLs, preserving HTML tool origins and
// avoiding network requests even when the downloaded index.html is opened alone.
export async function consolidatePages({ directory, outputDirectory, base }) {
  const files = await filesIn(directory);
  const assets = Object.create(null);
  for (const name of files) {
    if (name === 'index.html') continue;
    assets[name] = [mimeTypes[path.extname(name)] || 'application/octet-stream', (await readFile(path.join(directory, name))).toString('base64')];
  }
  const resource = (url) => {
    if (!url.startsWith(base)) throw new Error(`Consolidated resource escapes build base: ${url}`);
    const name = url.slice(base.length);
    if (!Object.hasOwn(assets, name)) throw new Error(`Missing consolidated resource: ${name}`);
    return { name, mime: assets[name][0], bytes: assets[name][1] };
  };
  let html = await readFile(path.join(directory, 'index.html'), 'utf8');
  let modules = 0;
  html = html.replace(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g, (tag, url) => {
    if (!tag.includes('type="module"')) throw new Error('Unexpected non-module application script');
    const { name, bytes } = resource(url);
    modules += 1;
    delete assets[name];
    return `<script type="module" src="data:text/javascript;base64,${bytes}"></script>`;
  });
  html = html.replace(/<link\b[^>]*>/g, (tag) => {
    if (tag.includes('rel="modulepreload"')) throw new Error('Consolidated build must contain a single JavaScript bundle');
    if (!tag.includes('rel="stylesheet"')) return tag;
    const url = tag.match(/href="([^"]+)"/)?.[1];
    const { name, bytes } = resource(url || '');
    const css = Buffer.from(bytes, 'base64').toString('utf8').replace(/url\(\s*["']?([^)'"\s]+)["']?\s*\)/g, (match, value) => {
      if (value.startsWith('data:') || value.startsWith('#')) return match;
      const asset = resource(value);
      return `url("data:${asset.mime};base64,${asset.bytes}")`;
    });
    delete assets[name];
    return `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`;
  });
  if (modules !== 1) throw new Error('Consolidated build requires exactly one application module');
  if (Object.keys(assets).some((name) => /^assets\/.*\.js$/.test(name))) throw new Error('Unbundled JavaScript chunks in consolidated build');
  const bootstrap = `<script id="editor-embedded-assets">
(() => {
  const assets = ${JSON.stringify(assets).replace(/</g, '\\u003c')};
  const urls = new Map();
  globalThis.__ASHENEDSPIRE_HTML__ = (name) => {
    if (!Object.hasOwn(assets, name) || assets[name][0] !== 'text/html') throw new Error('Missing embedded HTML: ' + name);
    return new TextDecoder().decode(Uint8Array.from(atob(assets[name][1]), c => c.charCodeAt(0)));
  };
  globalThis.__ASHENEDSPIRE_ASSET_URL__ = (name) => {
    if (!Object.hasOwn(assets, name)) throw new Error('Missing embedded editor asset: ' + name);
    if (!urls.has(name)) {
      const [type, encoded] = assets[name];
      let bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
      if (name === 'responsive-preview.html') {
        const base = document.createElement('base');
        base.href = new URL('.', location.href).href;
        const source = new TextDecoder().decode(bytes).replace('<head>', '<head>' + base.outerHTML);
        bytes = new TextEncoder().encode(source);
      }
      urls.set(name, URL.createObjectURL(new Blob([bytes], {type})));
    }
    return urls.get(name);
  };
})();
</script>`;
  html = html.replace('<head>', '<head>\n' + bootstrap);
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(path.join(outputDirectory, 'index.html'), html);
  console.log(`Consolidated Pages HTML: ${Buffer.byteLength(html)} bytes, ${Object.keys(assets).length} embedded resources`);
}
