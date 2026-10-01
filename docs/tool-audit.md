# AshenedSpire Editor Tool Audit

Current implementation note, October 1, 2026: the local editor opens without an owner account or sign-in. Vite establishes automatic loopback-only sessions while retaining CSRF/origin checks, private-path protections and preview sandboxing. Account is for optional GitHub authorization through GitHub CLI and the OS default browser; GitHub passwords/tokens stay outside the editor frontend, and authorization does not connect a repository before its clone succeeds. Legacy password mode remains for explicit hosts/tests with a five-character minimum. In game tabs now use bundled native card/scene renderers and isolated native combat; see [preview behavior and limits](in-game-preview.md). The latest delivery decision authorizes consolidated HTML publication from `test` in the existing repository, superseding the earlier pause; dev → test → main promotion remains. The audit observations and screenshots below are historical evidence, including the former owner gate, disconnected previews and publication pause. They are not new browser verification of the current account or preview flow.

Dates: September 29–30, 2026. Cloud Chrome desktop viewport: 1363 × 936. Browser plugin unavailable; requested cloud-browser QA used `mcp__cua_repl` exclusively. No remote repository mutations, credentials, or source-file changes performed by this audit.

## Outcome and intended workflow

Editor must support complete local game-authoring loop:

1. Choose local repository and branch.
2. Load current source documents.
3. Create or update content, presentation and settings.
4. Validate documents and review changed files.
5. Save changes to isolated checkout.
6. Build HTML and playtest resulting game.
7. Export checkpoint; promote dev → test → main after checks.

Final editor supports reviewed card/wireframe creation, native settings JSON authoring, local branch controls, CSV/XLSX export commands, and selective native document adapters. Browser drafts, authenticated checkout writes and game execution remain distinct. Native settings promotion and Tags/Opening/UI adapters address part of the save/build workflow; cards, decks, effects, battlefield proposals and native ERD need additional integration. Renamed editor, toolbar and authentication checks are recorded separately below. GitHub connection and remote publication skipped under latest direction.

Status meanings: **PASS** means observed action and result; **PARTIAL** means useful authoring surface exists with stated boundary; **BLOCKED** means required workflow absent or unavailable; **UNVERIFIED** means evidence cannot establish completion.

## Baseline content authoring

| Mode | Checked action and observation | Status and restriction |
|---|---|---|
| Cards Visual and Form | Renamed Ambush to Ambush QA; field committed on blur; Visual and heading updated. Undo restored Ambush. | PASS draft edit. Limited to 47 inspected Rogue definitions. Dedicated create-card flow absent. |
| Cards JSON | Applied malformed JSON; parse error displayed, active card preserved. Restored original source buffer. | PASS last-valid-document safeguard. Raw JSON does not execute code. |
| Cards Table and Prompt | Table exposes definitions; Prompt accepts proposed JSON for review. | PARTIAL. Prompt never calls assistant; proposal-to-game adapter absent. Full proposal/import round trip unverified. |
| Deck Collection | Added selected owned copy; count changed 10 → 11. Undo restored 10. | PASS sandbox edit. Two owned copies per inspected card; no live inventory/equipment integration. |
| Deck Validation | Declared minimum 10, unlimited maximum and ordered play disabled; 11-card sandbox deck valid. | PASS declared sandbox limits. Does not prove engine's composed deck. |
| Tags Table and Tree | Guard label changed to Guard QA, visible in Tree; Undo restored. Usage and mechanic restrictions readable. | PASS vocabulary draft. Label alone grants no mechanic; parentId is ancestry, dotted IDs opaque. |
| Tag Import | Native v2/v3 import and explicit mapping/review controls available. | PARTIAL. Only imported rows become candidates; schema/sample rows create no game records. File import round trip unverified. |
| ERD 0.2.4 | Native toolbar/menu renders; independent Commerce sample contains four tables. | PARTIAL. Save/history/document separate from game's 285 tags. No live synchronization. |

## Baseline presentation authoring

