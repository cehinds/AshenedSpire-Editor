import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCardDefinition, createCardDraft, applyCardDraft, createWireframeDefinition, suggestDraftId, validateWireframes} from '../src/authoring-create.mjs';
import {historyState, commit, undo, redo, parseCSV} from '../src/core.mjs';
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

test('reviewed card creation copies complete separate tag rows and explicit upgrade identity without touching the template', () => {
  const sourceTagging = parseCSV(readFileSync(new URL('../src/sources/tagging.csv', import.meta.url), 'utf8'));
  const nodes = parseCSV(readFileSync(new URL('../src/sources/nodes.csv', import.meta.url), 'utf8'));
  const cards = json('cards.json');
  cards[0].upgrade.id = cards[0].id;
  const templateRows = sourceTagging.filter(row => row.family === 'card' && row.objectId === cards[0].id);
  templateRows[0].foreign = {retain: ['opaque']};
  const project = {cards, nodes, owned: {}, tagging: sourceTagging};
  const before = structuredClone(project);
  const proposal = createCardDraft(project, cards[0].id, {id: 'qa.card-draft', name: 'QA draft'});
  assert.equal(proposal.definition.upgrade.id, proposal.definition.id);
  assert.equal(proposal.ownedCopies, 2);
  assert.deepEqual(proposal.tagging, templateRows.map(row => ({...row, objectId: 'qa.card-draft'})));
  assert.equal(proposal.tagging.filter(row => row.tagId === 'classification.attack').length, 1);
  applyCardDraft(project, proposal);
  assert.equal(project.cards.at(-1).id, 'qa.card-draft');
  assert.equal(project.owned['qa.card-draft'], 2);
  assert.deepEqual(project.cards.slice(0, -1), before.cards);
  assert.deepEqual(project.tagging.slice(0, before.tagging.length), before.tagging);
  proposal.tagging[0].foreign.retain.push('proposal edit');
  assert.deepEqual(project.tagging.at(-templateRows.length).foreign, {retain: ['opaque']});
  assert.deepEqual(sourceTagging, before.tagging);
});

test('creation refuses missing classification or existing native IDs rather than inventing assignments', () => {
  const project = {cards: json('cards.json'), nodes: [{id: 'classification', parentId: ''}, {id: 'classification.attack', parentId: 'classification'}], tagging: []};
  const identity = {id: 'qa.draft', name: 'QA draft'};
  assert.throws(() => createCardDraft(project, 'ambush', identity), /exactly one native classification/);
  project.tagging = [{family: 'card', scope: '', objectId: 'ambush', tagId: 'classification.attack'}, {family: 'card', scope: '', objectId: 'qa.draft', tagId: 'classification.attack'}];
  assert.throws(() => createCardDraft(project, 'ambush', identity), /already has native/);
});
