import { spawn } from "node:child_process";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createAuthHost } from "./auth-host.mjs";
import { promoteCheckoutStage } from "./checkout-promotion.mjs";
import { createGitHubAccount } from "./github-account.mjs";

const API = "/api/workbench";
const MAX_TEXT = 1024 * 1024;
const MAX_LOG = 128 * 1024;
const OUTPUTS = new Set(["dist", "build", "out"]);
const PRIVATE = new Set([".git", ".workbench", "node_modules", ".ssh", ".npmrc", ".netrc"]);
const PROTECTED_BRANCHES = ["main", "test", "dev"];
const LOCAL_ENV = { GIT_NO_LAZY_FETCH: "1", GIT_LFS_SKIP_SMUDGE: "1" };
const DEFAULTS = [
  { url: "https://github.com/cehinds/AshenSpire", branch: "dev" },
  { url: "git@github.com:cehinds/AshenSpire-Combat-Workshop.git", branch: "" },
];

class HostError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function fail(status, message) {
  throw new HostError(status, message);
}

export function redact(value) {
  return String(value)
    .replace(/\b(?:https?|ssh):\/\/[^\s/@]+(?::[^\s/@]*)?@/gi, "https://[redacted]@")
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)\b/g, "[redacted]")
    .replace(/((?:token|password|secret|authorization|api[_-]?key)\s*[:=]\s*)(?:Bearer\s+)?[^\s,;]+/gi, "$1[redacted]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+/gi, "Bearer [redacted]");
}

export function parseRepository(value, branch = "") {
  if (typeof value !== "string" || value.length > 200) fail(400, "Use GitHub owner/repo, HTTPS URL, or git@github.com:owner/repo.git.");
  const match = value.trim().match(/^(?:https:\/\/github\.com\/|git@github\.com:)?([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9_][A-Za-z0-9_.-]{0,99}?)(?:\.git)?\/?$/);
  if (!match || match[2] === "." || match[2] === "..") fail(400, "Only GitHub repository URLs without credentials, query strings, or extra paths are supported.");
  validateBranch(branch);
  const [, owner, name] = match;
  const id = `${owner}--${name}`.toLowerCase();
  const gitUrl = value.trim().startsWith("git@github.com:") ? `git@github.com:${owner}/${name}.git` : `https://github.com/${owner}/${name}.git`;
  return { id, kind: "github", name: `${owner}/${name}`, url: `https://github.com/${owner}/${name}`, gitUrl, branch, status: "not-connected", checkoutScope: id === "cehinds--ashenspire" ? "game-source" : "repository" };
}

function localDescriptor(value, branch, root) {
  if (typeof value !== "string" || value.length > 4096 || /[\x00-\x1f]/.test(value) || !path.isAbsolute(value) || value.startsWith("\\\\") || value.startsWith("//")) fail(400, "Choose absolute local Git working-directory path; network shares are not supported.");
  validateBranch(branch);
  const source = path.resolve(value);
  const relative = path.relative(source, path.join(path.resolve(root), ".workbench"));
  if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)) || source.split(path.sep).some(part => PRIVATE.has(part.toLowerCase()))) fail(403, "Import separate local game repository outside editor runtime directories and their parents.");
  const name = path.basename(source);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "repository";
  const key = process.platform === "win32" ? source.toLowerCase() : source;
  return { id: `local-${slug}-${createHash("sha256").update(key).digest("hex").slice(0, 16)}`, kind: "local", name, path: source, url: source, gitUrl: source, branch, status: "not-connected", checkoutScope: "repository" };
}

export async function parseLocalRepository(value, branch = "", root = process.cwd()) {
  const descriptor = localDescriptor(value, branch, root);
  const anchor = path.parse(descriptor.path).root;
  await noSymlink(anchor, path.relative(anchor, descriptor.path).split(path.sep).join("/"));
  if (!(await lstat(descriptor.path)).isDirectory()) fail(400, "Local repository source must be directory.");
  if (!await exists(path.join(descriptor.path, ".git"))) fail(400, "Select Git working-directory root containing .git directory. Bare repositories are not supported.");
  const dotgit = await noSymlink(descriptor.path, ".git");
  if (!(await lstat(dotgit)).isDirectory()) fail(400, "Linked worktrees and bare repositories are not supported; use ordinary Git working directory.");
  const result = await spawnCommand("git", ["-c", "protocol.allow=never", "rev-parse", "--is-inside-work-tree"], { cwd: descriptor.path, timeout: 10_000, env: LOCAL_ENV }).done;
  if (result.exitCode !== 0 || result.stdout.trim() !== "true") fail(400, "Local source is not valid Git working directory.");
  return localDescriptor(await realpath(descriptor.path), branch, root);
}

function validateBranch(branch) {
  if (branch === "") return;
  if (typeof branch !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,149}$/.test(branch) || branch.includes("..") || branch.includes("//") || branch.endsWith("/") || branch.endsWith(".") || branch.split("/").some(part => part.startsWith(".") || part.endsWith(".lock"))) {
    fail(400, "Branch must be valid Git branch name, such as main, dev, or feature/cards.");
  }
}

function safePath(value = "", allowEmpty = true) {
  if (typeof value !== "string" || value.length > 1000 || /[\x00-\x1f\\]/.test(value) || value.startsWith("/") || /^[A-Za-z]:/.test(value)) fail(400, "Use relative repository path.");
  const parts = value.split("/");
  if (value === "" && allowEmpty) return "";
  if (parts.some(part => !part || part === "." || part === ".." || PRIVATE.has(part.toLowerCase()) || /^\.env(?:\.|$)/i.test(part))) fail(403, "Private runtime paths and traversal are blocked.");
  return parts.join("/");
}

