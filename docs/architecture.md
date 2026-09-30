# AshenedSpire Editor architecture

Editor brand is AshenedSpire. Referenced game source remains `cehinds/AshenSpire`; changing editor name does not rename original game repository or native engine contracts.

## Folder map

| Path | Owner and contents | Runtime |
|---|---|---|
| `src/App.jsx` | Shared shell, desktop File/Edit/View/Build/Window menus, workspace state and recovery | Browser |
| `src/Views.jsx` | Cards, Decks, Tags/ERD, Scenes, Battlefield, UI, Poses, Combat and Project panels | Browser |
| `src/RepositoryWorkspace.jsx` | Connected repository list, file hierarchy/editor, build jobs and previews | Browser; calls authenticated local host |
| `src/core.mjs` | Authoring state, validation, import/export, undo/redo helpers | Browser and domain tests |
| `src/NativeDocumentBridge.jsx` | Reviewed native source load/save with current revision and retained metadata | Authenticated local host |
| `src/GameSettings.jsx` | Native settings JSON and explicit defaults promotion | Browser; promotion uses authenticated host |
| `src/LocalBranches.jsx` | Local branch creation, switching and safe deletion | Authenticated local host |
| `src/xlsx.js` | Genuine Excel ZIP/Office Open XML export; typed tabular cells and safe string handling | Browser and byte-level tests |
| `src/native/` | Retained native presentation model and generated configuration | Browser |
| `src/sources/` | Inspected authoring source snapshots used by local drafts | Browser build input |
| `public/assets/`, `public/fonts/` | Source-art previews and local fonts | Static |
| `public/native/` | Independent ERD Workbench 0.2.4 document | Static iframe/full window |
| `public/source/` | Readable original inspected source snapshots | Static |
| `public/responsive-preview.html` | Fixed phone/tablet/desktop viewport wrapper | Static |
| `server/auth-host.mjs` | Local editor account, password verification, sessions and account APIs | Node host |
| `server/workspace-host.mjs` | Authenticated local imports, protected local branches, isolated checkouts, safe file access, native settings promotion and build processes | Node host |
| `tests/` | Domain, authentication, repository/security, packaging and publication checks | Node test runner |
| `scripts/` | Build verification, source review, optional deployment preparation | Local Node or CI runner |
| `.github/` | Workflows, review routing/template, dependency updates | GitHub Actions |
| `docs/` | Architecture and CI/CD contracts | Documentation |
| `design/` | Approved source design reference | Documentation |
| `worker/` | Optional Sites static wrapper | Optional hosting runtime |
| `.openai/hosting.json` | Optional Sites build metadata | Build input |
| `.workbench/` | Local account data and managed repository checkouts | Private local storage; Git ignored |
| `dist/` | Generated client HTML/assets and optional Sites wrapper | Build output; Git ignored |

Folders separate by runtime and responsibility. `main`, `dev`, and `test` are Git branches, not duplicated source folders. Each branch uses same layout. Build numbers belong in generated deployment history, preserving one source tree.

## Data boundaries

| Data | Stored where | Writes |
|---|---|---|
| Browser authoring draft | Browser local storage | Explicit authoring edits; recoverable undo/redo |
| Imported authoring package | Browser state | Validated before applying; no automatic checkout writes |
| Local editor account and session state | Local authentication host | Account setup, login, logout and password change |
| Local Git transfer | Ordinary local source directory | No remote fetch/pull/push or GitHub account connection |
| Repository registration and checkouts | Ignored `.workbench/` | Authenticated host creates isolated clones |
| Checkout text files | Managed checkout | Explicit authenticated save with revision comparison |
| Game build outputs | Managed checkout build folders | Real declared/native build process; logs and verified generation tracked |
| Published editor snapshot | Optional Pages HTML/artifact history | CI copies validated static output; no authentication database or checkout directories |

Exports stay separate from game source. Native document bridge loads existing Tags/Scenes/UI documents, preserves their metadata, then explicitly saves a reviewed revision. Native settings promotion invokes the selected checkout’s actual validator and writes its promoted defaults. Other draft modes remain separate. File saves modify isolated checkouts. Build jobs use those checkouts; no implicit commit, push, merge or engine import occurs.

## Authentication and offline mode

Local host exposes `/api/auth` for editor account setup and login. Session guards protect `/api/workbench` repository, file and build operations. Editor account credentials are independent of GitHub credentials.

| Account boundary | Behavior |
|---|---|
| Initial account | One local owner; explicit first setup, no default credentials |
| Password | 12–128 characters; UTF-8 encoding bounded to 512 bytes |
| Password storage | scrypt hash with random 16-byte salt; `.workbench/auth.json` written atomically with owner-only `0600` permissions |
| Session | Eight-hour absolute lifetime; server restart revokes in-memory sessions |
| Cookie | `HttpOnly`, `SameSite=Strict`; `Secure` added when connection uses actual Transport Layer Security (TLS) |
| Request protection | Same-origin checks and Cross-Site Request Forgery (CSRF) token on account mutations; account JSON body bounded to 8 KiB |
| Failed logins | Five failures per client Internet Protocol (IP) address per 15 minutes, then HTTP 429 |
| Password change | Current password required; previous sessions and preview capabilities revoked |
| Built-game iframe | Narrow 15-minute preview capability bound to authenticated session, repository and verified build generation |

Local loopback HTTP is supported. Private hosted access requires TLS and authenticated backend deployment; it is outside static Pages templates.

Offline authoring mode is an explicit static build target (`npm run build:pages`, `VITE_EDITOR_RUNTIME=static`). Browser authoring remains available there; account login, authenticated repository operations and real game builds do not. Default local build keeps account gate and never treats an unavailable authentication host as successful login. Offline mode does not turn unavailable backend operations into successful actions.

GitHub Pages cannot enforce password authentication. Published bundles, native tools and source snapshots are public static files. Private remote access would require an authenticated backend and access-controlled asset delivery. Local account gate is not a claim that exported HTML or public Pages files are private.

## Local source flow

Feature work enters `dev`, accepted candidates enter `test`, stable editor enters `main`. Fast checks verify source before promotion. The Pages workflow publishes each channel into versioned folders with consolidated HTML and immutable history. See [CI/CD](ci-cd.md) for exact workflow permissions, build URLs and timing limits.
