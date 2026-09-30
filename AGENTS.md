# AshenedSpire Editor Instructions

## AshenSpire direction

User expanded scope to GitHub repository integration, adding repositories, file hierarchy, and game builds. Project tools now owns Repositories / Files / Builds. Keep server-managed isolated checkouts separate from authoring snapshots. Repository text writes require explicit save and revision checks; builds use declared package scripts and show real job logs and artifacts. Existing host Git credentials stay outside browser input. Do not imply private repositories are connected before clone succeeds. GitHub connection and remote publication now skipped at user request. Keep CI/Pages templates ready; do not create or publish remote repo. Local main/test/dev branches remain requested. User explicitly permits dividing work across as many agents as needed.

The user approved building the parent motif and wireframes shown in `design/AshenSpire-Parent-Design.pdf`, and requested ERD Workbench 0.2.4. Preserve the charcoal tool shell, warm paper card surface, ember gold selection, nine workspace navigation, shared library/canvas/inspector pattern, and separate Battlefield Lab. Use actual source records and assets; label proposals and disconnected engine/host features explicitly. Prefer concise, plain progress updates. Latest user steering supersedes prior remote destination: do not connect GitHub or publish. Add real local username/password authentication; no default credentials, browser-stored passwords, or mock security gates.

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Editor acceptance

Editor name AshenedSpire; core game remains AshenSpire. Top bar uses File / Edit / View / Build / Window / Help with real actions and keyboard navigation. Browser audit must distinguish draft authoring from checkout file writes and game runtime integration. Report observations and restrictions grouped by content, presentation, settings, source control, verification, interchange, and delivery. Authentication requires server-side hashes and sessions; static Pages previews cannot provide password security.

## Local editor expansion

Latest delivery decision: publish consolidated single-file HTML builds from `test` to `https://cehinds.github.io/AshenedSpire-Editor/test/<run-number>-<attempt>/` using the existing GitHub repository and Pages workflow. This supersedes the earlier pause on remote publication for editor previews. Preserve immutable build history and channel latest links. Embed application code, CSS, fonts, art, source snapshots, and native ERD in `dist/pages/index.html`; keep authenticated local and Sites outputs separate. Static previews remain public draft authoring without account or Git/build host security.

Visible repository tools now import ordinary local Git directories into isolated checkouts, with no remote connection; protected branch creation/switch/merged-only deletion are explicit. File menu includes real XLSX/CSV exports and native Tags/Scenes/UI document load/review/revision save. Cards and named wireframes have reviewed draft creation. Project Game settings preserves the native profile and uses explicit native settings-defaults promotion on supported local game checkouts. Keep renderer and private combat limits visible; no mock execution or credential entry.
