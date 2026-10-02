import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {access, mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import {createWorkspaceHost} from '../server/workspace-host.mjs';

const fixture = name => readFile(new URL('./fixtures/native-source/' + name, import.meta.url), 'utf8');

async function withHost(files, run)
{
    const directory = await mkdtemp(path.join(tmpdir(), 'native-source-host-'));
    let host, server;
    try
    {
        const source = path.join(directory, 'game');
        const root = path.join(directory, 'editor');
        await mkdir(source); await mkdir(root);
        for (const [name, content] of Object.entries(files))
        {
            await mkdir(path.dirname(path.join(source, name)), {recursive: true});
            await writeFile(path.join(source, name), content);
        }
        const git = (...args) => execFileSync('git', args, {cwd: source, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
        git('init', '-b', 'dev'); git('config', 'user.email', 'fixture@example.test'); git('config', 'user.name', 'Fixture');
        git('add', '.'); git('commit', '-m', 'Native source fixture');
        host = createWorkspaceHost({root, defaults: [], commandTimeout: 30000, jobTimeout: 60000});
        await host.ready;
        server = createServer((req, res) => host.middleware(req, res, () => {res.statusCode = 404; res.end();}));
        await new Promise((resolve, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', resolve);});
        const origin = `http://127.0.0.1:${server.address().port}`;
        const bootstrap = await fetch(origin + '/api/auth/session');
        const cookie = bootstrap.headers.get('set-cookie').split(';')[0];
        const status = await fetch(origin + '/api/workbench/status', {headers: {Cookie: cookie}}).then(response => response.json());
        assert.ok(status.capabilities.includes('native-source'));
        async function api(route, method = 'GET', value)
        {
            const response = await fetch(origin + '/api/workbench' + route, {method, headers: {Cookie: cookie, ...(method === 'GET' ? {} : {Origin: origin, 'Content-Type': 'application/json', 'X-Workbench-CSRF': status.csrfToken})}, ...(value === undefined ? {} : {body: JSON.stringify(value)})});
            return {status: response.status, body: await response.json()};
        }
        const imported = await api('/repos', 'POST', {path: source, branch: 'dev'});
        assert.equal(imported.status, 201);
        const id = imported.body.repo.id;
        assert.equal((await api(`/repos/${id}/connect`, 'POST', {})).status, 200);
        const checkout = path.join(root, '.workbench', 'repos', id);
        await run({api, id, source, checkout});
    }
    finally
    {
        if (host) await host.close();
        if (server?.listening) await new Promise(resolve => server.close(resolve));
        await rm(directory, {recursive: true, force: true});
    }
}

const CARDS = 'src/content/cards/rogue.js';
const evaluate = async (checkout, relative, name) => (await import(pathToFileURL(path.join(checkout, relative)).href + '?t=' + Math.random()))[name];

test('card adapter reviews, verifies by evaluation, and saves edited and new cards with revision checks', async () =>
{
    const original = await fixture('rogue-cards.mjs');
    await withHost({[CARDS]: original}, async ({api, id, source, checkout}) =>
    {
        const cards = await evaluate(checkout, CARDS, 'rogueCards');
        const edited = {...JSON.parse(JSON.stringify(cards.find(card => card.id === 'quickCut'))), name: 'Quick Cut, "edited"', cost: 1};
        const review = await api(`/repos/${id}/native-source/review`, 'POST', {adapter: 'card', path: CARDS, card: edited, mode: 'replace'});
        assert.equal(review.status, 200, review.body.error);
        assert.equal(review.body.verified, true);
        assert.equal(review.body.exportName, 'rogueCards');
        assert.match(review.body.diff, /\+ +name: 'Quick Cut, "edited"'/);
        assert.equal(review.body.before, original);
        const start = original.indexOf("    id: 'quickCut'") - 4;
        assert.equal(review.body.after.slice(0, start), original.slice(0, start), 'Bytes before the card are untouched');
        assert.ok(review.body.after.endsWith(original.slice(original.indexOf("  {\n    id: 'feint'"))), 'Bytes after the card are untouched');

        assert.equal((await api(`/repos/${id}/native-source/save`, 'POST', {adapter: 'card', path: CARDS, card: edited, mode: 'replace', revision: review.body.revision, expected: 'f'.repeat(64)})).status, 409, 'Unreviewed content refused');
        assert.equal((await api(`/repos/${id}/native-source/save`, 'POST', {adapter: 'card', path: CARDS, card: {...edited, cost: 2}, mode: 'replace', revision: review.body.revision, expected: review.body.expected})).status, 409, 'Draft changed after review refused');
        const saved = await api(`/repos/${id}/native-source/save`, 'POST', {adapter: 'card', path: CARDS, card: edited, mode: 'replace', revision: review.body.revision, expected: review.body.expected});
        assert.equal(saved.status, 200, saved.body.error);
        assert.equal(saved.body.content, review.body.after);
        const stale = await api(`/repos/${id}/native-source/save`, 'POST', {adapter: 'card', path: CARDS, card: edited, mode: 'replace', revision: review.body.revision, expected: review.body.expected});
        assert.equal(stale.status, 409, 'Stale revision refused');
        const afterSave = await evaluate(checkout, CARDS, 'rogueCards');
        assert.deepEqual(JSON.parse(JSON.stringify(afterSave.find(card => card.id === 'quickCut'))), edited);
        assert.equal(await readFile(path.join(source, CARDS), 'utf8'), original, 'Imported source stays untouched; adapter writes managed checkout');

        const added = {...edited, id: 'drafted', name: 'Drafted card'};
        assert.equal((await api(`/repos/${id}/native-source/review`, 'POST', {adapter: 'card', path: CARDS, card: added, mode: 'replace'})).status, 422, 'Replace needs an existing card');
        assert.equal((await api(`/repos/${id}/native-source/review`, 'POST', {adapter: 'card', path: CARDS, card: edited, mode: 'append'})).status, 422, 'Append refuses an existing id');
        const append = await api(`/repos/${id}/native-source/review`, 'POST', {adapter: 'card', path: CARDS, card: added, mode: 'append'});
        assert.equal(append.status, 200, append.body.error);
        const appended = await api(`/repos/${id}/native-source/save`, 'POST', {adapter: 'card', path: CARDS, card: added, mode: 'append', revision: append.body.revision, expected: append.body.expected});
        assert.equal(appended.status, 200, appended.body.error);
        const final = await evaluate(checkout, CARDS, 'rogueCards');
        assert.equal(final.length, cards.length + 1);
        assert.equal(final.at(-1).id, 'drafted');
        assert.equal(final.find(card => card.id === 'scannerProbe').note, cards.find(card => card.id === 'scannerProbe').note);
    });
});

test('card adapter rejects mismatched evaluation, sandbox escapes, and paths outside card modules', async () =>
{
    const mapped = "export const mappedCards = [\n  { id: 'one', name: 'One', cost: 1, effects: [] },\n].map(card => ({ ...card, cost: card.cost + 1 }));\n";
    const network = "import { connect } from 'node:net';\nexport const netCards = [\n  { id: 'one', name: 'One', effects: [] },\n];\n";
    const writer = "import { writeFileSync } from 'node:fs';\nwriteFileSync('escaped.txt', 'x');\nexport const writeCards = [\n  { id: 'one', name: 'One', effects: [] },\n];\n";
    const files = {'src/content/cards/mapped.js': mapped, 'src/content/cards/network.js': network, 'src/content/cards/writer.js': writer, 'src/content/other.js': "export const otherCards = [];\n"};
    await withHost(files, async ({api, id, checkout}) =>
    {
        const review = (file, card, mode = 'replace') => api(`/repos/${id}/native-source/review`, 'POST', {adapter: 'card', path: file, card, mode});
        const mismatch = await review('src/content/cards/mapped.js', {id: 'one', name: 'Two', cost: 1, effects: []});
        assert.equal(mismatch.status, 422);
        assert.match(mismatch.body.error, /differs from the reviewed draft/);
        const blocked = await review('src/content/cards/network.js', {id: 'one', name: 'Two', effects: []});
        assert.equal(blocked.status, 422);
        assert.match(blocked.body.error, /blocks node:net/);
        const escaped = await review('src/content/cards/writer.js', {id: 'one', name: 'Two', effects: []});
        assert.equal(escaped.status, 422);
        await assert.rejects(access(path.join(checkout, 'escaped.txt')), 'Permission model blocks module writes');
        assert.equal((await review('src/content/other.js', {id: 'one', name: 'One', effects: []}, 'append')).status, 403);
        assert.equal((await review('../outside.js', {id: 'one', name: 'One', effects: []}, 'append')).status, 403);
        assert.equal((await api(`/repos/${id}/native-source/review`, 'POST', {adapter: 'shell', path: 'src/content/cards/mapped.js'})).status, 403);
    });
});

test('combatantStage adapter writes numeric tokens into balance.js and verifies the rest of balance', async () =>
{
    const original = await fixture('balance.mjs');
    const files = {'src/content/balance.js': original, 'src/content/tooltipHelp.js': "export const tooltipHelp = { stage: 'Readable centre' };\n"};
    await withHost(files, async ({api, id, checkout}) =>
    {
        const route = action => `/repos/${id}/native-source/${action}`;
        assert.equal((await api(route('review'), 'POST', {adapter: 'combatantStage', path: 'src/content/balance.js', stage: {centerPct: 90}})).status, 422, 'Native validator range enforced');
        assert.equal((await api(route('review'), 'POST', {adapter: 'combatantStage', path: 'src/content/balance.js', stage: {bogus: 1}})).status, 422);
        const review = await api(route('review'), 'POST', {adapter: 'combatantStage', path: 'src/content/balance.js', stage: {centerPct: 55, intentGapPx: 8}});
        assert.equal(review.status, 200, review.body.error);
        assert.match(review.body.diff, /- +centerPct: 50,[^]*\+ +centerPct: 55,/);
        assert.equal(review.body.after.replace('intentGapPx: 8', 'intentGapPx: 6').replace('centerPct: 55', 'centerPct: 50'), original, 'Only the two literals change');
        const saved = await api(route('save'), 'POST', {adapter: 'combatantStage', path: 'src/content/balance.js', stage: {centerPct: 55, intentGapPx: 8}, revision: review.body.revision, expected: review.body.expected});
        assert.equal(saved.status, 200, saved.body.error);
        const balance = await evaluate(checkout, 'src/content/balance.js', 'balance');
        assert.deepEqual(balance.ui.combatantStage, {hudClearanceViewportPct: 3, actionClearanceViewportPct: 3, intentGapPx: 8, centerPct: 55});
        assert.equal(balance.help.stage, 'Readable centre');
    });
});
