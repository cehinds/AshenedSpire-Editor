import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {sceneArtUrl, sceneArtOptions, getActor, patchActor, getStage, patchStage, patchPresentation, reorderScene, addScene, sortedScenes, sceneDuration, formatTime, sequenceTimeline, sequenceLength, locateSequenceTime, nextSequenceScene, moveSequenceScene} from '../src/scene-studio-model.mjs';
import {parseCSV} from '../src/core.mjs';
import {parseNativeDocument, serializeNativeDocument} from '../src/native-document.mjs';

const source = JSON.parse(fs.readFileSync(new URL('../src/sources/prologue.json', import.meta.url)));
const scope = {structuredClone, queueMicrotask: () => {}};
vm.runInNewContext(fs.readFileSync(new URL('../src/native/game-preview/runtime.js', import.meta.url), 'utf8'), scope);
const native = scope.AshenNative;
const project = () => ({scenes: structuredClone(source)});
const sequence = p => p.scenes.components.sequence;
const config = p => native.prologueConfig(native.prologuePresetOverrides(sequence(p)));
const plain = value => JSON.parse(JSON.stringify(value));
globalThis.__ASHENEDSPIRE_ASSET_URL__ = path => `/preview/${path}`;

test('scene art uses every shipped native background, class variant and device', () => {
  assert.equal(sceneArtUrl({art: 'none'}), '');
  assert.equal(sceneArtUrl({art: 'not-real'}), '');
  assert.match(sceneArtUrl({art: 'carry'}, 'rogue'), /carry-rogue-desktop\.webp$/);
  assert.match(sceneArtUrl({art: 'carry'}, 'unknown', 'mobile'), /carry-reaver-mobile\.webp$/);
  for (const choice of sceneArtOptions()) {
    if (choice.id === 'none') continue;
    assert.ok(fs.existsSync(new URL(`../public/${choice.src.replace('/preview/', '')}`, import.meta.url)), choice.src);
  }
  const row = native.prologueRows().find(row => row.key === 'gameConfig.prologue.scenes.warmth.art');
  assert.deepEqual(sceneArtOptions().map(item => item.id), plain(row.choices));
});

test('actor effective defaults agree with the renderer for desktop and mobile', () => {
  const p = project();
  for (const scene of sequence(p).scenes) {
    const rendered = config(p).scenes.find(item => item.id === scene.id);
    for (const device of ['desktop', 'mobile']) assert.deepEqual(getActor(scene, device), plain(rendered.actor[device]));
  }
});

test('native actor edits preserve other device and fields while enabling manual placement', () => {
  const p = project();
  const scene = sequence(p).scenes.find(scene => scene.id === 'carry');
  const mobile = structuredClone(scene.actor.mobile);
  scene.actor.desktop.customMetadata = 'preserve';
  assert.ok(patchActor(p, scene.id, 'desktop', {x: 71, y: 92, height: 35, rotation: -32, layer: 'front', locked: false, opacity: 0.2}));
  assert.deepEqual(scene.actor.mobile, mobile);
  assert.equal(scene.actor.desktop.customMetadata, 'preserve');
  assert.equal(scene.actor.desktop.opacity, undefined);
  const actual = config(p).scenes.find(item => item.id === scene.id).actor.desktop;
  assert.deepEqual(plain(actual), {x: 71, y: 92, height: 35, rotation: -32, layer: 'front', locked: false, positionMode: 'manual'});
  patchActor(p, scene.id, 'desktop', {x: 140, height: -2, rotation: 200});
  assert.equal(scene.actor.desktop.x, 100);
  assert.equal(scene.actor.desktop.height, 10);
  assert.equal(scene.actor.desktop.rotation, 180);
  patchActor(p, scene.id, 'desktop', {positionMode: 'auto'});
  assert.equal(config(p).scenes.find(item => item.id === scene.id).actor.desktop.positionMode, 'auto');
  assert.equal(patchActor(p, 'unknown', 'desktop', {x: 20}), false);
});

