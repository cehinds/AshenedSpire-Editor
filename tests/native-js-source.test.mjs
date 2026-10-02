import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {CARD_SOURCE_FILES, canonicalJson, cardArrayNames, changedRegion, planNativeSource, scanCardSource, spliceCardSource, spliceObjectNumbers, toJsLiteral, verifyNativeSource} from '../src/native-js-source.mjs';

const fixture = name => readFileSync(new URL('./fixtures/native-source/' + name, import.meta.url), 'utf8');
const evaluate = async (content, name) => (await import('data:text/javascript,' + encodeURIComponent(content)))[name];
const json = value => JSON.parse(JSON.stringify(value));

test('scanner finds card literals and ignores ids inside strings, comments, templates and regex', () =>
{
    const scan = scanCardSource(fixture('rogue-cards.mjs'));
    assert.equal(scan.exportName, 'rogueCards');
    assert.deepEqual(scan.ids, ['ambush', 'rogueShiv', 'smokePellet', 'quickCut', 'feint', 'scannerProbe']);
    assert.equal(scan.opaque, 0);
    assert.deepEqual(cardArrayNames("export const aCards = [];\nexport const bCards = [];\nconst cCards = [];\n"), ['aCards', 'bCards']);
    assert.throws(() => scanCardSource("export const aCards = [];\nexport const bCards = [];\n"), /Choose card array: aCards, bCards/);
    assert.throws(() => scanCardSource("export const aCards = [\n  { id: 'x' ,\n];\n"), /could not be scanned safely/);
    assert.throws(() => scanCardSource("export const aCards = [\n  { id: 'x', note: 'open },\n];\n"), /Unterminated string/);
    assert.equal(scanCardSource("export const aCards = [{ id: 'a' }, ...more, make('b')];\n").opaque, 2);
});

