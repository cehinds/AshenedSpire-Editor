#!/usr/bin/env node
import path from "node:path";
import { pathToFileURL } from "node:url";

export function checkBranchPolicy({ base, head, baseRepository, headRepository }) {
  if (!["dev", "test", "main"].includes(base)) throw new Error("Pull request target must be dev, test, or main");
  if (!head || head === base) throw new Error("Pull request must originate from another branch");
  const source = { test: "dev", main: "test" }[base];
  if (source && head !== source) throw new Error(`Promote ${source} into ${base}; feature branches enter dev first`);
  if (source && baseRepository && headRepository && baseRepository !== headRepository) {
    throw new Error(`Promotion into ${base} must originate from this repository's ${source} branch`);
  }
  return `${head} → ${base}`;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const flow = checkBranchPolicy({
    base: process.env.BASE_BRANCH,
    head: process.env.HEAD_BRANCH,
    baseRepository: process.env.BASE_REPOSITORY,
    headRepository: process.env.HEAD_REPOSITORY,
  });
  console.log(`Branch policy passed: ${flow}`);
}
