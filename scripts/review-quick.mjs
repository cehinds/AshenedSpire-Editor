#!/usr/bin/env node
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const roots = ["src", "server", "scripts", "tests", ".github", "worker"];
const failures = [];
let inspected = 0;
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) { failures.push(`${name}: source symlink requires review`); continue; }
    if (entry.isDirectory()) { await inspect(name); continue; }
    if (!/\.(?:m?js|jsx|css|ya?ml|md|json)$/.test(name)) continue;
    const source = await readFile(name, "utf8");
    inspected += 1;
    if (/^(?:<{7}|={7}|>{7})(?: |$)/m.test(source)) failures.push(`${name}: unresolved merge marker`);
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(source)) failures.push(`${name}: private key material`);
    if (/(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{70,})/.test(source)) failures.push(`${name}: GitHub credential material`);
    if ((await stat(name)).size > 10 * 1024 * 1024) failures.push(`${name}: source file exceeds 10 MiB`);
    if (/\.(?:mjs|js)$/.test(name)) {
      const parsed = spawnSync(process.execPath, ["--check", name], { encoding: "utf8" });
      if (parsed.status !== 0) failures.push(`${name}: ${parsed.stderr.trim()}`);
    }
    if (/\.github\/workflows\/.*\.ya?ml$/.test(name.replaceAll(path.sep, "/"))) {
      if (/pull_request_target\s*:/.test(source)) failures.push(`${name}: privileged PR execution requires separate security review`);
      for (const match of source.matchAll(/uses:\s*([^\s#]+)/g)) {
        if (!match[1].startsWith("./") && !/@[a-f0-9]{40}$/.test(match[1])) failures.push(`${name}: action must use immutable SHA: ${match[1]}`);
      }
    }
  }
}
for (const root of roots) await inspect(root);
if (failures.length) throw new Error(failures.join("\n"));
console.log(`Quick source review passed: ${inspected} files; syntax, conflicts, credentials, file size, and workflow pins. Human or AI semantic review remains separate.`);
