#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Validates the single-file Pages HTML (dist/pages/index.html) that every
// dev → test promotion must produce before merge and that push-to-test publishes.
export async function checkConsolidatedPages(file) {
  let info;
  try { info = await stat(file); } catch { throw new Error(`Consolidated Pages HTML is missing: ${file}`); }
  if (!info.isFile() || info.size === 0) throw new Error(`Consolidated Pages HTML is empty or not a file: ${file}`);
  const html = await readFile(file, "utf8");
  if (!/<html[\s>]/i.test(html) || !/<\/html>\s*$/i.test(html)) throw new Error("Consolidated Pages HTML is not a complete HTML document");
  const modules = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map((match) => match[1]);
  if (modules.length !== 1 || !modules[0].startsWith("data:text/javascript;base64,")) {
    throw new Error("Consolidated Pages HTML must embed exactly one application module");
  }
  if (/<link\b[^>]*rel="(?:stylesheet|modulepreload)"/.test(html)) throw new Error("Consolidated Pages HTML still references external CSS or JavaScript");
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    if (/^(?:\/|https?:)/.test(match[1])) throw new Error(`Consolidated Pages HTML references an external resource: ${match[1]}`);
  }
  const bootstrap = html.match(/<script id="editor-embedded-assets">([\s\S]*?)<\/script>/)?.[1];
  if (!bootstrap) throw new Error("Consolidated Pages HTML is missing its embedded asset table");
  if (!bootstrap.includes('"native/erd-workbench-0.2.4.html":["text/html"')) throw new Error("Consolidated Pages HTML is missing the native ERD Workbench 0.2.4");
  return { bytes: info.size };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const file = path.resolve(process.argv[2] || "dist/pages/index.html");
  const { bytes } = await checkConsolidatedPages(file);
  console.log(`Consolidated Pages HTML passed: ${path.relative(process.cwd(), file)} (${bytes} bytes)`);
}
