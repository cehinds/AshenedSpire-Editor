import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createServer, request} from 'node:http';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {createWorkspaceHost} from '../server/workspace-host.mjs';

test('paused accounts open local operations without credentials and preserve origin, CSRF and private paths', async t =>
{
    const root = await mkdtemp(path.join(tmpdir(), 'editor-local-access-'));
    // Even an invalid legacy account store must be preserved and ignored.
    await mkdir(path.join(root, '.workbench'));
    await writeFile(path.join(root, '.workbench/auth.json'), 'preserve existing account data');
    let clock = Date.now();
    const host = createWorkspaceHost({root, defaults: [], authOptions: {now: () => clock, sessionMs: 1000}});
    await host.ready;
    const server = createServer((req, res) => host.middleware(req, res, () => {res.statusCode = 404; res.end();}));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => {await host.close(); await new Promise(resolve => server.close(resolve)); await rm(root, {recursive: true, force: true});});
    const origin = `http://127.0.0.1:${server.address().port}`;
    const bootstrap = await fetch(origin + '/api/auth/session');
    let cookie = bootstrap.headers.get('set-cookie').split(';')[0];
    const session = await bootstrap.json();
    assert.equal(session.accountsPaused, true); assert.equal(session.localAccess, true);
    assert.equal(session.setupRequired, false); assert.equal(session.authenticated, false); assert.equal(session.username, null);
    const status = await fetch(origin + '/api/workbench/status', {headers: {Cookie: cookie}});
    assert.equal(status.status, 200);
    const {csrfToken} = await status.json();
    for (const action of ['setup', 'login', 'password', 'logout'])
    {
        const response = await fetch(origin + '/api/auth/' + action, {method: 'POST', headers: {Cookie: cookie, Origin: origin, 'Content-Type': 'application/json'}, body: '{}'});
        assert.equal(response.status, 404, `Dormant ${action} endpoint must not configure an account`);
    }
    const mutation = async headers => fetch(origin + '/api/workbench/repos', {method: 'POST', headers: {Cookie: cookie, Origin: origin, 'Content-Type': 'application/json', 'X-Workbench-CSRF': csrfToken, ...headers}, body: '{}'});
    assert.equal((await mutation({'X-Workbench-CSRF': ''})).status, 403);
    assert.equal((await mutation({Origin: 'http://evil.test'})).status, 403);
    assert.equal((await mutation({Origin: 'null'})).status, 403, 'Sandbox cannot invoke checkout writes');
    assert.equal((await mutation({})).status, 400, 'Valid local access reaches data validation');
    assert.equal((await fetch(origin + '/api/auth/session', {headers: {Origin: 'http://evil.test'}})).status, 403);
    const rebound = await new Promise((resolve, reject) => {const req = request(origin + '/api/auth/session', {headers: {Host: 'evil.test'}}, res => {res.resume(); res.on('end', () => resolve(res.statusCode));}); req.on('error', reject); req.end();});
    assert.equal(rebound, 403);
    for (const blocked of ['/.workbench/auth.json', '/%2eworkbench%2fauth.json', '/.git/config']) assert.equal((await fetch(origin + blocked)).status, 404);
    clock += 1001;
    assert.equal((await fetch(origin + '/api/workbench/status', {headers: {Cookie: cookie}})).status, 401);
    const reconnect = await fetch(origin + '/api/auth/session', {headers: {Cookie: cookie}});
    assert.equal(reconnect.status, 200); cookie = reconnect.headers.get('set-cookie').split(';')[0];
    assert.equal((await fetch(origin + '/api/workbench/status', {headers: {Cookie: cookie}})).status, 200, 'Reconnect never requires credentials');
    assert.equal(await readFile(path.join(root, '.workbench/auth.json'), 'utf8'), 'preserve existing account data');
});

test('account-free preview capabilities remain sandboxed, artifact-only and expire with local access', async t =>
{
    const root = await mkdtemp(path.join(tmpdir(), 'editor-local-preview-'));
    const checkout = path.join(root, '.workbench/repos/fixture--game');
    await mkdir(path.join(checkout, 'dist/assets'), {recursive: true});
    await writeFile(path.join(checkout, 'source.txt'), 'private game source');
    await writeFile(path.join(checkout, 'dist/index.html'), '<html>Built fixture</html>');
    await writeFile(path.join(checkout, 'dist/assets/game.js'), 'console.log("built fixture")');
    const git = (...args) => execFileSync('git', args, {cwd: checkout, stdio: 'ignore'});
    git('init', '-b', 'main'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.test'); git('add', '.'); git('commit', '-m', 'fixture');
    const generation = 'a'.repeat(24);
    await writeFile(path.join(root, '.workbench/registry.json'), JSON.stringify({version: 1, repos: [{id: 'fixture--game', url: 'https://github.com/fixture/Game', branch: 'main', status: 'connected', lastBuildStatus: 'succeeded', buildGeneration: generation}]}));
    let clock = Date.now();
    const host = createWorkspaceHost({root, defaults: [], authOptions: {now: () => clock, sessionMs: 1000}});
    await host.ready;
    const server = createServer((req, res) => host.middleware(req, res, () => {res.statusCode = 404; res.end();}));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => {await host.close(); await new Promise(resolve => server.close(resolve)); await rm(root, {recursive: true, force: true});});
    const origin = `http://127.0.0.1:${server.address().port}`;
    const bootstrap = await fetch(origin + '/api/auth/session');
    const cookie = bootstrap.headers.get('set-cookie').split(';')[0];
    const receipt = await fetch(origin + '/api/workbench/repos/fixture--game/artifacts', {headers: {Cookie: cookie}}).then(res => res.json());
    const url = receipt.artifacts[0].url;
    assert.match(url, /\/~[a-f0-9]{64}\//);
    const preview = await fetch(origin + url);
    assert.equal(preview.status, 200);
    assert.match(preview.headers.get('content-security-policy'), /sandbox allow-scripts allow-downloads/);
    assert.doesNotMatch(preview.headers.get('content-security-policy'), /allow-same-origin/);
    assert.equal((await fetch(new URL('./assets/game.js', origin + url))).status, 200);
    assert.equal((await fetch(origin + url.replace('dist/index.html', 'source.txt'))).status, 401);
    assert.equal((await fetch(origin + url.replace('job=' + generation, 'job=' + 'b'.repeat(24)))).status, 401);
    assert.equal((await fetch(origin + '/api/workbench/status?preview=' + url.match(/~([a-f0-9]{64})/)[1])).status, 401);
    clock += 1001;
    assert.equal((await fetch(origin + url)).status, 401, 'Local session expiry revokes preview capability');
    await assert.rejects(readFile(path.join(root, '.workbench/auth.json')), {code: 'ENOENT'}, 'No owner account was created');
});