| Mode | Checked action and observation | Status and restriction |
|---|---|---|
| Opening Compose | Scene words changed, composition preview updated. Duration changed. Undo restored both. | PASS draft edits. Exact native camera/reveal/host acknowledgement absent. |
| Opening Words and sound | Name, speaker, words, music and stinger controls render. | PARTIAL. Native fields retained; full prologue renderer disconnected. Artwork samples do not cover arbitrary environments. |
| Battlefield Layout | Role/selection changed stage arithmetic 120% → 40%; Undo restored. | PASS proposal arithmetic. No saved game formation/environment changes. |
| Battlefield Diagnostics and Compare | Source sprite diagnostic and desktop/tablet/phone geometry views render. | PARTIAL. Formation fit and alpha/body/shadow bounds require renderer integration. |
| UI Config | HUD 10 → 11%; scene 55 → 54%; total stayed 100%. Undo restored. | PASS geometry edit. Native variables/fractions retained; full compiler/runtime adapter absent. |
| UI JSON and Compare | Native JSON editor and geometry comparison available. | PARTIAL. No create-new-wireframe workflow or saved-build renderer integration. |
| Poses Stage | Seven-pose sampler ran 2× without loop and stopped at 1200 ms. | PASS native sampler. Presentation-only; runtime override disconnected. |
| Effects | Added shieldBash clip, selected release cue, duration 440 ms, offset −10 ms; visible track updated. Four Undo steps removed changes. | PASS reference/timing edit. Effect artwork catalog absent; stage previews poses only. |
| Bindings | Resolution panel displays matching Ambush binding, score and winner. | PARTIAL. Declared binding resolution does not prove engine invokes sequence. |

## Baseline source control and verification

| Mode | Checked action and observation | Status and restriction |
|---|---|---|
| Existing local checkout | Previously connected isolated AshenSpire checkout displayed dev @ 38166cb and runtime-asset sparse scope. | PASS existing local state only. No new GitHub connection performed. Large art originals excluded. |
| Files | Hierarchy rendered; selected text file loaded with size/revision. Edited buffer then attempted Cards navigation; inline Unsaved checkout edits prevented switch. Keep editing preserved buffer. Original buffer restored. | PASS file load and unsaved guard. Explicit save has revision protection. This audit did not write checkout source. Binary/oversized/private paths protected. |
| Local branches | No create/switch/manage branch UI found in baseline. | BLOCKED requested workflow. Branch-before-clone field does not manage local branches. |
| Builds | Build tasks and successful saved artifacts visible. Opened built web HTML; title screen transitioned to actual main menu and Settings. | PASS saved artifact/menu smoke. Checkout build excludes browser drafts. Full gameplay and updated-source build not tested here. |
| Combat Workshop | Scenario controls and required connection contract visible; Run real engine disabled. | BLOCKED engine integration. No mock receipts/results presented. |
| Runtime health | Meaningful content, correct baseline title, no framework error overlay, relevant console errors absent. | PASS baseline desktop. Browser extension logs excluded. |

## Baseline interchange and persistence

| Action | Observation | Status and restriction |
|---|---|---|
| Save draft | Edits show Saved locally; Undo returns original effective values. | PARTIAL browser recovery. Separate from checkout backup and source write. Explicit owner/session UI checked separately below. |
| CSV | Authored tag rows and original headers displayed; unknown columns retained. | PASS readable CSV surface. Downloaded CSV bytes and import round trip unverified. |
| JSON export | Export toast reports completion and game files unchanged. | UNVERIFIED downloaded bytes. Cloud download event timed out; no path returned. |
| Excel | No XLSX export control found in baseline. | BLOCKED requested format. CSV is not XLSX. |
| Runtime game configuration | Copy JSON fell back to In console. Console contained schemaVersion 1, game/build metadata, overrides and promotionOwned. Reverted tested values recorded as original effective values. | PARTIAL JSON generation. Opaque sandbox prevents clipboard/persistent storage; no editor-to-checkout settings bridge. |

## Advanced settings inventory

All 18 source-game Advanced sections and 136 groups opened and inspected in built-game preview. Inventory coverage means controls rendered and descriptions read. Individual value mutation coverage is representative, not every field. Remaining 16 sections expose 2,637 controls, excluding Opening and Character/progression controls.

