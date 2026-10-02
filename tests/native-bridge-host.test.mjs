import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {createWorkspaceHost} from '../server/workspace-host.mjs';
import {parseCSV} from '../src/core.mjs';
import {mergedNativeProject, reviewNativeSave} from '../src/native-document.mjs';

const sourceText = async name => readFile(new URL('../src/' + name, import.meta.url), 'utf8');
async function projectFixture()
{
    const json = async name => JSON.parse(await sourceText(name));
    const cards = await json('cards.json');
    return {schema: 'ashenspire.workbench/1', cards, nodes: parseCSV(await sourceText('sources/nodes.csv')), deck: cards.slice(0, 10).map(card => card.id), styles: {}, scenes: await json('sources/prologue.json'), lab: {base: 40, role: 2, selected: true, policy: 'overflow', cardScale: 100}, ui: await json('sources/w4a-combat.json'), pose: {...(await json('pose-config.json')).components.starter, assets: await json('pose-assets.json')}, scenario: {ruleset: 'foundations', cardId: cards[0].id, playerHp: 40, enemyHp: 30}, owned: Object.fromEntries(cards.map(card => [card.id, 2])), scenePlacement: {}, erdNative: null};
}

test('authenticated local native load/edit/review/save reaches build output and rejects stale overwrite', async () =>
{
    const directory = await mkdtemp(path.join(tmpdir(), 'native-bridge-host-'));
    let host, server;
    try
    {
        const source = path.join(directory, 'game');
        const root = path.join(directory, 'editor');
        await mkdir(source); await mkdir(root);
        const git = (...args) => execFileSync('git', args, {cwd: source, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
        git('init', '-b', 'dev'); git('config', 'user.email', 'fixture@example.test'); git('config', 'user.name', 'Fixture');
        const original = await sourceText('sources/w4a-combat.json');
        await writeFile(path.join(source, 'native-ui.json'), original);
        await writeFile(path.join(source, 'package.json'), JSON.stringify({name: 'bridge-fixture', version: '1.0.0', type: 'module', scripts: {build: 'node build.mjs'}}));
        await writeFile(path.join(source, 'package-lock.json'), JSON.stringify({name: 'bridge-fixture', version: '1.0.0', lockfileVersion: 3, packages: {}}));
        await writeFile(path.join(source, 'build.mjs'), "import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'; const ui=JSON.parse(readFileSync('native-ui.json','utf8')); mkdirSync('dist',{recursive:true}); writeFileSync('dist/index.html','<html><body>HUD '+ui.sizing.bands.hud+'</body></html>');\n");
        git('add', '.'); git('commit', '-m', 'Native bridge fixture');
        host = createWorkspaceHost({root, defaults: [], commandTimeout: 30000, jobTimeout: 60000});
        await host.ready;
        server = createServer((req, res) => host.middleware(req, res, () => {res.statusCode = 404; res.end();}));
        await new Promise((resolve, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', resolve);});
        const origin = `http://127.0.0.1:${server.address().port}`;
        const bootstrap = await fetch(origin + '/api/auth/session');
        let cookie = bootstrap.headers.get('set-cookie').split(';')[0];
        const session = await bootstrap.json();
        const status = await fetch(origin + '/api/workbench/status', {headers: {Cookie: cookie}}).then(response => response.json());
        async function api(route, method = 'GET', value)
        {
            const response = await fetch(origin + '/api/workbench' + route, {method, headers: {Cookie: cookie, ...(method === 'GET' ? {} : {Origin: origin, 'Content-Type': 'application/json', 'X-Workbench-CSRF': status.csrfToken})}, ...(value === undefined ? {} : {body: JSON.stringify(value)})});
            return {status: response.status, body: await response.json()};
        }
        const imported = await api('/repos', 'POST', {path: source, branch: 'dev'});
        assert.equal(imported.status, 201);
        const id = imported.body.repo.id;
        assert.equal((await api(`/repos/${id}/connect`, 'POST', {})).status, 200);
        const file = (await api(`/repos/${id}/file?path=native-ui.json`)).body;
        const {next, parsed} = mergedNativeProject(await projectFixture(), 'ui', file.content);
        const receipt = {ws: 'ui', repoId: id, path: file.path, revision: file.revision, parsed};
        next.ui.sizing.bands.hud += 2; next.ui.sizing.bands.scene -= 2;
        const review = reviewNativeSave(next, 'ui', receipt, file);
        const saved = await api(`/repos/${id}/file`, 'PUT', {path: file.path, revision: review.revision, content: review.after});
        assert.equal(saved.status, 200); assert.notEqual(saved.body.revision, file.revision);
        assert.equal((await api(`/repos/${id}/file`, 'PUT', {path: file.path, revision: file.revision, content: original})).status, 409);
        const current = (await api(`/repos/${id}/file?path=native-ui.json`)).body;
        assert.equal(JSON.parse(current.content).sizing.bands.hud, 12);
        assert.throws(() => reviewNativeSave(next, 'ui', receipt, current), /Checkout changed/);
        const started = await api(`/repos/${id}/jobs`, 'POST', {task: 'build'});
        assert.equal(started.status, 202, started.body.error);
        let job;
        for (let attempt = 0; attempt < 150; attempt += 1)
        {
            job = (await api('/jobs')).body.jobs.find(value => value.id === started.body.job.id);
            if (job.status !== 'running') break;
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        assert.equal(job.status, 'succeeded', job.log);
        const artifact = (await api(`/repos/${id}/artifacts`)).body.artifacts.find(value => value.path === 'dist/index.html');
        const preview = await fetch(origin + artifact.url);
        assert.equal(preview.status, 200); assert.match(await preview.text(), /HUD 12/);
        assert.equal(await readFile(path.join(source, 'native-ui.json'), 'utf8'), original, 'Original source stays untouched; native save targets managed checkout');
    }
    finally
    {
        if (host) await host.close();
        if (server?.listening) await new Promise(resolve => server.close(resolve));
        await rm(directory, {recursive: true, force: true});
    }
});
