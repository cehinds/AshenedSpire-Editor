import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const derive = promisify(scrypt);
const COOKIE = "ashenedspire_session";
const COST = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "terminal.local"]);
const AUTH = "/api/auth";
const digest = value => createHash("sha256").update(value).digest("hex");
const random = () => randomBytes(32).toString("hex");
const same = (left, right) => {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};

class AuthError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new AuthError(status, message); };

export function authCookie(value, { encrypted = false, maxAge = 0 } = {}) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0, Math.floor(maxAge))}${encrypted ? "; Secure" : ""}`;
}

function checkRequest(req, mutation = false) {
  let host;
  try { host = new URL(`http://${req.headers.host}`).hostname; } catch { fail(403, "Invalid local host."); }
  if (!HOSTS.has(host)) fail(403, "Authentication requires localhost or managed terminal.local.");
  if (mutation) {
    let origin;
    try { origin = new URL(req.headers.origin); } catch { fail(403, "Same-origin Origin header required."); }
    if (!["http:", "https:"].includes(origin.protocol) || origin.host !== req.headers.host) fail(403, "Cross-origin authentication blocked.");
    if (req.socket?.encrypted && origin.protocol !== "https:") fail(403, "HTTPS origin required.");
    if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"] || "")) fail(415, "Authentication requires application/json.");
  }
}

async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) { size += Buffer.byteLength(chunk); if (size > 8192) fail(413, "Authentication request too large."); chunks.push(chunk); }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).toString("utf8") || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) fail(400, "JSON object required.");
    return parsed;
  } catch (error) { if (error instanceof AuthError) throw error; fail(400, "Invalid JSON."); }
}

function password(value) {
  if (typeof value !== "string" || value.length < 12 || value.length > 128 || Buffer.byteLength(value) > 512) fail(400, "Password must contain 12–128 characters.");
}

function username(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.@-]{0,63}$/.test(value)) fail(400, "Username must contain 1–64 letters, digits, dots, underscores, @, or hyphens.");
}

function reply(res, status, value) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.end(JSON.stringify(value));
}

