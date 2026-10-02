import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {installCardEditor} from '../src/native-card-editor.mjs';

class Element {
  constructor(doc) {this.ownerDocument = doc; this.style = {backgroundImage: '', backgroundSize: '', backgroundPosition: '', position: '', touchAction: ''}; this.dataset = {}; this.attrs = new Map(); this.children = []; this.listeners = new Map(); this.classes = new Set(); this.classList = {add: key => this.classes.add(key), remove: key => this.classes.delete(key)}; this.scrollLeft = this.scrollTop = 0; this.rect = {left: 0, top: 0, width: 800, height: 700}; this.offsetWidth = 800; this.offsetHeight = 700;}
  append(child) {child.parentElement = this; this.children.push(child);}
  remove() {if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); this.parentElement = null;}
  contains(child) {return child === this || this.children.some(item => item.contains(child));}
  setAttribute(key, value) {this.attrs.set(key, value);}
  getAttribute(key) {return this.attrs.get(key) ?? null;}
  hasAttribute(key) {return this.attrs.has(key);}
  removeAttribute(key) {this.attrs.delete(key);}
  getBoundingClientRect() {return this.rect;}
  querySelector(selector) {return this.parts?.[selector] || null;}
  closest(selector) {const key = selector === '[data-editor-part]' ? 'editorPart' : 'editorRotate'; return this.dataset[key] ? this : this.parentElement?.closest(selector);}
  addEventListener(type, handler) {this.listeners.set(type, handler);}
  removeEventListener(type) {this.listeners.delete(type);}
  setPointerCapture(id) {this.capture = id;}
  hasPointerCapture(id) {return this.capture === id;}
  releasePointerCapture() {this.capture = null;}
}

function fixture({editable = true, layout = {}, zoom = 100, selected = ['identity']} = {}) {
  let frame = null;
  const doc = {defaultView: {getComputedStyle: () => ({position: 'static'}), addEventListener() {}, removeEventListener() {}, requestAnimationFrame(callback) {frame = callback; return 1;}, cancelAnimationFrame() {frame = null;}}};
  doc.createElement = () => new Element(doc); doc.head = new Element(doc);
  const host = new Element(doc), wrapper = new Element(doc), face = new Element(doc);
  face.offsetWidth = 280; face.offsetHeight = 392; face.rect = {left: 100, top: 100, width: 140, height: 196};
  host.append(wrapper); wrapper.append(face);
  const identity = new Element(doc), costs = new Element(doc);
  identity.rect = {left: 110, top: 120, width: 100, height: 30}; costs.rect = {left: 110, top: 160, width: 50, height: 20};
  face.append(identity); face.append(costs); face.parts = {'.cname': identity, '.card-cost-rail': costs};
  const customElements = {};
  for (const id of Object.keys(layout.custom || {})) {
    const element = new Element(doc);
    element.rect = {left: 120, top: 180, width: 80, height: 25};
    face.append(element); face.parts[`[data-card-component="${id}"]`] = element; customElements[id] = element;
  }
  const definitions = [{id: 'identity', label: 'Name', selector: '.cname'}, {id: 'costs', label: 'Costs', selector: '.card-cost-rail'}];
  const emitted = [], rawEmitted = [], applied = [];
  // Execute the exact serialized function, so accidental import/closure use fails.
  const installer = vm.runInNewContext(`(${installCardEditor.toString()})`);
  const editor = installer(host, event => {rawEmitted.push(event); emitted.push(JSON.parse(JSON.stringify(event)));}, (_face, value) => {applied.push(JSON.parse(JSON.stringify(value))); return {identity: {x: 20 + (value.parts?.identity?.x || 0), y: 40, width: 200, height: 60}, costs: {x: 20, y: 120, width: 100, height: 40}};}, definitions);
  const snapshot = {editable, ids: ['ambush'], zoom, draft: {styles: {ambush: {layout}}}, layoutSelection: selected, layoutView: {gridEnabled: true, gridSize: 10, snapEnabled: true, rotationSnap: 15}};
  editor.update(snapshot, [face]);
  const event = (type, target = identity, extra = {}) => {
    const value = {target, button: 0, pointerId: 1, clientX: 150, clientY: 150, preventDefault() {this.prevented = true;}, stopPropagation() {}, ...extra};
    host.listeners.get(type)?.(value); return value;
  };
  const flushFrame = () => {const callback = frame; frame = null; callback?.();};
  return {host, wrapper, face, identity, costs, customElements, editor, snapshot, emitted, rawEmitted, applied, event, flushFrame};
}

