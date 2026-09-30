# Design QA

**Final result: passed**

Scope: approved parent motif, source-backed authoring prototype, and local repository/file/build workflow. This is a visual/interaction acceptance of the prototype, not acceptance of engine or native-host integration.

## Visual truth and capture

- Source: `design/AshenSpire-Parent-Design.pdf`, page 1, originally 1440 × 1080. `qa/source-desktop.png` crops the app region at (40,156) to 1360 × 650.
- Implementation: cloud browser, Cards / Ambush / Visual / base definition, 17 px rules, dark theme. Source and implementation use the same actual Ambush content.
- CSS viewport: 1360 × 650 inside `/responsive-preview.html`, verified iframe bounds 1360 × 650 at x=1.5, y=71 in a 1363 × 936 browser screenshot.
- `qa/desktop-full.jpg`: raw 1363 × 936 browser evidence. `qa/desktop.png`: content-only 1360 × 650 crop starting at (2,71). Density is 1 screenshot pixel per CSS pixel; half-pixel frame origin rounded to the nearest pixel. No scaling or device bezel normalization required.
- Full comparison: `qa/comparison-final.png`, source and implementation together in one input at 1:1. Earlier full comparison: `qa/comparison-before.png`.
- Focused comparison: `qa/card-comparison.png`, source and implementation card text, borders, costs and ID together. Full and focused combined images were opened and visually reviewed.
- Additional evidence: `qa/phone.jpg` (390 px CSS editor), `qa/tablet.jpg` (900 px), `qa/poses.jpg` (native ATK-04), and `qa/phone-value-20.jpg` (successful numeric replacement). Responsive harness screenshots include surrounding staging; they are not pixel comparisons to the schematic responsive board.

## Findings and iterations

1. [P2, resolved] Rules prose appeared as one paragraph instead of distinct readable rule lines. Changed the card surface to sentence-separated lines with preserved line breaks. The final focused comparison shows all four rules wrapping as intended.
2. [P2, resolved] Bright default scrollbars competed with quiet chrome; deck lists could push actions away. Applied dark scrollbars and bounded deck list scrolling. Final full view shows restrained chrome; deck add/cancel browser checks passed.
3. [P1, resolved] Phone numeric replacement appended to the existing value when focus moved the caret after selection. Removed the focus-time selection mutation and applied end-caret placement only to collapsed pointer selections. Phone fill/Enter visibly committed 20 without a range error (`qa/phone-value-20.jpg`).
4. [P2, resolved] Enter and blur both applied a numeric transaction, requiring two undo steps. Enter now blurs once; the blur handler owns commit. Browser checked 17 → 20 → one Undo → 17 using the updated code.
5. [P2, resolved] At 1360 × 650, the preview buttons were cut by excessive card-stage vertical space. `qa/comparison-before.png` shows the mismatch. Changed stage padding from 30 to 12 px and minimum height from 400 to 374 px. `qa/comparison-final.png` shows Base and Upgraded controls fully visible above the footer. The card is 12 px higher than the static wireframe; this accommodates the functional controls while preserving card size and region proportions.

6. [P1, resolved] Retained ERD and native pose imports could bypass nested validation. Package import/recovery now rejects invalid native documents before render; domain regression tests pass.
7. [P1, resolved] Mutable artifact links and saves during build could misrepresent provenance. Generation-bound previews reject stale builds; checkout operations use a shared lock. Host tests cover these controls.
8. [P1, resolved] Local repository host needed a safe network boundary. Vite defaults to loopback; API verifies host, same-origin mutations, JSON and CSRF. Artifact scripts run in an opaque sandbox. Host tests pass.

No actionable P0/P1/P2 finding remains within the implemented scope.

## Required fidelity surfaces