export function createAuthHost({ root = process.cwd(), now = Date.now, sessionMs = 8 * 60 * 60_000, bootstrapMs = 30 * 60_000, previewMs = 15 * 60_000, failureLimit = 5, failureWindowMs = 15 * 60_000 } = {}) {
  root = path.resolve(root);
  const storage = path.join(root, ".workbench");
  const filename = path.join(storage, "auth.json");
  const sessions = new Map();
  const previews = new Map();
  const failures = new Map();
  let owner = null;
  let busy = false;

  async function assertStorage() {
    for (const dir of [root, storage]) {
      const stat = await lstat(dir);
      if (!stat.isDirectory() || stat.isSymbolicLink()) fail(500, "Authentication storage must use real directories.");
    }
  }

  const ready = (async () => {
    await mkdir(storage, { recursive: true, mode: 0o700 });
    await assertStorage();
    let handle;
    try { handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW); }
    catch (error) { if (error.code === "ENOENT") return; fail(500, "Authentication store unavailable; preserve file and repair local permissions."); }
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > 8192) fail(500, "Invalid authentication store.");
      const value = JSON.parse(await handle.readFile("utf8"));
      username(value.username);
      if (value.version !== 1 || value.algorithm !== "scrypt" || value.N !== COST.N || value.r !== COST.r || value.p !== COST.p || !/^[a-f0-9]{32}$/.test(value.salt || "") || !/^[a-f0-9]{128}$/.test(value.hash || "")) fail(500, "Invalid authentication store.");
      owner = value;
    } catch { fail(500, "Invalid authentication store; preserve file and repair before continuing."); }
    finally { await handle.close(); }
  })();
  ready.catch(() => {});

  function clean() {
    for (const [id, session] of sessions) if (session.expires <= now()) sessions.delete(id);
    for (const [id, preview] of previews) if (preview.expires <= now() || !sessions.get(preview.session)?.authenticated) previews.delete(id);
    for (const [id, failure] of failures) if (failure.until <= now()) failures.delete(id);
  }

  function current(req) {
    clean();
    const cookie = String(req.headers.cookie || "").split(";").map(value => value.trim()).find(value => value.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    if (!/^[a-f0-9]{64}$/.test(cookie || "")) return null;
    const id = digest(cookie);
    const session = sessions.get(id);
    return session ? { id, ...session } : null;
  }

  function issue(req, res, authenticated = false) {
    clean();
    while (sessions.size >= 1000) sessions.delete(sessions.keys().next().value);
    const token = random();
    const id = digest(token);
    const life = authenticated ? sessionMs : bootstrapMs;
    const session = { authenticated, csrfToken: random(), expires: now() + life };
    sessions.set(id, session);
    res.setHeader("Set-Cookie", authCookie(token, { encrypted: Boolean(req.socket?.encrypted), maxAge: life / 1000 }));
    return { id, ...session };
  }

  function view(session) {
    return { setupRequired: !owner, authenticated: Boolean(session?.authenticated), username: session?.authenticated ? owner.username : null, csrfToken: session.csrfToken, ...(session.authenticated ? { expiresAt: new Date(session.expires).toISOString() } : {}) };
  }

  async function store(record, initial = false) {
    await assertStorage();
    const temporary = `${filename}.${random()}.tmp`;
    let setupLock;
    try {
      if (initial) {
        try {
          setupLock = await open(`${filename}.setup-lock`, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
        } catch (error) { if (error.code === "EEXIST") fail(409, "Owner already configured."); throw error; }
        try { await lstat(filename); fail(409, "Owner already configured."); } catch (error) { if (error.code !== "ENOENT") throw error; }
      }
      const handle = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
      try { await handle.writeFile(JSON.stringify(record)); await handle.sync(); } finally { await handle.close(); }
      await rename(temporary, filename);
    } finally {
      await unlink(temporary).catch(() => {});
      if (setupLock) { await setupLock.close(); await unlink(`${filename}.setup-lock`).catch(() => {}); }
    }
  }

  async function makeOwner(name, secret) {
    const salt = randomBytes(16).toString("hex");
    const hash = (await derive(secret, Buffer.from(salt, "hex"), 64, COST)).toString("hex");
    return { version: 1, username: name, algorithm: "scrypt", N: COST.N, r: COST.r, p: COST.p, salt, hash };
  }

  async function verify(secret) {
    if (typeof secret !== "string" || secret.length > 128 || Buffer.byteLength(secret) > 512) return false;
    const derived = await derive(secret, Buffer.from(owner.salt, "hex"), 64, COST);
    return timingSafeEqual(derived, Buffer.from(owner.hash, "hex"));
  }

  function rate(req) {
    const key = req.socket?.remoteAddress || "local";
    const existing = failures.get(key);
    if (existing && existing.until > now() && existing.count >= failureLimit) fail(429, "Too many failed attempts. Try again in 15 minutes.");
    return key;
  }

  function failed(key) {
    const previous = failures.get(key);
    failures.set(key, { count: (previous?.until > now() ? previous.count : 0) + 1, until: previous?.until > now() ? previous.until : now() + failureWindowMs });
  }

  async function handle(req, res) {
    checkRequest(req, req.method !== "GET");
    await ready;
    const route = new URL(req.url, "http://local.invalid").pathname;
    let session = current(req);
    if (route === `${AUTH}/session` && req.method === "GET") return reply(res, 200, view(session || issue(req, res)));
    if (req.method !== "POST" || !["setup", "login", "logout", "password"].some(action => route === `${AUTH}/${action}`)) fail(404, "Authentication endpoint not found.");
    if (!session || !same(req.headers["x-auth-csrf"], session.csrfToken)) fail(403, "Refresh session and supply X-Auth-CSRF token.");
    const data = await body(req);
    if (route === `${AUTH}/logout`) {
      sessions.delete(session.id); clean(); return reply(res, 200, view(issue(req, res)));
    }
    const key = rate(req);
    if (busy) fail(429, "Authentication operation in progress. Try again shortly.");
    busy = true;
    try {
      if (route === `${AUTH}/setup`) {
        if (owner) fail(409, "Owner already configured. Sign in instead.");
        username(data.username); password(data.password);
        const record = await makeOwner(data.username, data.password);
        await store(record, true); owner = record;
      } else if (route === `${AUTH}/login`) {
        if (!owner) fail(409, "Configure local owner first.");
        const valid = await verify(data.password);
        if (!valid || data.username !== owner.username) { failed(key); fail(401, "Invalid username or password."); }
        failures.delete(key);
      } else {
        if (!session.authenticated) fail(401, "Sign in before changing password.");
        password(data.newPassword);
        if (!await verify(data.currentPassword)) { failed(key); fail(401, "Invalid current password."); }
        const record = await makeOwner(owner.username, data.newPassword);
        await store(record); owner = record; sessions.clear(); previews.clear(); failures.clear();
        return reply(res, 200, view(issue(req, res)));
      }
      sessions.delete(session.id);
      return reply(res, 200, view(issue(req, res, true)));
    } finally { busy = false; }
  }

  async function authorize(req) {
    checkRequest(req);
    await ready;
    const session = current(req);
    if (session?.authenticated) { req.authSession = session; return; }
    const url = new URL(req.url, "http://local.invalid");
    const match = url.pathname.match(/^\/api\/workbench\/preview\/([a-z0-9][a-z0-9_.-]{0,145})\/~([a-f0-9]{64})\/(dist|build|out)(?:\/|$)/);
    if (["GET", "HEAD"].includes(req.method) && match) {
      const preview = previews.get(digest(match[2]));
      if (preview && preview.repoId === match[1] && preview.expires > now() && sessions.get(preview.session)?.authenticated && (!url.searchParams.has("job") || url.searchParams.get("job") === preview.generation)) { req.authPreview = preview; return; }
    }
    fail(401, "Sign in to use local workspace.");
  }

  function artifactUrl(value, req, repoId, generation) {
    const session = current(req);
    if (!session?.authenticated) fail(401, "Sign in to preview build.");
    clean();
    let token;
    for (const [id, preview] of previews) if (preview.session === session.id && preview.repoId === repoId && preview.generation === generation && preview.expires > now()) { token = preview.token; break; }
    if (!token) {
      while (previews.size >= 1000) previews.delete(previews.keys().next().value);
      token = random(); previews.set(digest(token), { token, session: session.id, repoId, generation, expires: Math.min(session.expires, now() + previewMs) });
    }
    return value.replace(`/preview/${repoId}/`, `/preview/${repoId}/~${token}/`);
  }

  function middleware(req, res, next) {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, "http://local.invalid").pathname); } catch { return reply(res, 400, { error: "Invalid URL encoding." }); }
    if (pathname.split(/[\\/]/).some(part => [".workbench", ".git", ".env", ".ssh", ".npmrc", ".netrc"].includes(part.toLowerCase()) || /^\.env\./i.test(part))) return reply(res, 404, { error: "Private runtime path unavailable." });
    if (!pathname.startsWith(`${AUTH}/`) && pathname !== AUTH) return next();
    handle(req, res).catch(error => { if (!res.headersSent) reply(res, error.status || 500, { error: error instanceof AuthError ? error.message : "Authentication unavailable. Check local storage permissions." }); else res.end(); });
  }

  return { middleware, authorize, artifactUrl, ready, close: () => { sessions.clear(); previews.clear(); failures.clear(); }, filename };
}
