# AshenedSpire Editor Instructions

## AshenSpire direction

User expanded scope to GitHub repository integration, adding repositories, file hierarchy, and game builds. Project tools now owns Repositories / Files / Builds. Keep server-managed isolated checkouts separate from authoring snapshots. Repository text writes require explicit save and revision checks; builds use declared package scripts and show real job logs and artifacts. Existing host Git credentials stay outside browser input. Do not imply private repositories are connected before clone succeeds. Account UI is paused by the latest user correction; do not request editor or GitHub credentials. Existing host GitHub credentials stay outside the editor. No GitHub password or token is entered or stored by the editor frontend. Keep CI/Pages workflow support in the existing repository. Preserve dev → test → main promotion. User explicitly permits dividing work across as many agents as needed.

The user approved building the parent motif and wireframes shown in `design/AshenSpire-Parent-Design.pdf`, and requested ERD Workbench 0.2.4. Preserve the charcoal tool shell, warm paper card surface, ember gold selection, nine workspace navigation, shared library/canvas/inspector pattern, and separate Battlefield Lab. Use actual source records and assets; label proposals and disconnected engine/host features explicitly. Prefer concise, plain progress updates. Latest account clarification: opening and using the local editor must not require an editor account or sign-in. Vite uses `authOptions.accountsPaused: true` for automatic loopback-only local sessions; retain cookies, CSRF/origin checks, private-path protections and preview sandboxing. The legacy password-mode library remains for explicit hosts/tests, with a five-character minimum and server-side password hashes; do not expose a local account UI.

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

Table / Form / JSON / Prompt inspector choices are independent of the canvas Visual / In game choice. Place New card inline in the workspace toolbar, outside the canvas. All views share the same live, valid authoring draft; Table Inspect selects the corresponding record for the inspector and canvas. Form expands into a clickable card wireframe, with the selected region’s editable details in the inspector. Keep related controls in compact rows and use a labeled section dropdown. Preserve proposal reviews, invalid-input safeguards, explicit checkout saves and the distinction between preview state and saved game source.

## Account pause and reconnect

October 1, 2026: the account requirement was a misunderstanding. Pause Account, setup, login, logout and password UI. Authoring opens directly; automatic loopback sessions retain origin/CSRF, path, revision, branch and sandbox-preview guards. Leave prior credential stores unread and unchanged. Static/public previews are draft-only and never request local host access. Session renewal retains drafts and refreshes checkout tokens; native settings promotion requires fresh target review. Do not re-enable accounts without a user request. New worktrees belong under D:/repos/.codex/worktrees.

October 1, 2026 toolbar refinement: consolidate the workspace title, Visual / In game tabs and draft actions inline when width permits. Use a + icon with New card hover and accessible labels, familiar Undo / Redo icons, and compact panel icons. Remove redundant preview-caption rows. Card in game, Upgraded and fullscreen controls also share one compact row; move the Escape hint to the fullscreen hover label. Wrap deliberately when space is insufficient.

October 1, 2026 collapsed-layout direction: replace button rails that would need horizontal scrolling with labeled dropdowns, merged into an existing related row. Mobile workspace navigation and secondary actions belong in the workspace toolbar; inspector editing mode belongs beside its heading. Preserve wide inline controls and pose thumbnails when they fit, primary actions, keyboard access, and real handlers.

All new configurable Codex home state, skills, caches, sessions and authoring outputs belong under D:/repos/.codex. New worktrees belong under D:/repos/.codex/worktrees. Preserve live storage and recovery records; do not repeat an in-progress migration from this chat.

October 1, 2026: workspace titles must remain readable in full. Remove reserved badge padding from the compact toolbar; allow deliberate wrapping when needed instead of truncating the selected card name.

October 1, 2026: collapsed/tablet preview modes show only the current option and a dropdown arrow. Keep history, creation and panel access on that same toolbar row; prevent panel icons wrapping onto a separate row.

October 1, 2026: card toolbar follows the user's compact [+] / full card name / [current library option ▾] layout, with previous/next card controls and a Visual/In game switch. The same Library launcher opens and closes its panel, including wide layouts. Card view zoom is live, with Fit recovery; an Upgraded checkbox sits at the top right instead of separate Base/Upgrade buttons. View zoom and upgrade selection stay outside authored records and undo history and remain synchronized between Visual and native In game previews. Collapse secondary commands into the existing workspace menu when space is limited.