test('scene staging inherits presentation until a native override is activated', () => {
  const p = project();
  const seq = sequence(p);
  const scene = seq.scenes[0];
  seq.presentation.imageFocusX = 63;
  scene.stage = {wash: 0.1, imageFocusX: 80};
  assert.equal(getStage(seq, scene).imageFocusX, 63);
  patchStage(p, scene.id, {imageFocusY: 24, imageScale: 1.4});
  assert.equal(scene.ownStaging, true);
  assert.equal(scene.stage.wash, 0.1);
  assert.equal(getStage(seq, scene).imageFocusX, 80);
  const rendered = config(p).scenes[0];
  assert.equal(rendered.stage.imageFocusY, 24);
  assert.equal(rendered.stage.imageScale, 1.4);
  assert.equal(rendered.ownStaging, true);
  assert.equal(patchStage(p, scene.id, {imageScale: 90, opacity: 0.1}), false);
  assert.equal(scene.stage.opacity, undefined);
});

test('master edits reach multiple scenes while retaining sparse local overrides and actor/audio records', () => {
  const p = project();
  const seq = sequence(p);
  const [first, second] = seq.scenes;
  patchStage(p, second.id, {textScale: 1.5, wash: 0.05});
  second.stage.foreign = {keep: true};
  seq.presentation.foreign = {source: 'retained'};
  const sceneRecords = structuredClone(seq.scenes);
  assert.ok(patchPresentation(p, {textScale: 1.2, textAlign: 'left', imageScale: 1.4, wash: 0.2, speed: 1.5, showPause: false}));
  assert.deepEqual(seq.scenes, sceneRecords);
  assert.deepEqual(seq.presentation.foreign, {source: 'retained'});
  assert.equal(getStage(seq, first).textScale, 1.2);
  assert.equal(getStage(seq, second).textScale, 1.5);
  for (const scene of [first, second]) {
    assert.equal(getStage(seq, scene).textAlign, 'left');
    assert.equal(getStage(seq, scene).imageScale, 1.4);
    const nativeConfig = config(p);
    const rendered = nativeConfig.scenes.find(item => item.id === scene.id);
    const effective = getStage(nativeConfig, rendered);
    assert.equal(effective.textScale, getStage(seq, scene).textScale);
    assert.equal(effective.imageScale, 1.4);
    assert.equal(effective.textAlign, 'left');
  }
  assert.equal(config(p).presentation.speed, 1.5);
  assert.equal(config(p).presentation.showPause, false);
});

test('caption height follows shared defaults, sparse scene overrides and the native staging toggle', () => {
  const p = project();
  const seq = sequence(p);
  const [first, second] = seq.scenes;
  assert.equal(getStage(seq, first).captionHeightVh, 18);
  assert.ok(patchPresentation(p, {captionFixedHeight: true, captionHeightVh: 24}));
  assert.ok(patchStage(p, second.id, {captionHeightVh: 30}));
  assert.equal(getStage(seq, first).captionFixedHeight, true);
  assert.equal(getStage(seq, first).captionHeightVh, 24);
  assert.equal(getStage(seq, second).captionFixedHeight, true);
  assert.equal(getStage(seq, second).captionHeightVh, 30);
  patchPresentation(p, {captionHeightVh: 20});
  assert.equal(getStage(seq, first).captionHeightVh, 20);
  assert.equal(getStage(seq, second).captionHeightVh, 30);
  second.ownStaging = false;
  assert.equal(getStage(seq, second).captionHeightVh, 20);
  assert.equal(second.stage.captionHeightVh, 30);
  // The editor adapter owns fixed height; the pinned native game never claims it.
  assert.equal(native.prologueRows().some(row => row.prologuePath?.includes('captionHeightVh')), false);
});

