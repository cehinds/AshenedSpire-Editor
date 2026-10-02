import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

// Explicit maintenance command; shipped builds use the reviewed, vendored snapshot.
const source = path.resolve(process.argv[2] || 'D:/repos/AshenSpire');
const out = path.resolve('src/native/game-preview');
await fs.mkdir(out, { recursive: true });
const exports = {
  'ui/screens/prologue.js': ['mountPrologue'],
  'model/prologue.js': ['prologuePresetOverrides', 'prologueConfig', 'prologueRows', 'prologueValueIsValid', 'prologueCopy', 'prologueSequence', 'PROLOGUE_DEFAULTS'],
  'model/prologueTiming.js': ['prologueSceneMs'],
  'ui/components/card.js': ['renderCard', 'scheduleCardFits'],
  'model/registries.js': ['createRegistries'],
  'content/index.js': ['contentBundle'],
  'ui/components/tooltipGlossary.js': ['configureTooltipGlossary'],
  'ui/assetmap.js': ['ASSET_MAP'],
  'config/generated/ui.js': ['uiConfig'],
  'ui/screens/combat.js': ['mountCombat'],
  'model/state.js': ['createRunState', 'createDeck'],
  'engine/combat.js': ['createCombat', 'dispatch'],
  'engine/rng.js': ['createRng'],
  'model/loadout.js': ['runMods'],
  'model/advancedConfig.js': ['configuredContentBundle', 'presentationConfig'],
  'model/handRules.js': ['resolveHandRules'],
  'content/combatRules.js': ['combatRules'],
  'ui/assets.js': ['playerSprite', 'enemySprite'],
  'ui/components/environmentArt.js': ['combatBackdropHtml'],
  'ui/services/PoseAnimator.js': ['stageFor'],
  'ui/wireframeChoices.js': ['applyWireframeChoices'],
  'ui/input.js': ['initInput'],
  'ui/presentationSequence.js': ['playPresentationSequence'],
  'ui/fx.js': ['anchorLocalBox'],
  'ui/models/CardSizeModel.js': ['cardShapeCssProperties', 'cardLevelCssProperties'],
};
const entry = Object.entries(exports).map(([file, names]) => `export { ${names.join(', ')} } from ${JSON.stringify(path.join(source, 'src', file).replaceAll('\\', '/'))};`).join('\n');
const previewUiAdapter = `
// Editor preview seam: apply authoring data before native consumers freeze config.
if (globalThis.__ASHEN_PREVIEW_UI__) {
  const draft = globalThis.__ASHEN_PREVIEW_UI__;
  const scope = {...uiConfig.tokens, ...(draft.vars || {})};
  function resolve(value, trail = []) {
    if (typeof value === 'string' && /^\\$[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
      const key = value.slice(1);
      if (!(key in scope) || trail.includes(key)) throw Error('Invalid preview UI variable: ' + key);
      return resolve(scope[key], [...trail, key]);
    }
    if (Array.isArray(value)) return value.map(item => resolve(item, trail));
    if (value && typeof value === 'object') {
      if ('numerator' in value && 'denominator' in value && Object.keys(value).length === 2) {
        const n = resolve(value.numerator, trail), d = resolve(value.denominator, trail);
        if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) throw Error('Invalid preview UI fraction');
        return n / d;
      }
      return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'vars').map(([key, item]) => [key, resolve(item, trail)]));
    }
    return value;
  }
  uiConfig.scenes.w4a = resolve(draft);
}
deepFreeze(uiConfig);
`;
await build({ stdin: { contents: entry, resolveDir: source, sourcefile: 'editor-preview-entry.js' }, outfile: path.join(out, 'runtime.js'), bundle: true, format: 'iife', globalName: 'AshenNative', platform: 'browser', target: 'es2022', minify: true, legalComments: 'eof', plugins: [{ name: 'editor-ui-draft', setup(builder) { builder.onLoad({ filter: /config[\\/]generated[\\/]ui\.js$/ }, async args => {
  const original = await fs.readFile(args.path, 'utf8');
  const marker = 'export const uiConfig = deepFreeze({';
  if (!original.includes(marker)) throw Error('Native UI export changed; review the preview adapter before vendoring.');
  return { contents: original.replace(marker, 'export const uiConfig = ({') + previewUiAdapter, loader: 'js' };
}); } }] });
const modelScope = { structuredClone, queueMicrotask() {} };
vm.runInNewContext(await fs.readFile(path.join(out, 'runtime.js'), 'utf8'), modelScope);
await fs.writeFile(path.join(out, 'scene-actors.json'), JSON.stringify(Object.fromEntries(modelScope.AshenNative.PROLOGUE_DEFAULTS.scenes.map(scene => [scene.id, scene.actor])), null, 2) + '\n');
const cssNames = ['base.css', 'kit.css', 'ui.css', 'combat.css', 'combat-poses.css', 'hud-visibility.css', 'map.css', 'legacy-dungeon.css', 'prologue.css', 'responsive-type.css'];
await fs.writeFile(path.join(out, 'styles.css'), (await Promise.all(cssNames.map(name => fs.readFile(path.join(source, 'styles', name), 'utf8')))).join('\n'));
const assetRoot = path.resolve('public/assets/game-preview');
const assets = {};
let bytes = 0;
async function copyAssets(dir, relative = '') {
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    const rel = path.posix.join(relative, item.name);
    if (item.isDirectory()) await copyAssets(path.join(dir, item.name), rel);
    else {
      if (!/\.(?:webp|png|svg|jpg|jpeg|woff2?|ogg|mp3)$/i.test(rel)) continue;
      const destination = path.join(assetRoot, rel);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(path.join(dir, item.name), destination);
      assets[`assets/${rel}`] = `assets/game-preview/${rel}`;
      bytes += (await fs.stat(destination)).size;
    }
  }
}
await copyAssets(path.join(source, 'assets-mobile'));
await fs.writeFile(path.join(out, 'assets.js'), `// Native asset paths use the shipped mobile art pack for compact editor previews.\nexport const nativeAssetPaths = ${JSON.stringify(assets)};\n`);
await fs.copyFile(path.join(source, 'LICENSE'), path.join(out, 'LICENSE'));
await fs.copyFile(path.join(source, 'CREDITS.md'), path.join(out, 'CREDITS.md'));
const revision = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const sourceDirty = Boolean(execFileSync('git', ['-C', source, 'status', '--porcelain'], { encoding: 'utf8' }).trim());
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const hashes = Object.fromEntries(await Promise.all(['runtime.js', 'styles.css', 'assets.js'].map(async file => [file, sha256(await fs.readFile(path.join(out, file)))])));
await fs.writeFile(path.join(out, 'provenance.json'), JSON.stringify({ repository: 'AshenSpire', revision, sourceDirty, snapshot: 'working-tree', hashes, entryExports: exports, assets: Object.keys(assets).length, assetBytes: bytes, assetQuality: 'mobile', generatedBy: 'scripts/vendor-game-preview.mjs' }, null, 2) + '\n');
console.log(`Vendored native runtime from ${revision}; ${Object.keys(assets).length} assets, ${bytes} bytes.`);
