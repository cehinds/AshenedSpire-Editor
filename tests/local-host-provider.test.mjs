import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {transformSync} from 'esbuild';

// Run the actual provider's hook state transitions with controlled network
// responses. Browser integration separately verifies checkout buffer rendering.
async function provider(runtime, fetch)
{
    const source = await readFile(new URL('../src/AuthGate.jsx', import.meta.url), 'utf8');
    const {code} = transformSync(source, {loader: 'jsx', format: 'cjs', jsx: 'automatic', define: {'import.meta.env.VITE_EDITOR_RUNTIME': JSON.stringify(runtime)}});
    const hooks = [];
    let cursor = 0;
    const react = {
        createContext: () => ({Provider: 'provider'}),
        useState(initial) {const index = cursor++; if (!(index in hooks)) hooks[index] = initial; return [hooks[index], value => {hooks[index] = typeof value === 'function' ? value(hooks[index]) : value;}];},
        useRef(initial) {const index = cursor++; return hooks[index] ||= {current: initial};},
        useCallback(callback) {cursor++; return callback;},
        useEffect() {cursor++;},
        useContext() {return null;},
    };
    const module = {exports: {}};
    vm.runInNewContext(code, {module, exports: module.exports, require: name => name === 'react' ? react : {jsx: (type, props) => ({type, props})}, fetch, AbortController, setTimeout, clearTimeout});
    const children = {draft: 'unsaved authoring'};
    const render = () => {cursor = 0; return module.exports.LocalHostProvider({children}).props;};
    return {render, children};
}

const response = token => ({ok: true, headers: {get: () => 'application/json'}, json: async () => ({accountsPaused: true, localAccess: true, csrfToken: token})});

test('local reconnect changes connection identity so tools can refresh tokens while authoring remains mounted', async () =>
{
    let token = 'first-host-session';
    const app = await provider('local', async () => response(token));
    assert.equal(app.render().children, app.children);
    assert.equal(app.render().value.connected, false);
    await app.render().value.refresh();
    assert.equal(app.render().value.connected, true);
    assert.equal(app.render().value.connectionId, token);
    await app.render().value.refresh();
    assert.equal(app.render().value.connectionId, token, 'Routine focus refresh keeps the same connection identity');
    token = 'restarted-host-session';
    await app.render().value.refresh();
    assert.equal(app.render().value.connectionId, token, 'Fresh host session triggers consumer status refresh');
    assert.equal(app.render().children, app.children, 'Unsaved authoring stays mounted through reconnect');
});

test('public static authoring mounts directly and never bootstraps local session access', async () =>
{
    let requests = 0;
    const app = await provider('static', async () => {requests++; return response('unexpected');});
    await app.render().value.refresh();
    assert.equal(requests, 0);
    assert.equal(app.render().value.offline, true);
    assert.equal(app.render().value.connected, false);
    assert.equal(app.render().children, app.children);
});

test('superseded local refresh cannot replace the newest host connection', async () =>
{
    const pending = [];
    const app = await provider('local', () => new Promise(resolve => pending.push(resolve)));
    const first = app.render().value.refresh();
    const second = app.render().value.refresh();
    pending[1](response('current-host-session'));
    await second;
    pending[0](response('obsolete-host-session'));
    await first;
    assert.equal(app.render().value.connectionId, 'current-host-session');
    assert.equal(app.render().value.connected, true);
});
