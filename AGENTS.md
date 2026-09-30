# AshenedSpire Editor Instructions

## AshenSpire direction

User expanded scope to GitHub repository integration, adding repositories, file hierarchy, and game builds. Project tools now owns Repositories / Files / Builds. Keep server-managed isolated checkouts separate from authoring snapshots. Repository text writes require explicit save and revision checks; builds use declared package scripts and show real job logs and artifacts. Existing host Git credentials stay outside browser input. Do not imply private repositories are connected before clone succeeds. Account is for optional GitHub authorization through the operating system's default browser and GitHub CLI host credentials. No GitHub password or token is entered or stored by the editor frontend. Keep CI/Pages workflow support in the existing repository. Preserve dev → test → main promotion. User explicitly permits dividing work across as many agents as needed.

The user approved building the parent motif and wireframes shown in `design/AshenSpire-Parent-Design.pdf`, and requested ERD Workbench 0.2.4. Preserve the charcoal tool shell, warm paper card surface, ember gold selection, nine workspace navigation, shared library/canvas/inspector pattern, and separate Battlefield Lab. Use actual source records and assets; label proposals and disconnected engine/host features explicitly. Prefer concise, plain progress updates. Latest account clarification: opening and using the local editor must not require an editor account or sign-in. Vite uses `authOptions.requireLogin: false` for automatic loopback-only local sessions; retain cookies, CSRF/origin checks, private-path protections and preview sandboxing. The legacy password-mode library remains for explicit hosts/tests, with a five-character minimum and server-side password hashes; do not expose a local account UI.

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Editor acceptance

Editor name AshenedSpire; core game remains AshenSpire. Top bar uses File / Edit / View / Build / Window / Help with real actions and keyboard navigation. Browser audit must distinguish draft authoring from checkout file writes and game runtime integration. Report observations and restrictions grouped by content, presentation, settings, source control, verification, interchange, and delivery. Local access uses a server-managed session without a sign-in gate; optional GitHub authorization is separate from editor access. Static Pages previews cannot provide password security or local Git/build access.

## Local editor expansion

Pages supports consolidated single-file HTML builds from `test` at `https://cehinds.github.io/AshenedSpire-Editor/test/<run-number>-<attempt>/` using the existing GitHub repository and Pages workflow. Preserve immutable build history and channel latest links. Embed application code, CSS, fonts, art, source snapshots, and native ERD in `dist/pages/index.html`; keep local session and Sites outputs separate. Static previews remain public draft authoring without account or Git/build host security.

Visible repository tools import ordinary local Git directories into isolated checkouts; local-folder import requires no remote connection. Protected branch creation/switch/merged-only deletion are explicit. File menu includes real XLSX/CSV exports and native Tags/Scenes/UI document load/review/revision save. Cards and named wireframes have reviewed draft creation. Project Game settings preserves the native profile and uses explicit native settings-defaults promotion on supported local game checkouts. Keep renderer and private combat limits visible; no mock execution or editor credential entry.