test('native and custom linked parts remain selectable while a group lock blocks all mutations', () => {
  const layout = {custom: {'component-1': {kind: 'text', label: 'Caption'}}, parts: {identity: {groupId: 'heading'}, 'component-1': {groupId: 'heading', locked: true}}};
  const f = fixture({layout});
  const custom = f.customElements['component-1'];
  assert.equal(custom.getAttribute('role'), 'button');
  assert.match(custom.getAttribute('aria-label'), /Caption; locked/);
  assert.equal(f.identity.dataset.editorLocked, 'true');
  assert.equal(f.host.children.some(element => element.dataset.editorRotate), false);
  for (const target of [custom, f.identity]) {
    f.event('pointerdown', target); f.event('pointermove', target, {clientX: 200}); f.event('pointerup', target);
    f.event('keydown', target, {key: 'ArrowRight'});
    f.event('keydown', target, {key: 'Enter'}); f.event('dblclick', target);
    const dataTransfer = {types: ['Files'], files: [{type: 'image/png', size: 100}]};
    f.event('dragover', target, {dataTransfer}); assert.equal(dataTransfer.dropEffect, 'none');
    f.event('drop', target, {dataTransfer});
  }
  assert.equal(f.applied.length, 0);
  assert.ok(f.emitted.length >= 2);
  assert.ok(f.emitted.every(event => event.type === 'card-part-select'));
  f.editor.destroy();
});

test('custom component selection, grouped movement, rotation and art drops use stable IDs', () => {
  const layout = {custom: {'component-1': {kind: 'image', label: 'Seal'}}, parts: {'component-1': {groupId: 'heading'}, identity: {groupId: 'heading'}}};
  const f = fixture({layout, selected: ['component-1']});
  const custom = f.customElements['component-1'];
  f.event('pointerdown', custom); f.event('pointermove', custom, {clientX: 160}); f.event('pointerup', custom);
  assert.deepEqual(f.emitted.at(-1).partIds, ['component-1', 'identity']);
  assert.equal(f.applied.at(-1).parts['component-1'].x, 20);
  const rotate = f.host.children.find(element => element.dataset.editorRotate);
  assert.equal(rotate.dataset.editorRotate, 'component-1');
  f.event('keydown', rotate, {key: 'ArrowRight'});
  assert.equal(f.emitted.at(-1).type, 'card-layout-rotate');
  const file = new File(['art'], 'seal.png', {type: 'image/png'});
  f.event('drop', custom, {dataTransfer: {files: [file]}});
  assert.equal(f.rawEmitted.at(-1).file, file); assert.equal(f.emitted.at(-1).partId, 'component-1');
  f.editor.update({...f.snapshot, draft: {styles: {ambush: {layout: {}}}}}, [f.face]);
  assert.equal(custom.getAttribute('role'), null); assert.equal(custom.dataset.editorPart, undefined);
  f.editor.destroy();
});

test('disabled and removed components lose interaction and do not receive file drops', () => {
  for (const state of [{enabled: false}, {removed: true}]) {
    const f = fixture({layout: {custom: {'component-1': {kind: 'text', label: 'Caption'}}, parts: {identity: state, 'component-1': state}}, selected: ['identity', 'component-1']});
    for (const target of [f.identity, f.customElements['component-1']]) {
      assert.equal(target.dataset.editorPart, undefined); assert.equal(target.getAttribute('role'), null);
      f.event('pointerdown', target); f.event('pointermove', target, {clientX: 200}); f.event('pointerup', target);
      f.event('keydown', target, {key: 'Enter'}); f.event('dblclick', target);
      f.event('drop', target, {dataTransfer: {files: [{type: 'image/png', size: 100}]}});
    }
    assert.equal(f.emitted.length, 0); assert.equal(f.applied.length, 0);
    assert.equal(f.host.children.some(element => element.dataset.editorRotate), false);
    f.editor.destroy();
  }
});

test('lock, disable and removal changes cancel pending group translation and rotation', () => {
  for (const state of [{locked: true}, {enabled: false}, {removed: true}]) for (const rotate of [false, true]) {
    const base = {custom: {'component-1': {kind: 'text', label: 'Caption'}}, parts: {identity: {groupId: 'heading'}, 'component-1': {groupId: 'heading'}}};
    const f = fixture({layout: base});
    const target = rotate ? f.host.children.find(element => element.dataset.editorRotate) : f.identity;
    f.event('pointerdown', target); f.event('pointermove', target, {clientX: 190, clientY: 190});
    const changed = {...base, parts: {...base.parts, 'component-1': {...base.parts['component-1'], ...state}}};
    f.editor.update({...f.snapshot, draft: {styles: {ambush: {layout: changed}}}}, [f.face]);
    f.event('pointerup', target);
    assert.deepEqual(f.applied.at(-1), changed);
    assert.equal(f.emitted.filter(event => event.type.startsWith('card-layout-')).length, 0);
    f.editor.destroy();
  }
});

