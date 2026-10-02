import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { previewContentBundle } from '../src/game-card-preview.mjs';
import { combatPreviewSnapshot } from '../src/game-runtime-preview.mjs';
import { parseCSV } from '../src/core.mjs';

const base = new URL('../src/native/game-preview/', import.meta.url);
const runtime = await fs.readFile(new URL('runtime.js', base), 'utf8');
const scope = { console, structuredClone, URLSearchParams, setTimeout, clearTimeout, performance, queueMicrotask };
vm.runInNewContext(runtime, scope);
const N = scope.AshenNative;

test('native preview snapshot has verifiable working-tree provenance', async () => {
  const receipt = JSON.parse(await fs.readFile(new URL('provenance.json', base), 'utf8'));
  assert.equal(receipt.snapshot, 'working-tree');
  assert.equal(typeof receipt.sourceDirty, 'boolean');
  for (const [file, expected] of Object.entries(receipt.hashes)) assert.equal(createHash('sha256').update(await fs.readFile(new URL(file, base))).digest('hex'), expected);
});

test('authored UI resolves before native config is frozen', async () => {
  const ui = JSON.parse(await fs.readFile(new URL('../src/sources/w4a-combat.json', import.meta.url), 'utf8'));
  ui.sizing.bands = { hud: 10, scene: 70, context: 15, footer: 5 };
  ui.vars.meterRowRem = 1.2;
  const customized = { ...scope, __ASHEN_PREVIEW_UI__: ui };
  vm.runInNewContext(runtime, customized);
  const config = customized.AshenNative.uiConfig.scenes.w4a;
  assert.equal(config.sizing.bands.context, 15);
  assert.equal(config.sizing.combatantMeters.hpMinRem, 1.2);
  assert.equal(config.sizing.footer.minimumTargetPx, 44);
  assert.equal(Object.isFrozen(config), true);
});

test('native combat runs drafted cards through actual seeded engine', async () => {
  const cards = JSON.parse(await fs.readFile(new URL('../src/cards.json', import.meta.url), 'utf8'));
  cards[0].name = 'Live draft card';
  const nodes = parseCSV(await fs.readFile(new URL('../src/sources/nodes.csv', import.meta.url), 'utf8'));
  nodes[0].label = 'Preview tag';
  const tagging = parseCSV(await fs.readFile(new URL('../src/sources/tagging.csv', import.meta.url), 'utf8'));
  const bundle = N.configuredContentBundle(previewContentBundle(N.contentBundle, { cards, nodes, tagging }), {});
  assert.equal(bundle.nodes.find(node => node.id === nodes[0].id).label, 'Preview tag');
  const registries = N.createRegistries(bundle);
  assert.equal(registries.cards.get(cards[0].id).name, 'Live draft card');
  const run = N.createRunState({ registries, classId: 'rogue', seed: 17 });
  run.deck = N.createDeck(cards.slice(0, 10).map(card => card.id));
  const combat = N.createCombat({ registries, rng: N.createRng(17), player: { ...run, classId: 'rogue', relicIds: run.relics }, enemyIds: [registries.enemies.ids()[0]], ruleset: N.combatRules, handRules: N.resolveHandRules({}, bundle.attributes) });
  assert.equal(combat.phase, 'player');
  assert.ok(combat.piles.hand.length > 0);
  const turn = combat.turn;
  const result = N.dispatch(combat, { type: 'endTurn' });
  assert.ok(result.events.length > 0);
  assert.equal(combat.turn, turn + 1);
  const attackRun = N.createRunState({ registries, classId: 'rogue', seed: 17 });
  attackRun.deck = N.createDeck(Array(10).fill('ambush'));
  const attackCombat = N.createCombat({ registries, rng: N.createRng(17), player: { ...attackRun, classId: 'rogue', relicIds: attackRun.relics }, enemyIds: [registries.enemies.ids()[0]], ruleset: N.combatRules });
  attackCombat.enemies[0].hp = attackCombat.enemies[0].maxHp = 30;
  delete attackCombat.player.statuses.prepared;
  const attack = N.dispatch(attackCombat, { type: 'playCard', cardInstanceId: attackCombat.piles.hand[0].instanceId, targetId: attackCombat.enemies[0].id });
  assert.ok(attack.events.some(event => event.type === 'damageDealt' && event.amount > 0));
  assert.ok(attackCombat.enemies[0].hp < 30);
  assert.equal(attackCombat.queue.length, 0);
});

test('combat UI can query classification for every merged card, including generated cards', async () => {
  const cards = JSON.parse(await fs.readFile(new URL('../src/cards.json', import.meta.url), 'utf8'));
  const nodes = parseCSV(await fs.readFile(new URL('../src/sources/nodes.csv', import.meta.url), 'utf8'));
  const tagging = parseCSV(await fs.readFile(new URL('../src/sources/tagging.csv', import.meta.url), 'utf8'));
  // Registry construction alone does not exercise the native framework's lazy
  // kind requirement. Mounting combat queries costs and playability for cards.
  for (const storedTagging of [undefined, tagging]) {
    const draft = {cards, nodes, tagging: storedTagging};
    const snapshot = combatPreviewSnapshot(draft, 'combat', 'rogue', tagging);
    const bundle = N.configuredContentBundle(previewContentBundle(N.contentBundle, snapshot.project), {});
    const registries = N.createRegistries(bundle);
    assert.deepEqual(Array.from(registries.cards.get('smokePellet').kindIds), ['classification.skill']);
    assert.equal(draft.tagging, storedTagging, 'preview does not migrate the saved draft');
    for (const card of registries.cards.all()) {
      assert.doesNotThrow(() => registries.framework.costProfile(card), card.id);
      assert.doesNotThrow(() => registries.framework.isUnplayable(card), card.id);
    }
  }
});

test('combat preview keeps explicit classification removal invalid instead of restoring source tags', async () => {
  const cards = JSON.parse(await fs.readFile(new URL('../src/cards.json', import.meta.url), 'utf8'));
  const nodes = parseCSV(await fs.readFile(new URL('../src/sources/nodes.csv', import.meta.url), 'utf8'));
  const sourceTagging = parseCSV(await fs.readFile(new URL('../src/sources/tagging.csv', import.meta.url), 'utf8'));
  const removed = sourceTagging.filter(row => !(row.family === 'card' && row.objectId === 'smokePellet' && row.tagId === 'classification.skill'));
  for (const tagging of [removed, []]) {
    const snapshot = combatPreviewSnapshot({cards, nodes, tagging}, 'combat', 'rogue', sourceTagging);
    assert.equal(snapshot.project.tagging, tagging);
    const registries = N.createRegistries(N.configuredContentBundle(previewContentBundle(N.contentBundle, snapshot.project), {}));
    const smoke = registries.cards.get('smokePellet');
    assert.throws(() => registries.framework.costProfile(smoke), /card smokePellet: states no kind/);
    assert.throws(() => registries.framework.isUnplayable(smoke), /card smokePellet: states no kind/);
  }
  assert(sourceTagging.some(row => row.objectId === 'smokePellet' && row.tagId === 'classification.skill'));
});
