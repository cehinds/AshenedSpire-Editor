import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

// Explicit maintenance command. Builds use this checked-in native snapshot.
const source = path.resolve(process.argv[2] || 'D:/repos/AshenSpire');
const output = path.resolve('src/native/scene-audio');
await fs.mkdir(output, {recursive: true});
const entryExports = {
  'ui/audio.js': ['initAudio', 'AUDIO_DEFAULTS'],
  'ui/assetmap.js': ['ASSET_MAP', 'assetUrl'],
  'content/music.js': ['MUSIC_MANIFEST', 'BEDS'],
  'content/sfx.js': ['SFX_MANIFEST', 'SFX_RECIPES'],
};
const entry = Object.entries(entryExports).map(([file, names]) => `export {${names.join(',')}} from ${JSON.stringify(path.join(source, 'src', file).replaceAll('\\', '/'))};`).join('\n');
const originalReturn = 'return { sfx, music, stopMusic, setVolumes, configureMusic, resume, isReal: true };';
const originalWarmSample = 'warmSample(sample);';
const adapterWarmSample = 'if (!settings.studioProceduralOnly) warmSample(sample);';
const adapterReturn = `return { sfx, music, stopMusic, setVolumes, configureMusic, resume, isReal: true,
  get contextState() { return ctx.state; },
  async unlock() {
    if (ctx.state !== 'running') await ctx.resume();
    if (ctx.state !== 'running') throw new Error('Audio is blocked by the browser. Press Audition audio again.');
  }
};`;
const result = await build({
  stdin: {contents: entry, resolveDir: source, sourcefile: 'scene-audio-entry.js'},
  outfile: path.join(output, 'runtime.js'), bundle: true, format: 'esm', platform: 'browser',
  target: 'es2022', minify: true, legalComments: 'eof', metafile: true,
  banner: {js: '// Native AshenSpire procedural audio. MIT; see LICENSE and provenance.json.'},
  plugins: [{name: 'scene-audio-unlock', setup(builder) {
    builder.onLoad({filter: /src[\\/]ui[\\/]audio\.js$/}, async args => {
      const contents = await fs.readFile(args.path, 'utf8');
      if (contents.split(originalReturn).length !== 2) throw new Error('Native audio API changed; review the unlock adapter before vendoring.');
      if (contents.split(originalWarmSample).length !== 2) throw new Error('Native sample warmup changed; review the procedural-only adapter before vendoring.');
      return {contents: contents.replace(originalReturn, adapterReturn).replace(originalWarmSample, adapterWarmSample), loader: 'js'};
    });
  }}],
});
for (const name of ['LICENSE', 'CREDITS.md']) await fs.copyFile(path.join(source, name), path.join(output, name));
const sha = value => createHash('sha256').update(value).digest('hex');
const sourceHashes = {};
for (const input of Object.keys(result.metafile.inputs).filter(name => path.basename(name) !== 'scene-audio-entry.js')) {
  const absolute = path.resolve(input);
  sourceHashes[path.relative(source, absolute).replaceAll('\\', '/')] = sha(await fs.readFile(absolute));
}
const hashes = Object.fromEntries(await Promise.all(['runtime.js', 'LICENSE', 'CREDITS.md'].map(async name => [name, sha(await fs.readFile(path.join(output, name)))])));
const revision = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
const sourceDirty = Boolean(execFileSync('git', ['-C', source, 'status', '--porcelain'], {encoding: 'utf8'}).trim());
await fs.writeFile(path.join(output, 'provenance.json'), JSON.stringify({repository: 'AshenSpire', revision, sourceDirty, snapshot: 'working-tree', entryExports, hashes, sourceHashes, adapter: 'Adds contextState and awaitable unlock to the existing native AudioContext. The explicit studioProceduralOnly setting skips optional SFX sample warmup because no sample source is bundled. Synthesis, cue recipes, and music playback are unchanged.', optionalAssets: 'No samples required. Editor auditions explicitly use native procedural synthesis without requesting absent samples; ordinary native mode retains sample fallback behavior.', generatedBy: 'scripts/vendor-scene-audio.mjs'}, null, 2) + '\n');
console.log(`Vendored native scene audio from ${revision}.`);