test('custom definition sanitizer accepts at most 32 safe text/image component IDs', () => {
  const custom = Object.fromEntries(Array.from({length: 34}, (_, index) => [`component-${index + 1}`, {kind: 'text', label: `Text ${index + 1}`} ]));
  Object.assign(custom, {'component-0': {kind: 'text'}, 'component-evil"]': {kind: 'text'}, 'component-40': {kind: 'script'}});
  const f = fixture({layout: {custom}});
  const interactive = Object.entries(f.customElements).filter(([, element]) => element.dataset.editorPart);
  assert.equal(interactive.length, 32);
  assert.equal(f.customElements['component-33'].getAttribute('role'), null);
  assert.equal(f.customElements['component-evil"]'].getAttribute('role'), null);
  f.editor.destroy();
});

test('native artwork drops retain the original file and exact target without reading it', () => {
  const f = fixture();
  const file = new File(['png'], 'art.png', {type: 'image/png'});
  const dataTransfer = {types: ['Files'], files: [file]};
  assert.equal(f.event('dragover', f.costs, {dataTransfer}).prevented, true);
  assert.equal(dataTransfer.dropEffect, 'copy');
  assert.equal(f.event('drop', f.costs, {dataTransfer}).prevented, true);
  const result = f.rawEmitted.at(-1);
  assert.equal(result.type, 'card-part-art-drop'); assert.equal(result.cardId, 'ambush'); assert.equal(result.partId, 'costs');
  assert.equal(result.file, file);
  const boundary = new File([new Uint8Array(2_000_000)], 'art.webp', {type: 'image/webp'});
  f.event('drop', f.identity, {dataTransfer: {files: [boundary]}});
  assert.equal(f.rawEmitted.at(-1).file, boundary);
  assert.equal(f.applied.length, 0);
  f.editor.destroy();
});

test('artwork drops reject unsafe files, missing targets and read-only previews', () => {
  const f = fixture();
  for (const file of [{type: 'image/svg+xml', size: 10}, {type: 'image/png', size: 2_000_000 + 1}, {type: 'image/webp', size: NaN}]) {
    assert.equal(f.event('drop', f.identity, {dataTransfer: {files: [file]}}).prevented, true);
  }
  const dataTransfer = {types: ['Files'], files: [{type: 'image/webp', size: 100}]};
  f.event('drop', f.host, {dataTransfer});
  f.event('dragover', f.host, {dataTransfer}); assert.equal(dataTransfer.dropEffect, 'none');
  assert.equal(f.event('dragover', f.identity, {dataTransfer: {types: ['text/plain']}}).prevented, undefined);
  assert.equal(f.emitted.length, 0);
  f.editor.update({...f.snapshot, editable: false}, [f.face]);
  assert.equal(f.event('dragover', f.identity, {dataTransfer}).prevented, undefined);
  assert.equal(f.event('drop', f.identity, {dataTransfer}).prevented, undefined);
  assert.equal(f.emitted.length, 0); assert.equal(f.applied.length, 0);
  f.editor.destroy();
});

test('native measurements are deferred, bounded, deduplicated and include authored offsets', () => {
  const f = fixture({layout: {parts: {identity: {x: 35}}}});
  assert.equal(f.emitted.length, 0);
  f.flushFrame();
  assert.deepEqual(f.emitted[0], {type: 'card-parts-measured', cardId: 'ambush', boxes: {identity: {x: 55, y: 40, width: 200, height: 60, rotation: 0}, costs: {x: 20, y: 120, width: 100, height: 40, rotation: 0}}, cardWidth: 280, cardHeight: 392});
  f.editor.update(f.snapshot, [f.face]); f.flushFrame();
  assert.equal(f.emitted.length, 1);
  f.editor.update({...f.snapshot, draft: {styles: {ambush: {layout: {parts: {identity: {x: 50}}}}}}}, [f.face]); f.flushFrame();
  assert.equal(f.emitted.at(-1).boxes.identity.x, 70);
  f.editor.destroy(); f.flushFrame();
  assert.equal(f.emitted.length, 2);
});

