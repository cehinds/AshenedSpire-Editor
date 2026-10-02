import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { addPagesBuild, validateBuildIdentity } from "../scripts/pages-history.mjs";
import { checkPagesBuild } from "../scripts/check-pages-build.mjs";
import { checkBranchPolicy } from "../scripts/check-branch-policy.mjs";

test("Branch policy permits feature integration and ordered promotion while rejecting bypasses", () => {
  for (const [head, base] of [["feature/menu", "dev"], ["dev", "test"], ["test", "main"]]) {
    assert.equal(checkBranchPolicy({ base, head }), `${head} → ${base}`);
  }
  for (const [head, base] of [["feature/menu", "test"], ["dev", "main"], ["feature/menu", "main"]]) {
    assert.throws(() => checkBranchPolicy({ base, head }), /Promote/);
  }
  assert.throws(() => checkBranchPolicy({ base: "main", head: "test", baseRepository: "cehinds/AshenedSpireEditor", headRepository: "other/AshenedSpireEditor" }), /this repository/);
});

const commit = "a".repeat(40);
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "editor-pages-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const buildDirectory = path.join(root, "build");
  await mkdir(path.join(buildDirectory, "assets"), { recursive: true });
  await writeFile(path.join(buildDirectory, "index.html"), '<!doctype html><html lang="en"><script type="module" src="/AshenedSpireEditor/dev/12-1/assets/app.js"></script></html>');
  await writeFile(path.join(buildDirectory, "assets", "app.js"), 'console.log("Editor");');
  await writeFile(path.join(buildDirectory, "assets", "app.css"), "body{color:white}");
  await mkdir(path.join(buildDirectory, "native"));
  await writeFile(path.join(buildDirectory, "native", "erd-workbench-0.2.4.html"), "<!doctype html><html></html>");
  return { root, buildDirectory, siteDirectory: path.join(root, "site") };
}

test("Pages history preserves dev and test builds and latest never regresses on late completion", async (t) => {
  const f = await fixture(t);
  await addPagesBuild({ ...f, branch: "dev", buildNumber: "12-1", commit });
  await addPagesBuild({ ...f, branch: "test", buildNumber: "13-1", commit });
  await addPagesBuild({ ...f, branch: "dev", buildNumber: "10-1", commit });
  const manifest = JSON.parse(await readFile(path.join(f.siteDirectory, "builds.json"), "utf8"));
  assert.equal(manifest.builds.length, 3);
  assert.match(await readFile(path.join(f.siteDirectory, "dev/latest/index.html"), "utf8"), /\.\.\/12-1\//);
  assert.match(await readFile(path.join(f.siteDirectory, "test/13-1/index.html"), "utf8"), /type="module"/);
  assert.match(await readFile(path.join(f.siteDirectory, "index.html"), "utf8"), /test\/latest\//);
  assert.equal(JSON.parse(await readFile(path.join(f.siteDirectory, "dev/12-1/build-info.json"))).commit, commit);
});

test("Pages build identifiers cannot escape history directories", () => {
  for (const identity of [
    { branch: "../main", buildNumber: "1-1", commit },
    { branch: "dev", buildNumber: "../../x", commit },
    { branch: "dev", buildNumber: "1-1", commit: "short" },
  ]) assert.throws(() => validateBuildIdentity(identity));
});

test("Published build numbers are immutable and identical retry is idempotent", async (t) => {
  const f = await fixture(t);
  const identity = { ...f, branch: "dev", buildNumber: "12-1", commit };
  await addPagesBuild(identity);
  assert.equal((await addPagesBuild(identity)).builds.length, 1);
  await writeFile(path.join(f.buildDirectory, "assets/app.js"), "different output");
  await assert.rejects(addPagesBuild(identity), /Immutable/);
});

test("Pages artifact rejects symlinks instead of exposing external files", async (t) => {
  const f = await fixture(t);
  await symlink(path.join(f.root, "private.txt"), path.join(f.buildDirectory, "leak.txt"));
  await assert.rejects(addPagesBuild({ ...f, branch: "dev", buildNumber: "12-1", commit }), /symbolic links/);
});

test("Nested HTML smoke gate detects missing files and root-relative CSS or application escapes", async (t) => {
  const f = await fixture(t);
  await checkPagesBuild(f.buildDirectory, "/AshenedSpireEditor/dev/12-1/");
  await writeFile(path.join(f.buildDirectory, "assets/app.css"), 'body{background:url("/fonts/font.woff2")}');
  await assert.rejects(checkPagesBuild(f.buildDirectory, "/AshenedSpireEditor/dev/12-1/"), /CSS asset escapes/);
  await writeFile(path.join(f.buildDirectory, "assets/app.css"), "body{}");
  await writeFile(path.join(f.buildDirectory, "assets/app.js"), 'const frame="/native/tool.html";');
  await assert.rejects(checkPagesBuild(f.buildDirectory, "/AshenedSpireEditor/dev/12-1/"), /Application URL escapes/);
  await rm(path.join(f.buildDirectory, "assets/app.js"));
  await assert.rejects(checkPagesBuild(f.buildDirectory, "/AshenedSpireEditor/dev/12-1/"), /ENOENT/);
});

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function publish(cwd, env) {
  const script = fileURLToPath(new URL("../scripts/publish-pages-history.mjs", import.meta.url));
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve(output) : reject(new Error(output)));
  });
}

