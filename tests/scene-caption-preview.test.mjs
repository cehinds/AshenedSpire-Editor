import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {resolveCaptionPreview, applyCaptionPreview, fitCaption, captionPreviewStyles} from '../src/scene-caption-preview.mjs';
import {getStage} from '../src/scene-studio-model.mjs';
import {sceneFramePayload, sceneFrameDocument} from '../src/scene-playback.mjs';
import {studioFrameDocument} from '../src/scene-studio-frame.mjs';

const sequence = JSON.parse(fs.readFileSync(new URL('../src/sources/prologue.json', import.meta.url))).components.sequence;
const runtime = fs.readFileSync(new URL('../src/native/game-preview/runtime.js', import.meta.url), 'utf8');
function screenElement() {
  const classes = new Set();
  return {classList: {toggle(name, enabled) {enabled ? classes.add(name) : classes.delete(name);}, contains: name => classes.has(name)}, style: {setProperty(key, value) {this[key] = value;}, removeProperty(key) {delete this[key];}}};
}

test('caption resolver agrees with editor staging for inherited, local, invalid and disabled overrides', () => {
  const draft = structuredClone(sequence);
  draft.presentation = {...draft.presentation, captionFixedHeight: true, captionHeightVh: 25};
  const scene = draft.scenes[0];
  for (const [ownStaging, stage] of [[false, {captionHeightVh: 40}], [true, {captionHeightVh: 40}], [true, {captionFixedHeight: false}], [true, {captionFixedHeight: 'yes', captionHeightVh: NaN}], [true, {captionHeightVh: 101}], [true, {captionHeightVh: 1}], [true, {captionHeightVh: 100}], [true, {captionVerticalAlign: 'middle'}], [true, {captionVerticalAlign: 'sideways'}], [true, {captionOverflow: 'shrink'}], [true, {captionOverflow: 'wrap'}]]) {
    Object.assign(scene, {ownStaging, stage});
    const effective = getStage(draft, scene);
    assert.deepEqual(resolveCaptionPreview(draft, scene.id), {captionFixedHeight: effective.captionFixedHeight, captionHeightVh: effective.captionHeightVh, captionVerticalAlign: effective.captionVerticalAlign, captionOverflow: effective.captionOverflow});
  }
  assert.deepEqual(resolveCaptionPreview(undefined, 'unknown'), {captionFixedHeight: false, captionHeightVh: 18, captionVerticalAlign: 'auto', captionOverflow: 'scroll'});
});

test('fixed height applies viewport units and automatic sizing removes all adapter state', () => {
  const screen = screenElement();
  const host = {querySelector: () => screen};
  const draft = structuredClone(sequence);
  draft.presentation = {...draft.presentation, captionFixedHeight: true, captionHeightVh: 22.5};
  applyCaptionPreview(host, draft, draft.scenes[0].id);
  assert.equal(screen.style['--editor-caption-height'], '22.5vh');
  assert.equal(screen.classList.contains('editor-caption-fixed'), true);
  draft.presentation.captionFixedHeight = false;
  applyCaptionPreview(host, draft, draft.scenes[0].id);
  assert.equal(screen.style['--editor-caption-height'], undefined);
  assert.equal(screen.classList.contains('editor-caption-fixed'), false);
  assert.match(captionPreviewStyles, /box-sizing:border-box;height:var\(--editor-caption-height\)/);
  assert.match(captionPreviewStyles, /grid-template-rows:minmax\(0,1fr\) var\(--editor-caption-height\) auto/);
  assert.match(captionPreviewStyles, /overflow:auto/);
  assert.match(captionPreviewStyles, /orientation:portrait/);
});

test('vertical align toggles one editor class and native default removes them', () => {
  const screen = screenElement();
  const host = {querySelector: () => screen};
  const draft = structuredClone(sequence);
  draft.presentation = {...draft.presentation, captionFixedHeight: true, captionVerticalAlign: 'bottom'};
  applyCaptionPreview(host, draft, draft.scenes[0].id);
  assert.equal(screen.classList.contains('editor-caption-valign-bottom'), true);
  assert.equal(screen.classList.contains('editor-caption-valign-top'), false);
  Object.assign(draft.scenes[0], {ownStaging: true, stage: {captionVerticalAlign: 'middle'}});
  applyCaptionPreview(host, draft, draft.scenes[0].id);
  assert.equal(screen.classList.contains('editor-caption-valign-middle'), true);
  assert.equal(screen.classList.contains('editor-caption-valign-bottom'), false);
  draft.scenes[0].stage.captionVerticalAlign = 'auto';
  applyCaptionPreview(host, draft, draft.scenes[0].id);
  assert.equal(['top', 'middle', 'bottom'].some(align => screen.classList.contains(`editor-caption-valign-${align}`)), false);
  assert.match(captionPreviewStyles, /editor-caption-valign-middle \.prologue-caption\{justify-content:safe center\}/);
  assert.doesNotMatch(captionPreviewStyles, /(^|[^ ])\.prologue-screen\.editor-caption-valign/m);
});

