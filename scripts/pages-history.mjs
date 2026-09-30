import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

export const channels = ["dev", "test", "main"];

export function validateBuildIdentity({ branch, buildNumber, commit }) {
  if (!channels.includes(branch)) throw new Error("Pages channel must be dev, test, or main");
  if (!/^[1-9]\d*-[1-9]\d*$/.test(buildNumber)) throw new Error("Build number must be run-number-attempt");
  if (!/^[a-f0-9]{40}$/i.test(commit)) throw new Error("Build commit must be a full Git SHA");
}

export function compareBuilds(left, right) {
  const a = left.buildNumber.split("-").map(Number);
  const b = right.buildNumber.split("-").map(Number);
  return b[0] - a[0] || b[1] - a[1];
}

async function filesIn(directory, relative = "") {
  const result = [];
  for (const entry of await readdir(path.join(directory, relative), { withFileTypes: true })) {
    const name = path.posix.join(relative, entry.name);
    if (entry.isSymbolicLink()) throw new Error("Pages build cannot contain symbolic links");
    if (entry.isDirectory()) result.push(...await filesIn(directory, name));
    else if (entry.isFile()) result.push(name);
  }
  return result.sort();
}

async function digestBuild(directory) {
  const hash = createHash("sha256");
  for (const file of await filesIn(directory)) {
    hash.update(file).update("\0").update(await readFile(path.join(directory, file))).update("\0");
  }
  return hash.digest("hex");
}

const document = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{margin:3rem auto;padding:0 1rem;max-width:54rem;background:#181b20;color:#e8dfca;font:16px system-ui}a{color:#e3b54f}nav,li{margin:.8rem 0}code{color:#adb5c0}</style></head><body>${body}</body></html>\n`;
const redirect = (target) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=${target}"><title>AshenedSpire Editor</title></head><body><a href="${target}">Open AshenedSpire Editor</a></body></html>\n`;

export async function addPagesBuild({ siteDirectory, buildDirectory, branch, buildNumber, commit, builtAt = new Date().toISOString() }) {
  validateBuildIdentity({ branch, buildNumber, commit });
  const index = await readFile(path.join(buildDirectory, "index.html"), "utf8");
  if (!index.includes("<html")) throw new Error("Build is missing an HTML entry document");
  const digest = await digestBuild(buildDirectory);
  await mkdir(siteDirectory, { recursive: true });
  let manifest = { schemaVersion: 1, builds: [] };
  try {
    manifest = JSON.parse(await readFile(path.join(siteDirectory, "builds.json"), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.builds)) throw new Error("Unsupported Pages history manifest");
  for (const entry of manifest.builds) validateBuildIdentity(entry);
  const previous = manifest.builds.find((entry) => entry.branch === branch && entry.buildNumber === buildNumber);
  if (previous && (previous.commit !== commit || previous.digest !== digest)) throw new Error("Immutable build number already contains different output");
  if (!previous) {
    const destination = path.join(siteDirectory, branch, buildNumber);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(buildDirectory, destination, { recursive: true, force: false, errorOnExist: true });
    const entry = { branch, buildNumber, commit, builtAt, digest };
    manifest.builds.push(entry);
    await writeFile(path.join(destination, "build-info.json"), JSON.stringify(entry, null, 2) + "\n");
  }
  manifest.builds.sort((a, b) => channels.indexOf(a.branch) - channels.indexOf(b.branch) || compareBuilds(a, b));
  await writeFile(path.join(siteDirectory, "builds.json"), JSON.stringify(manifest, null, 2) + "\n");
  await writeFile(path.join(siteDirectory, ".nojekyll"), "");
  const links = [];
  for (const channel of channels) {
    const builds = manifest.builds.filter((entry) => entry.branch === channel);
    if (!builds.length) continue;
    await mkdir(path.join(siteDirectory, channel, "latest"), { recursive: true });
    await writeFile(path.join(siteDirectory, channel, "latest", "index.html"), redirect(`../${builds[0].buildNumber}/`));
    await writeFile(path.join(siteDirectory, channel, "index.html"), document(`AshenedSpire · ${channel}`, `<h1>AshenedSpire · ${channel}</h1><nav><a href="latest/">Latest build ${builds[0].buildNumber}</a> · <a href="../">All channels</a></nav><ul>${builds.map((entry) => `<li><a href="${entry.buildNumber}/">Build ${entry.buildNumber}</a> · <code>${entry.commit.slice(0, 12)}</code></li>`).join("")}</ul>`));
    links.push(`<li><a href="${channel}/latest/">${channel} · build ${builds[0].buildNumber}</a> · <a href="${channel}/">History</a></li>`);
  }
  const main = manifest.builds.find((entry) => entry.branch === "main");
  await writeFile(path.join(siteDirectory, "index.html"), document("AshenedSpire Editor builds", `<h1>AshenedSpire Editor</h1>${main ? '<nav><a href="main/latest/">Open stable editor</a></nav>' : "<p>Stable editor awaits first main build.</p>"}<ul>${links.join("")}</ul><p>Hosted preview supports authoring. Repository files and game builds require local Workbench host.</p>`));
  return manifest;
}
