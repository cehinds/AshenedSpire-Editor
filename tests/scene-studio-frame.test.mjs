import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {instrumentStudioRuntime, studioFrameDocument} from '../src/scene-studio-frame.mjs';
import {sceneFramePayload} from '../src/scene-playback.mjs';

const runtime = fs.readFileSync(new URL('../src/native/game-preview/runtime.js', import.meta.url), 'utf8');
const sequence = JSON.parse(fs.readFileSync(new URL('../src/sources/prologue.json', import.meta.url))).components.sequence;

class Element {
  constructor(tag) {
    this.tagName = tag; this.children = []; this.className = ''; this.textContent = ''; this.dataset = {};
    this.style = {setProperty(key, value) {this[key] = value;}, removeProperty(key) {delete this[key];}};
    this.classList = {
      contains: token => this.className.split(' ').includes(token),
      add: token => {if(!this.classList.contains(token))this.className=(this.className+' '+token).trim();},
      toggle: (token, enabled) => {this.className=this.className.split(' ').filter(value=>value!==token).join(' ');if(enabled)this.classList.add(token);},
    };
    this.isConnected = true; this.animations = [];
  }
  setAttribute(key, value) {this[key] = value;}
  appendChild(value) {this.children.push(value); return value;}
  append(...values) {this.children.push(...values);}
  replaceChildren(...values) {this.children = values;}
  insertBefore(value, before) {this.children.splice(this.children.indexOf(before), 0, value);}
  addEventListener() {}
  removeEventListener() {}
  closest() {return null;}
  focus() {}
  remove() {}
  decode() {return Promise.resolve();}
  getContext() {return {save() {}, restore() {}, translate() {}, transform() {}, scale() {}, drawImage() {}, fillRect() {}, createRadialGradient: () => ({addColorStop() {}})};}
  animate(frames, options) {const animation = {frames, options, currentTime: 0, pause() {}, cancel() {}, finish() {}}; this.animations.push(animation); return animation;}
  querySelectorAll(selector) {
    return this.children.flatMap(child => child instanceof Element ? [...(child.className.split(' ').includes(selector.slice(1)) ? [child] : []), ...child.querySelectorAll(selector)] : []);
  }
  querySelector(selector) {return this.querySelectorAll(selector)[0] || null;}
  getBoundingClientRect() {return {x: 100, y: 50, width: 400, height: 200};}
}

function nativeHarness() {
  const context = {structuredClone, queueMicrotask() {}};
  vm.createContext(context);
  vm.runInContext(instrumentStudioRuntime(runtime), context);
  const frames = new Map(); let frameId = 0;
  const responsiveEvents = new Map();
  const mobileQuery = {matches: false, addEventListener: (name, callback) => responsiveEvents.set(name, callback), removeEventListener: name => responsiveEvents.delete(name)};
  const host = new Element('div');
  Object.assign(context, {
    document: {hidden: false, body: new Element('body'), createElement: tag => new Element(tag), createTextNode: text => text, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {}},
    matchMedia: query => query.includes('orientation') ? mobileQuery : {matches: false, addEventListener() {}, removeEventListener() {}},
    Image: class extends Element {constructor() {super('img');this.naturalWidth=200;this.naturalHeight=400;}},
    requestAnimationFrame: callback => {frames.set(++frameId, callback); return frameId;},
    cancelAnimationFrame: id => frames.delete(id),
    setTimeout, clearTimeout,
  });
  return {context, host, setMobile(matches) {mobileQuery.matches=matches;responsiveEvents.get('change')?.();}, advance(time) {const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(time));}};
}

test('checked instrumentation keeps the original bundle untouched and rejects unsupported revisions', () => {
  const original = runtime;
  new vm.Script(instrumentStudioRuntime(runtime));
  assert.equal(runtime, original);
  assert.throws(() => instrumentStudioRuntime('var AshenNative = {};'), /does not support/);
  assert.throws(() => instrumentStudioRuntime(runtime.replace('te=!1,v.disabled=!1,V=0}', 'te=!1,v.disabled=!1,V=1}')), /clock changed/);
});

