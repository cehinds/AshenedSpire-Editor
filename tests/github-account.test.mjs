import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createGitHubAccount } from "../server/github-account.mjs";
import { createWorkspaceHost } from "../server/workspace-host.mjs";

const disconnected = JSON.stringify({ hosts: {} });
const connected = JSON.stringify({ hosts: { "github.com": [{ active: true, state: "success", host: "github.com", login: "octocat", token: "ghp_never-expose", error: "password=never-expose", scopes: "private" }] } });
const tick = () => new Promise(resolve => setImmediate(resolve));
function harness(statuses = [disconnected], browserExit = 0) {
  const calls = [];
  const children = [];
  function spawnImpl(command, args, options) {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = new EventEmitter();
    child.stdin.end = input => { child.input = input; };
    child.kill = () => { child.killed = true; };
    calls.push({ command, args, options });
    children.push(child);
    if (command !== "gh") queueMicrotask(() => child.emit("close", browserExit));
    else if (args[1] === "status") queueMicrotask(() => {
      const result = statuses.length > 1 ? statuses.shift() : statuses[0];
      if (result instanceof Error) child.emit("error", result);
      else if (result !== null) { child.stdout.emit("data", typeof result === "object" ? result.stdout : result); child.emit("close", typeof result === "object" ? result.exitCode : 0); }
    });
    return child;
  }
  return { calls, children, spawnImpl };
}

test("GitHub status uses fixed arguments and exposes only a verified account name", async () => {
  const h = harness([connected]);
  const account = createGitHubAccount(h);
  assert.deepEqual(await account.status(), { available: true, connected: true, username: "octocat", login: { state: "idle" } });
  assert.deepEqual(h.calls[0].args, ["auth", "status", "--active", "--hostname", "github.com", "--json", "hosts"]);
  assert.equal(h.calls[0].options.shell, false);
  assert.equal(h.calls[0].options.windowsHide, true);
  assert.equal(h.calls[0].options.env.GH_BROWSER, undefined);
  assert.equal(h.calls[0].options.env.BROWSER, undefined);
  assert.equal((await account.startLogin()).connected, true);
  assert.equal(h.calls.filter(call => call.args[1] === "login").length, 0);
  account.close();
});

test("only POST start initiates one browser flow, parses split device code and verifies success", async () => {
  const h = harness([disconnected, connected]);
  const account = createGitHubAccount(h);
  const results = await Promise.all([account.startLogin(), account.startLogin(), account.startLogin()]);
  assert.ok(results.every(result => result.login.state === "pending"));
  assert.equal(h.children.length, 2);
  const child = h.children[1];
  assert.equal(child.input, "\n");
  assert.deepEqual(h.calls[1].args, ["auth", "login", "--hostname", "github.com", "--git-protocol", "https", "--web", "--skip-ssh-key"]);
  child.stderr.emit("data", "secret=never-expose First copy your one-time code: ABCD-");
  child.stderr.emit("data", "1234\nhttps://evil.example/token=secret ghp_private");
  child.stderr.emit("data", "\nMore output with code ABCD-1234");
  assert.deepEqual((await account.status()).login, { state: "pending", code: "ABCD-1234", verificationUrl: "https://github.com/login/device" });
  await account.startLogin();
  assert.equal(h.children.length, 3);
  const browserCall = h.calls[2];
  assert.equal(browserCall.command, process.platform === "win32" ? "rundll32.exe" : process.platform === "darwin" ? "open" : "xdg-open");
  assert.equal(browserCall.args.at(-1), "https://github.com/login/device");
  assert.equal(browserCall.options.shell, false);
  assert.equal(browserCall.options.windowsHide, true);
  child.emit("close", 0);
  await tick();
  assert.deepEqual(await account.status(), { available: true, connected: true, username: "octocat", login: { state: "succeeded" } });
  account.close();
});

test("failed default-browser opener retains only the fixed manual link and code", async () => {
  const h = harness([disconnected], 1);
  const account = createGitHubAccount({ ...h, platform: "win32" });
  await account.startLogin();
  const child = h.children[1];
  child.stderr.emit("data", "One-time code (ABCD-1234) copied to clipboard\n");
  await tick();
  const result = await account.status();
  assert.equal(result.login.state, "pending");
  assert.equal(result.login.code, "ABCD-1234");
  assert.equal(result.login.verificationUrl, "https://github.com/login/device");
  assert.match(result.login.error, /default browser could not be opened/);
  assert.deepEqual(h.calls[2].args, ["url.dll,FileProtocolHandler", "https://github.com/login/device"]);
  child.stderr.emit("data", "more output");
  await account.status();
  assert.equal(h.calls.filter(call => call.command !== "gh").length, 1);
  account.close();
});

