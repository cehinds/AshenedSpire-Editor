# AshenedSpire Editor CI/CD

Continuous Integration (CI) checks changes before merge. The prepared Continuous Delivery (CD) workflow can publish validated editor previews, but site publication is paused and the remote Pages workflow is disabled.

Source promotion remains `dev` → `test` → `main` in the existing repository. Optional GitHub account authorization in the editor uses GitHub CLI and the OS default browser; it does not authorize publication or connect a checkout by itself. The publication details below describe the retained workflow, not an enabled deployment.

## Repository layout

| Folder | Purpose |
|---|---|
| `src/` | React editor, shared shell, nine workspaces, desktop menu |
| `public/` | Static assets, native ERD 0.2.4, source snapshots, responsive preview |
| `server/` | Automatic local sessions, optional GitHub CLI authorization, retained password-mode library and Git/repository/file/build host; excluded from GitHub Pages runtime |
| `tests/` | Domain, local host/security, Sites packaging, Pages history checks |
| `scripts/` | Source review, build validation, Sites packaging, Pages publication |
| `.github/workflows/` | Fast merge checks and versioned Pages publication |
| `docs/` | Branch and pipeline contracts |
| `design/` | Approved shell design reference |
| `worker/` | Optional Sites runtime wrapper |
| `.workbench/` | Local isolated repository checkouts; ignored, never committed or hosted |
| `dist/` | Generated output; ignored |

## Branch flow

Feature branch → pull request into `dev` → pull request from `dev` into `test` → pull request from `test` into `main`.

Fast CI enforces promotion path: pull requests into `test` must come from this repository's `dev`; pull requests into `main` must come from its `test`. Feature pull requests enter `dev`. Branch protection must require this CI status to enforce policy before merge; workflow files alone cannot configure remote rules.

| Branch | Role | Preview |
|---|---|---|
| `dev` | Daily editor integration | `/AshenedSpireEditor/dev/<build-number>/` |
| `test` | Candidate acceptance checks | `/AshenedSpireEditor/test/<build-number>/` |
| `main` | Stable editor | `/AshenedSpireEditor/main/<build-number>/` |
| `gh-pages` | Generated, shared static build history | Published by Actions; never merge into source branches |

Build number is GitHub workflow run number plus attempt, such as `42-1`. A rerun becomes `42-2`, preserving the earlier output. Actual project Pages URLs use `https://cehinds.github.io/AshenedSpireEditor/dev/42-1/`, not `github.com/cehinds/...`.

Each channel also has `/latest/` and a history index. Repository root URL shows build channels and opens stable editor through `main/latest/`. Immutable builds contain `index.html`, supporting assets, and `build-info.json`; this is a complete static HTML folder, not one self-contained file.

## Fast checks

`Fast CI / Functionality and quick review` runs on pull requests targeting `dev`, `test`, or `main`, and their pushes.

1. Cached Node.js 22; locked `npm ci` dependencies; pull request branch policy.
2. `npm run review:quick`: JavaScript module syntax, merge markers, credential patterns, source size, privileged PR trigger prohibition, immutable action pins.
3. `npm run build`: production React compile and Sites packaging.
4. `npm test`: domain behavior, account/session authentication, local repository clone/edit/build, host protections, static packaging, nested HTML smoke, immutable history and concurrent publication.

One Linux runner, no matrix, no full-engine build, no coverage threshold, no remote GitHub clone inside tests. Fast CI has **one five-minute job timeout**. Versioned Pages has **two separate five-minute jobs**: build, then publication. These are per-job limits, not a promise that end-to-end publication or merge takes five minutes. Runner queue, maintainer review, GitHub availability, Pages deployment, and merge waiting add elapsed time.

These are deterministic automated code checks. Semantic human or AI code review remains separate. Pull request template and CODEOWNERS route review without forcing additional waiting. Review and merge require normal maintainer pull request actions. Required reviewers and optional CodeRabbit/Copilot reviews can be configured later, outside fast gate.

## Versioned publication

