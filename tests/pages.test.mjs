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

test('Pages serializes the full run and gives validated history upload and deployment separate bounded jobs', async () => {
  const pages = (await readFile(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  const [workflow, jobs] = pages.split('\njobs:\n');
  assert.match(workflow, /\nconcurrency:\n  group: editor-pages-publication\n  queue: max\n  cancel-in-progress: false\n/);
  assert.doesNotMatch(jobs, /concurrency:/, 'the queue must span the entire upload/deploy sequence');
  const jobBlocks = [...jobs.matchAll(/^  (\w+):\n([\s\S]*?)(?=^  \w+:\n|$(?![\s\S]))/gm)];
  assert.deepEqual(jobBlocks.map(match => match[1]), ['build', 'publish', 'deploy']);
  const { build, publish, deploy } = Object.fromEntries(jobBlocks.map(match => [match[1], match[2]]));
  for (const job of [build, publish, deploy]) assert.match(job, /^    timeout-minutes: 5$/m);
  for (const gate of ['npm ci --no-audit --no-fund', 'npm run review:quick', 'npm run build:pages', 'npm run check:pages-html', 'npm test']) {
    assert.ok(build.includes(`run: ${gate}\n`), `build must retain ${gate}`);
  }
  assert.match(publish, /^    needs: build$/m);
  assert.match(deploy, /^    needs: publish$/m);
  const artifact = 'name: editor-html-${{ github.run_id }}-${{ github.run_attempt }}';
  assert.ok(build.includes(artifact) && publish.includes(artifact), 'history consumes this run and attempt’s validated HTML');
  assert.match(publish, /run: node scripts\/publish-pages-history\.mjs/);
  assert.match(publish, /actions\/upload-pages-artifact@[a-f0-9]{40}[\s\S]*name: github-pages\n\s+path: \.pages-site\//);
  assert.match(publish, /permissions:\n      contents: write\n/);
  assert.doesNotMatch(publish, /deploy-pages|pages: write|id-token: write|environment:/);
  assert.match(deploy, /permissions:\n      pages: write\n      id-token: write\n/);
  assert.match(deploy, /environment:\n      name: github-pages\n      url: \$\{\{ steps\.deployment\.outputs\.page_url \}\}/);
  assert.match(deploy, /id: deployment\n\s+uses: actions\/deploy-pages@[a-f0-9]{40}[\s\S]*artifact_name: github-pages/);
  assert.doesNotMatch(deploy, /contents: write|actions\/checkout|run: (?:npm|node)|upload-pages-artifact|run_id:/, 'deployment uses the same-run uploaded site without rebuilding or fetching another run');
});

// Large hosted builds retain the exact source artifact but avoid oversized Git blobs.
import { randomBytes, createHash, webcrypto } from 'node:crypto';
import vm from 'node:vm';
import { decodeHostedHtml } from '../scripts/pages-delivery.mjs';

async function largeFixture(t) {
  const f=await fixture(t);
  const original=Buffer.from(`<!doctype html><html lang="en"><body>Original editor · 🔥<script>window.originalEditor=true;</script><!--${randomBytes(4096).toString('hex')}--></body></html>`);
  await writeFile(path.join(f.buildDirectory,'index.html'),original);
  const identity={...f,branch:'dev',buildNumber:'20-1',commit,deliveryOptions:{thresholdBytes:128,chunkBytes:256}};
  const history=await addPagesBuild(identity),destination=path.join(f.siteDirectory,'dev','20-1');
  const manifest=JSON.parse(await readFile(path.join(destination,'editor-delivery.json'),'utf8'));
  const readChunk=async file=>readFile(path.join(destination,file));
  return {...f,original,identity,history,destination,manifest,readChunk};
}

test('large hosted HTML is lossless bounded transport while build artifact and original digest remain unchanged',async t=>{
  const f=await largeFixture(t);
  assert.ok(f.manifest.chunks.length>1);
  assert.ok(f.manifest.chunks.every(c=>c.bytes<=256));
  assert.deepEqual(Buffer.from(await decodeHostedHtml(f.manifest,f.readChunk)),f.original);
  assert.deepEqual(await readFile(path.join(f.buildDirectory,'index.html')),f.original);
  assert.equal(f.history.builds[0].delivery.originalSha256,createHash('sha256').update(f.original).digest('hex'));
  const plain=await addPagesBuild({...f,branch:'test',buildNumber:'21-1',commit});
  assert.equal(plain.builds[0].digest,plain.builds[1].digest,'transport never changes the original build digest');
  assert.equal(plain.builds[1].delivery,undefined);
  assert.deepEqual(await readFile(path.join(f.siteDirectory,'test','21-1','index.html')),f.original);
  const loader=await readFile(path.join(f.destination,'index.html'),'utf8');
  assert.match(loader,/Download single HTML/);assert.match(loader,/document\.open\(\);document\.write\(html\);document\.close\(\)/);
});

test('chunk corruption, truncation, wrong original content and escaped chunk names fail verification',async t=>{
  const f=await largeFixture(t);
  await assert.rejects(decodeHostedHtml(f.manifest,async file=>{const b=Buffer.from(await f.readChunk(file));b[0]^=1;return b;}),/verification failed/);
  await assert.rejects(decodeHostedHtml(f.manifest,async file=>(await f.readChunk(file)).subarray(1)),/verification failed/);
  await assert.rejects(decodeHostedHtml({...f.manifest,originalSha256:'0'.repeat(64)},f.readChunk),/content verification failed/);
  await assert.rejects(decodeHostedHtml({...f.manifest,originalBytes:f.original.length-1},f.readChunk),/size exceeds/);
  await assert.rejects(decodeHostedHtml({...f.manifest,chunks:[{...f.manifest.chunks[0],file:'../private.bin'}]},f.readChunk),/Invalid.*chunk/);
});

test('large build retries preserve immutable hosted chunks and reject changed source bytes',async t=>{
  const f=await largeFixture(t),before=await readFile(path.join(f.destination,'index.html'));
  await addPagesBuild({...f.identity,deliveryOptions:{thresholdBytes:1,chunkBytes:32}});
  assert.deepEqual(await readFile(path.join(f.destination,'index.html')),before);
  await writeFile(path.join(f.buildDirectory,'index.html'),Buffer.concat([f.original,Buffer.from('changed')]));
  await assert.rejects(addPagesBuild(f.identity),/Immutable/);
});

async function loaderHarness(f,{download=false,corrupt=false}={}) {
  const html=await readFile(path.join(f.destination,'index.html'),'utf8'),script=html.match(/<script>([\s\S]*)<\/script>/)[1];
  const nodes=new Map(),state={href:'https://example.test/editor/dev/20-1/',written:null,blob:null};
  const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,disabled:false,textContent:'',click(){this.onclick?.();}});return nodes.get(id);};
  let done;const completed=new Promise(resolve=>done=resolve);
  let errorHidden=false;Object.defineProperty(node('error'),'hidden',{get(){return errorHidden;},set(value){errorHidden=value;if(!value)done();}});
  let scriptContext;const document={getElementById:node,open(){state.opened=true;state.transportReleased=vm.runInContext('original===null && pending===null && downloadUrl===null',scriptContext);},write(text){state.written=text;},close(){done();},createElement(){return {click(){done();}};}};
  class BrowserURL extends URL {static createObjectURL(blob){state.blob=blob;return 'blob:verified-editor';}}
  const context={document,location:{href:state.href},crypto:webcrypto,TextDecoder,Uint8Array,Blob,ReadableStream,DecompressionStream,URL:BrowserURL,AbortSignal,
    fetch:async url=>({ok:true,arrayBuffer:async()=>{const b=Buffer.from(await f.readChunk(path.basename(url.pathname)));if(corrupt)b[0]^=1;return b;}})};
  scriptContext=vm.createContext(context);vm.runInContext(script,scriptContext);
  if(download)node('download').click();
  let timer;try{await Promise.race([completed,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('loader timed out')),5000);})]);}finally{clearTimeout(timer);}
  return {state,nodes};
}

test('hosted loader opens exact original HTML at the same URL and download returns those exact bytes',async t=>{
  const f=await largeFixture(t),opened=await loaderHarness(f);
  assert.equal(opened.state.written,f.original.toString('utf8'));
  assert.equal(opened.state.transportReleased,true);
  assert.equal(opened.state.href,'https://example.test/editor/dev/20-1/');
  const saved=await loaderHarness(f,{download:true});
  assert.equal(saved.state.written,null);
  assert.deepEqual(Buffer.from(await saved.state.blob.arrayBuffer()),f.original);
});

test('hosted loader exposes a retryable error and never opens unverified content',async t=>{
  const f=await largeFixture(t),result=await loaderHarness(f,{corrupt:true});
  assert.equal(result.state.written,null);
  assert.equal(result.nodes.get('retry').hidden,false);
  assert.match(result.nodes.get('error').textContent,/verification failed/);
});
