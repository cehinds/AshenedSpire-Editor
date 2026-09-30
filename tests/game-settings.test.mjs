import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyGameSettings, exportGameSettings, parseGameSettings, removeGameOverride, SETTINGS_LIMIT, setGameOverride, validateGameSettings, validateGameSettingsOptional} from '../src/game-settings.mjs';

test('native empty envelope and optional draft validate without editor schema replacing game schema', () =>
{
    assert.deepEqual(validateGameSettingsOptional(undefined), []);
    assert.deepEqual(validateGameSettings(emptyGameSettings()), []);
    assert.equal(emptyGameSettings().game, 'Ashen Spire');
    assert.equal(emptyGameSettings().statRows, 7);
    assert(validateGameSettings({...emptyGameSettings(), game: 'AshenedSpire'}).length);
});

test('import/export preserves native stamps, promotion ownership and unknown metadata', () =>
{
    const file = {...emptyGameSettings(), build: {version: '0.7.1.709', profile: true}, ratingsVersion: 1, promotionOwned: ['gameConfig.progression.xpMultiplier'], foreign: {retain: [null, true, 42]}, overrides: {'gameConfig.progression.xpMultiplier': 1.25, 'settings.deckMaxUnlimited': true}};
    assert.deepEqual(parseGameSettings(exportGameSettings(file)), file);
    const edited = setGameOverride(file, 'settings.deckMinSize', '11');
    assert.equal(edited.overrides['settings.deckMinSize'], 11);
    assert.deepEqual(edited.foreign, file.foreign);
    assert.deepEqual(edited.promotionOwned, file.promotionOwned);
    assert.deepEqual(removeGameOverride(edited, 'settings.deckMinSize'), file);
    assert.equal(Object.keys(file.overrides).length, 2);
});

test('invalid envelopes and JSON fail atomically without modifying active profile', () =>
{
    const active = emptyGameSettings();
    for (const file of [{}, {...active, schemaVersion: 2}, {...active, overrides: []}, {...active, promotionOwned: [42]}, {...active, build: 'wrong'}, {...active, statRows: '7'}]) assert.throws(() => parseGameSettings(JSON.stringify(file)));
    assert.throws(() => parseGameSettings('{bad'), /valid JSON/);
    assert.throws(() => setGameOverride(active, 'settings.deckMinSize', 'NaN'), /valid JSON/);
    assert.throws(() => setGameOverride(active, ' ', '1'), /key/);
    assert.deepEqual(active.overrides, {});
});

test('size, depth, cycles and non-JSON values cannot enter portable profile', () =>
{
    assert.throws(() => parseGameSettings(' '.repeat(SETTINGS_LIMIT + 1)), /1 MiB/);
    const cyclic = emptyGameSettings(); cyclic.loop = cyclic;
    assert(validateGameSettings(cyclic).some(issue => /cycles/.test(issue)));
    assert(validateGameSettings({...emptyGameSettings(), overrides: {x: Infinity}}).length);
    assert(validateGameSettings({...emptyGameSettings(), overrides: {x: undefined}}).length);
});

test('unknown native override keys remain structurally editable without promising engine acceptance', () =>
{
    const next = setGameOverride(emptyGameSettings(), 'gameConfig.future.setting', '{"nested":[true,1,"keep"]}');
    assert.deepEqual(validateGameSettings(next), []);
    assert.deepEqual(parseGameSettings(exportGameSettings(next)), next);
    const safe = setGameOverride(next, '__proto__', '{"polluted":true}');
    assert.equal(Object.prototype.polluted, undefined);
    assert(Object.hasOwn(safe.overrides, '__proto__'));
});