When enabled, `Versioned Pages` is configured for pushes to `dev`, `test`, or `main`, or manual dispatch on those branches. It is currently disabled remotely. Build stage independently reruns fast gates before upload. Artifact uses Vite base path `/<repository>/<branch>/<run-number>-<attempt>/` so bundled assets, native tools, and static links stay inside that version.

`build:pages` sets `VITE_EDITOR_RUNTIME=static` before calling Vite's production build through cross-platform Node wrapper. This compiles explicitly labeled offline authoring mode and skips unavailable account API calls. Default `npm run build` remains the local runtime with automatic loopback sessions. Static artifact includes `editor-runtime.json` recording public assets, unavailable authentication, and unavailable repository host.

Publication receives only successfully validated HTML artifacts. `contents: write`, `pages: write`, and `id-token: write` exist only on publication job. Pull request jobs are read-only and do not deploy or execute with publication credentials. Actions are pinned to verified full commit hashes; Dependabot proposes weekly dependency/action updates.

Publication jobs share one concurrency group with `queue: max`, `cancel-in-progress: false`. GitHub supports up to 100 pending runs. Every publication fetches current shared `gh-pages`, appends its immutable build, updates indexes, and makes a normal non-force push. Compare-and-swap retries preserve another writer's updates. Older completions cannot move a channel's latest link backward. Then one complete site, including earlier builds from every channel, is uploaded and deployed.

History is retained without automatic deletion. GitHub Pages has site/storage limits; eventually archive or prune old numbered builds deliberately. Source branches stay small because generated history lives on `gh-pages`.

## Repository settings

If site publication is requested again, review these settings before re-enabling the remote Pages workflow:

1. Settings → Pages → Source: **GitHub Actions**.
2. `github-pages` environment: allow deployment branches `dev`, `test`, and `main`. Add all three explicitly if using selected-branch restrictions.
3. Protect source branches with required status **Functionality and quick review** and pull requests. Keep approval count zero for quick solo merges; add reviewers when team needs them.
4. Keep generated `gh-pages` outside source-branch protection that would block Actions history commits. Default workflow permissions may stay read-only; publication job declares its own minimum write permissions.
5. Optional automatic merging uses normal GitHub branch rules and required green checks. Workflows do not silently merge or bypass protection.

## Hosted and local behavior

GitHub Pages serves public static files. Hosted editor supports authoring snapshots and embedded native tools in explicitly labeled offline authoring mode. It cannot enforce password authentication or run account/session APIs. A password prompt inside static HTML would not protect files; this project does not claim it does.

Local editor opens without an account or sign-in. Vite uses `authOptions.requireLogin: false`; `/api/auth` issues an automatic loopback-only session, and `/api/workbench` retains session, CSRF and origin checks. Local repository import, checkout file editing, native settings promotion, package installs, and real game builds require this local Node/Git host through `npm run dev` or `npm run preview`. Local-folder import does not contact a remote. Optional Account authorization opens GitHub in the OS default browser using GitHub CLI; credentials stay on the host and no password/token input is present in the editor frontend. A repository is connected only after its clone succeeds.

The password-mode library remains for explicitly configured hosts and tests, with a five-character minimum and server-side hashes. The normal editor has no local account/password UI.

Authentication protects local server operations. Static authoring assets and exported HTML remain public whenever published. A future private hosted editor needs an authenticated backend and access-controlled static delivery; GitHub Pages alone cannot provide that boundary.

## Local pipeline commands

```sh
npm ci
npm run review:quick
npm run build
npm test
WORKBENCH_BASE_PATH=/AshenedSpireEditor/dev/42-1/ npm run build:pages
```

`npm run build:pages` validates nested HTML/asset references, compiled application URLs and native ERD presence. Running root build again restores ordinary localhost base path and the local session runtime. Publication helper is workflow-only: it requires Git origin, GitHub branch/build identity, and push rights; do not run against a live repository to preview locally.

## Official references

- [Custom GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [GitHub Actions concurrency and queued publication](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)
- [Actions workflow permissions and syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
