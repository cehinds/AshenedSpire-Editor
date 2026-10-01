import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {initAudio, assetUrl, ASSET_MAP, BEDS, SFX_RECIPES} from '../src/native/scene-audio/runtime.js';
import {createSceneAudioController} from '../src/scene-studio-audio.mjs';

test('native audio snapshot preserves license and verifies the vendored output', async () => {
  const root = new URL('../src/native/scene-audio/', import.meta.url);
  const receipt = JSON.parse(await fs.readFile(new URL('provenance.json', root), 'utf8'));
  assert.equal(receipt.repository, 'AshenSpire');
  assert.ok(receipt.sourceHashes['src/ui/audio.js']);
  assert.ok(receipt.sourceHashes['src/content/music.js']);
  assert.ok(receipt.sourceHashes['src/content/sfx.js']);
  assert.ok(receipt.adapter.includes('unlock'));
  for (const [name, hash] of Object.entries(receipt.hashes)) assert.equal(createHash('sha256').update(await fs.readFile(new URL(name, root))).digest('hex'), hash);
  assert.match(await fs.readFile(new URL('LICENSE', root), 'utf8'), /MIT License/);
  assert.equal(BEDS.quiet, 'silence');
  assert.ok(Array.isArray(SFX_RECIPES.beat));
});

test('native asset resolver keeps optional missing samples available to native fallback', () => {
  assert.equal(assetUrl('assets/sfx/missing.ogg'), 'assets/sfx/missing.ogg');
  ASSET_MAP['assets/sfx/test.ogg'] = 'data:audio/ogg;base64,test';
  assert.equal(assetUrl('assets/sfx/test.ogg'), 'data:audio/ogg;base64,test');
  delete ASSET_MAP['assets/sfx/test.ogg'];
});

test('real native fallback requests optional samples; editor auditions synthesize without requests', async () => {
  const previous = Object.fromEntries(['window', 'navigator', 'addEventListener', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const nodes = [];
  const parameter = () => ({value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {}});
  const node = kind => {
    const value = {kind, gain: parameter(), frequency: parameter(), Q: parameter(), connect(target) {return target;}, disconnect() {}, start() {value.started = true;}, stop() {value.stopped = true;}};
    nodes.push(value);return value;
  };
  const listeners = [];
  const requests = [];
  class AudioContext {
    constructor() {this.state = 'suspended';this.currentTime = 0;this.sampleRate = 8000;this.destination = node('destination');}
    async resume() {this.state = 'running';}
    createGain() {return node('gain');}
    createOscillator() {return node('oscillator');}
    createBufferSource() {return node('buffer-source');}
    createBiquadFilter() {return node('filter');}
    createBuffer(_channels, count) {return {getChannelData: () => new Float32Array(count)};}
  }
  try {
    for (const [key, value] of Object.entries({window: {AudioContext}, navigator: {userActivation: {hasBeenActive: true}}, addEventListener: name => listeners.push(name), fetch: async url => {requests.push(url);throw new Error('Optional sample unavailable');}})) Object.defineProperty(globalThis, key, {value, configurable: true, writable: true});
    const audio = initAudio();
    assert.equal(audio.isReal, true);
    assert.equal(audio.contextState, 'suspended');
    await audio.unlock();
    assert.equal(audio.contextState, 'running');
    assert.equal(audio.music('quiet'), 'silence');
    audio.sfx('beat');
    await Promise.resolve();
    assert.ok(nodes.some(item => item.kind === 'oscillator' && item.started && item.stopped), 'native recipe schedules real Web Audio nodes');
    assert.deepEqual(requests, ['assets/sfx/beat.ogg']);
    assert.equal(listeners.length, 4);
    audio.stopMusic(0);
    const firstNotes = nodes.filter(item => item.kind === 'oscillator' && item.started).length;
    const editorAudio = createSceneAudioController({assertGesture() {}, prepareAssets() {}});
    await editorAudio.start({music: 'quiet', stinger: 'beat'});
    await Promise.resolve();
    assert.deepEqual(requests, ['assets/sfx/beat.ogg'], 'editor mode must not fetch absent optional samples');
    assert.ok(nodes.filter(item => item.kind === 'oscillator' && item.started).length > firstNotes, 'editor still schedules the unchanged native synthesis recipe');
    editorAudio.stop();
  } finally {
    for (const [key, descriptor] of Object.entries(previous)) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  }
});

function engineFixture(unlock = async () => {}) {
  const calls = [];
  return {calls, engine: {isReal: true, unlock, music: cue => calls.push(['music', cue]), sfx: cue => calls.push(['sfx', cue]), stopMusic: fade => calls.push(['stop', fade]), setVolumes: volumes => calls.push(['volumes', volumes])}};
}

test('auditions reuse one engine, route native cues and stop both audio buses', async () => {
  const {calls, engine} = engineFixture();
  let allocations = 0;
  const audio = createSceneAudioController({createEngine: () => {allocations++;return engine;}, assertGesture() {}, prepareAssets() {}});
  assert.equal(allocations, 0);
  assert.equal((await audio.start({music: 'map', stinger: 'beat'})).state, 'playing');
  await audio.start({music: 'map', stinger: 'victory'}, {'settings.musicVolume': 22});
  assert.equal(allocations, 1);
  assert.deepEqual(calls.filter(call => call[0] === 'sfx'), [['sfx', 'beat'], ['sfx', 'victory']]);
  assert.ok(calls.some(call => call[0] === 'volumes' && call[1].musicVolume === 22));
  assert.equal(audio.stop().state, 'stopped');
  assert.deepEqual(calls.at(-1), ['volumes', {muteAudio: true}]);
  assert.ok(calls.some(call => call[0] === 'stop' && call[1] === 0));
});

test('stop cancels pending unlock so a late browser resume cannot start a cue', async () => {
  let release;
  const {calls, engine} = engineFixture(() => new Promise(resolve => {release = resolve;}));
  const audio = createSceneAudioController({createEngine: () => engine, assertGesture() {}, prepareAssets() {}});
  const starting = audio.start({music: 'boss', stinger: 'victory'});
  audio.stop();
  release();
  assert.equal((await starting).state, 'stopped');
  assert.equal(calls.some(call => call[0] === 'sfx'), false);
  assert.equal(calls.some(call => call[0] === 'music' && call[1] === 'boss'), false);
});

test('blocked browser, unavailable WebAudio and unsupported cues surface errors', async () => {
  const blocked = createSceneAudioController({assertGesture() {throw new Error('Press Audition audio');}, createEngine() {assert.fail('must remain lazy');}});
  await assert.rejects(blocked.start({music: 'map'}), /Press Audition/);
  assert.equal(blocked.status().state, 'error');
  const unavailable = createSceneAudioController({assertGesture() {}, prepareAssets() {}, createEngine: () => ({isReal: false})});
  await assert.rejects(unavailable.start({music: 'map'}), /Web Audio is unavailable/);
  const invalid = createSceneAudioController({assertGesture() {}, createEngine() {assert.fail('invalid cue must not allocate engine');}});
  await assert.rejects(invalid.start({music: 'fabricated'}), /unsupported native audio cue/);
  const {engine} = engineFixture(() => new Promise(() => {}));
  const timeout = createSceneAudioController({createEngine: () => engine, assertGesture() {}, prepareAssets() {}, unlockTimeoutMs: 5});
  await assert.rejects(timeout.start({music: 'map'}), /blocked by the browser/);
});
