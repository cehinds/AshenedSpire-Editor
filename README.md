# AshenedSpire Editor

Local game-authoring editor with nine workspaces, native ERD Workbench 0.2.4, Visual Studio-style File / Edit / View / Build / Window / Help menus, and server-side username/password authentication. Core game's name remains **AshenSpire**.

## Run

Requires Node.js 22+ and Git for local checkout operations. Add an ordinary local Git repository folder through Project tools; the editor copies committed files into its own isolated checkout. Uncommitted source-directory edits are not imported. No GitHub connection is required.

```sh
npm ci
npm run dev
```

Open Vite's printed localhost URL. First visit sets up one local owner account; no default username or password exists. Passwords need 12–128 characters. Login, logout, session expiry, and password change use local server; password change signs out every session. Account reset, email recovery, multi-user roles, and multifactor authentication are not implemented.

`npm run preview` serves production build with same local host/authentication. `/responsive-preview.html` shows phone/tablet/desktop editor. Server binds loopback by default. Hosted static preview explicitly opens draft-only authoring; static files do not provide password security.

## Folder structure

| Folder | Responsibility |
|---|---|
| `src/` | Editor shell, menus, authentication UI, authoring workspaces |
| `server/` | Account/session authentication; isolated repository, text-file, and build host |
| `public/` | Game snapshot assets, fonts/licenses, native ERD, responsive harness |
| `tests/` | Domain behavior, authentication, Git/file/build operations, Pages publication |
| `scripts/` | Fast source review, build checks, static packaging, versioned publication |
| `.github/` | CI/CD templates, pull request checklist, ownership, dependency updates |
| `docs/` | Pipeline contract and grouped tool audit |
| `design/` | Original approved parent design reference; predates renamed menu/auth extensions |
| `worker/` | Optional static Sites wrapper; does not replace local account/Git host |
| `.workbench/` | Ignored local owner store, isolated checkouts, verified build records |
| `dist/` | Ignored generated build |

Source branches: **main**, **test**, **dev**. The GitHub repository is `cehinds/AshenedSpire-Editor`. Versioned Pages publishes validated static editor builds, including `https://cehinds.github.io/AshenedSpire-Editor/test/<run-number>-<attempt>/`.

## What each mode can do

| Workspace | Implemented | Boundary |
|---|---|---|
| Cards | Create reviewed cards from native templates; edit inspected Rogue definitions in form/JSON; visual base/upgrade; artwork sidecars | Draft definitions; native JavaScript card-source adapter remains unavailable |
| Decks | Add/remove owned sandbox copies, validate limits, confirm/cancel | Separate from runtime inventory/equipment/deck |
| Tags / ERD | Edit vocabulary rows; parent/cycle checks; CSV; imported-row mapping; native ERD 0.2.4; reviewed native CSV checkout saves | Native ERD history independent; labels do not grant mechanics |
| Scenes | Native playable opening preview, live words/timing/staging, Play/Pause/Restart, device targets; reviewed native JSON checkout saves | Audio and saved-game host integration remain unavailable |
| Battlefield | Normal/boss/selection sizing, explicit overflow/cap, device comparisons, JSON proposal | No applied formation/environment adapter |
| UI settings | Native combat config JSON; valid 100% layout bands; named wireframe snapshots/apply/export; reviewed native JSON checkout saves | Wireframes store geometry drafts; compiler/runtime verification uses the game build |
| Poses / effects | Native seven-pose sampler and authored pose playback in the game, effect timing, bindings, structural validation | Presentation preview does not deal damage; checkout promotion remains separate |
| Combat workshop | Scenario/seed/ruleset editing and isolated native playable combat using draft cards/deck | Private Workshop service and persistent game saves remain disconnected |
| Project tools | Local Git import, protected branch create/switch/delete, file tree/edit/save, jobs/artifacts; game settings JSON import/edit/export and reviewed native defaults promotion; CSV/JSON/XLSX | Authenticated host required for checkout writes/jobs. CSV/XLSX exports are data tables; XLSX import is unavailable |