test("missing CLI and failed login expose useful generic errors, never process diagnostics", async () => {
  const missing = Object.assign(new Error("secret diagnostic"), { code: "ENOENT" });
  const unavailable = createGitHubAccount(harness([missing]));
  assert.equal((await unavailable.startLogin()).available, false);
  assert.match((await unavailable.status()).login.error, /Install GitHub CLI/);
  unavailable.close();
  const h = harness();
  const account = createGitHubAccount(h);
  await account.startLogin();
  h.children[1].stderr.emit("data", "password=secret github_pat_12345");
  h.children[1].emit("close", 1);
  await tick();
  const status = await account.status();
  assert.equal(status.login.state, "failed");
  assert.doesNotMatch(JSON.stringify(status), /secret|github_pat|password/);
  account.close();
});

test("timeouts and host close terminate active login and discard expired device codes", async () => {
  const h = harness();
  const account = createGitHubAccount({ ...h, loginTimeout: 15 });
  await account.startLogin();
  h.children[1].stderr.emit("data", "one-time code: ABCD-1234");
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(h.children[1].killed, true);
  assert.match((await account.status()).login.error, /timed out/);
  assert.equal((await account.status()).login.code, undefined);
  await account.startLogin();
  const child = h.children.at(-1);
  account.close();
  assert.equal(child.killed, true);
  assert.match((await account.status()).login.error, /host closed/);
  const count = h.children.length;
  await account.startLogin();
  assert.equal(h.children.length, count);
});

test("status rejects malformed, inactive, failed and non-GitHub account data", async () => {
  for (const data of ["not JSON", "{}", JSON.stringify({ hosts: { "github.com": [{ active: true, state: "error", host: "github.com", login: "octocat" }] } }), JSON.stringify({ hosts: { "github.com": [{ active: false, state: "success", host: "github.com", login: "octocat" }] } }), JSON.stringify({ hosts: { "github.com": [{ active: true, state: "success", host: "evil.example", login: "octocat" }] } })]) {
    const account = createGitHubAccount(harness([data]));
    assert.equal((await account.status()).connected, false);
    account.close();
  }
});

test("nonzero status distinguishes logged-out CLI from fatal command failure without diagnostics", async () => {
  for (const exitCode of [1, 2]) {
    const account = createGitHubAccount(harness([{ exitCode, stdout: "token=private" }]));
    const result = await account.status();
    assert.equal(result.available, true);
    assert.equal(result.connected, false);
    assert.equal(result.login.state, exitCode === 1 ? "idle" : "failed");
    assert.doesNotMatch(JSON.stringify(result), /private|token=/);
    account.close();
  }
});

test("verified account clears an earlier failed status without starting login or a browser", async () => {
  const missing = Object.assign(new Error("private diagnostic"), { code: "ENOENT" });
  const h = harness([missing, connected]);
  const account = createGitHubAccount(h);
  assert.equal((await account.status()).login.state, "failed");
  assert.deepEqual(await account.status(), { available: true, connected: true, username: "octocat", login: { state: "idle" } });
  assert.ok(h.calls.every(call => call.command === "gh" && call.args[1] === "status"));
  account.close();
});

test("GitHub routes preserve session, origin, CSRF, JSON and credential-input protections", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "github-account-"));
  const h = harness();
  const host = createWorkspaceHost({ root, defaults: [], githubOptions: h });
  const server = createServer((req, res) => host.middleware(req, res, () => { res.statusCode = 404; res.end(); }));
  try {
    await host.ready;
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(`${origin}/api/workbench/github/status`)).status, 401);
    const bootstrap = await fetch(`${origin}/api/auth/session`);
    let cookie = bootstrap.headers.get("set-cookie").split(";")[0];
    const session = await bootstrap.json();
    const signin = await fetch(`${origin}/api/auth/setup`, { method: "POST", headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json", "X-Auth-CSRF": session.csrfToken }, body: JSON.stringify({ username: "FixtureOwner", password: "fixture-password-123!" }) });
    assert.equal(signin.status, 200);
    cookie = signin.headers.get("set-cookie").split(";")[0];
    const status = await fetch(`${origin}/api/workbench/status`, { headers: { Cookie: cookie } }).then(response => response.json());
    const headers = { Cookie: cookie, Origin: origin, "Content-Type": "application/json", "X-Workbench-CSRF": status.csrfToken };
    for (const [overrides, body, expected] of [[{ Origin: "https://evil.example" }, {}, 403], [{ "X-Workbench-CSRF": "" }, {}, 403], [{ "Content-Type": "text/plain" }, {}, 415], [{}, { token: "never-forward" }, 400]]) {
      assert.equal((await fetch(`${origin}/api/workbench/github/login`, { method: "POST", headers: { ...headers, ...overrides }, body: JSON.stringify(body) })).status, expected);
    }
    assert.equal(h.calls.length, 0);
    assert.equal((await fetch(`${origin}/api/workbench/github/status`, { headers: { Cookie: cookie } })).status, 200);
    assert.equal(h.calls.filter(call => call.args[1] === "login").length, 0);
    const result = await fetch(`${origin}/api/workbench/github/login`, { method: "POST", headers, body: "{}" });
    assert.equal(result.status, 200);
    assert.equal((await result.json()).login.state, "pending");
  } finally {
    await host.close();
    await new Promise(resolve => server.close(resolve));
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
