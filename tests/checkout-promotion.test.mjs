import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rename, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {promoteCheckoutStage} from '../server/checkout-promotion.mjs';

async function fixture(t)
{
    const root = await mkdtemp(path.join(tmpdir(), 'checkout-promotion-'));
    t.after(() => rm(root, {recursive: true, force: true}));
    const stage = path.join(root, 'local-fixture.clone-' + 'a'.repeat(16)), target = path.join(root, 'local-fixture');
    await mkdir(stage); await writeFile(path.join(stage, 'game.txt'), 'staged game');
    return {root, stage, target};
}
const locked = code => Object.assign(new Error('Injected directory lock'), {code});

test('Windows transient EPERM/EACCES retries promote the same staged checkout and revalidate each attempt', async t =>
{
    const f = await fixture(t), delays = [];
    let attempts = 0, validations = 0;
    await promoteCheckoutStage(f.stage, f.target, {reposRoot: f.root, platform: 'win32', validateParent: async () => {validations++;}, wait: async delay => {delays.push(delay);}, renameOperation: async (from, to) => {assert.equal(from, f.stage); assert.equal(to, f.target); attempts++; if (attempts < 3) throw locked(attempts === 1 ? 'EPERM' : 'EACCES'); await rename(from, to);}});
    assert.equal(attempts, 3); assert.equal(validations, 3); assert.deepEqual(delays, [100, 250]);
    assert.equal(await readFile(path.join(f.target, 'game.txt'), 'utf8'), 'staged game');
    await assert.rejects(readFile(path.join(f.stage, 'game.txt')), {code: 'ENOENT'});
});

test('permanent Windows locks stop after a bounded retry budget and preserve staging', async t =>
{
    const f = await fixture(t), delays = [];
    let attempts = 0;
    await assert.rejects(promoteCheckoutStage(f.stage, f.target, {reposRoot: f.root, platform: 'win32', wait: async delay => {delays.push(delay);}, renameOperation: async () => {attempts++; throw locked('EPERM');}}), {code: 'EPERM'});
    assert.equal(attempts, 7); assert.equal(delays.length, 6); assert.equal(delays.reduce((sum, delay) => sum + delay, 0), 5850);
    assert.equal(await readFile(path.join(f.stage, 'game.txt'), 'utf8'), 'staged game');
});

test('other platforms and unrelated filesystem errors are never retried', async t =>
{
    const f = await fixture(t);
    for (const [platform, code] of [['linux', 'EPERM'], ['win32', 'ENOSPC'], ['win32', 'ENOENT']])
    {
        let attempts = 0, waits = 0;
        await assert.rejects(promoteCheckoutStage(f.stage, f.target, {reposRoot: f.root, platform, wait: async () => {waits++;}, renameOperation: async () => {attempts++; throw locked(code);}}), {code});
        assert.equal(attempts, 1); assert.equal(waits, 0);
    }
});

test('an occupied checkout target is preserved before rename or after a retry wait', async t =>
{
    for (const initial of [true, false])
    {
        const f = await fixture(t);
        let attempts = 0;
        const occupy = async () => {await mkdir(f.target); await writeFile(path.join(f.target, 'user.txt'), 'existing checkout');};
        if (initial) await occupy();
        await assert.rejects(promoteCheckoutStage(f.stage, f.target, {reposRoot: f.root, platform: 'win32', wait: occupy, renameOperation: async () => {attempts++; throw locked('EPERM');}}), error => error.status === 409);
        assert.equal(attempts, initial ? 0 : 1);
        assert.equal(await readFile(path.join(f.target, 'user.txt'), 'utf8'), 'existing checkout');
        assert.equal(await readFile(path.join(f.stage, 'game.txt'), 'utf8'), 'staged game');
    }
});

test('promotion refuses unowned paths and symlink staging without calling rename', async t =>
{
    const f = await fixture(t);
    let attempts = 0;
    const options = {reposRoot: f.root, platform: 'win32', renameOperation: async () => {attempts++;}};
    await assert.rejects(promoteCheckoutStage(f.stage, path.join(f.root, '../outside'), options), error => error.status === 403);
    await assert.rejects(promoteCheckoutStage(path.join(f.root, 'unowned.clone-' + 'a'.repeat(16)), f.target, options), error => error.status === 403);
    const alternate = path.join(f.root, 'linked.clone-' + 'b'.repeat(16));
    await symlink(f.stage, alternate, 'junction');
    await assert.rejects(promoteCheckoutStage(alternate, path.join(f.root, 'linked'), options), error => error.status === 403);
    assert.equal(attempts, 0);
});
