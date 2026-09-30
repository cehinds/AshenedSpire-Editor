import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createWorkspaceHost } from "../server/workspace-host.mjs";

const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function source(root, name, native = false) {
  const dir = path.join(root, name); await mkdir(dir);
  git(dir, "init", "-b", "main"); git(dir, "config", "user.name", "Fixture"); git(dir, "config", "user.email", "fixture@example.test");
  git(dir, "config", "core.autocrlf", "false");
  await writeFile(path.join(dir, ".gitattributes"), "* text=auto eol=lf\n");
  await writeFile(path.join(dir, "game.txt"), "main game\n");
  await writeFile(path.join(dir, ".gitignore"), "dist/\nnode_modules/\n");
  if (native) {
    await mkdir(path.join(dir, "tools")); await mkdir(path.join(dir, "src/content"), { recursive: true });
    await writeFile(path.join(dir, "index.html"), "<html>Native fixture</html>");
    await writeFile(path.join(dir, "tools/bundle.mjs"), "// AshenSpire.html fixture bundle marker\n");
    await writeFile(path.join(dir, "tools/launch.mjs"), "import {mkdirSync,writeFileSync} from 'node:fs';mkdirSync('dist',{recursive:true});writeFileSync('dist/index.html','built native fixture');\n");
    await writeFile(path.join(dir, "src/content/settingsDefaults.js"), "export const values = {};\n");
    await writeFile(path.join(dir, "tools/settings-defaults.mjs"), "import {readFileSync,writeFileSync} from 'node:fs';const profile=JSON.parse(readFileSync(process.argv[2],'utf8'));if(profile.game!=='Ashen Spire'||profile.schemaVersion!==1||typeof profile.overrides['settings.musicVolume']!=='number'||profile.overrides['settings.musicVolume']<0||profile.overrides['settings.musicVolume']>100)throw new Error('Illegal fixture settings profile');console.log('Settings validated');await new Promise(resolve=>setTimeout(resolve,150));writeFileSync('src/content/settingsDefaults.js','export const values = '+JSON.stringify(profile.overrides)+';\\n');console.log('Native fixture defaults written');\n");
  } else {
    await writeFile(path.join(dir, "package.json"), JSON.stringify({ name: "local-branch-fixture", version: "1.0.0", scripts: { "test:long": "node -e \"setTimeout(()=>console.log('done'),60000)\"", build: "node -e \"console.log('build')\"" } }));
    await writeFile(path.join(dir, "package-lock.json"), JSON.stringify({ name: "local-branch-fixture", version: "1.0.0", lockfileVersion: 3, packages: {} }));
  }
  git(dir, "add", "."); git(dir, "commit", "-m", "main fixture");
  git(dir, "branch", "test"); git(dir, "switch", "-c", "dev");
  await writeFile(path.join(dir, "game.txt"), "dev game\n"); git(dir, "add", "game.txt"); git(dir, "commit", "-m", "dev fixture"); git(dir, "switch", "main");
  git(dir, "remote", "add", "origin", "https://unreachable.example.test/no-network.git");
  return dir;
}