test('replacing a card splices one literal and evaluates to the draft with every other card unchanged', async () =>
{
    const text = fixture('rogue-cards.mjs');
    const cards = json(await evaluate(text, 'rogueCards'));
    for (const card of cards)
    {
        const draft = {...card, name: `${card.name} — it's "edited"\nline two\\${'`'}`, extra: {nested: [1, -0.5, null, true]}};
        const {content, mode} = spliceCardSource(text, draft, {mode: 'replace'});
        assert.equal(mode, 'replace');
        const after = json(await evaluate(content, 'rogueCards'));
        assert.equal(after.length, cards.length);
        after.forEach((value, index) => assert.deepEqual(value, cards[index].id === card.id ? json(draft) : cards[index]));
        assert.equal(verifyNativeSource('card', {card: json(draft), mode: 'replace', exportName: 'rogueCards'}, {before: cards, after}).length, 0);
    }
    const {content} = spliceCardSource(text, {...cards[3], cost: 9}, {mode: 'replace'});
    const start = text.indexOf("    id: 'quickCut'") - 4;
    assert.equal(content.slice(0, start), text.slice(0, start));
    assert.ok(content.endsWith(text.slice(text.indexOf("  {\n    id: 'feint'"))));
    assert.match(changedRegion(text, content), /^@@ line \d+ @@/);
    assert.throws(() => spliceCardSource(text, {id: 'missing', name: 'x', effects: []}, {mode: 'replace'}), /not an object literal/);
    assert.throws(() => spliceCardSource(text, cards[0], {mode: 'append'}), /already exists/);
});

test('appending a card handles trailing commas, no trailing comma, and empty arrays', async () =>
{
    const card = {id: 'fresh', name: 'Fresh', effects: [{op: 'draw', amount: 1}]};
    for (const source of ["export const xCards = [\n  { id: 'a', name: 'A', effects: [] },\n];\n", "export const xCards = [\n  { id: 'a', name: 'A', effects: [] }\n];\n", "export const xCards = [];\n", "export const xCards = [\n  // only a comment\n];\n"])
    {
        const {content} = spliceCardSource(source, card, {mode: 'append'});
        const after = json(await evaluate(content, 'xCards'));
        assert.deepEqual(after.at(-1), card);
        assert.equal(after.length, source.includes("id: 'a'") ? 2 : 1);
    }
});

test('literal serialization is deterministic, escapes safely, and refuses non-JSON values', async () =>
{
    const separator = String.fromCharCode(0x2028), nul = String.fromCharCode(0);
    const value = {plain: 'a', quote: "it's", lines: `x\ny${separator}z${nul}`, 'needs-quote': 1, list: Array.from({length: 30}, (_, index) => index), deep: {a: {b: [{c: 'd'}]}}};
    const literal = toJsLiteral(value);
    assert.equal(literal, toJsLiteral(structuredClone(value)));
    assert.ok(!literal.includes(separator) && !literal.includes(nul));
    assert.deepEqual(json(await evaluate(`export const v = ${literal};`, 'v')), value);
    assert.equal(toJsLiteral({a: 1, b: [1, 2]}), '{ a: 1, b: [1, 2] }');
    assert.throws(() => toJsLiteral(JSON.parse('{"__proto__": {"x": 1}}')), /__proto__/);
    assert.throws(() => toJsLiteral({a: Infinity}), /finite/);
    assert.throws(() => toJsLiteral({a: () => 1}), /JSON values/);
    assert.notEqual(canonicalJson({a: () => 1}), canonicalJson({}));
    assert.equal(canonicalJson({b: 1, a: [2, {d: 1, c: 2}]}), '{"a":[2,{"c":2,"d":1}],"b":1}');
});

test('combatantStage splice edits numeric literals only and refuses unsafe forms', async () =>
{
    const text = fixture('balance.mjs');
    const content = spliceObjectNumbers(text, 'balance', ['ui', 'combatantStage'], {centerPct: 60, intentGapPx: 0});
    assert.equal(content.replace('centerPct: 60', 'centerPct: 50').replace('intentGapPx: 0', 'intentGapPx: 6'), text);
    const inserted = spliceObjectNumbers("export const balance = {\n  ui: {\n    combatantStage: {\n      centerPct: 50,\n    },\n  },\n};\n", 'balance', ['ui', 'combatantStage'], {intentGapPx: 4});
    assert.deepEqual(json((await evaluate(inserted, 'balance')).ui.combatantStage), {centerPct: 50, intentGapPx: 4});
    assert.throws(() => spliceObjectNumbers("export const balance = { ui: { combatantStage: { centerPct: 40 + 10 } } };\n", 'balance', ['ui', 'combatantStage'], {centerPct: 55}), /plain number literal/);
    assert.throws(() => spliceObjectNumbers("export const balance = { ui: { combatantStage: makeStage() } };\n", 'balance', ['ui', 'combatantStage'], {centerPct: 55}), /plain object literal/);
    assert.throws(() => planNativeSource('combatantStage', text, {stage: {centerPct: 80}}), /25–75/);
    assert.throws(() => planNativeSource('combatantStage', text, {stage: {other: 1}}), /Unknown/);
    const before = {ui: {combatantStage: {centerPct: 50, intentGapPx: 6}, other: 1}};
    assert.deepEqual(verifyNativeSource('combatantStage', {stage: {centerPct: 60}}, {before, after: {ui: {combatantStage: {centerPct: 60, intentGapPx: 6}, other: 1}}}), []);
    assert.equal(verifyNativeSource('combatantStage', {stage: {centerPct: 60}}, {before, after: {ui: {combatantStage: {centerPct: 60, intentGapPx: 6}, other: 2}}}).length, 1);
});

test('verification rejects drift in other cards and non-JSON originals', () =>
{
    const before = [{id: 'a', name: 'A'}, {id: 'b', name: 'B'}];
    assert.match(verifyNativeSource('card', {card: {id: 'a', name: 'A2'}, mode: 'replace', exportName: 'x'}, {before, after: [{id: 'a', name: 'A2'}, {id: 'b', name: 'B2'}]})[0], /b changed unexpectedly/);
    assert.match(verifyNativeSource('card', {card: {id: 'a', name: 'A2'}, mode: 'replace', exportName: 'x'}, {before, after: [{id: 'a', name: 'A3'}, {id: 'b', name: 'B'}]})[0], /differs from the reviewed draft/);
    assert.match(verifyNativeSource('card', {card: {id: 'a', name: 'A2'}, mode: 'replace', exportName: 'x'}, {before: [{id: 'a', name: 'A', text: {$nonJson: 'function'}}], after: [{id: 'a', name: 'A2'}]})[0], /non-JSON/);
    assert.match(verifyNativeSource('card', {card: {id: 'c'}, mode: 'append', exportName: 'x'}, {before, after: before})[0], /exactly one/);
});

// Optional: ASHENSPIRE_CHECKOUT=/path/to/AshenSpire round-trips every real card module.
const checkout = process.env.ASHENSPIRE_CHECKOUT;
test('every real card in an AshenSpire checkout survives replace and evaluates unchanged', {skip: !checkout || !existsSync(path.join(checkout, CARD_SOURCE_FILES[0])) ? 'set ASHENSPIRE_CHECKOUT to a game checkout' : false}, async () =>
{
    for (const file of CARD_SOURCE_FILES)
    {
        const text = readFileSync(path.join(checkout, file), 'utf8');
        const {exportName} = scanCardSource(text);
        const cards = json(await evaluate(text, exportName));
        for (const card of cards)
        {
            const after = json(await evaluate(spliceCardSource(text, card, {mode: 'replace'}).content, exportName));
            assert.deepEqual(after, cards, `${file} ${card.id}`);
        }
    }
});
