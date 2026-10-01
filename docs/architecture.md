# AshenedSpire Editor architecture

Editor brand is AshenedSpire. Referenced game source remains `cehinds/AshenSpire`; changing editor name does not rename original game repository or native engine contracts.

## Folder map

| Path | Owner and contents | Runtime |
|---|---|---|
| `src/App.jsx` | Shared shell, desktop File/Edit/View/Build/Window menus, workspace state and recovery | Browser |
| `src/Views.jsx` | Cards, Decks, Tags/ERD, Scenes, Battlefield, UI, Poses, Combat and Project panels | Browser |
| `src/InGamePreview.jsx`, `src/NativePreviewFrame.jsx` | Workspace preview routing and script-only sandboxed frames with applied-draft acknowledgements | Browser |
| `src/ScenePreview.jsx`, `src/GameCardPreview.jsx`, `src/GameRuntimePreview.jsx` | Native scene/card rendering and isolated playable combat with current drafts | Browser |
| `src/RepositoryWorkspace.jsx` | Connected repository list, file hierarchy/editor, build jobs and previews | Browser; calls local host with session |
| `src/core.mjs` | Authoring state, validation, import/export, undo/redo helpers | Browser and domain tests |
| `src/NativeDocumentBridge.jsx` | Reviewed native source load/save with current revision and retained metadata | Local host with session |
| `src/GameSettings.jsx` | Native settings JSON and explicit defaults promotion | Browser; promotion uses local host with session |
| `src/LocalBranches.jsx` | Local branch creation, switching and safe deletion | Local host with session |
| `src/xlsx.js` | Genuine Excel ZIP/Office Open XML export; typed tabular cells and safe string handling | Browser and byte-level tests |
| `src/native/` | Retained native presentation model and generated configuration | Browser |
| `src/native/game-preview/` | Bundled game renderer snapshot, runtime, assets map and provenance | Browser build input |
| `src/sources/` | Inspected authoring source snapshots used by local drafts | Browser build input |
| `public/assets/`, `public/fonts/` | Source-art previews and local fonts | Static |
| `public/native/` | Independent ERD Workbench 0.2.4 document | Static iframe/full window |
| `public/source/` | Readable original inspected source snapshots | Static |
| `public/responsive-preview.html` | Fixed phone/tablet/desktop viewport wrapper | Static |
| `server/auth-host.mjs` | Automatic loopback sessions; retained explicit password-mode host and tests | Node host |
| `server/github-account.mjs` | Optional GitHub CLI authorization through the OS default browser; allowlisted account status | Node host |
| `server/workspace-host.mjs` | Session-guarded local imports, protected local branches, isolated checkouts, safe file access, native settings promotion and build processes | Node host |
| `tests/` | Domain, authentication, repository/security, packaging and publication checks | Node test runner |
| `scripts/` | Build verification, source review, optional deployment preparation | Local Node or CI runner |
| `.github/` | CI and Pages workflows, review routing/template, dependency updates | GitHub Actions |
| `docs/` | Architecture and CI/CD contracts | Documentation |
| `design/` | Approved source design reference | Documentation |
| `worker/` | Optional Sites static wrapper | Optional hosting runtime |
| `.openai/hosting.json` | Optional Sites build metadata | Build input |
| `.workbench/` | Local account data and managed repository checkouts | Private local storage; Git ignored |
| `dist/` | Generated local client HTML/assets, optional Sites wrapper, and consolidated static `pages/index.html` | Build output; Git ignored |

Folders separate by runtime and responsibility. `main`, `dev`, and `test` are Git branches, not duplicated source folders. Each branch uses same layout. Build numbers belong in generated deployment history, preserving one source tree.

## Data boundaries

