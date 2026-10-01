import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseCardDefinition, prepareCardDefinition, validateCardDefinition} from '../src/card-definition.mjs';
import {parseCSV, validateProject, historyState, commit, undo} from '../src/core.mjs';
import {previewContentBundle} from '../src/game-card-preview.mjs';

const text = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
const json = name => JSON.parse(text(name));
function fixture() {
  const cards = json('cards.json'), config = json('pose-config.json');
  return {schema: 'ashenspire.workbench/1', cards, nodes: parseCSV(text('sources/nodes.csv')), deck: cards.slice(0, 10).map(card => card.id), styles: {}, scenes: json('sources/prologue.json'), lab: {base: 40, role: 2, selected: true, policy: 'overflow', cardScale: 100}, ui: json('sources/w4a-combat.json'), pose: {...config.components.starter, assets: json('pose-assets.json')}, scenario: {ruleset: 'foundations', cardId: cards[0].id, playerHp: 40, enemyHp: 30}, owned: Object.fromEntries(cards.map(card => [card.id, 2])), scenePlacement: {}, erdNative: null};
}

test('card edits preserve native unknown fields, conditions and upgrades without mutating sources', () => {
  const project = fixture();
  const card = project.cards[0];
  card.futureNativeField = {retained: ['opaque', 7]};
  const original = structuredClone(project);
  const candidate = prepareCardDefinition(project, card.id, {...card, name: 'Live edit', cost: 2, staminaCost: 3, manaCost: 4});
  assert.deepEqual(candidate.futureNativeField, card.futureNativeField);
  assert.deepEqual(candidate.effects, card.effects);
  assert.deepEqual(candidate.upgrade, card.upgrade);
  candidate.futureNativeField.retained.push('detached');
  assert.deepEqual(project, original);
  for (const native of project.cards) assert.deepEqual(validateCardDefinition(native, native.id), []);
});

test('invalid JSON and malformed native structures cannot replace the last valid card', () => {
  const project = fixture(), card = project.cards[0];
  const original = structuredClone(project);
  for (const value of [null, [], 5, {...card, id: 'different'}, {...card, name: ''}, {...card, name: ' '}, {...card, type: 12}, {...card, effects: null}, {...card, effects: [null]}, {...card, effects: [{op: ''}]}, {...card, effects: [[]]}, {...card, keywords: 'exhaust'}, {...card, flavor: {}}, {...card, cost: -1}, {...card, manaCost: '2'}, {...card, upgrade: null}, {...card, upgrade: {effects: [null]}}, {...card, upgrade: {staminaCost: -2}}]) {
    assert.throws(() => parseCardDefinition(JSON.stringify(value), project, card.id));
  }
  assert.throws(() => parseCardDefinition('{"id":', project, card.id), /last valid card/);
  assert.throws(() => prepareCardDefinition(project, card.id, {...card, opaque: Infinity}), /finite/);
  const cyclic = {...card}; cyclic.opaque = cyclic;
  assert.throws(() => prepareCardDefinition(project, card.id, cyclic), /non-circular/);
  assert.deepEqual(project, original);
});

test('card preparation enforces whole-project validation and stable identity', () => {
  const project = fixture(), card = project.cards[0];
  assert.deepEqual(validateProject(project), []);
  project.ui.sizing.bands.hud += 1;
  assert.throws(() => prepareCardDefinition(project, card.id, {...card, name: 'Rejected'}), /sum to 100/);
  const absent = fixture(); absent.cards = absent.cards.slice(1);
  assert.throws(() => prepareCardDefinition(absent, card.id, card), /no longer/);
});

test('valid full JSON updates share history and reach native preview registries immediately', () => {
  const project = fixture(), card = project.cards[0];
  const candidate = parseCardDefinition(JSON.stringify({...card, name: 'New native name', textTemplate: 'Draft native rules', cost: 2, staminaCost: 3, manaCost: 4}), project, card.id);
  const next = {...project, cards: project.cards.map(item => item.id === card.id ? candidate : item)};
  const history = commit(historyState(project), next);
  assert.deepEqual(undo(history).present, project);
  const scope = {console, structuredClone, setTimeout, clearTimeout, queueMicrotask() {}, performance};
  vm.runInNewContext(text('native/game-preview/runtime.js'), scope);
  const native = scope.AshenNative;
  const registries = native.createRegistries(previewContentBundle(native.contentBundle, next));
  const active = registries.cards.get(card.id);
  assert.equal(active.name, 'New native name');
  assert.equal(active.textTemplate, 'Draft native rules');
  assert.equal(active.cost, 2);
  assert.equal(active.staminaCost, 3);
  assert.equal(active.manaCost, 4);
  assert.equal(project.cards[0].name, card.name);
});

test('effect and upgrade edits preserve unrelated data and accept native inheritance', () => {
  const project = fixture(), card = project.cards[0];
  const effects = card.effects.map((effect, index) => index ? effect : {...effect, amount: 12});
  const candidate = prepareCardDefinition(project, card.id, {...card, effects, upgrade: {cost: 0, futureNativeField: {keep: true}}});
  assert.equal(candidate.effects[0].amount, 12);
  assert.deepEqual(candidate.effects.slice(1), card.effects.slice(1));
  assert.deepEqual(candidate.upgrade, {cost: 0, futureNativeField: {keep: true}});
  assert.equal(card.effects[0].amount, 5);
});

test('upgrade identity and name cannot invalidate the merged visual card', () => {
  const project = fixture(), card = project.cards[0];
  for (const name of [null, {}, [], 42, '', '   ']) {
    assert.throws(() => prepareCardDefinition(project, card.id, {...card, upgrade: {name}}), /upgrade.name/);
  }
  for (const id of [null, {}, [], 42, '', 'different-card']) {
    assert.throws(() => prepareCardDefinition(project, card.id, {...card, upgrade: {id}}), /upgrade.id/);
  }
  const inherited = prepareCardDefinition(project, card.id, {...card, upgrade: {cost: 0}});
  assert.equal({...inherited, ...inherited.upgrade}.name, card.name);
  assert.equal({...inherited, ...inherited.upgrade}.id, card.id);
  const named = prepareCardDefinition(project, card.id, {...card, upgrade: {id: card.id, name: 'Upgraded Ambush'}});
  assert.equal({...named, ...named.upgrade}.name, 'Upgraded Ambush');
  assert.equal({...named, ...named.upgrade}.id, card.id);
});
