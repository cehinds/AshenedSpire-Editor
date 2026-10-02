import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const TEXT_QUERY = "?native-text";
const LOADER = "/src/native-text.js";

// `import load from './file?native-text'` gives `load(): Promise<string>`.
// Production emits the file as a hashed .txt asset fetched on first use, so the
// multi-megabyte vendored renderer and stylesheet never sit inside a JavaScript
// chunk. The consolidated Pages build embeds that asset like any other file and
// publicUrl() resolves it from the embedded table. Dev serves it as ?raw.
export function nativeTextAssets() {
  let command = "build";
  const files = [];
  return {
    name: "ashenedspire-native-text",
    enforce: "pre",
    configResolved(config) { command = config.command; },
    async resolveId(source, importer) {
      if (!source.endsWith(TEXT_QUERY)) return null;
      const file = source.slice(0, -TEXT_QUERY.length);
      const resolved = await this.resolve(file, importer, { skipSelf: true });
      if (!resolved) throw new Error(`Cannot resolve native text source: ${file}`);
      // The module id must not mention ".css", or Vite's CSS pipeline claims the loader.
      if (!files.includes(resolved.id)) files.push(resolved.id);
      return `\0native-text:${files.indexOf(resolved.id)}.js`;
    },
    async load(id) {
      if (!id.startsWith("\0native-text:")) return null;
      const file = files[Number.parseInt(id.slice("\0native-text:".length), 10)];
      if (command === "serve") {
        return `export default () => import(${JSON.stringify("/@fs/" + file.replace(/\\/g, "/").replace(/^\/+/, "") + "?raw")}).then(module => module.default);`;
      }
      const source = await readFile(file);
      this.addWatchFile?.(file);
      const hash = createHash("sha256").update(source).digest("hex").slice(0, 10);
      const base = path.basename(path.dirname(file)) + "-" + path.basename(file).replace(/\.[^.]+$/, "");
      const fileName = `assets/${base}-${hash}.txt`;
      this.emitFile({ type: "asset", fileName, source });
      return `import {loadNativeText} from ${JSON.stringify(LOADER)};\nexport default () => loadNativeText(${JSON.stringify(fileName)});`;
    },
  };
}

// The vendored asset map pairs ~5,000 keys with values that always equal
// `assets/game-preview/` + the key's tail. Rebuild the identical object (same
// keys, values and order) from per-directory file lists instead of shipping
// ~690 kB of repeated literal strings. Falls back to the original source if
// the vendored map ever stops following that rule.
export function compactNativeAssetMap() {
  return {
    name: "ashenedspire-compact-asset-map",
    transform(code, id) {
      if (!id.replace(/\\/g, "/").endsWith("/src/native/game-preview/assets.js")) return null;
      const start = code.indexOf("{"), end = code.lastIndexOf("}");
      let map;
      try { map = JSON.parse(code.slice(start, end + 1)); } catch { return null; }
      if (!/export const nativeAssetPaths\s*=\s*$/.test(code.slice(0, start))) return null;
      const runs = [], lists = [], listIndex = new Map();
      let current = null;
      for (const [key, value] of Object.entries(map)) {
        if (!key.startsWith("assets/") || value !== "assets/game-preview/" + key.slice(7)) return null;
        const tail = key.slice(7), slash = tail.lastIndexOf("/");
        const dir = slash < 0 ? "" : tail.slice(0, slash), name = tail.slice(slash + 1);
        if (!name || name.includes("|")) return null;
        if (!current || current.dir !== dir) runs.push(current = { dir, names: [] });
        current.names.push(name);
      }
      const encoded = runs.map(({ dir, names }) => {
        const joined = names.join("|");
        if (!listIndex.has(joined)) { listIndex.set(joined, lists.length); lists.push(joined); }
        return [dir, listIndex.get(joined)];
      });
      const output = `const lists=${JSON.stringify(lists)};\nconst runs=${JSON.stringify(encoded)};\nexport const nativeAssetPaths={};\nfor(const [dir,index] of runs)for(const name of lists[index].split("|")){const tail=dir?dir+"/"+name:name;nativeAssetPaths["assets/"+tail]="assets/game-preview/"+tail;}\n`;
      return { code: output, map: null };
    },
  };
}
