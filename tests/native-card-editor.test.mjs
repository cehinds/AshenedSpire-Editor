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
  const definitions = [{id: 'identity', label: 'Name', selector: '.cname'}, {id: 'costs', label: 'Costs', selector: '.card-cost-rail'}];
  const emitted = [], applied = [];
  // Execute the exact serialized function, so accidental import/closure use fails.
  const installer = vm.runInNewContext(`(${installCardEditor.toString()})`);
  const editor = installer(host, event => emitted.push(JSON.parse(JSON.stringify(event))), (_face, value) => {applied.push(JSON.parse(JSON.stringify(value))); return {identity: {x: 20 + (value.parts?.identity?.x || 0), y: 40, width: 200, height: 60}, costs: {x: 20, y: 120, width: 100, height: 40}};}, definitions);
  const snapshot = {editable, ids: ['ambush'], zoom, draft: {styles: {ambush: {layout}}}, layoutSelection: selected, layoutView: {gridEnabled: true, gridSize: 10, snapEnabled: true, rotationSnap: 15}};
  editor.update(snapshot, [face]);
  const event = (type, target = identity, extra = {}) => {
    const value = {target, button: 0, pointerId: 1, clientX: 150, clientY: 150, preventDefault() {this.prevented = true;}, stopPropagation() {}, ...extra};
    host.listeners.get(type)?.(value); return value;
  };
  const flushFrame = () => {const callback = frame; frame = null; callback?.();};
  return {host, wrapper, face, identity, costs, editor, snapshot, emitted, applied, event, flushFrame};
}

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