test('master patch accepts native row defaults and rejects invalid or unsupported global fields', () => {
  const p = project();
  for (const row of native.prologueRows().filter(row => row.prologuePath?.[0] === 'presentation')) {
    assert.ok(patchPresentation(p, {[row.prologuePath[1]]: row.def}), row.key);
    assert.ok(native.prologueValueIsValid(row, sequence(p).presentation[row.prologuePath[1]]), row.key);
  }
  const before = structuredClone(p);
  assert.equal(patchPresentation(p, {captionHeightVh: 0, captionFixedHeight: 'true', speed: 9, imageFocusX: 23.4, textBoxColor: 'red', music: 'boss', actor: {x: 50}}), false);
  assert.deepEqual(p, before);
  assert.equal(patchPresentation({}, {textScale: 1.2}), false);
  assert.equal(patchStage(p, sequence(p).scenes[0].id, {captionHeightVh: 101}), false);
  for (const height of [1, 100]) assert.ok(patchPresentation(p, {captionHeightVh: height}));
  assert.ok(patchPresentation(p, {textAlign: 'right', captionHeightVh: Infinity}));
  assert.equal(sequence(p).presentation.captionHeightVh, 100);
  assert.equal(sequence(p).presentation.textAlign, 'right');
});

test('native scene document serialization retains master height and local overrides', () => {
  const read = name => fs.readFileSync(new URL('../src/' + name, import.meta.url), 'utf8');
  const json = name => JSON.parse(read(name));
  const p = project();
  const cards = json('cards.json');
  Object.assign(p, {schema: 'ashenspire.workbench/1', cards, nodes: parseCSV(read('sources/nodes.csv')), deck: [], styles: {}, lab: {base: 40, role: 2, selected: true, policy: 'overflow', cardScale: 100}, ui: json('sources/w4a-combat.json'), pose: {...json('pose-config.json').components.starter, assets: json('pose-assets.json')}, scenario: {ruleset: 'foundations', cardId: cards[0].id, playerHp: 40, enemyHp: 30}, owned: {}, scenePlacement: {}});
  const receipt = {ws: 'scenes', revision: 'a'.repeat(64), parsed: parseNativeDocument('scenes', JSON.stringify(p.scenes))};
  const [first, second] = sequence(p).scenes;
  patchPresentation(p, {captionFixedHeight: true, captionHeightVh: 22, textScale: 1.2});
  patchStage(p, second.id, {captionHeightVh: 31, textScale: 1.5});
  const exported = JSON.parse(serializeNativeDocument(p, 'scenes', receipt));
  assert.deepEqual(exported, p.scenes);
  assert.equal(getStage(exported.components.sequence, exported.components.sequence.scenes[0]).captionHeightVh, 22);
  assert.equal(getStage(exported.components.sequence, exported.components.sequence.scenes[1]).captionHeightVh, 31);
  assert.equal(first.ownStaging, false);
});

test('all exposed effective stage fields remain accepted by the native validator', () => {
  const p = project();
  const seq = sequence(p);
  for (const scene of seq.scenes) {
    const effective = getStage(seq, scene);
    for (const row of native.prologueRows().filter(row => row.prologuePath?.[0] === 'scenes' && row.prologuePath?.[1] === '0' && row.prologuePath?.[2] === 'stage')) {
      assert.ok(native.prologueValueIsValid(row, effective[row.prologuePath[3]]), row.key);
    }
  }
});

test('scene reordering changes native playback without changing fixed slot ids', () => {
  const p = project();
  const ids = sequence(p).scenes.map(scene => scene.id);
  assert.equal(reorderScene(p, 'warmth', 'up'), false);
  assert.equal(reorderScene(p, 'year', 'up'), true);
  assert.deepEqual(sequence(p).scenes.map(scene => scene.id), ids);
  assert.equal(sortedScenes(sequence(p))[0].id, 'year');
  const nativeConfig = config(p);
  assert.equal(nativeConfig.scenes[native.prologueSequence(nativeConfig)[0]].id, 'year');
});