| Section | Groups | Rendered controls | Observation or restriction |
|---|---:|---:|---|
| Opening sequence | 11 | Not totaled | Playback, motif, stage, text, controls, class dialogue, button text, preview, scenes, preset slots, scene file. Separate from editor's Compose preview. |
| Character and progression | 16 | Not totaled | Starting stats, level-up, equipment requirements, classes, experience, skills and talents. Some authored fields explicitly not read at runtime. |
| Combat rules | 9 | 543 | Actions/costs, rating/card values, deck, exposure, boss tiers. |
| Stats | 23 | 1570 | Resources, ratings, resistance, status bonuses, weapons, armour, relics and enemy overrides. |
| Recovery | 3 | 16 | HP, stamina and mana. |
| Rewards and economy | 31 | 119 | Combat rewards, rarity, prices, smithing, flasks and promotion reward switches. |
| Shops | 6 | 151 | Merchant kinds, market, blacksmith, master, consumables and companions. |
| Deck | 1 | 8 | Minimum changed 10 → 11 → 10; value updated and restored. Runtime setting, not editor sandbox limit. |
| Equipment and relics | 11 | 127 | Starting equipment, balance, swapping, drops, rarity and relic categories. |
| Run and world | 6 | 26 | Rest/shrines, atlas/seats, gauntlet, co-op, endless and run modifiers. |
| Interface | 3 | 10 | Map/HUD, appearance and controls. |
| Text and lore | 2 | 6 | Flavor text and lore window. |
| Battlefield | 4 | 42 | Formation layout/grid, characters and movement. |
| Layout | 5 | 14 | Modals, menus, scenes, card size and window. Backdrop auto → off → auto and groundline auto → on → auto verified. No new wireframe editor here. |
| Import export and debug | 2 | 5 | Configuration file and diagnostics. Non-default settings JSON separate from game source schema. |
| Defaults and sync | 1 | Service panel | Named profile list reported Failed to fetch. GitHub save disabled without token. No credentials entered, stored, or transmitted. Preview sandbox cannot retain settings. |
| Changelog | 1 | Read-only | Historical change list readable. |
| About | 1 | Read-only | Build identity, game acknowledgements, asset/runtime and save descriptions readable. |

Some large category changes exceeded cloud selector's initial three-second action deadline while selection visibly changed. Longer ten-second action deadline allowed remaining groups. No relevant game/app console errors observed. One oversized inventory batch exceeded 60-second REPL limit; resumed shorter batches. This is not evidence every game rule is correct.

## Final renamed editor and authentication QA

Final compiled static editor opened through explicit index document. Local host owner setup inspected read-only. No default credentials or QA owner account created through cloud browser.

| Check | Observation | Status and restriction |
|---|---|---|
| First owner setup | Create editor owner gate, empty username/password/confirmation fields; password input type masked with minimum 12 and maximum 128 characters. | PASS initial state. No account created or credential entered. Setup/login/password/logout behavior belongs to backend fixture tests, not browser sign-in verification. |
| Offline entry | Static artifact first displays Local account host unavailable and explicit Open offline authoring preview button. No account/repository access granted. | PASS. Preview is a user-chosen draft mode. |
| Branding and toolbar | AshenedSpire banner and File, Edit, View, Build, Window, Account, Help menus; source game identity retained as AshenSpire. | PASS desktop rendering. |
| View navigation | View → Scenes shows Remembered warmth Compose workspace. Cards → View → Table shows card definitions. | PASS mode/workspace routing. |
| Save | File → Save authoring draft displays Authoring draft saved in this browser and Saved locally footer. | PASS explicit browser save. No checkout writes. |
| Export | File → Export current document displays Export complete. Game files unchanged. | PARTIAL dispatch only. Downloaded bytes remain unverified. |
| Draft validation | Build → Validate authoring draft reports Authoring project validation passed. | PASS draft schema command. Does not validate native game execution. |
| Offline builds | Build → Builds and game preview shows Local authenticated host required, repository selector disabled, known repositories disconnected. | PASS host restriction. Cannot run new build or edit checkout in static preview. |
| Account | Offline preview details opens a dialog stating no authenticated repository or build access. | PASS mode disclosure. Credential flows intentionally not entered. |
| Popup keyboard | End → last item; Home → first item; `s` → Save; Escape closes popup and restores File trigger. Fixed ArrowDown now focuses Import; ArrowRight opens Edit and focuses first enabled Find command. | PASS final keyboard routing. Initial focus defect fixed and retested. |
| Phone | 390 px editor frame uses explicit index entry; File menu fits within frame; Window → Inspector opens drawer, Close works; Library drawer shows 47 cards and closes. | PASS fixed-viewport layout. Physical touch and native phone browser not simulated. |
| Console health | No relevant error/warning entries after final desktop and phone actions. | PASS rendered frontend smoke; excludes extension logging. |

