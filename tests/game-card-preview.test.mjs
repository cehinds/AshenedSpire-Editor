import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {cardsForTag, previewContentBundle} from '../src/game-card-preview.mjs';
import {parseCSV, historyState, commit, undo, redo} from '../src/core.mjs';
import {createCardDraft, applyCardDraft} from '../src/authoring-create.mjs';

test('native bundle overlays live cards and derives changed tag ancestry without mutating sources', () => {
  const base = {cards: [{id:'a', name:'Original', damageSchool:'steel'}, {id:'b', name:'Unedited'}], nodes: [{id:'card',parentId:'',label:'Cards'}, {id:'theme',parentId:'',label:'Theme'}, {id:'blade',parentId:'card',label:'Blade',color:'AABBCC'}], tagging: [{family:'card',objectId:'a',tagId:'blade'}]};
  const draft = {cards:[{id:'a',name:'Edited'}],nodes:[{id:'blade',parentId:'theme',label:'Edited blade',color:'112233'}]};
  const result = previewContentBundle(base,draft);
  assert.equal(result.cards[0].name,'Edited');
  assert.equal(result.cards[0].damageSchool,'steel');
  assert.equal(result.cards[1].name,'Unedited');
  assert.equal(result.tags[0].domain,'theme');
  assert.equal(result.tags[0].label,'Edited blade');
  assert.equal(result.tags[0].color,'112233');
  assert.equal(base.cards[0].name,'Original');
  assert.equal(base.nodes[2].parentId,'card');
  assert.notEqual(result.tagging[0],base.tagging[0]);
});

test('tag preview selects cards linked to the selected subtree and leaves unrelated cards out', () => {
  const cards = [{id:'a'}, {id:'b'}];
  const nodes = [{id:'root'}, {id:'child',parentId:'root'}, {id:'leaf',parentId:'child'}];
  const links = [{family:'card',objectId:'a',tagId:'leaf'}, {family:'enemy',objectId:'b',tagId:'root'}];
  assert.deepEqual(cardsForTag(cards,nodes,links,'root'), [{id:'a'}]);
  assert.deepEqual(cardsForTag(cards,nodes,links,'missing'), []);
});

test('real bundled native registries accept editor drafts and leave native source untouched', () => {
  const read = path => fs.readFileSync(new URL(path,import.meta.url),'utf8');
  const context = vm.createContext({console,setTimeout,clearTimeout,queueMicrotask:()=>{},TextEncoder,TextDecoder,structuredClone,performance});
  vm.runInContext(read('../src/native/game-preview/runtime.js'),context);
  const native = context.AshenNative;
  const cards = JSON.parse(read('../src/cards.json'));
  const nodes = parseCSV(read('../src/sources/nodes.csv'));
  const assignments = parseCSV(read('../src/sources/tagging.csv'));
  cards.find(card=>card.id==='ambush').name = 'Live edited Ambush';
  nodes.find(node=>node.id==='blade').label = 'Live edited Blade';
  const registries = native.createRegistries(previewContentBundle(native.contentBundle,{cards,nodes},assignments));
  assert.equal(registries.cards.get('ambush').name,'Live edited Ambush');
  assert.equal(registries.tags.find(tag=>tag.id==='blade').label,'Live edited Blade');
  assert.equal(native.contentBundle.cards.find(card=>card.id==='ambush').name,'Ambush');
  assert.equal(typeof native.renderCard,'function');
  assert.equal(typeof native.cardShapeCssProperties,'function');
});

test('new reviewed card is accepted by native registries from exported draft tagging and disappears on Undo', () => {
  const read = path => fs.readFileSync(new URL(path,import.meta.url),'utf8');
  const context = vm.createContext({console,setTimeout,clearTimeout,queueMicrotask:()=>{},TextEncoder,TextDecoder,structuredClone,performance});
  vm.runInContext(read('../src/native/game-preview/runtime.js'),context);
  const native = context.AshenNative;
  const sourceTagging = parseCSV(read('../src/sources/tagging.csv'));
  // Older saved drafts lack tagging. The reviewed transaction promotes source
  // assignments into the package and adds the new card's explicitly shown rows.
  const original = {cards: JSON.parse(read('../src/cards.json')), nodes: parseCSV(read('../src/sources/nodes.csv')), owned: {}};
  const before = JSON.stringify(native.contentBundle);
  let history = historyState(original), next = structuredClone(history.present);
  next.cards[0].upgrade.id = next.cards[0].id;
  const proposal = createCardDraft(next, 'ambush', {id: 'qa.card-draft', name: 'Reviewed draft'}, sourceTagging);
  applyCardDraft(next, proposal, sourceTagging);
  history = commit(history, next);
  const exported = JSON.parse(JSON.stringify(history.present));
  const bundle = previewContentBundle(native.contentBundle, exported, sourceTagging);
  const registries = native.createRegistries(bundle);
  assert.equal(registries.cards.get('qa.card-draft').name, 'Reviewed draft');
  assert.deepEqual(Array.from(registries.cards.get('qa.card-draft').kindIds), Array.from(registries.cards.get('ambush').kindIds));
  assert.equal(bundle.cards.find(card => card.id === 'qa.card-draft').upgrade.id, 'qa.card-draft');
  assert(cardsForTag(exported.cards, exported.nodes, exported.tagging, 'classification').some(card => card.id === 'qa.card-draft'));
  assert.deepEqual(exported.tagging.filter(row => row.objectId === 'qa.card-draft'), proposal.tagging);
  const reverted = undo(history);
  assert.deepEqual(reverted.present, original);
  const revertedBundle = previewContentBundle(native.contentBundle, reverted.present, sourceTagging);
  assert(!revertedBundle.cards.some(card => card.id === 'qa.card-draft'));
  assert(!revertedBundle.tagging.some(row => row.objectId === 'qa.card-draft'));
  assert.doesNotThrow(() => native.createRegistries(revertedBundle));
  assert.doesNotThrow(() => native.createRegistries(previewContentBundle(native.contentBundle, redo(reverted).present)));
  assert.equal(JSON.stringify(native.contentBundle), before);
});