| Data | Stored where | Writes |
|---|---|---|
| Browser authoring draft | Browser local storage | Explicit authoring edits; recoverable undo/redo |
| Imported authoring package | Browser state | Validated before applying; no automatic checkout writes |
| Local session state | Local authentication host | Automatic loopback session; no editor account required |
| GitHub credentials | GitHub CLI host storage | Optional authorization in the OS default browser; no password/token input or storage in editor frontend |
| Local Git transfer | Ordinary local source directory | No remote fetch/pull/push for local import |
| Repository registration and checkouts | Ignored `.workbench/` | Local host creates isolated clones after checking session |
| Checkout text files | Managed checkout | Explicit save with session and revision checks |
| Game build outputs | Managed checkout build folders | Real declared/native build process; logs and verified generation tracked |
| In game preview state | Script-only sandboxed frame | Current draft inputs acknowledged by revision; no checkout writes or persistent game saves |
| Published editor snapshot | Optional Pages HTML/artifact history | CI copies validated static output; no authentication database or checkout directories |

Exports stay separate from game source. Native document bridge loads existing Tags/Scenes/UI documents, preserves their metadata, then explicitly saves a reviewed revision. Native settings promotion invokes the selected checkout’s actual validator and writes its promoted defaults. Other draft modes remain separate. File saves modify isolated checkouts. Build jobs use those checkouts; no implicit commit, push, merge or engine import occurs.

## Local sessions, GitHub and offline mode

Vite sets `authOptions.requireLogin: false`. The local host automatically issues a loopback-only session through `/api/auth`; no editor account or sign-in gate is required. Session guards protect `/api/workbench` repository, file and build operations. Account opens optional GitHub authorization through GitHub CLI and the OS default browser. The frontend receives allowlisted status and a one-time device code, never a GitHub password or token. Authorization alone does not mark a repository connected; its clone must succeed.

The password-mode authentication library remains available for explicitly configured hosts and tests. It is separate from the default editor UI:

| Account boundary | Behavior |
|---|---|
| Initial account | Only explicit password mode has a local owner; no default credentials or local account UI |
| Password | Legacy password mode: 5–128 characters; UTF-8 encoding bounded to 512 bytes |
| Password storage | Legacy password mode: scrypt hash with random 16-byte salt; `.workbench/auth.json` written atomically with requested owner-only `0600` permissions |
| Session | Eight-hour absolute lifetime; server restart revokes in-memory sessions |
| Cookie | `HttpOnly`, `SameSite=Strict`; `Secure` added when connection uses actual Transport Layer Security (TLS) |
| Request protection | Same-origin checks and Cross-Site Request Forgery (CSRF) token on mutations; account JSON body bounded to 8 KiB |
| Failed logins | Legacy password mode: five failures per client Internet Protocol (IP) address per 15 minutes, then HTTP 429 |
| Password change | Legacy password mode: current password required; previous sessions and preview capabilities revoked |
| Built-game iframe | Narrow 15-minute preview capability bound to local session, repository and verified build generation; sandbox restrictions retained |

Password-free editor access requires loopback; it is not a public-host authentication mode. Private hosted access requires TLS and an appropriately authenticated backend deployment; it is outside static Pages templates. Private-path restrictions and checkout isolation apply independently of the sign-in UI.

Offline authoring mode is an explicit static build target (`npm run build:pages`, `VITE_EDITOR_RUNTIME=static`). Browser authoring and bundled native game previews remain available there; GitHub authorization, local repository operations and new checkout game builds do not. Native scene/card rendering and isolated combat run the committed snapshot, separately from checkout saves and builds. An unavailable local host does not grant repository access or turn backend operations into successful actions. See [preview behavior and limits](in-game-preview.md).

GitHub Pages cannot enforce password authentication. Published bundles, native tools and source snapshots are public static files. Private remote access would require an authenticated backend and access-controlled asset delivery. Local session protection is not a claim that exported HTML or public Pages files are private.

## Local source flow

Feature work enters `dev`, accepted candidates enter `test`, stable editor enters `main`. Fast checks verify source before promotion. The approved delivery publishes consolidated HTML from `test` through the existing repository's Pages workflow, preserving immutable numbered builds and channel latest links. Consolidation includes the native game preview runtime and assets; local and Sites outputs remain separate. See [CI/CD](ci-cd.md) for workflow permissions, build URLs and timing limits.
