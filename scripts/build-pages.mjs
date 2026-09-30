#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { checkPagesBuild } from "./check-pages-build.mjs";
import { consolidatePages } from "./consolidate-pages.mjs";

// Public static delivery cannot enforce account authentication or run Git jobs.
process.env.VITE_EDITOR_RUNTIME = "static";
const { build } = await import("vite");
await build({ mode: "production", build: { cssCodeSplit: false, rollupOptions: { output: { inlineDynamicImports: true } } } });
await import("./prepare-sites-build.mjs");
await writeFile(path.resolve("dist/client/editor-runtime.json"), JSON.stringify({
  runtime: "static-authoring",
  publicAssets: true,
  authentication: "unavailable",
  repositoryHost: "unavailable",
}, null, 2) + "\n");
await checkPagesBuild(path.resolve("dist/client"), process.env.WORKBENCH_BASE_PATH || "/");
await consolidatePages({ directory: path.resolve("dist/client"), outputDirectory: path.resolve("dist/pages"), base: process.env.WORKBENCH_BASE_PATH || "/" });
console.log("Built public offline-authoring preview; authenticated local host remains separate.");