Development preview's directory fallback was isolated from compiled static artifact by opening its explicit index document; this is a preview-server routing issue, not proof that static artifact calls authentication API.

## Final authoring additions

| Tool | Checked action and observation | Status and restriction |
|---|---|---|
| New card | Duplicate `ambush` ID disables creation with error. Reviewed `qa-editor-card` JSON includes four native effects and upgrade. Create selects QA card and library grows 47 → 48. Undo returns 47 and Ambush. | PASS native-definition draft creation. Two owned sandbox copies; artwork/tags/game source unchanged. Card source adapter remains unsupported. |
| New wireframe | Reviewed full native UI configuration including variables/fractions. Created named geometry snapshot. HUD 10 → 11 made stored layout differ; Apply disabled before review checkbox, enabled after review, restored HUD 10. Undo reversed apply, change and creation. | PASS named wireframe draft/review/apply/Undo. No new runtime mode or compiler is created. |
| Excel workbook | File → Export Excel workbook (.xlsx) shows successful export toast. | PARTIAL browser dispatch. Cloud download event timed out after ten seconds; downloaded bytes not browser verified. Unit validation of actual OOXML belongs to export fixture tests. |
| CSV | File → Export table as CSV shows UI config exported as CSV, nested values use JSON text. | PASS command routing/disclosure. Browser download bytes unverified. |
| Native checkout document | File → Load / save native checkout document opens explicit Authenticated local host required restriction for UI mode. Cards mode lists supported Tags CSV, Opening full JSON and UI JSON, and explicit unsupported cards/effects/battlefield/native ERD adapters. | PASS offline and adapter boundaries. Authenticated source-backed load/save not browser-tested; fixture tests can verify supported adapters. |
| Game settings / Overrides | Selected native `settings.deckMinSize`, typed 11, added one override. Invalid `{` update displayed parse error and retained active value 11. Undo restored zero overrides; saved baseline. | PASS typed native JSON draft/Undo. Deck key requires game deck editing and minimum-unlimited disabled; structural checks alone do not prove rule application. |
| Game settings / JSON | Schema version 2 proposal rejected with Native settings schemaVersion must be 1; active override remained 11. Original valid buffer restored. File → Export current document dispatched native settings JSON. | PASS last-valid-document safeguard and export routing. Browser-downloaded bytes unverified. |
| Game settings / Compatibility | Read rule timing, live future XP gains, per-device/interface keys, local-only art quality, preservation of metadata and native migrations. | PASS explicit restrictions. Most balance rules affect new run; native importer owns supported keys/ranges/cross-setting rules. |
| Game settings / Promotion | Local settings promotion panel states owner sign-in required; no checkout mutation controls available offline. Native tool targets settingsDefaults.js and requires build afterward; device/local-only keys omitted. | PASS offline restriction. Actual native promotion/import/build proof comes from integration fixtures; not signed-in browser QA. |
| Local branches | Local source-control panel appears in Repositories, Files and Builds. Refresh disabled; asks for local checkout and sign-in. | PASS static mode restriction. Authenticated create/switch/delete and dirty-tree behavior browser-unverified; backend branch fixtures required. |
| Add local repository | Local absolute Git folder and optional branch fields, Add disabled in offline mode. Remote GitHub connection/profile controls removed. | PASS local-only UI and disconnected state. No import or remote operation performed. |

All new-card, wireframe and game-settings QA draft changes were undone; baseline card count, name, UI bands and zero settings overrides restored and explicitly saved. A one-render field mismatch in immediate snapshots cleared on fresh read; no persistent selected-field defect found. Credential lifecycle was not entered because advertised browserAuth requires secure user credential collection and forbids model entry/account creation; backend fixtures cover setup/login/password/logout without configuring delivered owner.

## Required integration work

