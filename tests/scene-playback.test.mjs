import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {sceneFramePayload, sceneFrameDocument, scriptJson} from '../src/scene-playback.mjs';
const sequence = JSON.parse(fs.readFileSync(new URL('../src/sources/prologue.json', import.meta.url))).components.sequence;
const nativeContext = {structuredClone, queueMicrotask: () => {}};
vm.createContext(nativeContext);
vm.runInContext(fs.readFileSync(new URL('../src/native/game-preview/runtime.js', import.meta.url), 'utf8'), nativeContext);
const native = nativeContext.AshenNative;
const configFrom = sequence => native.prologueConfig(native.prologuePresetOverrides(sequence));

test('draft adapter retains native records, identity, and only native settings namespace', () => {
  const project = {scenes: {components: {sequence}}, gameSettings: {overrides: {'settings.reducedMotion': true, 'gameConfig.progression.xpMultiplier': 2}}};
  const payload = sceneFramePayload(project, 'carry', {classId: 'rogue', name: 'Ada', location: 'Hamlet'}, true);
  assert.equal(payload.sequence, sequence);
  assert.equal(payload.selectedId, 'carry');
  assert.equal(payload.playing, true);
  assert.deepEqual(payload.settings, {reducedMotion: true});
  assert.equal(payload.run.class, 'rogue');
  assert.equal(payload.run.customization.name, 'Ada');
  assert.equal(payload.run.journey.anchors.start, 'Hamlet');
});

test('real native config receives authored text, timing, order, enabled and wait gates', () => {
  const changed = structuredClone(sequence);
  changed.scenes[0].seconds = 9;
  changed.scenes[0].speaker = 'A new witness';
  changed.scenes[0].text = 'Words in the running game.';
  changed.scenes[0].waitForInput = true;
  changed.scenes[1].enabled = false;
  changed.scenes[2].order = 1;
  changed.scenes[0].order = 3;
  changed.presentation.speed = 2;
  changed.presentation.autoAdvance = false;
  const config = configFrom(changed);
  assert.equal(config.scenes[0].speaker, 'A new witness');
  assert.equal(config.scenes[0].text, 'Words in the running game.');
  assert.equal(native.prologueSceneMs(config.scenes[0]), 9000);
  assert.equal(config.scenes[0].waitForInput, true);
  assert.equal(config.presentation.speed, 2);
  assert.equal(config.presentation.autoAdvance, false);
  assert.equal(native.prologueSequence(config)[0], 2);
  assert.equal(native.prologueSequence(config).includes(1), false);
});

test('native text substitutions resolve declared preview identity and actual class line', () => {
  const config = configFrom(sequence);
  const copy = native.prologueCopy({name: 'Intro', speaker: '{class}', text: '{classLine} {name}', location: '{location}'}, config, {classId: 'rogue', name: 'Ada', location: 'Hamlet'});
  assert.equal(copy.speaker, config.classes.rogue.name);
  assert.equal(copy.text, config.classes.rogue.line + ' Ada');
  assert.equal(copy.location, 'Hamlet');
});

test('native traveller controls apply new actors to scenes and preserve per-device defaults', () => {
  const changed = structuredClone(sequence);
  changed.scenes[0].character = true;
  changed.scenes[0].actor = {desktop: {x: 67, y: 72, height: 38, positionMode: 'manual'}};
  const config = configFrom(changed);
  assert.equal(config.scenes[0].character, true);
  assert.equal(config.scenes[0].actor.desktop.x, 67);
  assert.equal(config.scenes[0].actor.desktop.y, 72);
  assert.equal(config.scenes[0].actor.desktop.height, 38);
  assert.equal(config.scenes[0].actor.desktop.positionMode, 'manual');
  assert.equal(config.scenes[0].actor.mobile.x, native.PROLOGUE_DEFAULTS.scenes[0].actor.mobile.x);
});

test('unknown scenes fail visibly through native adapter, rather than silently rendering another record', () => {
  const changed = structuredClone(sequence);
  changed.scenes[0].id = 'unknown-game-scene';
  assert.throws(() => configFrom(changed), /unknown scene/);
});

test('untrusted scene text cannot escape iframe script; asset CSS is resolved for nested build URLs', () => {
  const hostile = '</script><img src=x onerror=alert(1)>';
  const encoded = scriptJson({text: hostile});
  assert.equal(encoded.includes('</script>'), false);
  assert.equal(JSON.parse(encoded).text, hostile);
  const html = sceneFrameDocument({runtime: 'var AshenNative={};', styles: '.art{background:url(\'../assets/a.webp\')}', assets: {'assets/a.webp': 'data:image/webp;base64,abc'}, payload: {text: hostile}, channel: 'test'});
  assert.equal((html.match(/<script>/g) || []).length, 2);
  assert.ok(html.includes('url("data:image/webp;base64,abc")'));
  assert.ok(html.includes('AshenNative.mountPrologue'));
});

test('toolbar commands require the parent source and matching channel, and stop after completion', () => {
  const events = new Map();
  const hostEvents = new Map();
  const messages = [];
  const parent = {postMessage: value => messages.push(value)};
  let callbacks;
  const button = {textContent: 'Pause', disabled: false, closest: () => button, click() {
    this.textContent = this.textContent === 'Pause' ? 'Resume' : 'Pause';
    hostEvents.get('click')?.({target: this});
  }};
  const host = {querySelector: () => button, querySelectorAll: () => [button], addEventListener: (name, callback) => hostEvents.set(name, callback)};
  const payload = sceneFramePayload({scenes: {components: {sequence}}}, 'warmth', {}, true);
  const html = sceneFrameDocument({runtime: '', styles: '', assets: {}, payload, channel: 'trusted-preview'});
  const bridge = Array.from(html.matchAll(/<script>([\s\S]*?)<\/script>/g))[1][1];
  const context = {parent, document: {getElementById: () => host}, HTMLElement: {prototype: {focus() {}}}, addEventListener: (name, callback) => events.set(name, callback), AshenNative: {...native, mountPrologue: (_, options) => {callbacks = options; return () => {};}}};
  vm.runInNewContext(bridge, context);
  const command = (source, channel, command) => events.get('message')({source, data: {channel, type: 'scene-command', command}});
  command({}, 'trusted-preview', 'pause');
  command(parent, 'untrusted-preview', 'pause');
  assert.equal(button.textContent, 'Pause');
  command(parent, 'trusted-preview', 'pause');
  assert.equal(button.textContent, 'Resume');
  assert.equal(messages.at(-1).state, 'Paused');
  command(parent, 'trusted-preview', 'resume');
  assert.equal(messages.at(-1).state, 'Playing');
  callbacks.onFinish('completed');
  assert.equal(button.disabled, true);
  command(parent, 'trusted-preview', 'pause');
  assert.equal(messages.at(-1).type, 'finished');
  assert.equal(messages.at(-1).reason, 'completed');
});
