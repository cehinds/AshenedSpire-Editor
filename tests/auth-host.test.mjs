import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer, request } from "node:http";
import { mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { authCookie, createAuthHost } from "../server/auth-host.mjs";
import { createWorkspaceHost } from "../server/workspace-host.mjs";

const SECRET = "fixture-owner-password-456!";
const NEXT = "changed-fixture-password-789!";
const git = (cwd, ...args) => execFileSync("git", args, { cwd, stdio: "ignore" });

async function server(root, options = {}) {
  const host = createWorkspaceHost({ root, defaults: [], ...options });
  await host.ready;
  const http = createServer((req, res) => host.middleware(req, res, () => { res.statusCode = 404; res.end("missing"); }));
  await new Promise(resolve => http.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${http.address().port}`;
  function client() {
    let cookie = "", csrfToken;
    async function send(route, method = "GET", data, overrides = {}) {
      const response = await fetch(origin + route, { method, headers: { Cookie: cookie, ...(method === "GET" ? {} : { Origin: origin, "Content-Type": "application/json", "X-Auth-CSRF": csrfToken || "" }), ...overrides }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
      if (response.headers.get("set-cookie")) cookie = response.headers.get("set-cookie").split(";")[0];
      const text = await response.text();
      let body; try { body = JSON.parse(text); } catch { body = text; }
      if (body.csrfToken && route.startsWith("/api/auth/")) csrfToken = body.csrfToken;
      return { status: response.status, body, headers: response.headers, text };
    }
    return { send, get cookie() { return cookie; }, get csrfToken() { return csrfToken; } };
  }
  return { host, origin, client, close: async () => { await host.close(); await new Promise(resolve => http.close(resolve)); } };
}

async function builtFixture(root) {
  const dir = path.join(root, ".workbench/repos/fixture--game");
  await mkdir(path.join(dir, "dist/assets"), { recursive: true });
  await writeFile(path.join(dir, "source.txt"), "protected source");
  await writeFile(path.join(dir, "dist/index.html"), '<html><script src="./assets/game.js"></script></html>');
  await writeFile(path.join(dir, "dist/assets/game.js"), "console.log('built asset');");
  git(dir, "init", "-b", "main"); git(dir, "config", "user.name", "Fixture"); git(dir, "config", "user.email", "fixture@example.test"); git(dir, "add", "."); git(dir, "commit", "-m", "fixture");
  await writeFile(path.join(root, ".workbench/registry.json"), JSON.stringify({ version: 1, repos: [{ id: "fixture--game", url: "https://github.com/fixture/Game", branch: "main", status: "connected", lastBuildStatus: "succeeded", buildGeneration: "a".repeat(24) }] }));
}

test("cookie flags use actual TLS and ignore forwarded protocol claims", () => {
  const local = authCookie("token", { maxAge: 3600 });
  assert(local.includes("HttpOnly; SameSite=Strict")); assert(!local.includes("Secure"));
  assert(authCookie("token", { encrypted: true, maxAge: 3600 }).endsWith("; Secure"));
});

test("authentication store rejects dangling links and links to valid owner records", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "editor-auth-link-"));
  try {
    const storage = path.join(root, ".workbench");
    const target = path.join(root, "outside.json");
    await mkdir(storage);
    await symlink(target, path.join(storage, "auth.json"));
    await assert.rejects(createAuthHost({ root }).ready, /Authentication store unavailable/);
    const record = { version: 1, username: "Owner", algorithm: "scrypt", N: 32768, r: 8, p: 3, salt: "a".repeat(32), hash: "b".repeat(128) };
    await writeFile(target, JSON.stringify(record));
    await assert.rejects(createAuthHost({ root }).ready, /Authentication store unavailable/);
    assert.deepEqual(JSON.parse(await readFile(target, "utf8")), record);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("single-owner setup, API authorization, CSRF, preview capabilities, and session revocation", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "editor-auth-"));
  let app;
  try {
    await builtFixture(root);
    app = await server(root);
    const owner = app.client(), other = app.client(), visitor = app.client();
    for (const route of ["/api/workbench/status", "/api/workbench/repos", "/api/workbench/jobs", "/api/workbench/repos/fixture--game/tree", "/api/workbench/repos/fixture--game/file?path=source.txt", "/api/workbench/preview/fixture--game/dist/index.html"]) assert.equal((await visitor.send(route)).status, 401, route);
    assert.equal((await visitor.send("/api/auth/setup", "POST", { username: "Owner", password: SECRET })).status, 403, "Setup requires bootstrap CSRF");
    const bootstrap = await owner.send("/api/auth/session");
    assert.equal(bootstrap.body.setupRequired, true); assert.equal(bootstrap.body.authenticated, false);
    assert(bootstrap.headers.get("set-cookie").includes("HttpOnly; SameSite=Strict"));
    assert.equal((await owner.send("/api/auth/setup", "POST", { username: "Owner", password: SECRET }, { Origin: "http://evil.test" })).status, 403);
    assert.equal((await owner.send("/api/auth/setup", "POST", { username: "Owner", password: "short" })).status, 400);
    const beforeCookie = owner.cookie, beforeCsrf = owner.csrfToken;
    const setup = await owner.send("/api/auth/setup", "POST", { username: "Owner", password: SECRET }, { "X-Forwarded-Proto": "https" });
    assert.equal(setup.status, 200); assert.equal(setup.body.username, "Owner"); assert.equal(setup.body.authenticated, true);
    assert.notEqual(owner.cookie, beforeCookie); assert.notEqual(owner.csrfToken, beforeCsrf);
    assert(!setup.headers.get("set-cookie").includes("Secure"), "Untrusted forwarded protocol does not set Secure for local HTTP");
    const saved = await readFile(path.join(root, ".workbench/auth.json"), "utf8");
    assert(!saved.includes(SECRET)); assert.equal(JSON.parse(saved).algorithm, "scrypt");
    assert.deepEqual([JSON.parse(saved).N, JSON.parse(saved).r, JSON.parse(saved).p], [32768, 8, 3]);
    if (process.platform !== "win32") assert.equal((await stat(path.join(root, ".workbench/auth.json"))).mode & 0o777, 0o600);
    for (const route of ["/.workbench/auth.json", "/@fs" + root + "/.workbench/auth.json", "/%2eworkbench%2fauth.json"]) { const blocked = await visitor.send(route); assert.equal(blocked.status, 404); assert(!blocked.text.includes(JSON.parse(saved).hash)); }
    assert.equal((await owner.send("/api/auth/setup", "POST", { username: "Second", password: SECRET })).status, 409);
    assert.equal((await owner.send("/api/auth/logout", "POST", {}, { "X-Auth-CSRF": beforeCsrf })).status, 403, "Rotated CSRF cannot replay");
    assert.equal((await owner.send("/api/workbench/status")).status, 200);
    await other.send("/api/auth/session");
    assert.equal((await other.send("/api/auth/login", "POST", { username: "Owner", password: "wrong-password-123" })).status, 401);
    assert.equal((await other.send("/api/auth/login", "POST", { username: "Owner", password: SECRET })).status, 200);
    const artifacts = await owner.send("/api/workbench/repos/fixture--game/artifacts");
    const url = artifacts.body.artifacts[0].url;
    assert(url.includes("/~"));
    const builtPreview = await visitor.send(url);
    assert.equal(builtPreview.status, 200, "Artifact capability works without cookie in sandbox");
    assert(builtPreview.headers.get("content-security-policy").includes("sandbox allow-scripts allow-downloads"), "Sandbox permits game export downloads");
    assert(!builtPreview.headers.get("content-security-policy").includes("allow-same-origin"), "Game preview retains opaque origin");
    const assetUrl = new URL("./assets/game.js", app.origin + url).pathname;
    assert.equal((await visitor.send(assetUrl)).status, 200, "Relative artifact resource inherits scoped capability");
    const token = url.match(/~([a-f0-9]{64})/)[1];
    assert.equal((await visitor.send(`/api/workbench/status?preview=${token}`)).status, 401);
    assert.equal((await visitor.send(url.replace("dist/index.html", "source.txt"))).status, 401);
    assert.equal((await visitor.send(url.replace("job=" + "a".repeat(24), "job=" + "b".repeat(24)))).status, 401);
    assert.equal((await owner.send("/api/auth/logout", "POST", {})).body.authenticated, false);
    assert.equal((await visitor.send(url)).status, 401, "Logout revokes derived artifact capabilities");
    assert.equal((await owner.send("/api/workbench/status")).status, 401);
    assert.equal((await owner.send("/api/auth/login", "POST", { username: "Owner", password: SECRET })).status, 200);
    const secondUrl = (await owner.send("/api/workbench/repos/fixture--game/artifacts")).body.artifacts[0].url;
    const changed = await owner.send("/api/auth/password", "POST", { currentPassword: SECRET, newPassword: NEXT });
    assert.equal(changed.status, 200); assert.equal(changed.body.authenticated, false);
    assert.equal((await other.send("/api/workbench/status")).status, 401, "Password change revokes other sessions");
    assert.equal((await visitor.send(secondUrl)).status, 401, "Password change revokes all preview capabilities");
    assert.equal((await owner.send("/api/auth/login", "POST", { username: "Owner", password: SECRET })).status, 401);
    assert.equal((await owner.send("/api/auth/login", "POST", { username: "Owner", password: NEXT })).status, 200);
    await app.close(); app = await server(root);
    const restarted = app.client(); await restarted.send("/api/auth/session");
    assert.equal((await restarted.send("/api/auth/login", "POST", { username: "Owner", password: NEXT })).status, 200, "Hashed credential survives restart");
    const rebound = await new Promise((resolve, reject) => { const req = request(app.origin + "/api/auth/session", { headers: { Host: "evil.test" } }, response => { response.resume(); response.on("end", () => resolve(response.statusCode)); }); req.on("error", reject); req.end(); });
    assert.equal(rebound, 403);
  } finally { if (app) await app.close(); await rm(root, { recursive: true, force: true }); }
});

test("failed-login limits, bounded requests, absolute session expiry, and fail-closed store validation", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "editor-auth-limit-"));
  let app, clock = Date.now();
  try {
    app = await server(root, { authOptions: { now: () => clock, sessionMs: 1000, failureLimit: 2, failureWindowMs: 60_000 } });
    const client = app.client(); await client.send("/api/auth/session");
    assert.equal((await client.send("/api/auth/setup", "POST", { username: "Owner", password: SECRET })).status, 200);
    assert.equal((await client.send("/api/auth/password", "POST", { currentPassword: "bad-password-123", newPassword: NEXT })).status, 401);
    clock += 1001;
    assert.equal((await client.send("/api/workbench/status")).status, 401);
    await client.send("/api/auth/session");
    assert.equal((await client.send("/api/auth/login", "POST", { username: "Owner", password: "bad-password-123" })).status, 401);
    assert.equal((await client.send("/api/auth/login", "POST", { username: "Owner", password: SECRET })).status, 429);
    clock += 60_001;
    assert.equal((await client.send("/api/auth/login", "POST", { username: "Owner", password: SECRET })).status, 200);
    assert.equal((await client.send("/api/auth/password", "POST", { currentPassword: SECRET, newPassword: "x".repeat(129) })).status, 400);
    assert.equal((await client.send("/api/auth/login", "POST", { username: "Owner", password: "x".repeat(9000) })).status, 413);
    await app.close(); app = null;
    await writeFile(path.join(root, ".workbench/auth.json"), '{"invalid":"do-not-echo-secret"}');
    const invalid = createAuthHost({ root });
    await assert.rejects(invalid.ready, /Invalid authentication store/);
    await rm(path.join(root, ".workbench/auth.json"));
    await symlink(path.join(root, "outside.json"), path.join(root, ".workbench/auth.json"));
    const linked = createAuthHost({ root });
    await assert.rejects(linked.ready, /Authentication store unavailable/);
  } finally { if (app) await app.close(); await rm(root, { recursive: true, force: true }); }
});