| Surface | Assessment |
| --- | --- |
| Fonts / typography | DejaVu Sans regular and bold are bundled, matching the PDF. 20 px card heading, 17 px rules and 1.7 rule line height retain the hierarchy and four-line rule wrapping. Browser antialiasing differs slightly from the PDF renderer. Smaller functional labels remain legible. |
| Spacing / layout rhythm | 148 px navigation, 214 px library, 728 px work surface and 270 px inspector match the 1360 px source tracks. Header is 48 px; footer is 27 px. The compact-height fix keeps the complete card and preview actions visible. Real list scrolling and inspector controls replace schematic explanatory sections intentionally. |
| Colors / tokens | Exact motif tokens: background #11171C, panel #1B242B, raised #26313A, paper #EDE6D6, gold #E4BA6C, text #F1EEE7, muted #B5C0C7, line #42505A. Source and live comparison preserve selected/primary gold and warm paper. Status includes text rather than color alone. |
| Image quality / assets | Card target is deliberately text-only; no invented illustration replaces a source image. Pose and scene previews use original supplied game WebP assets. Seven pose thumbnails and ATK-04 stage art render with transparency and no visible missing-image state. PDF diagrams remain vector artwork. |
| Copy / content | Exact real Ambush effect values and costs remain visible. Labels accurately distinguish local draft, sandbox, proposal and disconnected engine. Real 47-card / 285-tag libraries replace the shortened schematic library. Functional undo/redo and base/upgrade labels replace schematic controls; this is intentional implementation detail. |

## Interactions and console

- Nine workspace navigation and mode switches rendered successfully.
- Card name edit updated the document, and Undo restored it.
- Deck explicit Add raised the fixture from 10 to 11; Cancel restored 10. Inspection remained distinct from adding.
- Native ERD 0.2.4 iframe opened; editing toggle and Table toolbar worked. Explicit mapping example proposed one supplied row; apply and undo worked. Domain tests cover schema-only/generated zero-row imports, cycles, collisions and invalid references.
- Scene composition loaded actual backgrounds and source words.
- Battlefield cap displayed 120% authored / 100% displayed; Undo restored overflow. No live layout was changed.
- UI HUD allocation preserved a 100% band sum and could be undone.
- Native pose Play/Pause, pose selection, and effect-clip fields worked. Native sampler and validator used original source code.
- Phone Library and Selection sheets opened. Exact numeric replacement and one-transaction undo passed after fixes. Tablet retained the inspector and used a library sheet; no app-wide horizontal overflow was visible. Phone workspace navigation intentionally scrolls horizontally.
- Change review and health dialog passed project and native presentation validation. Combat execution remained disabled.
- Final console inspection showed only `chrome-extension://.../content-script.bundle.js` metadata errors. The app health collector reported no captured app runtime errors. No React/Vite application error was observed.
- `qa/tests.txt`: 12 domain tests + 4 packaging tests + 4 repository-host tests passed. `qa/build.txt`: production build passed.

## Repository extension verification

- Cloud Chromium desktop at 1363 × 936 and editor phone width 390 px: actual hierarchy selection and text editor render. Repository modes use the wider main surface while keeping the parent motif.
- Main AshenSpire checkout is real Git at `38166cb12a2d8901fce7727aca37cd8d2e7e4b2d`; runtime assets included, large art originals omitted. Test file was edited, unsaved navigation refused, saved, and restored byte-for-byte. Final checkout status clean.
- Native build launched through workbench host and completed with exit 0, producing 0.7.1.709 HTML artifacts. Saved artifact panel still listed verified outputs after host restart. Web artifact entered title menu in isolated iframe; no app console errors were observed. This is a startup smoke check, not full gameplay acceptance.
- Backend fixture verifies Git clone, duplicate registration, traversal/symlink/secret exclusions, stale revisions, operation locks, build/test/cancel, sandboxed artifacts, stale preview rejection, and registry persistence.
- `qa/AshenSpire-Repository-Files-20260929.jpg`, `qa/AshenSpire-Game-Preview-20260929.jpg`, and `qa/repository-phone-20260929.jpg` record extension presentation.
- Combat Workshop private access remains unavailable. Windows command planner is unit-tested; actual Windows runtime remains untested.

## Accepted constraints and follow-up polish

- [P3] Some compact navigation controls are 36 px tall; increase targets to 44 px during full accessibility integration and physical-touch testing.
- [P3] Portable embedded pose data makes the initial JS chunk ~752 kB. Lazy-load the catalog when integrating with the actual app host.
- Physical touch, screen reader use, text zoom extremes, exhaustive recovery conflicts, and engine/native-host end-to-end behavior remain untested.
- Scene/UI previews are composition/geometry studies. Full native renderers, effect artwork, equipment/run ownership and private Workshop execution require adapters; the UI and README state these boundaries.

## Implementation checklist

- [x] Match parent motif and source card content.
- [x] Fix actionable fidelity and input issues; recapture and compare together.
- [x] Check desktop, tablet and phone presentation.
- [x] Run domain and packaging tests and production build.
- [x] Record engine/host limits and include actual browser examples.

final result: passed
