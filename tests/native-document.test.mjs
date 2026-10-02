import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {parseCSV, validateProject} from '../src/core.mjs';
import {checkDocumentPath, documentsFor, mergedNativeProject, parseNativeCSV, parseNativeDocument, reviewNativeSave, serializeNativeDocument} from '../src/native-document.mjs';

const read = name => readFileSync(new URL('../src/' + name, import.meta.url), 'utf8');
const json = name => JSON.parse(read(name));
function fixture()
{
    const cards = json('cards.json');
    return {schema: 'ashenspire.workbench/1', cards, nodes: parseCSV(read('sources/nodes.csv')), deck: cards.slice(0, 10).map(card => card.id), styles: {}, scenes: json('sources/prologue.json'), lab: {base: 40, role: 2, selected: true, policy: 'overflow', cardScale: 100}, ui: json('sources/w4a-combat.json'), pose: {...json('pose-config.json').components.starter, assets: json('pose-assets.json')}, scenario: {ruleset: 'foundations', cardId: cards[0].id, playerHp: 40, enemyHp: 30}, owned: Object.fromEntries(cards.map(card => [card.id, 2])), scenePlacement: {}, erdNative: null};
}
const paths = {tagging: 'content/source/tagging.csv', effects: 'content/source/nodeEffects.json', tags: 'content/source/nodes.csv', scenes: 'content/config/ui/screens/prologue.json', ui: 'content/config/ui/scenes/w4a-combat.json'};
const texts = {tagging: read('sources/tagging.csv'), effects: read('sources/nodeEffects.json'), tags: read('sources/nodes.csv'), scenes: read('sources/prologue.json'), ui: read('sources/w4a-combat.json')};
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

test('tag assignments CSV keeps interleaved comments and unchanged lines byte for byte', () =>
{
    const original = read('sources/tagging.csv');
    const {next, receipt} = loaded('tagging', original);
    assert.equal(serializeNativeDocument(next, 'tagging', receipt), original.replace(/\r\n/g, '\n'), 'Unchanged load/save is identity');
    const index = next.tagging.findIndex(row => row.family === 'card');
    const removed = next.tagging.splice(index, 1)[0];
    next.tagging.push({family: 'card', scope: '', objectId: 'ambush', tagId: 'drafted, "quoted"'});
    const saved = serializeNativeDocument(next, 'tagging', receipt);
    const comments = text => text.split('\n').filter(line => line.startsWith('#'));
    assert.deepEqual(comments(saved), comments(original), 'Every comment is retained in order');
    const line = `${removed.family},${removed.scope},${removed.objectId},${removed.tagId}`;
    assert.equal(saved.split('\n').filter(value => value === line).length, original.split('\n').filter(value => value === line).length - 1);
    assert.match(saved, /\ncard,,ambush,"drafted, ""quoted"""\n/);
    assert.deepEqual(parseNativeDocument('tagging', saved).value, next.tagging);
    assert.throws(() => mergedNativeProject(fixture(), 'tagging', 'family,objectId\ncard,ambush\n'), /requires unique family, scope, objectId, tagId/);
});

test('node effects JSON loads into draft, retains native keys, and refuses malformed entries', () =>
{
    const {next, receipt} = loaded('effects');
    assert.deepEqual(validateProject(next), []);
    const id = Object.keys(next.effects)[0];
    next.effects[id] = {...next.effects[id], editorNote: {kept: true}};
    const saved = JSON.parse(serializeNativeDocument(next, 'effects', receipt));
    assert.deepEqual(saved[id].editorNote, {kept: true});
    delete next.effects[id];
    assert.throws(() => serializeNativeDocument(next, 'effects', receipt), /Native field document\./);
    assert.throws(() => mergedNativeProject(fixture(), 'effects', '{"siphon": [1]}'), /effect objects/);
    assert.deepEqual(documentsFor('tags'), ['tags', 'tagging', 'effects']);
    assert.equal(checkDocumentPath('effects', paths.effects), paths.effects);
    assert.throws(() => checkDocumentPath('effects', 'content/source/nodeEffects.csv'));
});
