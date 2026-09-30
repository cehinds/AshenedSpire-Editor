import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {parseCSV, validateProject} from '../src/core.mjs';
import {checkDocumentPath, mergedNativeProject, parseNativeCSV, reviewNativeSave, serializeNativeDocument} from '../src/native-document.mjs';

const read = name => readFileSync(new URL('../src/' + name, import.meta.url), 'utf8');
const json = name => JSON.parse(read(name));
function fixture()
{
    const cards = json('cards.json');
    return {schema: 'ashenspire.workbench/1', cards, nodes: parseCSV(read('sources/nodes.csv')), deck: cards.slice(0, 10).map(card => card.id), styles: {}, scenes: json('sources/prologue.json'), lab: {base: 40, role: 2, selected: true, policy: 'overflow', cardScale: 100}, ui: json('sources/w4a-combat.json'), pose: {...json('pose-config.json').components.starter, assets: json('pose-assets.json')}, scenario: {ruleset: 'foundations', cardId: cards[0].id, playerHp: 40, enemyHp: 30}, owned: Object.fromEntries(cards.map(card => [card.id, 2])), scenePlacement: {}, erdNative: null};
}
const paths = {tags: 'content/source/nodes.csv', scenes: 'content/config/ui/screens/prologue.json', ui: 'content/config/ui/scenes/w4a-combat.json'};
const texts = {tags: read('sources/nodes.csv'), scenes: read('sources/prologue.json'), ui: read('sources/w4a-combat.json')};
function loaded(ws, content = texts[ws])
{
    const {next, parsed} = mergedNativeProject(fixture(), ws, content);
    return {next, receipt: {ws, repoId: 'owner--game', path: paths[ws], revision: 'a'.repeat(64), parsed}};
}

test('native bridge loads full real documents without mutating existing draft', () =>
{
    for (const ws of ['tags', 'scenes', 'ui'])
    {
        const original = fixture(), before = structuredClone(original);
        const {next} = mergedNativeProject(original, ws, texts[ws]);
        assert.deepEqual(validateProject(next), []);
        assert.deepEqual(original, before);
    }
});

test('native CSV retains comments, source columns, Unicode, commas, quotes, and multiline cells', () =>
{
    const text = '# retained source notice\nid,parentId,label,foreign\ncard,,"Card, raíz","line one\nline ""two"""\n# retained second notice\n';
    const {next, receipt} = loaded('tags', text);
    next.nodes[0].label = 'Updated, raíz';
    const content = serializeNativeDocument(next, 'tags', receipt);
    assert.match(content, /# retained source notice/);
    assert.match(content, /# retained second notice/);
    assert.deepEqual(parseNativeCSV(content).value, next.nodes);
    assert.equal(parseNativeCSV(content).value[0].foreign, 'line one\nline "two"');
});

test('native bridge refuses duplicate headers, malformed CSV, and incompatible JSON', () =>
{
    for (const content of ['id,parentId,label,label\na,,x,x\n', 'id,parentId,label\na,,"unclosed', 'id,parentId,label\na,,x,extra\n']) assert.throws(() => mergedNativeProject(fixture(), 'tags', content));
    assert.throws(() => mergedNativeProject(fixture(), 'scenes', '{}'), /sequence/);
    assert.throws(() => mergedNativeProject(fixture(), 'ui', '{}'), /sizing/);
    assert.throws(() => mergedNativeProject(fixture(), 'ui', '{"sizing":{"bands":{"hud":5}}}'), /sum to 100/);
});

test('loaded native JSON retains unknown root, nested, and scene metadata after authoring edit', () =>
{
    const source = json('sources/prologue.json');
    source.foreign = {opaque: [1, 2]};
    source.components.sequence.foreign = {flag: true};
    source.components.sequence.scenes[0].foreign = {keep: 'value'};
    const {next, receipt} = loaded('scenes', JSON.stringify(source));
    next.scenes.components.sequence.scenes[0].text = 'Edited words';
    const saved = JSON.parse(serializeNativeDocument(next, 'scenes', receipt));
    assert.deepEqual(saved.foreign, source.foreign);
    assert.deepEqual(saved.components.sequence.scenes[0].foreign, {keep: 'value'});
    delete next.scenes.foreign;
    assert.throws(() => serializeNativeDocument(next, 'scenes', receipt), /Native field/);
});

test('review requires loaded document and exact checkout revision while retaining draft on conflict', () =>
{
    const {next, receipt} = loaded('ui');
    next.ui.sizing.bands.hud += 1; next.ui.sizing.bands.scene -= 1;
    const before = structuredClone(next);
    assert.throws(() => serializeNativeDocument(next, 'ui', null), /Load/);
    assert.throws(() => reviewNativeSave(next, 'ui', receipt, {path: receipt.path, revision: 'b'.repeat(64), content: texts.ui}), /Checkout changed/);
    assert.throws(() => reviewNativeSave(next, 'ui', receipt, {path: 'other.json', revision: receipt.revision, content: texts.ui}), /Checkout changed/);
    const review = reviewNativeSave(next, 'ui', receipt, {path: receipt.path, revision: receipt.revision, content: texts.ui});
    assert.equal(review.before, texts.ui);
    assert.equal(JSON.parse(review.after).sizing.bands.hud, before.ui.sizing.bands.hud);
    assert.deepEqual(next, before);
});

test('native bridge accepts existing relative document extensions and refuses private or unsupported paths', () =>
{
    assert.equal(checkDocumentPath('tags', paths.tags), paths.tags);
    assert.equal(checkDocumentPath('scenes', paths.scenes), paths.scenes);
    for (const path of ['/etc/a.csv', '../a.csv', 'a/../b.csv', '.workbench/a.csv', 'a\\b.csv', 'a.js', 'a//b.csv']) assert.throws(() => checkDocumentPath('tags', path));
    assert.throws(() => checkDocumentPath('cards', 'rogue.mjs'), /supports/);
});

test('saving tags refuses dropping unseen source columns or invalid parent relationships', () =>
{
    const {next, receipt} = loaded('tags');
    delete next.nodes[0].blurb;
    assert.throws(() => serializeNativeDocument(next, 'tags', receipt), /source CSV columns/);
    const again = loaded('tags');
    again.next.nodes[0].parentId = 'does-not-exist';
    assert.throws(() => serializeNativeDocument(again.next, 'tags', again.receipt), /Missing parent/);
});
