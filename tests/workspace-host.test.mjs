import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer, request } from "node:http";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createWorkspaceHost, parseRepository, planCommand, redact, workspaceHostPlugin } from "../server/workspace-host.mjs";

const git = (dir, ...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
// Allow real subprocess completion on busy Windows hosts; these are not performance assertions.
const fixtureCommandTimeout = 30_000;
const fixtureJobTimeout = 60_000;

async function fixture(root, name, native = false) {
  const dir = path.join(root, name);
  await mkdir(dir);
  git(dir, "init", "-b", "main");
  git(dir, "config", "user.email", "fixture@example.test");
  git(dir, "config", "user.name", "Fixture");
  git(dir, "config", "core.autocrlf", "false");
  await writeFile(path.join(dir, ".gitattributes"), "* text=auto eol=lf\n");
  await mkdir(path.join(dir, "src"));
  await writeFile(path.join(dir, "src/game.txt"), "source game\n");
  await writeFile(path.join(dir, ".env"), "SECRET=blocked\n");
  await writeFile(path.join(dir, "binary.bin"), Buffer.from([1, 0, 255]));
  if (native) {
    await mkdir(path.join(dir, "tools"));
    await mkdir(path.join(dir, "art"));
    await writeFile(path.join(dir, "art/huge-original.txt"), "excluded original artwork");
    await writeFile(path.join(dir, "index.html"), "<html>source</html>");
    await writeFile(path.join(dir, "tools/bundle.mjs"), "export const bundle = true;\n");
    await writeFile(path.join(dir, "tools/launch.mjs"), "import {mkdirSync,writeFileSync} from 'node:fs'; if(!process.argv.includes('--build-only')) process.exit(3); mkdirSync('build/web',{recursive:true}); writeFileSync('build/web/AshenSpire.html','<html>native built game</html>'); console.log('Native build finished');\n");
  } else {
    await writeFile(path.join(dir, "package.json"), JSON.stringify({ name: "local-fixture", version: "1.0.0", scripts: { build: "node build.mjs", test: "node -e \"console.log('fixture test passed')\"", "test:long": "node -e \"setTimeout(()=>console.log('too late'),60000)\"", unsafe: "echo forbidden" } }));
    await writeFile(path.join(dir, "package-lock.json"), JSON.stringify({ name: "local-fixture", version: "1.0.0", lockfileVersion: 3, packages: {} }));
    await writeFile(path.join(dir, "build.mjs"), "import {mkdirSync,writeFileSync} from 'node:fs'; mkdirSync('dist',{recursive:true}); writeFileSync('dist/index.html','<html>fixture built game</html>'); console.log('password=never-reveal github_pat_1234567890'); console.log('Fixture build finished');\n");
  }
  git(dir, "add", ".");
  git(dir, "commit", "-m", "fixture");
  return dir;
}

async function start(root, sources) {
  const host = createWorkspaceHost({ root, defaults: [], cloneSource: repo => sources[repo.id], commandTimeout: 30_000, jobTimeout: 60_000 });
  await host.ready;
  const server = createServer((req, res) => host.middleware(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let cookie;
  const bootstrap = await fetch(`${origin}/api/auth/session`);
  cookie = bootstrap.headers.get("set-cookie").split(";")[0];
  const initial = await bootstrap.json();
  const status = await fetch(`${origin}/api/workbench/status`, { headers: { Cookie: cookie } }).then(response => response.json());
  async function api(route, method = "GET", body, headers = {}) {
    const response = await fetch(`${origin}/api/workbench${route}`, { method, headers: { Cookie: cookie, ...(method === "GET" ? {} : { Origin: origin, "Content-Type": "application/json", "X-Workbench-CSRF": status.csrfToken }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { response, status: response.status, body: await response.json() };
  }
  async function finish(id) {
    const deadline = Date.now() + fixtureJobTimeout + 15_000;
    while (Date.now() < deadline) {
      const { body } = await api("/jobs");
      const job = body.jobs.find(value => value.id === id);
      if (job.status !== "running") return job;
      await pause(50);
    }
    assert.fail("Fixture job did not finish.");
  }
  return { host, api, origin, status, finish, close: async () => { await host.close(); await new Promise(resolve => server.close(resolve)); } };
}

test("validates GitHub references and strips credential output", () => {
  assert.equal(parseRepository("git@github.com:cehinds/AshenSpire.git", "dev").id, "cehinds--ashenspire");
  assert.equal(parseRepository("git@github.com:cehinds/AshenSpire-Combat-Workshop.git").gitUrl, "git@github.com:cehinds/AshenSpire-Combat-Workshop.git");
  assert.equal(parseRepository("https://github.com/tester/Fixture.git").url, "https://github.com/tester/Fixture");
  for (const value of ["https://secret@github.com/tester/Repo", "https://evil.test/tester/Repo", "tester/../etc", "https://github.com/tester/Repo?secret=1", "tester/Repo/tree/main"]) assert.throws(() => parseRepository(value));
  for (const branch of ["--upload-pack=evil", "../main", "refs//main", "main.lock"]) assert.throws(() => parseRepository("tester/Repo", branch));
  assert.equal(redact("https://name:password@github.com/tester/Repo ghp_123456789 token=abc"), "https://[redacted]@github.com/tester/Repo [redacted] token=[redacted]");
});

test("Windows package manager planning accepts only fixed executable and literal arguments", () => {
  assert.deepEqual(planCommand("npm", ["run", "build:production"], "win32"), { command: "cmd.exe", args: ["/d", "/s", "/c", '"npm.cmd run build:production"'], windowsVerbatimArguments: true });
  assert.equal(planCommand("pnpm", ["install", "--frozen-lockfile"], "win32").args.at(-1), '"pnpm.cmd install --frozen-lockfile"');
  assert.equal(planCommand("yarn", ["run", "test"], "win32").command, "cmd.exe");
  assert.deepEqual(planCommand("bun", ["run", "build"], "win32"), { command: "bun.exe", args: ["run", "build"] });
  assert.deepEqual(planCommand(process.execPath, ["tools/launch.mjs", "--build-only"], "win32"), { command: process.execPath, args: ["tools/launch.mjs", "--build-only"] });
  assert.deepEqual(planCommand("npm", ["run", "build"], "linux"), { command: "npm", args: ["run", "build"] });
  for (const argument of ["build & calc.exe", "%COMSPEC%", "build;exit", "!PATH!", 'build"', "build\nexit"]) assert.throws(() => planCommand("npm", ["run", argument], "win32"));
});

test("local host clones, edits safely, builds, isolates artifacts, and persists repository registry", async () => {
  const temp = await mkdtemp(path.join(tmpdir(), "workbench-host-"));
  let app;
  try {
    const source = await fixture(temp, "source");
    const native = await fixture(temp, "native", true);
    const root = path.join(temp, "host"); await mkdir(root);
    const sources = { "tester--fixture": source, "cehinds--ashenspire": native };
    app = await start(root, sources);
    const { api } = app;
    assert.deepEqual(app.status.capabilities, ["repositories", "files", "builds", "branches", "local-import", "native-source"]);
    assert.equal((await api("/status")).response.headers.get("access-control-allow-origin"), null);
    const reboundStatus = await new Promise((resolve, reject) => {
      const req = request(`${app.origin}/api/workbench/status`, { headers: { Host: "evil.test" } }, response => { response.resume(); response.on("end", () => resolve(response.statusCode)); });
      req.on("error", reject); req.end();
    });
    assert.equal(reboundStatus, 403, "Reject DNS-rebinding host before exposing token");
    assert.equal((await api("/repos", "POST", { url: "tester/Fixture" }, { Origin: "http://evil.test" })).status, 403);
    assert.equal((await api("/repos", "POST", { url: "tester/Fixture" }, { "X-Workbench-CSRF": "bad" })).status, 403);
    assert.equal((await api("/repos", "POST", { url: "tester/Fixture" }, { "X-Workbench-CSRF": "é".repeat(64) })).status, 403, "Non-ASCII CSRF returns403 rather than timingSafeEqual length error");
    assert.equal((await api("/repos", "POST", { url: "tester/Fixture" }, { Origin: "null" })).status, 403);
    assert.equal((await api("/repos", "POST", { url: "https://token@github.com/tester/Fixture" })).status, 400);
    assert.equal((await api("/repos", "POST", { url: "git@github.com:tester/Fixture.git" })).status, 201);
    assert.equal((await api("/repos", "POST", { url: "tester/Fixture" })).status, 409);
    assert.equal((await api("/repos/tester--fixture/connect", "POST", {})).body.repo.status, "connected");
    assert.equal((await api("/repos")).body.repos[0].branch, "main", "Empty branch resolves remote default");
    assert.equal((await api("/repos/tester--fixture", "PATCH", { branch: "dev" })).status, 409);
    let tree = await api("/repos/tester--fixture/tree");
    assert(tree.body.entries.some(entry => entry.name === "src" && entry.type === "directory"));
    assert(!tree.body.entries.some(entry => [".git", ".env"].includes(entry.name)));
    const file = (await api("/repos/tester--fixture/file?path=src%2Fgame.txt")).body;
    assert.equal(file.content, "source game\n");
    const changed = await api("/repos/tester--fixture/file", "PUT", { path: file.path, content: "edited game\n", revision: file.revision });
    assert.equal(changed.status, 200); assert.notEqual(changed.body.revision, file.revision);
    assert.equal((await api("/repos/tester--fixture/file", "PUT", { path: file.path, content: "stale", revision: file.revision })).status, 409);
    for (const blocked of ["../source/src/game.txt", ".git/config", ".env", "node_modules/x", "src\\game.txt", "/etc/passwd", ".workbench/registry.json"]) {
      const result = await api(`/repos/tester--fixture/file?path=${encodeURIComponent(blocked)}`);
      assert([400, 403].includes(result.status), `${blocked}: ${result.status}`);
    }
    const managed = path.join(root, ".workbench/repos/tester--fixture");
    await symlink(path.join(source, "src/game.txt"), path.join(managed, "link.txt"));
    assert.equal((await api("/repos/tester--fixture/file?path=link.txt")).status, 403);
    tree = await api("/repos/tester--fixture/tree"); assert(!tree.body.entries.some(entry => entry.name === "link.txt"));
    assert.equal((await api("/repos/tester--fixture/file?path=binary.bin")).status, 415);
    const info = (await api("/repos/tester--fixture/git")).body;
    assert.equal(info.packageManager, "npm"); assert.equal(info.canBuild, true);
    assert(info.changes.some(change => change.path === "src/game.txt" && change.status.includes("M")));
    assert.equal((await api("/repos/tester--fixture/jobs", "POST", { task: "build", script: "unsafe" })).status, 422);
    const launch = await api("/repos/tester--fixture/jobs", "POST", { task: "build" });
    assert.equal(launch.status, 202);
    const job = await app.finish(launch.body.job.id);
    assert.equal(job.status, "succeeded"); assert(job.log.includes("Fixture build finished"));
    assert(!job.log.includes("never-reveal")); assert(!job.log.includes("github_pat_1234567890"));
    assert(job.artifacts.some(artifact => artifact.path === "dist/index.html"));
    const artifact = (await api("/repos/tester--fixture/artifacts")).body.artifacts[0];
    const preview = await fetch(`${app.origin}${artifact.url}`);
    assert.equal(await preview.text(), "<html>fixture built game</html>");
    assert.equal(preview.headers.get("access-control-allow-origin"), "*");
    assert(preview.headers.get("content-security-policy").includes("sandbox allow-scripts"));
    assert(preview.headers.get("content-security-policy").includes("connect-src 'self'"));
    assert.equal((await api("/preview/tester--fixture/src/game.txt")).status, 403);
    assert.equal((await api("/repos/tester--fixture/artifacts?path=src")).status, 403);
    await symlink(path.join(source, "src/game.txt"), path.join(managed, "dist/leak.txt"));
    assert.equal((await api("/preview/tester--fixture/dist/leak.txt")).status, 403);
    const simultaneous = await Promise.all([
      api("/repos/tester--fixture/jobs", "POST", { task: "test", script: "test:long" }),
      api("/repos/tester--fixture/jobs", "POST", { task: "test", script: "test:long" }),
    ]);
    assert.deepEqual(simultaneous.map(result => result.status).sort(), [202, 409], "Concurrent starts acquire one repository operation lock");
    const long = simultaneous.find(result => result.status === 202);
    assert.equal((await api("/repos/tester--fixture/jobs", "POST", { task: "build" })).status, 409);
    assert.equal((await api("/repos/tester--fixture/file", "PUT", { path: file.path, content: "during test", revision: changed.body.revision })).status, 409);
    assert.equal((await api(`/jobs/${long.body.job.id}/cancel`, "POST", {})).status, 200);
    assert.equal((await app.finish(long.body.job.id)).status, "cancelled");
    const builder = (await api("/repos/tester--fixture/file?path=build.mjs")).body;
    assert.equal((await api("/repos/tester--fixture/file", "PUT", { ...builder, content: "import {writeFileSync} from 'node:fs';writeFileSync('dist/index.html','refusal page');process.exit(7);\n" })).status, 200);
    const failed = await api("/repos/tester--fixture/jobs", "POST", { task: "build" });
    assert.equal((await app.finish(failed.body.job.id)).status, "failed");
    assert.equal((await fetch(`${app.origin}${artifact.url}`)).status, 409, "Failed newer build invalidates older preview links");
    assert.equal((await api("/repos/tester--fixture/artifacts")).body.artifacts.length, 0);
    const oldJob = (await api("/jobs")).body.jobs.find(value => value.id === launch.body.job.id);
    assert.equal(oldJob.artifactsStale, true); assert.equal(oldJob.artifacts, undefined);
    const restoreBuilder = (await api("/repos/tester--fixture/file?path=build.mjs")).body;
    await api("/repos/tester--fixture/file", "PUT", { ...restoreBuilder, content: builder.content });
    const rebuilt = await api("/repos/tester--fixture/jobs", "POST", { task: "build" });
    assert.equal((await app.finish(rebuilt.body.job.id)).status, "succeeded");
    assert.equal((await fetch(`${app.origin}${artifact.url}`)).status, 409, "Old generation rejected even after newer success");
    assert.equal((await api("/repos/tester--fixture/connect", "POST", {})).status, 200);
    assert.equal(await readFile(path.join(managed, "src/game.txt"), "utf8"), "edited game\n", "Fetch must preserve local edits");
    sources["tester--fixture"] = path.join(temp, "missing-remote");
    const offline = await api("/repos/tester--fixture/connect", "POST", {});
    assert.equal(offline.status, 200); assert.equal(offline.body.repo.status, "connected"); assert.equal(offline.body.remoteUpdated, false); assert(offline.body.warning.includes("Remote fetch failed"));
    assert.equal((await api("/repos/tester--fixture/file?path=src%2Fgame.txt")).body.content, "edited game\n");
    sources["tester--fixture"] = source;
    assert.equal((await api("/repos", "POST", { url: "cehinds/AshenSpire" })).status, 201);
    assert.equal((await api("/repos/cehinds--ashenspire/connect", "POST", {})).status, 200);
    const nativeInfo = (await api("/repos/cehinds--ashenspire/git")).body;
    assert.equal(nativeInfo.adapter, "ashenspire-node"); assert.equal(nativeInfo.packageManager, "node");
    assert.equal((await api("/repos/cehinds--ashenspire/jobs", "POST", { task: "install" })).status, 422);
    const nativeJob = await api("/repos/cehinds--ashenspire/jobs", "POST", { task: "build" });
    assert.equal((await app.finish(nativeJob.body.job.id)).status, "succeeded");
    assert(!(await api("/repos/cehinds--ashenspire/tree")).body.entries.some(entry => entry.name === "art"), "Sparse checkout omits original art");
    await app.close();
    const registryPath = path.join(root, ".workbench/registry.json");
    const registry = JSON.parse(await readFile(registryPath, "utf8"));
    for (const repo of registry.repos) repo.status = "not-connected";
    await writeFile(registryPath, JSON.stringify(registry));
    app = await start(root, sources);
    assert.equal((await app.api("/repos")).body.repos.length, 2);
    assert.equal((await app.api("/repos")).body.repos.find(repo => repo.id === "tester--fixture").gitUrl, "git@github.com:tester/Fixture.git", "SSH transport survives registry reload");
    assert((await app.api("/repos")).body.repos.every(repo => repo.status === "connected"), "Startup verifies real managed Git checkouts");
    assert.equal((await app.api("/repos/tester--fixture/file?path=src%2Fgame.txt")).body.content, "edited game\n");
  } finally { if (app) await app.close(); await rm(temp, { recursive: true, force: true }); }
});

test("Vite plugin exposes same local middleware for dev and built preview", async () => {
  const temp = await mkdtemp(path.join(tmpdir(), "workbench-vite-"));
  const installed = [];
  const httpServer = createServer((req, res) => installed[0](req, res, () => { res.statusCode = 404; res.end(); }));
  try {
    const plugin = workspaceHostPlugin({ root: temp, defaults: [] });
    const server = { httpServer, middlewares: { use: middleware => installed.push(middleware) } };
    plugin.configureServer(server); plugin.configurePreviewServer(server);
    assert.equal(installed.length, 2); assert.equal(installed[0], installed[1]);
    await new Promise(resolve => httpServer.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${httpServer.address().port}`;
    const bootstrap = await fetch(`${origin}/api/auth/session`);
    const session = await bootstrap.json();
    const response = await fetch(`${origin}/api/workbench/status`, { headers: { Cookie: bootstrap.headers.get("set-cookie").split(";")[0] } });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).capabilities, ["repositories", "files", "builds", "branches", "local-import", "native-source"]);
  } finally {
    if (httpServer.listening) await new Promise(resolve => httpServer.close(resolve));
    await rm(temp, { recursive: true, force: true });
  }
});