function visible(name) {
  return !PRIVATE.has(name.toLowerCase()) && !/^\.env(?:\.|$)/i.test(name) && !/[\x00-\x1f\\]/.test(name);
}

async function exists(filename) {
  try { await lstat(filename); return true; } catch (error) { if (error.code === "ENOENT") return false; throw error; }
}

async function noSymlink(root, relative = "") {
  const paths = [root];
  for (const part of relative.split("/").filter(Boolean)) paths.push(path.join(paths.at(-1), part));
  for (const filename of paths) {
    const stat = await lstat(filename).catch(error => { if (error.code === "ENOENT") fail(404, "Path not found."); throw error; });
    if (stat.isSymbolicLink()) fail(403, "Symbolic links are blocked.");
  }
  return paths.at(-1);
}

async function readText(filename) {
  const handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) fail(400, "Select regular file.");
    if (stat.size > MAX_TEXT) fail(413, "File exceeds 1 MiB text limit.");
    const data = await handle.readFile();
    if (data.includes(0)) fail(415, "Binary files cannot be edited as text.");
    const content = data.toString("utf8");
    if (!Buffer.from(content).equals(data)) fail(415, "File must use UTF-8 text encoding.");
    return { content, revision: createHash("sha256").update(data).digest("hex"), size: data.length };
  } finally { await handle.close(); }
}

export function planCommand(command, args, platform = process.platform) {
  if (platform === "win32" && ["npm", "pnpm", "yarn"].includes(command)) {
    if (!Array.isArray(args) || args.some(value => typeof value !== "string" || !/^(?:--[a-z][a-z-]*|[A-Za-z0-9][A-Za-z0-9:_-]{0,99})$/.test(value))) fail(400, "Package manager accepts validated literal arguments only.");
    return { command: "cmd.exe", args: ["/d", "/s", "/c", `"${command}.cmd ${args.join(" ")}"`], windowsVerbatimArguments: true };
  }
  return { command: platform === "win32" && command === "bun" ? "bun.exe" : command, args: [...args] };
}

function spawnCommand(command, args, { cwd, timeout = 120_000, onData, env = {} } = {}) {
  const planned = planCommand(command, args);
  const child = spawn(planned.command, planned.args, { cwd, shell: false, windowsVerbatimArguments: planned.windowsVerbatimArguments, windowsHide: true, detached: process.platform !== "win32", env: { ...process.env, ...(!process.env.GIT_SSH_COMMAND && !process.env.GIT_SSH ? { GIT_SSH_COMMAND: "ssh -o BatchMode=yes -o StrictHostKeyChecking=yes" } : {}), GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "Never", CI: "true", ...env }, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  let stdout = "";
  let timedOut = false;
  let killTimer;
  const terminate = () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    if (process.platform === "win32") {
      if (!Number.isInteger(child.pid) || child.pid <= 0) return;
      const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { shell: false, windowsHide: true, stdio: "ignore" });
      killer.on("error", () => { try { child.kill("SIGKILL"); } catch {} });
      killer.unref();
      return;
    }
    try { process.kill(-child.pid, "SIGTERM"); } catch {}
    killTimer = setTimeout(() => {
      try { process.platform === "win32" ? child.kill("SIGKILL") : process.kill(-child.pid, "SIGKILL"); } catch {}
    }, 1500);
    killTimer.unref();
  };
  const timer = setTimeout(() => { timedOut = true; terminate(); }, timeout);
  timer.unref();
  const collect = chunk => {
    const clean = redact(chunk.toString());
    output = (output + clean).slice(-MAX_LOG);
    onData?.(clean);
  };
  child.stdout.on("data", chunk => { stdout = (stdout + chunk.toString()).slice(-MAX_LOG); collect(chunk); });
  child.stderr.on("data", collect);
  const done = new Promise(resolve => {
    let complete = false;
    const finish = (exitCode, error) => {
      if (complete) return;
      complete = true;
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      resolve({ exitCode, stdout: redact(stdout), output: redact(output), timedOut, error: error ? redact(error.message) : undefined });
    };
    child.on("error", error => finish(null, error));
    child.on("close", code => finish(code));
  });
  return { child, done, terminate };
}

async function command(commandName, args, cwd, timeout) {
  const result = await spawnCommand(commandName, args, { cwd, timeout }).done;
  if (result.error || result.exitCode !== 0 || result.timedOut) fail(502, result.timedOut ? "Command timed out. Check GitHub reachability and local tools." : `${result.error || result.output.trim() || "Command failed."}\nCheck existing Git authentication, repository access, network, and configured branch.`);
  return result.stdout;
}

async function jsonBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_TEXT + 16_384) fail(413, "Request exceeds text limit.");
  }
  try { const value = body ? JSON.parse(body) : {}; if (!value || typeof value !== "object" || Array.isArray(value)) fail(400, "JSON object required."); return value; } catch (error) { if (error instanceof HostError) throw error; fail(400, "Invalid JSON body."); }
}

function reply(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(data));
}

