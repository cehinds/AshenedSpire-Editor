# Card inspector action audit

## Native component editor follow-up

Visual and In game now share the native AshenSpire card renderer and a validated presentation adapter. Visual adds selection outlines and handles. Warm paper is an optional theme on that same renderer. Proportions stay fixed during uniform zoom; Fit resets zoom and view panning. Layout exposes native Name, Costs, Artwork, Tags, Type, Rules and Footer parts with offsets, size, rotation, opacity, visibility, alignment, groups, layers and per-part PNG/WebP backgrounds. List/Grid arrangement and alignment use acknowledged native measurements. Grid spacing and rotation intervals stay outside authoring history.

Browser verified on the consolidated nested-base build: native component selection; inspector offsets, rotation and alignment reflected in both views; keyboard snap movement and a custom 30-degree rotation interval; grouping; Grid arrangement; background import/visibility and component visibility. Native combat played successfully: Ambush reduced enemy HP from 30/30 to 23/30. No relevant console errors were captured. Six tests of the exact serialized installer cover pointer drag and middle-button pan; the browser tool declined a direct scaled-iframe drag because it could not safely map fractional coordinates, so those gestures are not claimed as mouse-tested.

Final functionality suite: 120 passing tests across runners, plus separate Sites packaging checks. Layout tests cover portable JSON, bounds, grouped snapping, ordering, native default/restoration and proportional combat scaling. Presentation sidecars are retained by whole-project export and applied in editor combat previews. No real user checkout file was written; checkout promotion remains separate and requires a supported adapter.

Audit date: October 1, 2026. Scope: `codex/card-inspector` isolated worktree. This is an action-group inventory across all nine workspaces, not a claim that every button was clicked in a browser. Delivery verification below reflects the completed local change.

Evidence labels:

- **Source-reviewed:** handler, state transition, validation, and applicable disabled state inspected.
- **Browser-tested:** exercised in the local preview by the main task, as listed below.
- **Automated host fixtures:** tests use controlled temporary repositories and host requests; they do not establish success against a user's checkout.
- **Unexercised:** no browser or real-checkout execution claimed by this audit.

## Content

| Workspace | Source-reviewed action groups | Result and evidence boundary |
| --- | --- | --- |
| Cards | Independent canvas/inspector selection; clickable wireframe and section selection; Table Inspect; Form/native definition fields; effect add/remove; JSON apply/reset; proposal review; New card review/cancel | Shared valid draft is used by canvas and inspector. Invalid input retains the last valid document. Browser-tested flows are enumerated under Verification. New-card creation, copied native classification/tags, rendering and Undo passed. |
| Decks | Collection/type selection; add/remove and drop a sandbox copy; validation; confirm deck; cancel session changes | Actions have handlers and owned-copy limits. Selection is distinct from deck mutation. Source-reviewed; not browser-tested in this audit. |
| Tags / ERD | Table/tree selection; label/parent edits; native ERD opening; native file/example import; page/entity/column mapping; overwrite review; apply mapped rows; CSV view | Fixed stale overwrite review: review is tied to mapping, supplied rows, source selection, and existing record contents. Unrelated project clones preserve review. New source loading clears review. Later card-tag presentation work requires its own verification. |

The Cards “Open animation bindings” action now only navigates; it no longer changes a binding. Card validation rejects malformed upgrade names/IDs, and the rules-font reset clears an invalid buffer when returning to the inherited value.

## Presentation

| Workspace | Source-reviewed action groups | Result and evidence boundary |
| --- | --- | --- |
| Scenes | Scene selection; native text/duration/actor fields; device/identity selection; Play, pause/resume, restart and stop | Native scene preview wiring inspected. This branch does not contain the separate primary-work scene studio's movable/resizable panels. No scene playback browser claim is made here. |
| Battlefield | Device and diagnostic/compare modes; scale, role, selection and overflow policy; JSON editing | Controls update an explicitly labeled sizing proposal. Geometry is not evidence of game runtime integration. |
| Poses & effects | Play/pause/restart; speed/loop/scrub; pose/clip selection; bindings; clip add/remove/timing; artwork replacement; JSON | Fixed artwork targeting: capture pose and sequence identity before asynchronous loading, use the latest draft, reject missing/removed targets, and never redirect to the newly selected pose. Source-reviewed; asynchronous browser reproduction remains unexercised. |

