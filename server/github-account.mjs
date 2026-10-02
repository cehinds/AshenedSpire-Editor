import { spawn } from "node:child_process";

const STATUS_ARGS = ["auth", "status", "--active", "--hostname", "github.com", "--json", "hosts"];
const LOGIN_ARGS = ["auth", "login", "--hostname", "github.com", "--git-protocol", "https", "--web", "--skip-ssh-key"];
const DEVICE_URL = "https://github.com/login/device";
const UNAVAILABLE = "GitHub CLI is unavailable. Install GitHub CLI on this computer, then retry.";

// Credentials stay in GitHub CLI's host storage. Only this allowlisted snapshot
// crosses the HTTP boundary; CLI output and diagnostic messages never do.
export function createGitHubAccount({ spawnImpl = spawn, platform = process.platform, statusTimeout = 15_000, loginTimeout = 5 * 60_000 } = {}) {
  let available = false;
  let connected = false;
  let username = null;
  let login = { state: "idle" };
  let starting;
  let refreshing;
  let closed = false;
  const processes = new Set();
  const snapshot = () => ({ available, connected, username, login: { ...login } });

  function command(args, timeout, onData, executable = "gh") {
    let child;
    let timer;
    let settled = false;
    let output = "";
    let resolveDone;
    const done = new Promise(resolve => { resolveDone = resolve; });
    const finish = result => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      processes.delete(cancel);
      resolveDone({ ...result, stdout: output });
      output = "";
    };
    const cancel = (timedOut = false) => {
      if (settled) return;
      try { child?.kill(); } catch {}
      finish({ exitCode: null, timedOut, cancelled: !timedOut });
    };
    processes.add(cancel);
    const env = { ...process.env, GH_PROMPT_DISABLED: "1", GH_PAGER: "cat", NO_COLOR: "1" };
    // A host/browser override must not redirect this explicit default-browser flow.
    delete env.GH_BROWSER;
    delete env.BROWSER;
    try {
      child = spawnImpl(executable, args, { shell: false, windowsHide: true, env, stdio: ["pipe", "pipe", "pipe"] });
      child.stdout.on("data", chunk => {
        if (settled) return;
        if (!onData) output = (output + chunk.toString()).slice(-64 * 1024);
        else onData(chunk.toString());
      });
      child.stderr.on("data", chunk => { if (!settled) onData?.(chunk.toString()); });
      child.once("error", error => finish({ exitCode: null, missing: error.code === "ENOENT" }));
      child.once("close", exitCode => finish({ exitCode }));
      // gh's device flow can wait for Enter before opening the browser.
      child.stdin.on("error", () => {});
      child.stdin.end(onData ? "\n" : undefined);
      timer = setTimeout(() => cancel(true), timeout);
      timer.unref?.();
    } catch (error) { finish({ exitCode: null, missing: error.code === "ENOENT" }); }
    return done;
  }

  async function refresh() {
    if (closed) return snapshot();
    const result = await command(STATUS_ARGS, statusTimeout);
    if (closed) return snapshot();
    available = !result.missing;
    connected = false;
    username = null;
    if (result.missing) login = { state: "failed", error: UNAVAILABLE };
    else if (result.timedOut) login = { state: "failed", error: "GitHub account check timed out. Check your connection and retry." };
    else if (result.exitCode === 0) {
      try {
        const hosts = JSON.parse(result.stdout)?.hosts;
        if (!hosts || typeof hosts !== "object" || Array.isArray(hosts)) throw new Error("Invalid status shape");
        const records = hosts["github.com"];
        const account = Array.isArray(records) && records.find(entry => entry.active === true && entry.state === "success" && entry.host === "github.com" && typeof entry.login === "string" && /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(entry.login));
        if (account) {
          connected = true;
          username = account.login;
          if (login.state === "failed") login = { state: "idle" };
        }
      } catch { login = { state: "failed", error: "GitHub CLI returned an unreadable account status. Update GitHub CLI and retry." }; }
    } else if (result.exitCode !== 1) login = { state: "failed", error: "GitHub account status could not be checked. Update GitHub CLI and retry." };
    return snapshot();
  }

  function status() {
    if (closed || login.state === "pending") return Promise.resolve(snapshot());
    refreshing ||= refresh().finally(() => { refreshing = undefined; });
    return refreshing;
  }

  async function begin() {
    await status();
    if (closed || connected || !available) return snapshot();
    login = { state: "pending" };
    let pendingText = "";
    let browserOpened = false;
    void command(LOGIN_ARGS, loginTimeout, text => {
      // Keep just a bounded parser window; never expose arbitrary CLI text.
      pendingText = (pendingText + text).slice(-2048);
      const code = pendingText.match(/one-time code(?::\s*|\s*\()([A-Z0-9]{4}-[A-Z0-9]{4})\b/i)?.[1];
      if (code && login.state === "pending") {
        login = { ...login, code: code.toUpperCase(), verificationUrl: DEVICE_URL };
        if (!browserOpened) {
          browserOpened = true;
          // gh intentionally does not browse with piped stdio. Launch only our
          // fixed device URL through the OS default handler; never use CLI URLs.
          const executable = platform === "win32" ? "rundll32.exe" : platform === "darwin" ? "open" : "xdg-open";
          const args = platform === "win32" ? ["url.dll,FileProtocolHandler", DEVICE_URL] : [DEVICE_URL];
          void command(args, 10_000, undefined, executable).then(result => {
            if (!closed && login.state === "pending" && result.exitCode !== 0) login = { ...login, error: "The default browser could not be opened. Open the verification link and enter the code." };
          });
        }
      }
    }).then(async result => {
      pendingText = "";
      if (closed) return;
      if (result.missing) { available = false; login = { state: "failed", error: UNAVAILABLE }; }
      else if (result.timedOut) login = { state: "failed", error: "GitHub sign-in timed out. Choose Connect to GitHub to try again." };
      else if (result.exitCode !== 0) login = { state: "failed", error: "GitHub sign-in did not complete. Retry and finish approval in your default browser." };
      else {
        await refresh();
        if (!closed) login = connected ? { state: "succeeded" } : { state: "failed", error: "GitHub sign-in finished, but an active account could not be verified. Retry." };
      }
    });
    return snapshot();
  }

  function startLogin() {
    if (closed || login.state === "pending") return Promise.resolve(snapshot());
    starting ||= begin().finally(() => { starting = undefined; });
    return starting;
  }

  function close() {
    closed = true;
    for (const cancel of processes) cancel();
    if (login.state === "pending") login = { state: "failed", error: "GitHub sign-in stopped because the editor host closed." };
  }
  return { status, startLogin, close };
}
