# AshenedSpire Editor Instructions

## AshenSpire direction

User expanded scope to GitHub repository integration, adding repositories, file hierarchy, and game builds. Project tools now owns Repositories / Files / Builds. Keep server-managed isolated checkouts separate from authoring snapshots. Repository text writes require explicit save and revision checks; builds use declared package scripts and show real job logs and artifacts. Existing host Git credentials stay outside browser input. Do not imply private repositories are connected before clone succeeds. GitHub connection and remote publication now skipped at user request. Keep CI/Pages templates ready; do not create or publish remote repo. Local main/test/dev branches remain requested. User explicitly permits dividing work across as many agents as needed.

The user approved building the parent motif and wireframes shown in `design/AshenSpire-Parent-Design.pdf`, and requested ERD Workbench 0.2.4. Preserve the charcoal tool shell, warm paper card surface, ember gold selection, nine workspace navigation, shared library/canvas/inspector pattern, and separate Battlefield Lab. Use actual source records and assets; label proposals and disconnected engine/host features explicitly. Prefer concise, plain progress updates. Latest user steering supersedes prior remote destination: do not connect GitHub or publish. Latest user correction on October 1, 2026: the account requirement was a misunderstanding. Pause owner setup, login, logout and password UI for now; open authoring directly. Local checkout access uses automatic local browser sessions and same-origin CSRF protections, with no new credentials or account-store changes. Static/public builds stay draft-only and cannot access the local host. Do not re-enable accounts without an explicit user request.

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Editor acceptance

Editor name AshenedSpire; core game remains AshenSpire. Top bar uses File / Edit / View / Build / Window / Help with real actions and keyboard navigation. Browser audit must distinguish draft authoring from checkout file writes and game runtime integration. Report observations and restrictions grouped by content, presentation, settings, source control, verification, interchange, and delivery. Accounts are paused. Local host sessions scope checkout access and sandboxed build previews; static Pages previews remain public draft authoring.

## Local editor expansion

Latest delivery decision: publish consolidated single-file HTML builds from `test` to `https://cehinds.github.io/AshenedSpire-Editor/test/<run-number>-<attempt>/` using the existing GitHub repository and Pages workflow. This supersedes the earlier pause on remote publication for editor previews. Preserve immutable build history and channel latest links. Embed application code, CSS, fonts, art, source snapshots, and native ERD in `dist/pages/index.html`; keep local host and Sites outputs separate. Static previews remain public draft authoring without account or Git/build host security.

Visible repository tools now import ordinary local Git directories into isolated checkouts, with no remote connection; protected branch creation/switch/merged-only deletion are explicit. File menu includes real XLSX/CSV exports and native Tags/Scenes/UI document load/review/revision save. Cards and named wireframes have reviewed draft creation. Project Game settings preserves the native profile and uses explicit native settings-defaults promotion on supported local game checkouts. Keep renderer and private combat limits visible; no mock execution or credential entry.

## Live preview direction

The user expects a visible Play preview control above Scenes composition and an In game tab in every workspace. Previews should use actual AshenSpire renderers and respond to current draft edits. Keep the existing charcoal/gold layout, selected-record inspector, and explicit checkout saves. Show applied preview state and unsupported adapters accurately; do not equate a static layout or draft-only imitation with running the game.

## Scene studio visual direction

The user supplied `design/scene-studio-reference.png` as the target look and feel for the Scenes editor. Favor a dense charcoal scene studio with compact menus/toolbars, a thumbnail scene rail, a large fitted landscape editing canvas, a slim tool strip, an adjacent mobile preview, a bottom layer timeline, and a selected-object inspector. Preserve ember gold emphasis and access to all nine workspaces; compact/collapse navigation in the scene workspace to prioritize the canvas. Aim for direct manipulation, real native transforms, responsive overrides, and synchronized playback rather than decorative controls. The reference is visual guidance, not proof that its depicted layer, audio, variant, or export features already exist. The user subsequently authorized building this direction through completion. Implement against native data and renderer boundaries, with real manipulation, scene seeking, and native cue audition; do not present unsupported arbitrary layers or seekable music as available.

## Card studio direction

October 1, 2026: card authoring must fit the available workspace so the complete card and preview controls do not require unnecessary scrolling. Keep the charcoal shell and warm readable paper card. Provide a visible Preview & edit in game action, artwork file drop/import and relative asset paths, direct manipulation of native card regions, explicit position/size/rotation/opacity controls, and layer reordering. Save/export the full card object with its native definition, artwork, transforms, layer order, and tags. Add card to game is a separate reviewed, revision-checked checkout action. Every assigned tag appears in the editor: game-hidden property tags use configurable muted gray; player-facing tags use category colors. Preserve native hidden defaults and allow explicit per-card presentation overrides. Describe editor layout overrides accurately where the game lacks a corresponding runtime adapter. All project edits, servers and outputs belong under D:/repos/AshenedSpire-Editor; Codex-installed skills and temporary attachments may be read from their existing C: locations.

## Movable editor layout

October 1, 2026: the user requested draggable menus and UI quality-of-life fixes, plus an independent agent audit of every button. Menus support movement, pinning, position reset, close, and existing keyboard navigation. The scene inspector can float, dock, hide and reopen; scene rail, inspector and timeline sizing are adjustable. Persist layout preferences separately from authoring records and provide recovery/reset controls. Audit action wiring and browser behavior across all workspaces, clearly distinguish exercised controls from source-reviewed or host-restricted actions, and fix navigation that unexpectedly mutates drafts.

## Editor density rule

October 1, 2026: use available horizontal space before adding subrows. Keep related text, options, inputs and buttons together on compact rows; consolidate secondary commands into labeled dropdowns. Avoid tall nested toolbars, repeated headings and redundant descriptions that crowd out the visualization. Keep primary actions visible, input labels readable, keyboard access intact, and responsive wrapping deliberate. Apply this rule across editor workspaces without removing supported controls.

## Worktree storage

October 1, 2026: all new Codex worktrees belong under `D:/repos/.codex/worktrees`. Do not store checkout data on C:. The former `C:/Users/suprbludude/.codex/worktrees` path is now a junction to that D: directory. Old C: checkouts were deleted to recover disk space; their HEAD commits and uncommitted work were preserved under `.workbench/worktree-cleanup-20261001` and recovery refs in the original repositories. Notify existing agents of this requirement before assigning worktree work.

## Card inspector direction

Table / Form / JSON / Prompt inspector choices are independent of the canvas Visual / In game choice. Place New card in the second toolbar row, outside the canvas. All views share the same live, valid authoring draft; Table Inspect selects the corresponding record for the inspector and canvas. Form expands into a clickable card wireframe, with the selected region’s editable details in the inspector. Keep related controls in compact rows and use a labeled section dropdown. Preserve proposal reviews, invalid-input safeguards, explicit checkout saves and the distinction between preview state and saved game source.
