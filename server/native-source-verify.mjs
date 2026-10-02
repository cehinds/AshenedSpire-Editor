// Child process for native source verification. The host starts it with the
// Node permission model (read-only access to the checkout and this adapter, no
// writes, no child processes) and an import hook that refuses network and
// process modules. It imports the checkout module as it is on disk and the
// reviewed candidate text in its place, then prints both exports as canonical
// JSON for the host to compare with the draft. Nothing is written anywhere.
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { canonicalJson } from "../src/native-js-source.mjs";

const DENIED = ["net", "http", "https", "http2", "tls", "dgram", "dns", "dns/promises", "child_process", "worker_threads", "cluster", "inspector", "module", "repl", "vm", "wasi"];
const HOOKS = `
let target, original, source;
const denied = new Set(${JSON.stringify(DENIED)});
export async function initialize(data) { target = data.target; original = data.original; source = data.source; }
export async function resolve(specifier, context, next) {
  const bare = specifier.startsWith("node:") ? specifier.slice(5) : specifier;
  if (denied.has(bare)) throw new Error("Native source verification blocks " + specifier + ".");
  const resolved = await next(specifier, context);
  if (!/^(?:file|node):/.test(resolved.url)) throw new Error("Native source verification allows local file imports only.");
  return resolved;
}
export async function load(url, context, next) {
  if (url === target) return { format: "module", source, shortCircuit: true };
  if (url === original) { const loaded = await next(url, context); return { ...loaded, format: "module" }; }
  return next(url, context);
}`;

let input = "";
for await (const chunk of process.stdin) input += chunk;
const { file, candidate, exportName, path: exportPath = [] } = JSON.parse(input);
const original = pathToFileURL(file).href;
const target = `${original}?ashenedspire-candidate`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`, { data: { target, original, source: candidate } });
for (const name of ["fetch", "WebSocket", "EventSource", "XMLHttpRequest"]) delete globalThis[name];
const pick = module => exportPath.reduce((value, key) => value?.[key], module[exportName]);
try {
  const before = pick(await import(original));
  const after = pick(await import(target));
  process.stdout.write(JSON.stringify({ before: JSON.parse(canonicalJson(before)), after: JSON.parse(canonicalJson(after)) }));
} catch (error) {
  process.stderr.write(`NATIVE-VERIFY-ERROR ${error?.code ? `${error.code}: ` : ""}${String(error?.message ?? error).split("\n")[0].slice(0, 400)}\n`);
  process.exitCode = 2;
}
