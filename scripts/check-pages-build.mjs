#!/usr/bin/env node
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function checkPagesBuild(directory, base) {
  if (!/^\/[A-Za-z0-9_./-]*\/$/.test(base) && base !== "/") throw new Error("Pages base must be an absolute slash-terminated path");
  if (base.includes("..")) throw new Error("Pages base cannot traverse directories");
  const html = await readFile(path.join(directory, "index.html"), "utf8");
  let references = 0;
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    const value = match[1];
    if (!value.startsWith("/")) continue;
    if (!value.startsWith(base)) throw new Error(`Root-relative build asset escapes Pages base: ${value}`);
    await access(path.join(directory, value.slice(base.length)));
    references += 1;
  }
  if (!references || !html.includes('type="module"')) throw new Error("HTML is missing its built application module");
  for (const name of await readdir(path.join(directory, "assets"))) {
    if (base !== "/" && name.endsWith(".js")) {
      const javascript = await readFile(path.join(directory, "assets", name), "utf8");
      if (/["'`]\/(?:native\/|source\/|assets\/|responsive-preview\.html)/.test(javascript)) {
        throw new Error(`Application URL escapes Pages base in ${name}`);
      }
    }
    if (!name.endsWith(".css")) continue;
    const css = await readFile(path.join(directory, "assets", name), "utf8");
    for (const match of css.matchAll(/url\(["']?(\/[^)'"\s]+)["']?\)/g)) {
      if (!match[1].startsWith(base)) throw new Error(`CSS asset escapes Pages base: ${match[1]}`);
    }
  }
  await access(path.join(directory, "native", "erd-workbench-0.2.4.html"));
  console.log(`Pages HTML, entry assets, CSS URLs, and native ERD passed for ${base}`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await checkPagesBuild(path.resolve("dist/client"), process.env.WORKBENCH_BASE_PATH || "/");
}
