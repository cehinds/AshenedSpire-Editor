#!/usr/bin/env node
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { addPagesBuild } from "./pages-history.mjs";

function git(args, cwd = process.cwd(), allowFailure = false) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (!allowFailure && result.status !== 0) throw new Error(`Git ${args[0]} failed: ${result.stderr.trim()}`);
  return result;
}

const buildDirectory = path.resolve(process.env.PAGES_BUILD_DIRECTORY || "dist/client");
const siteDirectory = path.resolve(process.env.PAGES_SITE_DIRECTORY || ".pages-history");
const branch = process.env.GITHUB_REF_NAME;
const buildNumber = `${process.env.GITHUB_RUN_NUMBER}-${process.env.GITHUB_RUN_ATTEMPT}`;
const commit = process.env.GITHUB_SHA;
const sourceDirectory = process.cwd();

git(["config", "user.name", "github-actions[bot]"]);
git(["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
await rm(siteDirectory, { recursive: true, force: true });
git(["worktree", "prune"]);
git(["worktree", "add", "--detach", siteDirectory, "HEAD"]);

try {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const remote = git(["ls-remote", "--exit-code", "origin", "refs/heads/gh-pages"], sourceDirectory, true);
    if (remote.status === 0) {
      git(["fetch", "--depth=1", "--force", "origin", "gh-pages:refs/remotes/origin/gh-pages"], sourceDirectory);
      git(["checkout", "--detach", "refs/remotes/origin/gh-pages"], siteDirectory);
      git(["reset", "--hard", "refs/remotes/origin/gh-pages"], siteDirectory);
      git(["clean", "-fdx"], siteDirectory);
    } else if (remote.status === 2) {
      git(["checkout", "--orphan", `pages-bootstrap-${attempt}`], siteDirectory);
      for (const entry of await readdir(siteDirectory)) {
        if (entry !== ".git") await rm(path.join(siteDirectory, entry), { recursive: true, force: true });
      }
      git(["rm", "-r", "--cached", "--ignore-unmatch", "."], siteDirectory);
    } else {
      throw new Error("Cannot read gh-pages remote; refusing to replace history");
    }
    await addPagesBuild({ siteDirectory, buildDirectory, branch, buildNumber, commit });
    git(["add", "--all"], siteDirectory);
    git(["commit", "--allow-empty", "-m", `Publish ${branch}/${buildNumber} from ${commit.slice(0, 12)}`], siteDirectory);
    const pushed = git(["push", "origin", "HEAD:refs/heads/gh-pages"], siteDirectory, true);
    if (pushed.status === 0) {
      console.log(`Preserved Pages history with ${branch}/${buildNumber}/`);
      break;
    }
    if (attempt === 4) throw new Error("Pages history push failed after five retries; existing history remains intact");
    await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
  }
  // Upload only static site files. A worktree's .git file contains a local path.
  const output = path.resolve(process.env.PAGES_UPLOAD_DIRECTORY || ".pages-site");
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  const { cp } = await import("node:fs/promises");
  await cp(siteDirectory, output, { recursive: true, filter: (name) => path.basename(name) !== ".git" });
} finally {
  git(["worktree", "remove", "--force", siteDirectory], sourceDirectory, true);
}
