import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCardDefinition, createWireframeDefinition, suggestDraftId, validateWireframes} from '../src/authoring-create.mjs';
import {historyState, commit, undo, redo} from '../src/core.mjs';
const json = path => JSON.parse(readFileSync(new URL('../src/' + path, import.meta.url), 'utf8'));

test('new card preserves native effects, upgrades and unknown fields without sharing template objects', () => {
  const cards = json('cards.json'); cards[0].foreign = {opaque: ['retain']};
  const before = structuredClone(cards), definition = createCardDefinition({cards}, cards[0].id, {id: 'draft.ember-strike', name: ' Ember strike '});
  assert.equal(definition.id, 'draft.ember-strike'); assert.equal(definition.name, 'Ember strike');
  assert.deepEqual(definition.effects, cards[0].effects); assert.deepEqual(definition.upgrade, cards[0].upgrade);
  definition.effects[0].amount = 99; definition.foreign.opaque.push('new');
  assert.deepEqual(cards, before);
});
test('creation rejects duplicate, unsafe, reserved IDs and missing templates, and suggestions resolve collisions', () => {
  const project = {cards: json('cards.json')}, template = project.cards[0].id;
  for (const id of [template, '../outside', 'constructor', '', 'x'.repeat(97)]) assert.throws(() => createCardDefinition(project, template, {id, name: 'New'}));
  assert.throws(() => createCardDefinition(project, 'missing', {id: 'draft.new', name: 'New'}), /template/);
  assert.throws(() => createCardDefinition(project, template, {id: 'draft.new', name: '  '}), /name/);
  assert.equal(suggestDraftId('Ember strike', [{id: 'ember-strike'}, {id: 'ember-strike-2'}]), 'ember-strike-3');
});
test('wireframe snapshots preserve full native config and validate geometry, identity and import limits', () => {
  const ui = json('sources/w4a-combat.json'); ui.foreign = {opaque: '$nativeVariable'};
  const draft = createWireframeDefinition({ui}, {id: 'layout.ember', name: 'Ember layout'});
  assert.deepEqual(draft.config, ui); draft.config.sizing.bands.hud++;
  assert.equal(ui.sizing.bands.hud, 10);
  assert(validateWireframes([draft]).some(issue => issue.includes('sum to 100')));
  draft.config.sizing.bands.hud--;
  assert.deepEqual(validateWireframes([draft]), []); assert.deepEqual(validateWireframes(undefined), []);
  assert(validateWireframes([draft, draft]).length); assert(validateWireframes([{...draft, config: null}]).length);
  assert(validateWireframes({}).length); assert(validateWireframes(Array(101).fill(draft)).length);
});
test('card and wireframe creation are reversible draft transactions with no mutation of history snapshots', () => {
  const original = {cards: json('cards.json'), ui: json('sources/w4a-combat.json'), owned: {}, wireframes: []};
  let history = historyState(original), next = structuredClone(history.present);
  const card = createCardDefinition(next, next.cards[0].id, {id: 'new-card', name: 'New card'});
  next.cards.push(card); next.owned[card.id] = 2;
  next.wireframes.push(createWireframeDefinition(next, {id: 'new-layout', name: 'New layout'}));
  history = commit(history, next);
  assert.equal(history.present.cards.length, original.cards.length + 1); assert.equal(history.present.wireframes.length, 1);
  assert.deepEqual(undo(history).present, original); assert.deepEqual(redo(undo(history)).present, history.present);
  assert.equal(original.wireframes.length, 0);
});