test('native seeking drives actual animation currentTime, delayed reveal, reverse seek, and bounded playback', async () => {
  const {context, host, advance} = nativeHarness();
  const draft = structuredClone(sequence);
  draft.presentation = {...draft.presentation, reveal: 'typewriter', revealSpeed: 10, textDelaySeconds: 1, autoAdvance: true};
  draft.scenes[0].text = 'abcdefghijklmnopqrst';
  const settings = context.AshenNative.prologuePresetOverrides(draft);
  const shown = [];
  const cleanup = context.AshenNative.mountPrologue(host, {settings, startScene: 0, preview: true, onScene: index => shown.push(index)});
  const clock = host.__ashenStudio;
  clock.pause();
  clock.seek(1.5);
  // The image decode is asynchronous, matching the real native mount path.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(clock.ready, true);
  assert.equal(clock.time, 1.5, 'pending seek survives asynchronous native image decoding');
  const plate = host.querySelector('.prologue-plate');
  assert.ok(plate.animations.length > 0, 'native transition/camera animations exist');
  clock.seek(1.5);
  assert.equal(clock.time, 1.5);
  assert.ok(plate.animations.every(animation => animation.currentTime === 1500));
  assert.equal(host.querySelector('.prologue-said').textContent, 'abcde');
  clock.seek(.5);
  assert.equal(host.querySelector('.prologue-said').textContent, '');
  clock.seek(999);
  assert.equal(clock.time, 5);
  clock.play();
  assert.equal(clock.time, 0, 'play from the end restarts the selected scene');
  clock.seek(4.9);
  advance(1000); advance(1250);
  assert.equal(clock.time, 5);
  assert.equal(clock.playing, false);
  assert.deepEqual(shown, [0], 'studio never auto advances despite game autoAdvance setting');
  clock.seek(-8);
  assert.equal(clock.time, 0);
  clock.seek(NaN);
  assert.equal(clock.time, 0);
  cleanup();
});

test('native responsive remounts replace outgoing actors after decode, including rapid device switches', async () => {
  const {context, host, setMobile} = nativeHarness();
  const draft = structuredClone(sequence);
  draft.scenes[0].character = true;
  draft.scenes[0].actor = {desktop: {x: 20, y: 80, height: 40}, mobile: {x: 70, y: 75, height: 30}};
  const cleanup = context.AshenNative.mountPrologue(host, {settings: context.AshenNative.prologuePresetOverrides(draft), startScene: 0, preview: true});
  const clock = host.__ashenStudio;
  clock.pause();clock.seek(1);
  await new Promise(resolve => setImmediate(resolve));
  const desktopActor = host.querySelector('.prologue-actor');
  assert.equal(desktopActor.style.left, '20%');
  setMobile(true);
  assert.equal(host.querySelector('.prologue-actor'), desktopActor, 'keep ready art visible while replacement decodes');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(host.querySelectorAll('.prologue-plate').length, 1);
  assert.equal(host.querySelectorAll('.prologue-actor').length, 1, 'outgoing actor cannot paint above the new background');
  assert.equal(host.querySelector('.prologue-actor').style.left, '70%');
  setMobile(false);setMobile(true);setMobile(false);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(host.querySelectorAll('.prologue-plate').length, 1);
  assert.equal(host.querySelectorAll('.prologue-actor').length, 1);
  assert.equal(host.querySelector('.prologue-actor').style.left, '20%');
  assert.equal(clock.time, 1);
  assert.equal(clock.playing, false);
  cleanup();
});

function frameHarness(payload) {
  const html = studioFrameDocument({runtime, styles: '', assets: {}, payload, channel: 'trusted-studio'});
  const bridge = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][1][1];
  const events = new Map(), messages = [], calls = [];
  const host = new Element('div');
  const plate = new Element('div'); plate.className = 'prologue-plate'; host.append(plate);
  const actor = new Element('canvas'); actor.className = 'prologue-actor'; plate.append(actor);
  const screen = new Element('section'); screen.className = 'prologue-screen'; host.append(screen);
  const caption = new Element('div'); caption.className = 'prologue-caption'; screen.append(caption);
  const parent = {postMessage: value => messages.push(value)};
  let mounted;
  const clock = {time: 0, duration: 5, playing: false, ready: true, seek(time) {this.time = time; calls.push(['seek', time]);}, play() {this.playing = true;}, pause() {this.playing = false;}};
  const native = {ASSET_MAP: {}, prologuePresetOverrides(value) {mounted = value;return {};}, prologueConfig: () => ({scenes: payload.sequence.scenes}), prologueRows: () => [], mountPrologue() {host.__ashenStudio = clock;return () => calls.push(['cleanup']);}};
  vm.runInNewContext(bridge, {parent, structuredClone, document: {getElementById: () => host}, HTMLElement: Element, AshenNative: native, addEventListener: (name, callback) => events.set(name, callback), requestAnimationFrame: () => 1, cancelAnimationFrame() {}, innerWidth: 1000, innerHeight: 500});
  const command = (command, extra = {}, source = parent, channel = 'trusted-studio') => events.get('message')({source, data: {channel, type: 'studio-command', command, ...extra}});
  return {command, clock, calls, messages, mounted, actor, screen, events, host, plate, caption};
}