test('serialized editor drags canonical coordinates, snaps anchor and preserves grouped spacing', () => {
  const layout = {parts: {identity: {x: 5, y: 3, groupId: 'heading'}, costs: {x: 20, y: 10, groupId: 'heading'}}};
  const f = fixture({layout});
  f.event('pointerdown');
  f.event('pointermove', f.identity, {clientX: 162, clientY: 157});
  assert.equal(f.applied.at(-1).parts.identity.x, 30);
  assert.equal(f.applied.at(-1).parts.identity.y, 20);
  assert.equal(f.applied.at(-1).parts.costs.x, 45);
  f.event('pointerup');
  assert.deepEqual(f.emitted.at(-1), {type: 'card-layout-translate', cardId: 'ambush', partIds: ['identity', 'costs'], dx: 25, dy: 17, before: JSON.stringify(layout)});
  assert.equal(layout.parts.identity.x, 5);
  f.editor.destroy();
});

test('selection, double-click and keyboard editing remain separate from unchanged pointer clicks', () => {
  const f = fixture();
  f.event('pointerdown', f.costs, {shiftKey: true}); f.event('pointerup', f.costs);
  assert.deepEqual(f.emitted, [{type: 'card-part-select', cardId: 'ambush', partId: 'costs', additive: true}]);
  f.event('dblclick'); assert.equal(f.emitted.at(-1).type, 'card-part-edit');
  f.event('keydown', f.costs, {key: 'Enter'}); assert.equal(f.emitted.at(-1).partId, 'costs');
  f.event('keydown', f.identity, {key: 'ArrowRight'}); assert.equal(f.emitted.at(-1).dx, 10);
  f.editor.destroy();
});

test('rotation handle uses native part center and emits snapped absolute anchor angle', () => {
  const f = fixture({layout: {parts: {identity: {rotation: 0, groupId: 'heading'}, costs: {rotation: 10, groupId: 'heading'}}}});
  const handle = f.host.children.find(element => element.dataset.editorRotate);
  f.event('pointerdown', handle, {clientX: 160, clientY: 95});
  f.event('pointermove', handle, {clientX: 205, clientY: 135});
  assert.equal(f.applied.at(-1).parts.costs.rotation, 100);
  f.event('pointerup', handle);
  assert.equal(f.emitted.at(-1).type, 'card-layout-rotate'); assert.equal(f.emitted.at(-1).rotation, 90);
  f.editor.destroy();
});

test('middle panning and bounded wheel zoom change view only, including read-only mode', () => {
  const f = fixture({editable: false, zoom: 245});
  assert.equal(f.identity.getAttribute('role'), null);
  f.event('pointerdown'); f.event('pointermove', f.identity, {clientX: 170}); f.event('pointerup');
  assert.equal(f.emitted.length, 0); assert.equal(f.applied.length, 0);
  f.event('pointerdown', f.host, {button: 1}); f.event('pointermove', f.host, {clientX: 170, clientY: 160}); f.event('pointerup', f.host);
  assert.equal(f.wrapper.style.translate, '40px 20px'); assert.equal(f.emitted.length, 0);
  assert.equal(f.event('wheel', f.host, {ctrlKey: false, deltaY: -10}).prevented, undefined);
  assert.equal(f.event('wheel', f.host, {ctrlKey: true, deltaY: -10}).prevented, true);
  assert.deepEqual(f.emitted.at(-1), {type: 'card-view-zoom', zoom: 250});
  f.event('keydown', f.host, {ctrlKey: true, key: '0'}); assert.equal(f.emitted.at(-1).zoom, 100);
  f.editor.update({...f.snapshot, editable: false}, [f.face]); assert.equal(f.wrapper.style.translate, '40px 20px');
  f.editor.destroy(); assert.equal(f.host.listeners.size, 0);
});

test('cancelled and superseded gestures never commit stale layouts', () => {
  const f = fixture();
  f.event('pointerdown'); f.event('pointermove', f.identity, {clientX: 180});
  f.event('keydown', f.identity, {key: 'Escape'});
  assert.deepEqual(f.applied.at(-1), {});
  assert.equal(f.emitted.filter(event => event.type === 'card-layout-translate').length, 0);
  f.event('pointerdown'); f.event('pointermove', f.identity, {clientX: 180});
  const replacement = {parts: {identity: {x: 300}}};
  f.editor.update({...f.snapshot, draft: {styles: {ambush: {layout: replacement}}}}, [f.face]);
  f.event('pointerup');
  assert.deepEqual(f.applied.at(-1), replacement);
  assert.equal(f.emitted.filter(event => event.type === 'card-layout-translate').length, 0);
  f.editor.destroy();
});