test("Concurrent Git history writers preserve all builds without force pushes", async (t) => {
  const f = await fixture(t);
  const remote = path.join(f.root, "remote.git");
  git(f.root, ["init", "--bare", "--initial-branch=main", remote]);
  const source = path.join(f.root, "source");
  await mkdir(source);
  git(source, ["init", "--initial-branch=main"]);
  git(source, ["config", "user.name", "Test"]);
  git(source, ["config", "user.email", "test@example.test"]);
  await writeFile(path.join(source, "README.md"), "Editor fixture");
  git(source, ["add", "."]);
  git(source, ["commit", "-m", "Initial"]);
  git(source, ["remote", "add", "origin", remote]);
  git(source, ["push", "origin", "main"]);
  const sha = git(source, ["rev-parse", "HEAD"]);
  const left = path.join(f.root, "left");
  const right = path.join(f.root, "right");
  git(f.root, ["clone", remote, left]);
  git(f.root, ["clone", remote, right]);
  const common = { PAGES_BUILD_DIRECTORY: f.buildDirectory, GITHUB_SHA: sha, GITHUB_RUN_ATTEMPT: "1" };
  await Promise.all([
    publish(left, { ...common, GITHUB_REF_NAME: "dev", GITHUB_RUN_NUMBER: "14" }),
    publish(right, { ...common, GITHUB_REF_NAME: "test", GITHUB_RUN_NUMBER: "15" }),
  ]);
  const history = JSON.parse(git(f.root, ["--git-dir", remote, "show", "gh-pages:builds.json"]));
  assert.equal(history.builds.length, 2);
  assert.deepEqual(history.builds.map((entry) => entry.branch).sort(), ["dev", "test"]);
  assert.match(await readFile(path.join(left, ".pages-site", "dev/14-1/index.html"), "utf8"), /<html/);
  await assert.rejects(readFile(path.join(left, ".pages-site", ".git")), /ENOENT/);
});

test("dev → test pull requests build, verify and upload the test HTML candidate without deploying Pages", async () => {
  const ci = (await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
  const job = ci.slice(ci.indexOf("  test-html-candidate:"));
  assert.ok(ci.includes("  test-html-candidate:"), "CI must define the test HTML candidate job");
  assert.match(job, /if: github\.event_name == 'pull_request' && github\.base_ref == 'test'/);
  assert.match(job, /run: npm run check:branches/);
  assert.match(job, /run: npm run build:pages/);
  assert.match(job, /run: npm run check:pages-html/);
  assert.match(job, /name: editor-html-test-candidate-/);
  assert.match(job, /path: dist\/pages\/index\.html\n\s+if-no-files-found: error/);
  assert.doesNotMatch(ci, /deploy-pages|upload-pages-artifact|pages: write|contents: write/);
  const pages = (await readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
  assert.match(pages, /^on:\n  push:\n    branches: \[dev, test, main\]\n  workflow_dispatch:\n/m);
  assert.doesNotMatch(pages, /pull_request/);
  assert.match(pages, /run: npm run build:pages\n\s+- run: npm run check:pages-html/);
});