test('studio commands require parent/channel and emit viewport geometry; temporary drag updates real native styles', () => {
  const payload = sceneFramePayload({scenes: {components: {sequence}}}, 'warmth');
  const {command, clock, messages, actor, screen, caption, plate} = frameHarness(payload);
  command('seek', {time: 2}, {});
  command('seek', {time: 2}, undefined, 'other-channel');
  assert.equal(clock.time, 0);
  command('seek', {time: 2});
  assert.equal(clock.time, 2);
  command('play'); assert.equal(clock.playing, true);
  command('seek', {time: 3});
  assert.equal(clock.playing, false, 'scrubbing pauses native playback as well as the parent transport');
  assert.equal(clock.time, 3);
  command('pause'); assert.equal(clock.playing, false);
  command('actor-preview', {values: {x: 20, y: 80, height: 50, rotation: 12}});
  assert.equal(actor.style.left, '20%');
  assert.equal(actor.style.bottom, '4%');
  assert.equal(actor.style.height, '66%');
  assert.equal(actor.style.transform, 'translateX(-50%) rotate(12deg)');
  screen.classList.add('prologue-layout-caption');
  command('text-preview', {values: {layout: 'overlay', textPosition: 'top-right', textInsetX: 8, textInsetY: 12}});
  assert.equal(screen.style['--prologue-inset-x'], '8');
  assert.equal(screen.classList.contains('prologue-layout-overlay'), true);
  assert.equal(screen.classList.contains('prologue-layout-caption'), false);
  assert.equal(caption.dataset.position, 'top-right');
  command('text-preview', {values: {textPosition: 'invalid-position'}});
  assert.equal(caption.dataset.position, 'top-right');
  command('background-preview', {values: {imageFocusX: 23, imageFocusY: 67}});
  assert.equal(plate.style['--prologue-focus'], '23% 67%');
  const metrics = messages.find(message => message.type === 'metrics');
  assert.deepEqual(JSON.parse(JSON.stringify(metrics.actor)), {x: 10, y: 10, width: 40, height: 40});
  assert.ok(messages.some(message => message.type === 'ready'));
});

test('disabled scene preview uses a clone and update can restore native time without mutating the draft', () => {
  const draft = structuredClone(sequence); draft.scenes[0].enabled = false;
  const payload = sceneFramePayload({scenes: {components: {sequence: draft}}}, 'warmth');
  payload.studio = {time: 2};
  const {mounted, command, clock, calls, events} = frameHarness(payload);
  assert.equal(draft.scenes[0].enabled, false);
  assert.equal(mounted.scenes[0].enabled, true);
  assert.equal(mounted.presentation.autoAdvance, false);
  assert.equal(clock.time, 2);
  command('update', {payload: {...payload, studio: {time: 3}}});
  assert.equal(clock.time, 3);
  assert.equal(calls.filter(call => call[0] === 'cleanup').length, 1);
  command('update', {payload: {...payload, studio: undefined}});
  assert.equal(clock.time, 3, 'same-scene draft updates retain time when no explicit time is supplied');
  events.get('pagehide')();
  command('seek', {time: 4});
  assert.equal(clock.time, 3);
});

test('responsive remount metrics and drag previews target the newest native plate', () => {
  const payload = sceneFramePayload({scenes: {components: {sequence}}}, 'warmth');
  const {host, actor, command, messages} = frameHarness(payload);
  const outgoing = new Element('div'); outgoing.className = 'prologue-plate';
  const oldActor = new Element('canvas'); oldActor.className = 'prologue-actor';
  oldActor.getBoundingClientRect = () => ({x: 800, y: 0, width: 50, height: 50});
  outgoing.append(oldActor); host.children.unshift(outgoing);
  command('actor-preview', {values: {x: 30, y: 70, height: 40}});
  assert.equal(actor.style.left, '30%');
  assert.equal(oldActor.style.left, undefined);
  assert.equal(messages.at(-1).actor.x, 10);
});

test('draft text cannot close the frame script and nested asset URLs resolve', () => {
  const html = studioFrameDocument({runtime, styles: '.art{background:url(../assets/a.webp)}', assets: {'assets/a.webp': 'data:image/webp;base64,abc'}, payload: {text: '</script><img src=x onerror=alert(1)>'}, channel: 'studio'});
  assert.equal([...html.matchAll(/<script>/g)].length, 2);
  assert.ok(html.includes('url("data:image/webp;base64,abc")'));
  assert.ok(html.includes('\\u003c/script>'));
  [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach(match => new vm.Script(match[1]));
});