Top-bar menus, workspace navigation, library/inspector controls and fullscreen preview have action handlers. Menu keyboard navigation was source-reviewed. Draggable/pinned menus, position recovery, floating/docked scene inspector and panel sizing belong to separate primary-checkout work and are absent from this branch; this audit does not claim to have implemented or tested those controls.

## Settings

| Workspace | Source-reviewed action groups | Result and evidence boundary |
| --- | --- | --- |
| UI settings | Layout band edits and slack transfer; geometry comparison; native JSON; reviewed wireframe creation, apply, snapshot update and export | Native fields are retained; geometry previews and unsupported runtime adapters are described separately. Source-reviewed. |
| Project tools | Game-settings profile import/export; override editing/removal; compatibility view; reviewed native settings promotion; history and project review | Settings promotion requires the local host. Files/Builds navigation now carries the selected repository through shared navigation state. No promotion against a user's checkout was performed by this audit. |

Authoring opens without credentials. Owner setup, account/login/logout and password UI remain paused. Automatic local sessions and CSRF protection remain separate from draft authoring.

## Source control

Project Repositories / Files / Builds were source-reviewed: register/open/select an isolated local checkout; browse/refresh files; explicit revision-checked save/reload; dirty-buffer navigation review; branch create/switch/merged-only deletion; declared build/test scripts; reviewed dependency installation; cancellation, logs and verified artifact preview.

Automated fixture coverage is provided by `auth-host.test.mjs`, `workspace-host.test.mjs`, `local-branches.test.mjs` and `native-bridge-host.test.mjs`. These are controlled host checks, not browser acceptance or proof of a successful real game build. Actual user-checkout writes, branch changes, native promotion, builds and artifact execution are **unexercised** in this audit. Editor-driven remote connections and user-checkout publication remain unexercised. Delivery uses the existing repository pull-request and Pages workflow.

## Verification

| Workspace | Source-reviewed action groups | Result and evidence boundary |
| --- | --- | --- |
| Combat workshop | Scenario fields/prepared state; In game navigation; native encounter restart/class controls | Bundled native encounter wiring is present. Private Workshop service and game-save callbacks remain explicitly restricted. No full encounter playthrough is claimed. |

The main task browser-tested Cards wireframe clicks, the section dropdown, Form amount/cost/type edits, font reset, effect add/remove, Table Inspect, valid/invalid JSON and buffer reset, reviewed Prompt application, Undo/Redo, and creation Cancel/Escape. Reviewed new-card creation appeared in the actual native renderer with copied tags and was removed by Undo. Artwork import, fit selection, native artwork appearance and removal passed. Upgrade invalid-name rejection, remove/add and Undo passed. Narrow-screen section clicks opened visible editable fields at 390 × 844; the viewport was restored afterwards. No browser console errors were observed. Test-only card changes were restored.

The independent audit did not rerun tests. Final delivery checks passed: `npm test` (104 tests across its runners), `npm run test:sites` (4 tests), production build and Sites packaging, `npm run review:quick`, and `git diff --check`. The merge retains upstream checkout promotion protections and bounded Windows atomic-rename retries; its parent/symlink safety, collision and retry behavior have deterministic tests. Source review does not substitute for browser checks of downloads, asynchronous artwork races or every native engine control.

## Interchange

Source-reviewed actions include current-document/project export, CSV/XLSX export, validated package import, conflict recovery, and native Tags/Scenes/UI load → review → revision-checked save. Native ERD maintains its own document/history. Browser draft Undo is separate from checkout saves. Cards' native game-source writes and other unsupported adapters must not be implied by successful draft export.

## Delivery

This document records local validation evidence. Remote CI, merging and Pages publication must be confirmed separately before reporting delivery. The local preview is served on port 5174. Production packaging emitted `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`; protected Sites source files remain unchanged. Build output retains its existing large-bundle advisory. Published static previews support draft authoring, without local repository/build access. Keep local host, consolidated Pages and Sites outputs distinct.


Toolbar follow-up: workspace title, preview modes, draft history icons and + creation share a compact row. Card in game, upgrade and fullscreen controls share another row. Browser-tested: + review/cancel, live native name update, Undo/Redo, upgrade rendering, responsive dropdowns at 390 px, pose selection/seek, and Library reopening at 900 px. Widening restores inline preview tabs. Collapsed workspace navigation, canvas modes and secondary actions use dropdowns, while inspector mode lives beside its heading. No horizontal page overflow was observed at 390 px. Fullscreen/expanded preview and Escape exit were browser-tested. An editor expansion fallback keeps this control usable when browser fullscreen is unavailable. Test edits were restored.