**Game work:** Open a local repository and create a branch before editing. File saves change its isolated checkout. For Tags, Scenes and UI, File → Load / save native checkout document loads current source into the draft, retains a receipt, and enables explicit review and revision-checked save after editing. Project → Game settings edits the native profile; reviewed promotion invokes the actual game validator and replaces promoted defaults, then requires a build. Builds runs checked-out commands and shows real outputs. Cards, battlefield and effect drafts still require native source adapters; private combat runner remains disconnected. See `docs/tool-audit.md` for grouped evidence and restrictions.

## Live previews

Every workspace has an **In game** tab. Scenes also has **Play preview** in Compose. Native game renderers show current drafts, and the combat preview runs real isolated game actions. See [preview behavior and limits](docs/in-game-preview.md).

## Authentication and source ownership

Local owner credentials are salted/hashed server-side; plaintext passwords never enter browser storage or committed files. HttpOnly session cookies, expiry, login throttling, same-origin requests, and CSRF checks protect local operations. `.workbench/` stays ignored. No GitHub password/token entry is needed. Visible repository tools use local file transfer and never fetch, pull, push, or authenticate to a remote service. Bare repositories, linked worktrees, network shares and symlinked source directories are unsupported.

Repo saves require explicit action and content revision checks. Unsaved buffers block navigation and logout. Checkout operations are mutually locked during saves/builds. Symlinks, traversal, secrets, `.git`, and dependency internals are blocked. Build previews use sandboxed frames and generation-bound, short-lived artifact-only access; logout revokes access. Job history is session-only; last verified artifacts persist and become stale after later builds.

Branch switching requires a clean checkout and no unsaved editor buffer; commit or resolve checkout changes with Git before switching. main/test/dev and current branch cannot be deleted; unmerged deletion is refused. No automatic commits, merges, pushes, or deployment. Draft Undo/Redo does not undo checkout file writes. Exported files and public static assets remain readable if published; authentication is not an encryption claim for exports.

## CI/CD

```sh
npm run review:quick
npm run build
npm test
WORKBENCH_BASE_PATH=/AshenedSpire-Editor/test/42-1/ npm run build:pages
```

Fast gate checks functionality, account/session behavior, Git safety, production compile, syntax, merge markers, credential patterns, pinned workflow actions, and publication history. Five-minute job timeout bounds execution after runner starts; queue, human/AI review, and merge waiting are excluded. Semantic code review remains separate from deterministic checks.

Feature → `dev` → `test` → `main` promotion. GitHub Pages builds preserve `/AshenedSpire-Editor/<branch>/<run-number>-<attempt>/`, channel `/latest/`, and shared history. Output is one self-contained `dist/pages/index.html` with embedded code, CSS, fonts, images, source snapshots, and native ERD. Publication adds `build-info.json` alongside it; the editor needs only the HTML file. GitHub Pages cannot run password-authentication server or Git/build jobs. Full contract: `docs/ci-cd.md`.

## Provenance and validation limits

Game snapshot: `cehinds/AshenSpire`, `dev`, commit `38166cb12a2d8901fce7727aca37cd8d2e7e4b2d`. Original inspected files remain under `public/source/`; native model under `src/native/model/`. Supplied ERD Workbench 0.2.4 HTML remains unchanged; native format version is distinct. Licenses/notices retained in `NOTICE.md` and `public/fonts/`.

Browser audit covered all 18 game Advanced sections / 136 groups, with representative reversible mutations. Individual values across thousands of controls were not exhaustively mutated. Physical touch, screen readers, full campaign gameplay, Windows game runtime execution, and the private Workshop remain unverified. Native scene playback, card updates, isolated combat damage, fullscreen, and consolidated delivery are checked separately. Native document save/build integration and actual native settings validation are tested separately from browser UI.