October 1, 2026: keep zoom, Fit and Upgraded together without a spacer gap. Paper and native card previews use a fixed 5:7 ratio by default and scale uniformly. Ratio width/height are editable inspector presentation overrides, retained in whole-project exports, with a reset to 5:7; they do not imply native checkout settings promotion. Expanded anatomy remains an editable wireframe rather than a physical card face.

October 1, 2026: checked card preview switch means In game. Visual defaults to a clickable wireframe matching the native card's name, costs, artwork, tags, rules and footer order; keep the warm Paper appearance as an optional inspector view. Show Base/Upgraded state in the footer instead of duplicating the card ID/name. Upgraded state is visible in both wireframe values and footer.

October 1, 2026: Visual card editing must use the actual native renderer, matching In game one to one. Native part handles support dragging with grid snapping, configurable rotation intervals, middle-button card panning, multi-selection/groups, independent layers, text alignment and per-part artwork/background flags. Preserve native default layout until an authored override is applied. Warm paper is an optional theme on that same renderer, not a separate card imitation. Inspector Layout contains these editable parts; whole-project export retains validated presentation sidecars, and checkout promotion remains an explicit supported-adapter action.
## Scene studio visual direction

The user supplied `design/scene-studio-reference.png` as the target for the Scenes editor and authorized building it through completion. Preserve a dense charcoal studio, compact toolbar, thumbnail rail, fitted native canvas, tool strip, adjacent mobile preview, bottom timeline and selected-object inspector. Use native transforms, responsive overrides, synchronized seeking and cue audition. Do not imply arbitrary layers or seekable music are supported. Keep Play, Pause/Resume, Restart and Stop visible.

## Movable editor layout

The user requested draggable menus and UI quality-of-life fixes plus an independent agent button audit. Menus support dragging, pinning, reset, close and keyboard navigation. The scene inspector floats, docks, hides and reopens; rail, inspector and timeline sizes are adjustable. Persist layout separately from authoring records and provide reset/recovery. Distinguish browser-tested, source-reviewed and host-restricted controls; navigation must not mutate drafts.

## Master default scene controls

October 1, 2026: beside Scenes, offer Master default with component subsections for settings shared by every scene, including text-box height in vh. Preserve local scene overrides and native source boundaries. Scene transport uses icons in Restart, Play/Pause/Resume, Stop order with hover titles and accessible labels; put the canvas size/device selector at the far right.

## Battlefield studio direction

October 2, 2026: the earlier Battlefield Lab sliders were arithmetic only and never reached the renderer. Battlefield now edits real native stores against the vendored renderer at a chosen device size: w4a formation fit/spacing (`p.ui`, native UI document save), `gameConfig.presentation.*` figure, row, formation, column, grid, layer and spawn settings (Game settings profile / defaults promotion), and `balance.ui.combatantStage` tokens (preview and export only; no checkout adapter). Canvas guides come from measured native layout; drag a figure to move its column offsets and its top handle to resize player/enemy sprite scale, one undoable edit per release. Device, encounter, class, guides and grid are view choices outside authored records and undo. Sizing diagnostics and Compare report measured clipping, minimum-height and overlap issues per device. Vendored combat CSS fixes screen rows at 10/45/45% (10/55/35% below 700px), overriding w4a bands; authored rows (`p.lab.rows`, drag the Battlefield / hand bar) are a labeled preview/export proposal. Guides use native alpha-trimmed visible height, formation cell and fit scale. Arrow keys nudge column offsets (Shift ×10) and + / − step sprite scale; each key burst commits as one undoable edit.

## Scene sequence playback

October 2, 2026: Scenes transport includes Play all (active scenes in order, auto-advancing through the native renderer; Stop or choosing a rail scene ends it; Pause/Resume continues the sequence). The timeline offers Timeline (selected scene) and All scenes scopes; All scenes lays every active scene's Scenes, Dialogue, Traveller, Background and Audio cue tracks end to end with a global playhead, click-to-seek across scenes, clip selection into the inspector, and draggable/keyboard scene duration edges recorded as undoable draft edits.
