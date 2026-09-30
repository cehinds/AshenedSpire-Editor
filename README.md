# AshenedSpire Editor

Local game-authoring editor with nine workspaces, native ERD Workbench 0.2.4, and Visual Studio-style File / Edit / View / Build / Window / Help menus. No editor account or sign-in is required. Core game's name remains **AshenSpire**.

## Run

Requires Node.js 22+ and Git for local checkout operations. Add an ordinary local Git repository folder through Project tools; the editor copies committed files into its own isolated checkout. Uncommitted source-directory edits are not imported. No GitHub connection is required.

```sh
npm ci
npm run dev
```

Open Vite's printed localhost URL. The local host automatically establishes a loopback-only session. Account is for optional GitHub authorization: GitHub CLI opens the operating system's default browser and keeps credentials on the host. No GitHub password or token is entered or stored in the editor frontend. GitHub authorization does not connect a repository; a checkout is connected only after its clone succeeds.

`npm run preview` serves production build with the same automatic local session. `/responsive-preview.html` shows phone/tablet/desktop editor. Server binds loopback by default. Hosted static preview explicitly opens draft-only authoring; static files do not provide password security or local Git/build access.

## Folder structure

| Folder | Responsibility |
|---|---|
| `src/` | Editor shell, menus, GitHub account UI, authoring workspaces |
| `server/` | Local sessions, optional GitHub CLI authorization, retained password-mode library; isolated repository, text-file, and build host |
| `public/` | Game snapshot assets, fonts/licenses, native ERD, responsive harness |
| `tests/` | Domain behavior, authentication, Git/file/build operations, Pages publication |
| `scripts/` | Fast source review, build checks, static packaging, versioned publication |
| `.github/` | CI/CD templates, pull request checklist, ownership, dependency updates |
| `docs/` | Pipeline contract and grouped tool audit |
| `design/` | Original approved parent design reference; predates renamed menu/auth extensions |
| `worker/` | Optional static Sites wrapper; does not replace local session/Git host |
| `.workbench/` | Ignored optional legacy owner store, isolated checkouts, verified build records |
| `dist/` | Ignored generated build |

Source branches: **main**, **test**, **dev**, promoted through dev → test → main. Site publication remains paused and the remote Pages workflow is disabled. CI/Pages files remain ready; GitHub account authorization does not publish a site.

## What each mode can do

| Workspace | Implemented | Boundary |
|---|---|---|
| Cards | Create reviewed cards from native templates; edit inspected Rogue definitions in form/JSON; visual base/upgrade; artwork sidecars | Draft definitions; native JavaScript card-source adapter remains unavailable |
| Decks | Add/remove owned sandbox copies, validate limits, confirm/cancel | Separate from runtime inventory/equipment/deck |
| Tags / ERD | Edit vocabulary rows; parent/cycle checks; CSV; imported-row mapping; native ERD 0.2.4; reviewed native CSV checkout saves | Native ERD history independent; labels do not grant mechanics |
| Scenes | Opening words, speaker, duration, sound identifiers, enabled/input fields, composition; reviewed native JSON checkout saves | Editor composition is not the full native renderer; build after saving |
| Battlefield | Normal/boss/selection sizing, explicit overflow/cap, device comparisons, JSON proposal | No applied formation/environment adapter |
| UI settings | Native combat config JSON; valid 100% layout bands; named wireframe snapshots/apply/export; reviewed native JSON checkout saves | Wireframes store geometry drafts; compiler/runtime verification uses the game build |
| Poses / effects | Native seven-pose sampler, playback controls, effect references/timing, bindings, structural validation | Effect art catalog and engine override disconnected |
| Combat workshop | Scenario/seed/ruleset proposal export | Real runner unavailable; Run remains disabled |
| Project tools | Local Git import, protected branch create/switch/delete, file tree/edit/save, jobs/artifacts; game settings JSON import/edit/export and reviewed native defaults promotion; CSV/JSON/XLSX | Local host session required for checkout writes/jobs; established automatically on loopback. CSV/XLSX exports are data tables; XLSX import is unavailable |

**Game work:** Open a local repository and create a branch before editing. File saves change its isolated checkout. For Tags, Scenes and UI, File → Load / save native checkout document loads current source into the draft, retains a receipt, and enables explicit review and revision-checked save after editing. Project → Game settings edits the native profile; reviewed promotion invokes the actual game validator and replaces promoted defaults, then requires a build. Builds runs checked-out commands and shows real outputs. Cards, battlefield and effect drafts still require native source adapters; private combat runner remains disconnected. See `docs/tool-audit.md` for grouped evidence and restrictions.

## Local access, GitHub and source ownership

Vite configures `authOptions.requireLogin: false`; loopback requests receive an automatic local session without an owner account. HttpOnly session cookies, expiry, same-origin requests and CSRF checks remain in place. Optional GitHub authorization runs through GitHub CLI and the default browser; host credentials stay outside the frontend. Local repository import copies committed files without contacting a remote. Bare repositories, linked worktrees, network shares and symlinked source directories are unsupported.

The retained authentication library supports password mode for explicitly configured hosts and tests: passwords are 5–128 characters, salted and hashed server-side, with session expiry and login throttling. The editor has no local account/password UI. `.workbench/` stays ignored.

Repo saves require explicit action and content revision checks. Unsaved buffers block navigation. Checkout operations are mutually locked during saves/builds. Symlinks, traversal, secrets, `.git`, and dependency internals are blocked. Build previews use sandboxed frames and generation-bound, short-lived artifact-only access tied to the local session. Job history is session-only; last verified artifacts persist and become stale after later builds.

Branch switching requires a clean checkout and no unsaved editor buffer; commit or resolve checkout changes with Git before switching. main/test/dev and current branch cannot be deleted; unmerged deletion is refused. No automatic commits, merges, pushes, or deployment. Draft Undo/Redo does not undo checkout file writes. Exported files and public static assets remain readable if published; authentication is not an encryption claim for exports.

## CI/CD

```sh
npm run review:quick
npm run build
npm test
WORKBENCH_BASE_PATH=/AshenedSpireEditor/dev/42-1/ npm run build:pages
```

Fast gate checks functionality, account/session behavior, Git safety, production compile, syntax, merge markers, credential patterns, pinned workflow actions, and publication history. Five-minute job timeout bounds execution after runner starts; queue, human/AI review, and merge waiting are excluded. Semantic code review remains separate from deterministic checks.

Feature → `dev` → `test` → `main` promotion. The prepared Pages workflow preserves numbered builds, channel `/latest/`, and shared history, but remote publication is disabled. GitHub Pages cannot run local session APIs or Git/build jobs. Full contract: `docs/ci-cd.md`.

## Provenance and validation limits

Game snapshot: `cehinds/AshenSpire`, `dev`, commit `38166cb12a2d8901fce7727aca37cd8d2e7e4b2d`. Original inspected files remain under `public/source/`; native model under `src/native/model/`. Supplied ERD Workbench 0.2.4 HTML remains unchanged; native format version is distinct. Licenses/notices retained in `NOTICE.md` and `public/fonts/`.

Browser audit covered all 18 game Advanced sections / 136 groups, with representative reversible mutations. Individual values across thousands of controls were not exhaustively mutated. Physical touch, screen readers, full gameplay, Windows runtime execution, full native renderer parity, private Workshop, and remote CI/deployment remain unverified. Native document save/build integration and actual native settings validation are tested separately from browser UI.