export function createWorkspaceHost({ root = process.cwd(), defaults = DEFAULTS, cloneSource, commandTimeout = 120_000, jobTimeout = 15 * 60_000, authOptions = {}, githubOptions = {} } = {}) {
  root = path.resolve(root);
  const auth = createAuthHost({ ...authOptions, root });
  const github = createGitHubAccount(githubOptions);
  const storage = path.join(root, ".workbench");
  const reposRoot = path.join(storage, "repos");
  const registry = path.join(storage, "registry.json");
  const csrfToken = randomBytes(32).toString("hex");
  const repos = new Map();
  const jobs = new Map();
  const active = new Map();
  const connecting = new Set();
  const starting = new Set();
  const saving = new Set();
  const branching = new Set();
  const savingRepo = id => [...saving].some(key => key.startsWith(`${id}/`));
  let writes = Promise.resolve();

  const persist = () => {
    writes = writes.catch(() => {}).then(async () => {
      await noSymlink(root, ".workbench");
      const tmp = `${registry}.${randomBytes(8).toString("hex")}.tmp`;
      await writeFile(tmp, JSON.stringify({ version: 1, repos: [...repos.values()] }, null, 2), { flag: "wx", mode: 0o600 });
      await rename(tmp, registry);
    });
    return writes;
  };

  const ready = (async () => {
    await auth.ready;
    if (await exists(storage)) await noSymlink(root, ".workbench");
    else await mkdir(storage, { mode: 0o700 });
    if (await exists(reposRoot)) await noSymlink(root, ".workbench/repos");
    else await mkdir(reposRoot, { mode: 0o700 });
    await mkdir(path.join(storage, "disabled-hooks"), { recursive: true, mode: 0o700 });
    await noSymlink(root, ".workbench/disabled-hooks");
    if (await exists(registry)) {
      await noSymlink(root, ".workbench/registry.json");
      const value = JSON.parse(await readFile(registry, "utf8"));
      if (value.version !== 1 || !Array.isArray(value.repos)) fail(500, "Invalid workspace registry; preserve registry and repair before continuing.");
      for (const item of value.repos) {
        const oldDefault = !item.gitUrl && defaults.find(value => parseRepository(value.url, value.branch).id === item.id);
        const repo = item.kind === "local" ? localDescriptor(item.path, item.branch || "", root) : parseRepository(item.gitUrl || oldDefault?.url || item.url, item.branch);
        repos.set(repo.id, { ...repo, status: item.status === "connecting" ? "not-connected" : item.status || "not-connected", ...(item.head ? { head: item.head } : {}), ...(item.error ? { error: redact(item.error) } : {}), ...(/^[a-f0-9]{24}$/.test(item.buildGeneration || "") ? { buildGeneration: item.buildGeneration, lastBuildStatus: item.lastBuildStatus === "running" ? "failed" : item.lastBuildStatus } : {}) });
      }
    }
    for (const item of defaults) {
      const repo = parseRepository(item.url, item.branch);
      if (!repos.has(repo.id)) repos.set(repo.id, repo);
    }
    for (const repo of repos.values()) {
      if (await exists(path.join(reposRoot, repo.id))) {
        try {
          const dirname = await checkout(repo);
          repo.head = (await command("git", ["rev-parse", "HEAD"], dirname, commandTimeout)).trim();
          repo.branch = (await command("git", ["branch", "--show-current"], dirname, commandTimeout)).trim();
          repo.status = "connected";
          delete repo.error;
        } catch (error) { repo.status = "error"; repo.error = redact(error.message); }
      } else repo.status = "not-connected";
    }
    await persist();
  })();

  function find(id) {
    if (!/^[a-z0-9][a-z0-9_.-]{0,145}$/.test(id)) fail(400, "Invalid repository ID.");
    const repo = repos.get(id);
    if (!repo) fail(404, "Repository not registered.");
    return repo;
  }

  async function checkout(repo) {
    const dirname = await noSymlink(root, `.workbench/repos/${repo.id}`);
    if (!(await lstat(dirname)).isDirectory()) fail(403, "Managed checkout must be directory.");
    await noSymlink(dirname, ".git");
    return dirname;
  }

  async function gitInfo(repo) {
    const dirname = await checkout(repo);
    const head = (await command("git", ["rev-parse", "HEAD"], dirname, commandTimeout)).trim();
    const branch = (await command("git", ["branch", "--show-current"], dirname, commandTimeout)).trim();
    const status = await command("git", ["status", "--porcelain=v1", "-z", "--untracked-files=normal"], dirname, commandTimeout);
    const parts = status.split("\0").filter(Boolean);
    const changes = [];
    for (let i = 0; i < parts.length; i++) {
      const item = parts[i];
      const change = { path: item.slice(3), status: item.slice(0, 2) };
      if (/R|C/.test(change.status)) i++;
      if (change.path.split("/").every(visible)) changes.push(change);
    }
    const build = await buildInfo(dirname, repo);
    return { head, branch, changes, ...build };
  }

  async function localGit(args, dirname, errorStatus = 409) {
    const result = await spawnCommand("git", ["-c", "protocol.allow=never", "-c", "protocol.file.allow=always", "-c", `core.hooksPath=${path.join(storage, "disabled-hooks")}`, ...args], { cwd: dirname, timeout: commandTimeout, env: LOCAL_ENV }).done;
    if (result.exitCode !== 0 || result.error || result.timedOut) fail(errorStatus, result.timedOut ? "Local Git operation timed out." : `${result.error || result.output.trim() || "Local Git operation failed."}\nResolve local Git condition and retry. No remote operation performed.`);
    return result.stdout;
  }

  const repoBusy = id => active.has(id) || connecting.has(id) || starting.has(id) || branching.has(id) || savingRepo(id);

  async function branchesInfo(repo, dirname = null) {
    dirname ||= await checkout(repo);
    const current = (await localGit(["branch", "--show-current"], dirname, 502)).trim();
    const raw = await localGit(["for-each-ref", "--format=%(refname:strip=2)%00%(objectname)", "refs/heads/"], dirname, 502);
    const branches = raw.split("\n").filter(Boolean).map(line => {
      const [name, head] = line.split("\0");
      return { name, head, current: name === current, protected: PROTECTED_BRANCHES.includes(name.toLowerCase()) };
    });
    const dirty = Boolean((await localGit(["status", "--porcelain=v1", "-z", "--untracked-files=normal"], dirname, 502)).length);
    return { current, branches, dirty, busy: repoBusy(repo.id), protectedBranches: PROTECTED_BRANCHES, restrictions: ["Switch requires clean checkout and no active build, test, save, or import.", "Current branch and main/test/dev cannot be deleted.", "Deletion uses git branch -d; unmerged work is preserved.", "Local operations only; no fetch, pull, push, or force deletion."] };
  }

  async function branchMutation(repo, action, data) {
    if (repoBusy(repo.id)) fail(409, "Finish active repository operation before changing branches.");
    branching.add(repo.id);
    try {
      const dirname = await checkout(repo);
      const name = data.name;
      if (!name) fail(400, "Branch name required.");
      validateBranch(name);
      await localGit(["check-ref-format", "--branch", name], dirname, 400);
      const info = await branchesInfo(repo, dirname);
      if (action === "create") {
        if (info.branches.some(branch => branch.name === name)) fail(409, "Local branch already exists.");
        if (data.switch !== undefined && typeof data.switch !== "boolean") fail(400, "Switch must be boolean.");
        if (data.from !== undefined && (!data.from || typeof data.from !== "string" || !info.branches.some(branch => branch.name === data.from))) fail(400, "Choose existing local source branch.");
        if (data.switch) {
          if (info.dirty) fail(409, "Checkout has local changes. Commit or resolve them before switching; no automatic discard or stash.");
          await localGit(["switch", "--no-guess", "--no-track", "-c", name, ...(data.from ? [data.from] : [])], dirname);
        } else await localGit(["branch", "--no-track", "--", name, ...(data.from ? [data.from] : ["HEAD"])], dirname);
      } else if (action === "switch") {
        if (!info.branches.some(branch => branch.name === name)) fail(404, "Local branch not found.");
        if (info.dirty) fail(409, "Checkout has local changes. Commit or resolve them before switching; no automatic discard or stash.");
        await localGit(["switch", "--no-guess", "--", name], dirname);
      } else {
        if (PROTECTED_BRANCHES.includes(name.toLowerCase())) fail(403, "main, test, and dev branches are protected from deletion.");
        if (name === info.current) fail(409, "Current branch cannot be deleted.");
        if (!info.branches.some(branch => branch.name === name)) fail(404, "Local branch not found.");
        await localGit(["merge-base", "--is-ancestor", `refs/heads/${name}`, "HEAD"], dirname);
        await localGit(["branch", "-d", "--", name], dirname);
      }
      repo.branch = (await localGit(["branch", "--show-current"], dirname)).trim();
      repo.head = (await localGit(["rev-parse", "HEAD"], dirname)).trim();
      if (action === "switch" || data.switch) {
        repo.lastBuildStatus = "branch-changed";
        for (const previous of jobs.values()) if (previous.repoId === repo.id && previous.artifacts) { delete previous.artifacts; previous.artifactsStale = true; }
      }
      await persist();
      const result = await branchesInfo(repo, dirname);
      return { ...result, busy: false, repo };
    } finally { branching.delete(repo.id); }
  }

  async function buildInfo(dirname, repo) {
    if ((repo?.id === "cehinds--ashenspire" || repo?.kind === "local") && await exists(path.join(dirname, "tools/launch.mjs")) && await exists(path.join(dirname, "tools/bundle.mjs")) && await exists(path.join(dirname, "index.html")) && (repo.id === "cehinds--ashenspire" || (await readText(await noSymlink(dirname, "tools/bundle.mjs"))).content.includes("AshenSpire.html"))) {
      for (const filename of ["tools/launch.mjs", "tools/bundle.mjs", "index.html"]) await noSymlink(dirname, filename);
      const scripts = ["build"];
      for (const [filename, script] of [["tests/run-node.mjs", "test"], ["tools/config-build.mjs", "test:config"], ["tools/content-build.mjs", "test:content"]]) {
        if (await exists(path.join(dirname, filename))) { await noSymlink(dirname, filename); scripts.push(script); }
      }
      let canPromoteSettings = false;
      if (repo.kind === "local" && await exists(path.join(dirname, "tools/settings-defaults.mjs")) && await exists(path.join(dirname, "src/content/settingsDefaults.js"))) {
        const tool = await noSymlink(dirname, "tools/settings-defaults.mjs");
        const target = await noSymlink(dirname, "src/content/settingsDefaults.js");
        canPromoteSettings = (await lstat(tool)).isFile() && (await lstat(target)).isFile();
      }
      return { scripts, packageManager: "node", adapter: "ashenspire-node", canBuild: true, canInstall: false, canPromoteSettings };
    }
    let pkg = {};
    if (await exists(path.join(dirname, "package.json"))) {
      const filename = await noSymlink(dirname, "package.json");
      try { pkg = JSON.parse((await readText(filename)).content); } catch (error) { if (error instanceof HostError) throw error; fail(422, "package.json contains invalid JSON."); }
    }
    let packageManager = null;
    for (const [lock, manager] of [["pnpm-lock.yaml", "pnpm"], ["yarn.lock", "yarn"], ["bun.lock", "bun"], ["bun.lockb", "bun"], ["package-lock.json", "npm"], ["npm-shrinkwrap.json", "npm"]]) {
      if (await exists(path.join(dirname, lock))) { await noSymlink(dirname, lock); packageManager = manager; break; }
    }
    const scripts = Object.entries(pkg.scripts || {}).filter(([name, value]) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9:_-]{0,99}$/.test(name)).map(([name]) => name);
    return { scripts, packageManager, canBuild: Boolean(packageManager && scripts.some(name => name === "build" || name.startsWith("build:"))), ...(packageManager ? {} : { buildReason: "Recognized lockfile required: package-lock.json, npm-shrinkwrap.json, pnpm-lock.yaml, yarn.lock, or bun.lock." }) };
  }

  async function artifacts(repo, relative = "") {
    const dirname = await checkout(repo);
    relative = safePath(relative);
    if (relative && !OUTPUTS.has(relative.split("/")[0])) fail(403, "Artifacts must remain under dist, build, or out.");
    const list = [];
    let scanned = 0;
    async function walk(rel, depth = 0) {
      if (depth > 12 || list.length >= 100 || scanned++ >= 10_000) return;
      const filename = await noSymlink(dirname, rel);
      const stat = await lstat(filename);
      if (stat.isFile()) {
        if (relative === rel || /\.(?:html|zip|tgz|tar\.gz|apk|aab|exe)$/i.test(rel)) list.push({ path: rel, size: stat.size, url: `${API}/preview/${repo.id}/${rel.split("/").map(encodeURIComponent).join("/")}?job=${repo.buildGeneration}` });
      } else if (stat.isDirectory()) {
        for (const entry of await readdir(filename, { withFileTypes: true })) if (visible(entry.name) && !entry.isSymbolicLink()) await walk(`${rel}/${entry.name}`, depth + 1);
      }
    }
    if (relative) await walk(relative);
    else for (const output of OUTPUTS) if (await exists(path.join(dirname, output))) {
      try { await walk(output); } catch (error) { if (error.status !== 403) throw error; }
    }
    return list;
  }

  async function startJob(repo, body) {
    if (repoBusy(repo.id)) fail(409, "Repository already has active operation.");
    if (!["build", "test", "install", "settings"].includes(body.task)) fail(400, "Task must be build, test, install, or settings.");
    starting.add(repo.id);
    let profileFile = null;
    let launched = false;
    try {
    const dirname = await checkout(repo);
    const info = await buildInfo(dirname, repo);
    if (!info.packageManager) fail(422, info.buildReason);
    const manager = info.packageManager;
    let executable = manager;
    let args;
    if (body.task === "settings") {
      if (!info.canPromoteSettings || info.adapter !== "ashenspire-node" || repo.kind !== "local") fail(422, "Settings promotion requires imported local AshenSpire checkout with native settings-defaults tool.");
      if (body.script !== undefined) fail(400, "Settings promotion does not accept command or script override.");
      const profile = body.profile;
      if (!profile || typeof profile !== "object" || Array.isArray(profile) || profile.game !== "Ashen Spire" || profile.schemaVersion !== 1 || !profile.overrides || typeof profile.overrides !== "object" || Array.isArray(profile.overrides)) fail(400, "Provide native Ashen Spire schemaVersion1 profile with overrides object. Engine tool validates individual values.");
      const content = JSON.stringify(profile);
      if (Buffer.byteLength(content) > MAX_TEXT) fail(413, "Settings profile exceeds 1 MiB.");
      await mkdir(path.join(storage, "profiles"), { recursive: true, mode: 0o700 });
      await noSymlink(root, ".workbench/profiles");
      profileFile = path.join(storage, "profiles", `${randomBytes(16).toString("hex")}.json`);
      await writeFile(profileFile, content, { flag: "wx", mode: 0o600 });
      executable = globalThis.process.execPath;
      args = ["tools/settings-defaults.mjs", profileFile];
    } else if (manager === "node") {
      if (body.task === "install") fail(422, "AshenSpire uses Node core tools; dependency install not required.");
      const script = body.script || body.task;
      const commands = { build: ["tools/launch.mjs", "--build-only"], test: ["tests/run-node.mjs", "--no-selftests"], "test:config": ["tools/config-build.mjs", "--check"], "test:content": ["tools/content-build.mjs", "--check"] };
      if (!info.scripts.includes(script) || !(script === body.task || script.startsWith(`${body.task}:`))) fail(422, `Choose supported ${body.task} script.`);
      args = commands[script];
      executable = globalThis.process.execPath;
    } else if (body.task === "install") {
      if (body.script) fail(400, "Install does not accept script override.");
      args = manager === "npm" ? ["ci"] : ["install", manager === "yarn" ? "--frozen-lockfile" : "--frozen-lockfile"];
    } else {
      const script = body.script || body.task;
      if (typeof script !== "string" || !(script === body.task || script.startsWith(`${body.task}:`)) || !info.scripts.includes(script)) fail(422, `Choose declared ${body.task} script from package.json.`);
      args = ["run", script];
    }
    const job = { id: randomBytes(12).toString("hex"), repoId: repo.id, task: body.task, ...(body.script ? { script: body.script } : {}), status: "running", startedAt: new Date().toISOString(), log: `${manager} ${args.join(" ")}\n` };
    if (body.task === "build") {
      for (const previous of jobs.values()) if (previous.repoId === repo.id && previous.artifacts) { delete previous.artifacts; previous.artifactsStale = true; }
      repo.buildGeneration = job.id; repo.lastBuildStatus = "running";
      await persist();
    }
    if (body.task === "settings") {
      for (const previous of jobs.values()) if (previous.repoId === repo.id && previous.artifacts) { delete previous.artifacts; previous.artifactsStale = true; }
      repo.lastBuildStatus = "settings-in-progress";
      await persist();
    }
    let cancelled = false;
    const process = spawnCommand(executable, args, { cwd: dirname, timeout: jobTimeout, env: repo.kind === "local" ? LOCAL_ENV : {}, onData: value => { job.log = redact((job.log + value).slice(-MAX_LOG)); } });
    launched = true;
    jobs.set(job.id, job);
    active.set(repo.id, { job, cancel: () => { cancelled = true; process.terminate(); } });
    process.done.then(async result => {
      const finalStatus = cancelled ? "cancelled" : result.exitCode === 0 && !result.timedOut && !result.error ? "succeeded" : "failed";
      job.finishedAt = new Date().toISOString();
      job.exitCode = result.exitCode;
      if (result.error) job.log += `\n${result.error}`;
      if (result.timedOut) job.log += "\nJob exceeded time limit and was terminated.";
      job.log = redact(job.log).slice(-MAX_LOG);
      if (body.task === "build" && finalStatus === "succeeded") {
        repo.lastBuildStatus = "succeeded";
        try { job.artifacts = await artifacts(repo); } catch (error) { job.log += `\nArtifact scan: ${redact(error.message)}`; }
      }
      if (body.task === "build") { repo.lastBuildStatus = finalStatus; await persist().catch(error => { job.log += `\nRegistry save failed: ${redact(error.message)}`; }); }
      if (body.task === "settings") { repo.lastBuildStatus = finalStatus === "succeeded" ? "settings-changed" : "settings-failed"; await persist().catch(error => { job.log += `\nRegistry save failed: ${redact(error.message)}`; }); }
      if (profileFile) await rm(profileFile, { force: true }).catch(() => { job.log += "\nTemporary profile cleanup failed; remove private runtime profile locally."; });
      active.delete(repo.id);
      job.status = finalStatus;
    });
    return job;
    } finally { if (!launched && profileFile) await rm(profileFile, { force: true }); starting.delete(repo.id); }
  }

  async function route(req, res) {
    let hostname;
    try { hostname = new URL(`http://${req.headers.host}`).hostname; } catch { fail(403, "Invalid local host."); }
    if (!["localhost", "127.0.0.1", "[::1]", "terminal.local"].includes(hostname)) fail(403, "Workspace API requires localhost or managed terminal.local host.");
    await ready;
    const url = new URL(req.url, "http://local.invalid");
    const method = req.method || "GET";
    if (!["GET", "HEAD"].includes(method)) {
      let origin;
      try { origin = new URL(req.headers.origin); } catch { fail(403, "Same-origin Origin header required."); }
      if (!["http:", "https:"].includes(origin.protocol) || origin.host !== req.headers.host) fail(403, "Cross-origin writes blocked.");
      const supplied = req.headers["x-workbench-csrf"];
      if (typeof supplied !== "string" || !/^[a-f0-9]{64}$/.test(supplied) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(csrfToken))) fail(403, "Refresh host status and supply X-Workbench-CSRF token.");
      if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"] || "")) fail(415, "Mutations require application/json.");
    }
    const parts = url.pathname.slice(API.length).split("/").filter(Boolean).map(part => { try { return decodeURIComponent(part); } catch { fail(400, "Invalid URL encoding."); } });
    if (parts[0] === "github" && parts.length === 2) {
      if (parts[1] === "status" && method === "GET") return reply(res, 200, await github.status());
      if (parts[1] === "login" && method === "POST") {
        const body = await jsonBody(req);
        if (Object.keys(body).length) fail(400, "GitHub sign-in does not accept credentials or options.");
        return reply(res, 200, await github.startLogin());
      }
    }
    if (parts[0] === "status" && parts.length === 1 && method === "GET") return reply(res, 200, { connected: true, host: "local", csrfToken, capabilities: ["repositories", "files", "builds", "branches", "local-import"] });
    if (parts[0] === "repos" && parts.length === 1) {
      if (method === "GET") return reply(res, 200, { repos: [...repos.values()] });
      if (method === "POST") {
        const body = await jsonBody(req);
        const repo = body.path !== undefined ? await parseLocalRepository(body.path, body.branch ?? "", root) : parseRepository(body.url, body.branch ?? "");
        if (repos.has(repo.id)) fail(409, "Repository already registered.");
        repos.set(repo.id, repo); await persist();
        return reply(res, 201, { repo });
      }
    }
    if (parts[0] === "repos" && parts[1]) {
      const repo = find(parts[1]);
      const target = path.join(reposRoot, repo.id);
      if (parts.length === 2 && method === "PATCH") {
        if (repoBusy(repo.id) || await exists(target)) fail(409, "Source branch can only change before cloning. Use local branch controls for existing checkout.");
        const body = await jsonBody(req); validateBranch(body.branch); repo.branch = body.branch; await persist(); return reply(res, 200, { repo });
      }
      if (parts[2] === "connect" && parts.length === 3 && method === "POST") {
        await jsonBody(req);
        if (repoBusy(repo.id)) fail(409, "Repository already has active operation.");
        connecting.add(repo.id); repo.status = "connecting"; delete repo.error;
        const existing = await exists(target);
        try {
          await noSymlink(root, ".workbench/repos");
          if (await exists(target)) {
            const dirname = await checkout(repo);
            if (repo.kind === "local") {
              repo.head = (await localGit(["rev-parse", "HEAD"], dirname)).trim();
              repo.branch = (await localGit(["branch", "--show-current"], dirname)).trim();
              repo.status = "connected"; delete repo.error; await persist();
              return reply(res, 200, { repo, remoteUpdated: false, localUpdated: true });
            }
            try {
              await command("git", ["fetch", "--no-tags", "--", cloneSource ? cloneSource(repo) : repo.gitUrl, ...(repo.branch ? [repo.branch] : [])], dirname, commandTimeout);
            } catch (error) {
              repo.head = (await command("git", ["rev-parse", "HEAD"], dirname, commandTimeout)).trim();
              repo.status = "connected"; repo.remoteError = redact(error.message); await persist();
              return reply(res, 200, { repo, remoteUpdated: false, warning: `Local checkout remains usable. Remote fetch failed: ${repo.remoteError}` });
            }
          } else {
            const stage = path.join(reposRoot, `${repo.id}.clone-${randomBytes(8).toString("hex")}`);
            try {
              const sparse = repo.checkoutScope === "game-source";
              if (repo.kind === "local") {
                const source = await parseLocalRepository(repo.path, repo.branch, root);
                const heads = (await localGit(["for-each-ref", "--format=%(refname:strip=2)%00%(objectname)", "refs/heads/"], source.path, 502)).split("\n").filter(Boolean).map(line => line.split("\0"));
                await localGit(["clone", "--no-local", "--no-hardlinks", ...(repo.branch ? ["--branch", repo.branch] : []), "--", source.path, stage], reposRoot, 502);
                const imported = new Set((await localGit(["for-each-ref", "--format=%(refname:strip=2)", "refs/heads/"], stage, 502)).trim().split("\n"));
                for (const [name, head] of heads) {
                  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(head || "")) fail(502, "Source branch listing exceeded safe bounds or changed during import. Retry locally.");
                  if (!imported.has(name)) await localGit(["branch", "--no-track", "--", name, head], stage, 502);
                }
              } else await command("git", ["clone", "--depth", "1", "--filter=blob:none", "--single-branch", ...(sparse ? ["--no-checkout"] : []), ...(repo.branch ? ["--branch", repo.branch] : []), "--", cloneSource ? cloneSource(repo) : repo.gitUrl, stage], reposRoot, commandTimeout);
              if (sparse) {
                await command("git", ["sparse-checkout", "init", "--cone"], stage, commandTimeout);
                await command("git", ["sparse-checkout", "set", ".github", "asset-data", "assets", "assets-mobile", "content", "editor", "map-detail", "music", "pose-studio", "src", "styles", "tests", "tools", "ui-studio"], stage, commandTimeout);
                const branch = repo.branch || (await command("git", ["branch", "--show-current"], stage, commandTimeout)).trim();
                await command("git", ["checkout", branch], stage, commandTimeout);
              }
              await promoteCheckoutStage(stage, target, {reposRoot, validateParent: () => noSymlink(root, ".workbench/repos")});
            } finally { await rm(stage, { recursive: true, force: true }); }
          }
          repo.head = (await command("git", ["rev-parse", "HEAD"], await checkout(repo), commandTimeout)).trim();
          repo.branch = (await command("git", ["branch", "--show-current"], await checkout(repo), commandTimeout)).trim();
          repo.status = "connected";
          delete repo.remoteError;
        } catch (error) { repo.status = "error"; repo.error = redact(error.message); await persist(); throw error; }
        finally { connecting.delete(repo.id); }
        await persist(); return reply(res, 200, { repo, remoteUpdated: existing });
      }
      if (parts[2] === "branches") {
        if (parts.length === 3 && method === "GET") return reply(res, 200, await branchesInfo(repo));
        if (parts.length === 3 && method === "POST") return reply(res, 201, await branchMutation(repo, "create", await jsonBody(req)));
        if (parts.length === 3 && method === "DELETE") return reply(res, 200, await branchMutation(repo, "delete", await jsonBody(req)));
        if (parts.length === 4 && parts[3] === "switch" && method === "POST") return reply(res, 200, await branchMutation(repo, "switch", await jsonBody(req)));
      }
      if (parts[2] === "git" && parts.length === 3 && method === "GET") return reply(res, 200, await gitInfo(repo));
      if (parts[2] === "tree" && parts.length === 3 && method === "GET") {
        const relative = safePath(url.searchParams.get("path") || "");
        const filename = await noSymlink(await checkout(repo), relative);
        if (!(await lstat(filename)).isDirectory()) fail(400, "Tree path must be directory.");
        const entries = (await readdir(filename, { withFileTypes: true })).filter(entry => visible(entry.name) && (entry.isFile() || entry.isDirectory())).map(entry => ({ name: entry.name, path: relative ? `${relative}/${entry.name}` : entry.name, type: entry.isDirectory() ? "directory" : "file" })).sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "directory" ? -1 : 1));
        return reply(res, 200, { path: relative, entries });
      }
      if (parts[2] === "file" && parts.length === 3) {
        const dirname = await checkout(repo);
        if (method === "GET") {
          const relative = safePath(url.searchParams.get("path") || "", false);
          return reply(res, 200, { path: relative, ...await readText(await noSymlink(dirname, relative)) });
        }
        if (method === "PUT") {
          const body = await jsonBody(req);
          if (active.has(repo.id) || connecting.has(repo.id) || starting.has(repo.id) || branching.has(repo.id)) fail(409, "Finish active repository operation before editing files.");
          const relative = safePath(body.path, false);
          if (typeof body.content !== "string" || body.content.includes("\0") || Buffer.byteLength(body.content) > MAX_TEXT) fail(413, "Content must be UTF-8 text, at most 1 MiB.");
          if (saving.has(`${repo.id}/${relative}`)) fail(409, "File save in progress.");
          saving.add(`${repo.id}/${relative}`);
          try {
            const filename = await noSymlink(dirname, relative);
            const before = await readText(filename);
            if (body.revision !== before.revision) fail(409, "File changed since read. Reload and merge before saving.");
            const handle = await open(filename, constants.O_RDWR | constants.O_NOFOLLOW);
            try {
              const current = await handle.readFile();
              if (createHash("sha256").update(current).digest("hex") !== body.revision) fail(409, "File changed during save. Reload before saving.");
              const data = Buffer.from(body.content); await handle.write(data, 0, data.length, 0); await handle.truncate(data.length); await handle.sync();
            } finally { await handle.close(); }
            if (OUTPUTS.has(relative.split("/")[0])) {
              repo.lastBuildStatus = "modified";
              for (const previous of jobs.values()) if (previous.repoId === repo.id && previous.artifacts) { delete previous.artifacts; previous.artifactsStale = true; }
              await persist();
            }
            return reply(res, 200, { path: relative, ...await readText(filename) });
          } finally { saving.delete(`${repo.id}/${relative}`); }
        }
      }
      if (parts[2] === "jobs" && parts.length === 3 && method === "POST") return reply(res, 202, { job: await startJob(repo, await jsonBody(req)) });
      if (parts[2] === "artifacts" && parts.length === 3 && method === "GET") {
        const relative = safePath(url.searchParams.get("path") || "");
        if (relative && !OUTPUTS.has(relative.split("/")[0])) fail(403, "Artifacts must remain under dist, build, or out.");
        const outputs = repo.lastBuildStatus === "succeeded" ? await artifacts(repo, relative) : [];
        return reply(res, 200, { path: relative, artifacts: outputs.map(output => ({ ...output, url: auth.artifactUrl(output.url, req, repo.id, repo.buildGeneration) })), ...(repo.lastBuildStatus === "succeeded" ? {} : { reason: "Run successful build to verify current artifacts." }) });
      }
    }
    if (parts[0] === "jobs" && parts.length === 1 && method === "GET") return reply(res, 200, { jobs: [...jobs.values()].map(job => ({ ...job, log: redact(job.log), ...(job.artifacts ? { artifacts: job.artifacts.map(output => ({ ...output, url: auth.artifactUrl(output.url, req, job.repoId, repos.get(job.repoId)?.buildGeneration) })) } : {}) })) });
    if (parts[0] === "jobs" && parts[1] && parts[2] === "cancel" && parts.length === 3 && method === "POST") {
      await jsonBody(req); const job = jobs.get(parts[1]); if (!job) fail(404, "Job not found."); active.get(job.repoId)?.job.id === job.id && active.get(job.repoId).cancel(); return reply(res, 200, { job });
    }
    if (parts[0] === "preview" && parts[1] && parts.length >= 3 && ["GET", "HEAD"].includes(method)) {
      const repo = find(parts[1]);
      let relative = safePath(parts.slice(parts[2]?.startsWith("~") ? 3 : 2).join("/"), false);
      if (!OUTPUTS.has(relative.split("/")[0])) fail(403, "Preview only serves dist, build, or out artifacts.");
      if (repo.lastBuildStatus !== "succeeded" || active.get(repo.id)?.job.task === "build") fail(409, "Current artifacts unavailable; run successful build first.");
      if (req.authPreview && req.authPreview.generation !== repo.buildGeneration) fail(409, "Preview capability belongs to older build.");
      if (url.searchParams.has("job") && url.searchParams.get("job") !== repo.buildGeneration) fail(409, "Saved preview belongs to older build. Open latest successful build.");
      const dirname = await checkout(repo);
      let filename = await noSymlink(dirname, relative);
      let stat = await lstat(filename);
      if (stat.isDirectory()) { relative += "/index.html"; filename = await noSymlink(dirname, relative); stat = await lstat(filename); }
      if (!stat.isFile() || stat.size > 32 * 1024 * 1024) fail(413, "Artifact must be regular file under 32 MiB.");
      const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".woff": "font/woff", ".woff2": "font/woff2", ".wasm": "application/wasm", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".mp4": "video/mp4" };
      res.setHeader("Content-Type", types[path.extname(filename)] || "application/octet-stream");
      res.setHeader("Cache-Control", "no-store"); res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("Referrer-Policy", "no-referrer");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Security-Policy", "sandbox allow-scripts allow-downloads; default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' blob:; frame-ancestors 'self'; base-uri 'none'; form-action 'none'");
      const handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
      try { const content = method === "HEAD" ? null : await handle.readFile(); res.statusCode = 200; res.end(content); } finally { await handle.close(); }
      return;
    }
    fail(404, "Workspace endpoint not found.");
  }

  const middleware = (req, res, next) => {
    auth.middleware(req, res, () => {
      if (!(req.url === API || req.url?.startsWith(`${API}/`) || req.url?.startsWith(`${API}?`))) return next();
      auth.authorize(req).then(() => route(req, res)).catch(error => {
        if (!res.headersSent) reply(res, error.status || 500, { error: redact(error.message || "Workspace host failure.") });
        else res.end();
      });
    });
  };
  return { middleware, ready, close: async () => { auth.close(); github.close(); for (const value of active.values()) value.cancel(); await writes; }, storage };
}

export function workspaceHostPlugin(options = {}) {
  let host;
  function attach(server) {
    host ||= createWorkspaceHost(options);
    server.middlewares.use(host.middleware);
    server.httpServer?.once("close", () => { void host.close(); });
  }
  return { name: "ashenspire-local-workspace-host", configureServer: attach, configurePreviewServer: attach };
}
