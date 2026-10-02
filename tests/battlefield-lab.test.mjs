import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {PRESENTATION_FIELDS, STAGE_DEFAULTS, FIT_FIELDS, SETTING_PREFIX, validateLab, normalizeLab, normalizeView, getPath, battlefieldDocument, battlefieldDocumentProblems, applyBattlefieldDocument, presentationValue, diagnose, LAB_DEFAULT} from '../src/battlefield-lab.mjs';
import {combatPreviewSnapshot} from '../src/game-runtime-preview.mjs';

const runtime = await fs.readFile(new URL('../src/native/game-preview/runtime.js', import.meta.url), 'utf8');
const scope = {console, structuredClone, URLSearchParams, setTimeout, clearTimeout, performance, queueMicrotask};
vm.runInNewContext(runtime, scope);
const N = scope.AshenNative;
const ui = JSON.parse(await fs.readFile(new URL('../src/sources/w4a-combat.json', import.meta.url), 'utf8'));

test('presentation fields mirror native defaults, ranges and choices', () => {
  const defaults = N.presentationConfig({});
  for (const field of PRESENTATION_FIELDS) {
    assert.equal(defaults[field.key], field.def, field.key + ' default');
    const key = SETTING_PREFIX + field.key;
    if (field.type === 'number') {
      assert.equal(N.presentationConfig({[key]: field.max + 1000})[field.key], field.max, field.key + ' max');
      assert.equal(N.presentationConfig({[key]: field.min - 1000})[field.key], field.min, field.key + ' min');
    }
    if (field.type === 'choice') for (const choice of field.choices) assert.equal(N.presentationConfig({[key]: choice})[field.key], choice, field.key + ' ' + choice);
  }
});

test('stage defaults and fit paths match native sources', () => {
  assert.deepEqual({...N.contentBundle.balance.ui.combatantStage}, STAGE_DEFAULTS);
  for (const field of FIT_FIELDS) assert.equal(typeof getPath(ui, field.path), 'number', field.path.join('.'));
});

test('legacy arithmetic labs stay importable and normalize to native stage defaults', () => {
  const legacy = {base: 40, role: 2, selected: true, policy: 'overflow', cardScale: 100};
  assert.deepEqual(validateLab(legacy), []);
  assert.deepEqual(normalizeLab(legacy), {...LAB_DEFAULT, stage: {}});
  assert.ok(validateLab({schema: LAB_DEFAULT.schema, stage: {centerPct: 500}}).length);
  assert.ok(validateLab({schema: LAB_DEFAULT.schema, stage: {}, device: 'desktop'}).length);
  assert.deepEqual(normalizeView({device: 'nope', encounter: 'a3_bossAshheartDragon'}).device, 'desktop');
});

test('battlefield document round-trips the three native stores', () => {
  const p = {ui: structuredClone(ui), lab: {schema: LAB_DEFAULT.schema, stage: {centerPct: 40}}, gameSettings: {schemaVersion: 1, game: 'Ashen Spire', build: {}, statRows: 7, overrides: {'gameConfig.presentation.playerSpriteScale': 1.2, 'gameConfig.progression.xpMultiplier': 2}}};
  const doc = battlefieldDocument(p);
  assert.deepEqual(battlefieldDocumentProblems(doc), []);
  assert.deepEqual(doc.presentation, {playerSpriteScale: 1.2});
  doc.presentation = {enemySpriteScale: 1.5};
  doc.formation.sizing.displayScale = 1.4;
  applyBattlefieldDocument(p, doc);
  assert.equal(p.ui.sizing.formation.displayScale, 1.4);
  assert.equal(p.gameSettings.overrides['gameConfig.presentation.playerSpriteScale'], undefined);
  assert.equal(p.gameSettings.overrides['gameConfig.presentation.enemySpriteScale'], 1.5);
  assert.equal(p.gameSettings.overrides['gameConfig.progression.xpMultiplier'], 2);
  assert.deepEqual(battlefieldDocumentProblems({...doc, presentation: {playerSpriteScale: 9}}), ['Player sprite scale must be 0.5–2']);
  assert.equal(presentationValue({'gameConfig.presentation.gridShape': 'hexagon'}, PRESENTATION_FIELDS.find(f => f.key === 'gridShape')), 'wide-rhombus');
});

test('preview snapshot carries stage tokens and view choices to the native frame', () => {
  const snapshot = combatPreviewSnapshot({lab: {schema: LAB_DEFAULT.schema, stage: {centerPct: 40}}}, 'battlefield', 'rogue', [], {encounter: 'eliteWyrm'});
  assert.deepEqual(snapshot.project.lab.stage, {centerPct: 40});
  assert.equal(snapshot.view.encounter, 'eliteWyrm');
});

test('measured diagnostics report clipping, minimum height and overlap', () => {
  const metrics = {viewport: {width: 1000, height: 600}, regions: {hud: {x: 0, y: 0, width: 1000, height: 60}, field: {x: 0, y: 60, width: 1000, height: 300}}, combatants: [
    {eid: 'player', role: 'player', name: 'Rogue', art: {x: 400, y: 40, width: 100, height: 200}},
    {eid: 'e1', role: 'enemy', name: 'Dragon', art: {x: 430, y: 200, width: 100, height: 50}},
  ]};
  const text = diagnose(metrics, ui).map(issue => issue.text).join('\n');
  assert.match(text, /Rogue: art rises 20 px into the HUD/);
  assert.match(text, /Dragon: 50 px is below the 92 px minimum/);
  assert.match(text, /Rogue and Dragon overlap by 70 px/);
});