1. Complete game source adapters for card definitions, decks, effects/bindings, battlefield proposals and native ERD synchronization. Existing Tags/Opening/UI bridge needs signed-in edit → save → build → runtime proof.
2. Verify each Advanced rule's native range, dependencies and effect timing. Current native settings workspace exposes a small known-key catalog plus custom/imported keys; it does not expose thousands of Advanced fields as typed editor forms.
3. Verify authenticated branch operations, source saving and settings promotion using integration fixtures and a signed-in user session; offline mode deliberately prevents them.
4. Verify exported/imported CSV/XLSX/JSON bytes and metadata round trips. Browser download events did not provide paths during this audit.
5. Finish native engine connection for Combat Workshop and presentation/runtime acknowledgements; full game behavior remains unverified.

## Evidence

Baseline cards screenshot: `output/qa-baseline-cards-20260929.jpg`, verified 91,307 bytes. Baseline branding predates renamed editor; do not present as final renamed-editor screenshot.

Final owner setup screenshot: `output/AshenedSpire-Owner-Setup-20260929.jpg`, verified 31,703 bytes. Final desktop File menu screenshot: `output/AshenedSpire-Final-Desktop-20260930.jpg`, verified 103,445 bytes. Phone File menu screenshot: `output/AshenedSpire-Phone-Menu-20260930.jpg`, verified 60,229 bytes. These contain no entered credentials. Earlier desktop menu image predates the final new tools; use final desktop image for handoff.

## Final implementation evidence outside browser

Parent validation on September 30, 2026: **57 named tests passed in 3.8 seconds**, with zero failures. Quick source review passed 62 files. Production compile and nested static HTML gates passed. Read-only review found no P1 blocker.

| Check | Evidence | Practical limit |
|---|---|---|
| Authentication | Server fixtures exercise single-owner setup, login/logout/password change, failed-login limits, session expiry/revocation, CSRF, TLS cookie flags, opaque short-lived preview capabilities and fail-closed storage | Browser credential entry was not performed; delivered owner remains unset |
| Local repositories and branches | Authenticated fixture imports committed local source into isolated checkout, preserves main/test/dev refs, creates/switches branches, rejects dirty/busy switches and current/protected/unmerged deletion | Ordinary local Git directories only; no remote connection, auto commit, merge or push |
| Native document save/build | Authenticated local UI document load → edit → review → revision save → actual fixture build produced HTML with edited HUD 12; stale overwrite rejected | Fixture proves integration contract; full native game renderer parity and all three modes' gameplay remain unverified |
| Settings promotion | Host fixture verifies reviewed native settings job, locking and private-input cleanup on success/failure. Separately, actual original game settings-defaults tool in isolated code copy accepted deck minimum 11 and passed --check; invalid minimum −1 and unknown key failed without changing defaults | Actual game rebuild/playtest after promoted defaults was not run; small known-key catalog plus arbitrary imported JSON remains |
| Interchange | Multiline/Unicode/unknown CSV columns and native JSON round-trip tests pass. Genuine XLSX ZIP/OOXML byte tests and independent openpyxl reader pass; strings remain non-formulas and numeric/Boolean cells typed | Cloud browser download paths unavailable; XLSX import and desktop Excel launch untested |
| Delivery | Local source repository, main/test/dev branches and ready CI/CD templates; no remote origin, GitHub connection or deployment | Five-minute CI limit applies per job after runner starts; queue, review and merge time not guaranteed |

The earlier baseline BLOCKED rows describe initial gaps; final authoring additions and this implementation evidence record their current state. Remaining source adapters for cards/decks/effects/battlefield/native ERD and private combat execution still limit a complete specialized game-authoring loop. Saved checkout text can be edited and built through Files/Builds today.

## Accounts paused — October 1, 2026

The latest correction supersedes historical account instructions. Account UI and editor credential endpoints are paused; automatic loopback sessions preserve same-origin/CSRF and private-path protections. Existing credential stores stay unread and unchanged. Static builds request no local session. Renewed sessions refresh repository, branch and native-document tokens without discarding drafts or automatically replaying writes; settings promotion requires renewed review. Windows checkout promotion retries only EPERM/EACCES in its validated private parent and refuses occupied targets.