async function serve(root) {
  const host = createWorkspaceHost({ root, defaults: [], commandTimeout: 10_000, jobTimeout: 10_000 }); await host.ready;
  const server = createServer((req, res) => host.middleware(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const bootstrap = await fetch(origin + "/api/auth/session"); let cookie = bootstrap.headers.get("set-cookie").split(";")[0]; const session = await bootstrap.json();
  const signin = await fetch(origin + `/api/auth/${session.setupRequired ? "setup" : "login"}`, { method: "POST", headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json", "X-Auth-CSRF": session.csrfToken }, body: JSON.stringify({ username: "FixtureOwner", password: "fixture-password-123!" }) });
  assert.equal(signin.status, 200); cookie = signin.headers.get("set-cookie").split(";")[0];
  const status = await fetch(origin + "/api/workbench/status", { headers: { Cookie: cookie } }).then(response => response.json());
  async function api(route, method = "GET", body, headers = {}) {
    const response = await fetch(origin + "/api/workbench" + route, { method, headers: { Cookie: cookie, ...(method !== "GET" ? { Origin: origin, "Content-Type": "application/json", "X-Workbench-CSRF": status.csrfToken } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  }
  async function finish(id) {
    for (let attempt = 0; attempt < 300; attempt++) { const job = (await api("/jobs")).body.jobs.find(item => item.id === id); if (job.status !== "running") return job; await pause(20); }
    assert.fail("Local fixture job timed out.");
  }
  return { api, finish, close: async () => { await host.close(); await new Promise(resolve => server.close(resolve)); } };
}

test("local imports isolate files and preserve main/test/dev; branch mutations authenticate and refuse data loss", async () => {
  const temp = await mkdtemp(path.join(tmpdir(), "local-branches-")); let app;
  try {
    const original = await source(temp, "Game Source"); const root = path.join(temp, "editor"); await mkdir(root); app = await serve(root);
    const { api } = app;
    assert.equal((await api("/repos", "POST", { path: "relative/game" })).status, 400);
    assert.equal((await api("/repos", "POST", { path: root })).status, 403);
    assert.equal((await api("/repos", "POST", { path: temp })).status, 403);
    await symlink(original, path.join(temp, "linked-game"));
    assert.equal((await api("/repos", "POST", { path: path.join(temp, "linked-game") })).status, 403);
    const empty = path.join(temp, "not-git"); await mkdir(empty); assert.equal((await api("/repos", "POST", { path: empty })).status, 400);
    const added = await api("/repos", "POST", { path: original }); assert.equal(added.status, 201); const repo = added.body.repo; assert.equal(repo.kind, "local");
    assert.equal((await api("/repos", "POST", { path: original })).status, 409);
    const prefix = `/repos/${repo.id}`;
    assert.equal((await api(prefix + "/connect", "POST", {})).status, 200, "Import reads local Git objects despite unusable origin URL");
    const checkout = path.join(root, ".workbench/repos", repo.id);
    assert.equal(git(checkout, "remote", "get-url", "origin").trim(), await realpath(original));
    if (process.platform !== "win32") assert.notEqual((await stat(path.join(checkout, "game.txt"))).ino, (await stat(path.join(original, "game.txt"))).ino);
    let info = await api(prefix + "/branches"); assert.equal(info.body.current, "main"); assert.deepEqual(info.body.branches.map(branch => branch.name).sort(), ["dev", "main", "test"]);
    assert.equal(info.body.branches.find(branch => branch.name === "dev").head, git(original, "rev-parse", "dev").trim());
    assert.equal((await api(prefix + "/branches", "GET", undefined, { Cookie: "" })).status, 401);
    assert.equal((await api(prefix + "/branches", "POST", { name: "no-auth" }, { Cookie: "" })).status, 401);
    assert.equal((await api(prefix + "/branches/switch", "POST", { name: "dev" }, { "X-Workbench-CSRF": "bad" })).status, 403);
    for (const name of ["--force", "feature//bad", "../escape", "bad..name", "HEAD", "name;touch", "space branch", "foo.lock"]) assert.equal((await api(prefix + "/branches", "POST", { name })).status, 400, name);
    const switched = await api(prefix + "/branches/switch", "POST", { name: "dev" }); assert.equal(switched.status, 200); assert.equal(switched.body.current, "dev");
    assert.equal(await readFile(path.join(checkout, "game.txt"), "utf8"), "dev game\n"); assert.equal(await readFile(path.join(original, "game.txt"), "utf8"), "main game\n");
    const file = (await api(prefix + "/file?path=game.txt")).body;
    const edited = await api(prefix + "/file", "PUT", { ...file, content: "unsaved checkout changes\n" }); assert.equal(edited.status, 200);
    assert.equal((await api(prefix + "/branches/switch", "POST", { name: "main" })).status, 409);
    assert.equal((await api(prefix + "/branches", "POST", { name: "feature/dirty-switch", switch: true })).status, 409);
    assert(!(await api(prefix + "/branches")).body.branches.some(branch => branch.name === "feature/dirty-switch"));
    assert.equal((await api(prefix + "/branches", "POST", { name: "feature/ref-only", switch: false })).status, 201, "Creating ref does not discard dirty files");
    await api(prefix + "/file", "PUT", { ...edited.body, content: file.content });
    assert.equal((await api(prefix + "/branches", "POST", { name: "feature/cards", from: "dev", switch: true })).body.current, "feature/cards");
    assert.equal((await api(prefix + "/branches", "DELETE", { name: "feature/cards" })).status, 409);
    for (const name of ["main", "test", "dev"]) assert.equal((await api(prefix + "/branches", "DELETE", { name })).status, 403);
    assert.equal((await api(prefix + "/branches/switch", "POST", { name: "dev" })).status, 200);
    assert.equal((await api(prefix + "/branches", "DELETE", { name: "feature/cards" })).status, 200);
    await api(prefix + "/branches", "POST", { name: "feature/unmerged", switch: true });
    git(checkout, "config", "user.name", "Fixture"); git(checkout, "config", "user.email", "fixture@example.test");
    await writeFile(path.join(checkout, "unique.txt"), "preserve unmerged work"); git(checkout, "add", "unique.txt"); git(checkout, "commit", "-m", "unmerged work");
    await api(prefix + "/branches/switch", "POST", { name: "dev" });
    assert.equal((await api(prefix + "/branches", "DELETE", { name: "feature/unmerged" })).status, 409);
    assert((await api(prefix + "/branches")).body.branches.some(branch => branch.name === "feature/unmerged"));
    const job = await api(prefix + "/jobs", "POST", { task: "test", script: "test:long" }); assert.equal(job.status, 202);
    assert.equal((await api(prefix + "/branches/switch", "POST", { name: "main" })).status, 409);
    assert.equal((await api(prefix + "/branches", "POST", { name: "feature/during-test" })).status, 409);
    await api(`/jobs/${job.body.job.id}/cancel`, "POST", {}); assert.equal((await app.finish(job.body.job.id)).status, "cancelled");
    await rm(original, { recursive: true, force: true });
    assert.equal((await api(prefix + "/connect", "POST", {})).status, 200, "Existing isolated checkout remains usable after source removed");
    await app.close(); app = await serve(root);
    assert.equal((await app.api(prefix + "/branches")).body.current, "dev", "Local registration and branch survive restart");
  } finally { if (app) await app.close(); await rm(temp, { recursive: true, force: true }); }
});

test("reviewed local native settings promotion invokes tool, validates profile, locks checkout, and cleans private input", async () => {
  const temp = await mkdtemp(path.join(tmpdir(), "local-settings-")); let app;
  try {
    const original = await source(temp, "AshenSpire", true); const root = path.join(temp, "editor"); await mkdir(root); app = await serve(root);
    const { api } = app; const repo = (await api("/repos", "POST", { path: original })).body.repo; const prefix = `/repos/${repo.id}`;
    assert.equal((await api(prefix + "/connect", "POST", {})).status, 200);
    const capabilities = (await api(prefix + "/git")).body; assert.equal(capabilities.adapter, "ashenspire-node"); assert.equal(capabilities.canPromoteSettings, true);
    const profile = { game: "Ashen Spire", schemaVersion: 1, overrides: { "settings.musicVolume": 35 } };
    assert.equal((await api(prefix + "/jobs", "POST", { task: "settings", profile }, { Cookie: "" })).status, 401);
    assert.equal((await api(prefix + "/jobs", "POST", { task: "settings", profile: { bogus: true } })).status, 400);
    assert.equal((await api(prefix + "/jobs", "POST", { task: "settings", profile, script: "arbitrary" })).status, 400);
    const job = await api(prefix + "/jobs", "POST", { task: "settings", profile }); assert.equal(job.status, 202);
    assert.equal((await api(prefix + "/branches/switch", "POST", { name: "dev" })).status, 409);
    assert.equal((await api(prefix + "/jobs", "POST", { task: "build" })).status, 409);
    const finished = await app.finish(job.body.job.id); assert.equal(finished.status, "succeeded"); assert(finished.log.includes("Native fixture defaults written"));
    const target = (await api(prefix + "/file?path=src%2Fcontent%2FsettingsDefaults.js")).body; assert(target.content.includes('"settings.musicVolume":35'));
    assert(!(await readFile(path.join(original, "src/content/settingsDefaults.js"), "utf8")).includes("musicVolume"), "Source repository unchanged");
    assert.deepEqual(await readdir(path.join(root, ".workbench/profiles")), []);
    assert.equal((await api(prefix + "/branches/switch", "POST", { name: "dev" })).status, 409, "Promoted source changes require commit before branch switch");
    const invalid = await api(prefix + "/jobs", "POST", { task: "settings", profile: { ...profile, overrides: { "settings.musicVolume": 101 } } });
    assert.equal((await app.finish(invalid.body.job.id)).status, "failed");
    assert.equal((await api(prefix + "/file?path=src%2Fcontent%2FsettingsDefaults.js")).body.content, target.content, "Tool rejects illegal profile before writing defaults");
    assert.deepEqual(await readdir(path.join(root, ".workbench/profiles")), []);
    assert.equal((await api(prefix + "/artifacts")).body.artifacts.length, 0, "Rebuild required after promotion");
  } finally { if (app) await app.close(); await rm(temp, { recursive: true, force: true }); }
});