test('add scene activates only existing disabled native slots and preserves authored content', () => {
  const p = project();
  const extra = sequence(p).scenes.find(scene => scene.id === 'extraA');
  extra.text = 'Authored slot';
  assert.equal(addScene(p), 'extraA');
  assert.equal(extra.text, 'Authored slot');
  assert.equal(config(p).scenes.find(scene => scene.id === 'extraA').enabled, true);
  assert.equal(addScene(p), 'extraB');
  assert.equal(addScene(p), 'extraC');
  assert.equal(addScene(p), 'extraD');
  assert.equal(addScene(p), null);
  assert.equal(sequence(p).scenes.length, 9);
});

test('timeline duration follows native bounds and time formatting is stable', () => {
  assert.equal(sceneDuration({seconds: 0.1}), 5);
  assert.equal(sceneDuration({seconds: 180}), 180);
  assert.equal(sceneDuration({seconds: 181}), 5);
  assert.equal(formatTime(65.9), '01:05');
  assert.equal(formatTime(-1), '00:00');
});

test('sequence timeline lays out enabled scenes end to end for play-all', () => {
  const p = project();
  const enabled = sortedScenes(sequence(p)).filter(scene => scene.enabled !== false);
  const timeline = sequenceTimeline(sequence(p));
  assert.deepEqual(timeline.map(row => row.id), enabled.map(scene => scene.id));
  let start = 0;
  for (const row of timeline) {
    assert.equal(row.start, start);
    assert.equal(row.duration, sceneDuration(row.scene));
    assert.ok(row.textStart >= 0 && row.textStart <= row.duration);
    start += row.duration;
  }
  assert.equal(sequenceLength(timeline), start);
  const second = timeline[1];
  assert.deepEqual(locateSequenceTime(timeline, second.start + 0.5), {id: second.id, time: 0.5});
  assert.deepEqual(locateSequenceTime(timeline, start + 10), {id: timeline.at(-1).id, time: timeline.at(-1).duration});
  assert.equal(nextSequenceScene(timeline, timeline[0].id), second.id);
  assert.equal(nextSequenceScene(timeline, timeline.at(-1).id), null);
  assert.equal(nextSequenceScene(timeline, 'missing'), null);
  assert.equal(locateSequenceTime([], 3), null);
});

test('sequence scenes move among active scenes and keep disabled slots after them', () => {
  const p = project();
  const before = sequenceTimeline(sequence(p)).map(row => row.id);
  const disabled = sortedScenes(sequence(p)).filter(scene => scene.enabled === false).map(scene => scene.id);
  assert.equal(moveSequenceScene(p, before[0], 2), true);
  assert.deepEqual(sequenceTimeline(sequence(p)).map(row => row.id), [before[1], before[2], before[0], ...before.slice(3)]);
  assert.equal(moveSequenceScene(p, before[0], 99), true);
  assert.equal(sequenceTimeline(sequence(p)).at(-1).id, before[0]);
  assert.equal(moveSequenceScene(p, before[0], -5), true);
  assert.deepEqual(sequenceTimeline(sequence(p)).map(row => row.id), before);
  assert.deepEqual(sortedScenes(sequence(p)).filter(scene => scene.enabled === false).map(scene => scene.id), disabled);
  assert.equal(moveSequenceScene(p, before[0], 0), false);
  if (disabled.length) assert.equal(moveSequenceScene(p, disabled[0], 0), false);
  assert.equal(moveSequenceScene(p, 'missing', 1), false);
});

test('sequence scene moves keep interleaved disabled slots in place', () => {
  const p = project();
  const all = sortedScenes(sequence(p));
  const [a, b] = all.filter(scene => scene.enabled !== false);
  const disabled = all.find(scene => scene.enabled === false);
  const rest = all.filter(scene => ![a, b, disabled].includes(scene));
  [a, disabled, b, ...rest].forEach((scene, index) => {scene.order = index + 1;});
  assert.equal(moveSequenceScene(p, a.id, 1), true);
  assert.deepEqual(sortedScenes(sequence(p)).slice(0, 3).map(scene => scene.id), [b.id, disabled.id, a.id]);
  assert.equal(sortedScenes(sequence(p))[0].enabled !== false, true);
});