function bridgeHarness(draft, studio) {
  const screen = screenElement(), events = new Map();
  const host = {querySelector: selector => selector === '.prologue-screen' ? screen : null, querySelectorAll: () => [], addEventListener() {}};
  const payload = sceneFramePayload({scenes: {components: {sequence: draft}}}, draft.scenes[0].id);
  const channel = 'caption-test';
  const html = (studio ? studioFrameDocument : sceneFrameDocument)({runtime: studio ? runtime : '', styles: '', assets: {}, payload, channel});
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][1][1];
  const parent = {postMessage() {}};
  let callbacks;
  const clock = {time: 0, duration: 5, playing: false, ready: true, revision: 1, seek(value) {this.time = value;}, play() {this.playing = true;}, pause() {this.playing = false;}};
  const native = {ASSET_MAP: {}, prologuePresetOverrides() {return {};}, prologueConfig() {return {scenes: draft.scenes, labels: {pause: 'Pause', resume: 'Resume'}};}, prologueRows: () => [], mountPrologue(_, options) {callbacks = options;host.__ashenStudio = clock;options.onScene(options.startScene);return () => {};}};
  vm.runInNewContext(script, {structuredClone, parent, document: {getElementById: () => host}, HTMLElement: {prototype: {focus() {}}}, AshenNative: native, addEventListener: (name, callback) => events.set(name, callback), requestAnimationFrame: () => 1, cancelAnimationFrame() {}, innerWidth: 1000, innerHeight: 500});
  return {screen, enter: index => callbacks.onScene(index), update(next) {events.get('message')({source: parent, data: {channel, type: 'studio-command', command: 'update', payload: next}});}, payload};
}

test('native In game entry callback applies local heights and restores automatic sizing on the next scene', () => {
  const draft = structuredClone(sequence);
  draft.presentation = {...draft.presentation, captionFixedHeight: true, captionHeightVh: 20};
  Object.assign(draft.scenes[1], {ownStaging: true, stage: {captionHeightVh: 30}});
  Object.assign(draft.scenes[2], {ownStaging: true, stage: {captionFixedHeight: false}});
  const {screen, enter} = bridgeHarness(draft, false);
  assert.equal(screen.style['--editor-caption-height'], '20vh');
  enter(1);
  assert.equal(screen.style['--editor-caption-height'], '30vh');
  enter(2);
  assert.equal(screen.style['--editor-caption-height'], undefined);
  assert.equal(screen.classList.contains('editor-caption-fixed'), false);
});

test('studio draft refresh responds to master edits, selected scene overrides and automatic recovery', () => {
  const draft = structuredClone(sequence);
  draft.presentation = {...draft.presentation, captionFixedHeight: true, captionHeightVh: 24};
  Object.assign(draft.scenes[1], {ownStaging: true, stage: {captionHeightVh: 30}});
  const {screen, update, payload} = bridgeHarness(draft, true);
  assert.equal(screen.style['--editor-caption-height'], '24vh');
  const changed = structuredClone(draft);
  changed.presentation.captionHeightVh = 35;
  update({...payload, sequence: changed});
  assert.equal(screen.style['--editor-caption-height'], '35vh');
  update({...payload, sequence: changed, selectedId: changed.scenes[1].id});
  assert.equal(screen.style['--editor-caption-height'], '30vh');
  changed.presentation.captionFixedHeight = false;
  update({...payload, sequence: changed, selectedId: changed.scenes[0].id});
  assert.equal(screen.style['--editor-caption-height'], undefined);
  assert.equal(screen.classList.contains('editor-caption-fixed'), false);
});

test('overflow modes apply only with a fixed height and shrink fits text without resizing the box', () => {
  const screen = screenElement();
  const draft = structuredClone(sequence);
  draft.presentation = {...draft.presentation, captionFixedHeight: false, captionOverflow: 'shrink'};
  applyCaptionPreview({querySelector: () => screen}, draft, draft.scenes[0].id);
  assert.equal(screen.classList.contains('editor-caption-overflow-shrink'), false);
  draft.presentation.captionFixedHeight = true;
  applyCaptionPreview({querySelector: () => screen}, draft, draft.scenes[0].id);
  assert.equal(screen.classList.contains('editor-caption-overflow-shrink'), true);
  draft.presentation.captionOverflow = 'clip';
  applyCaptionPreview({querySelector: () => screen}, draft, draft.scenes[0].id);
  assert.equal(screen.classList.contains('editor-caption-overflow-shrink'), false);
  assert.equal(screen.classList.contains('editor-caption-overflow-clip'), true);
  assert.match(captionPreviewStyles, /editor-caption-overflow-shrink,\.editor-caption-overflow-clip\) \.prologue-caption\{overflow:hidden\}/);

  // Text height scales with --prologue-text-scale; the box stays 100px tall.
  const caption = {dataset: {}, textContent: 'x'.repeat(40), clientHeight: 100, clientWidth: 300, scale: 1, style: {setProperty(_, value) {caption.scale = Number(value);}, removeProperty() {caption.scale = 1;}}, get scrollHeight() {return 160 * caption.scale;}};
  const shrinkScreen = screenElement();
  shrinkScreen.classList.toggle('editor-caption-overflow-shrink', true);
  const host = {querySelector: selector => selector === '.prologue-caption' ? caption : shrinkScreen};
  globalThis.getComputedStyle = () => ({getPropertyValue: () => '1'});
  try {
    const result = fitCaption(host);
    assert.equal(result.overflow, false);
    assert.ok(result.fit <= 0.63 && result.fit > 0.55, String(result.fit));
    caption.textContent = 'x'.repeat(400);
    Object.defineProperty(caption, 'scrollHeight', {get() {return 1000 * caption.scale;}});
    assert.deepEqual(fitCaption(host), {overflow: true, fit: 0.4});
    shrinkScreen.classList.toggle('editor-caption-overflow-shrink', false);
    assert.equal(fitCaption(host).fit, 1);
    assert.equal(caption.scale, 1);
  } finally {delete globalThis.getComputedStyle;}
});
