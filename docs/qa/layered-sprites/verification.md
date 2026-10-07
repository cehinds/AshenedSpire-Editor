# Layered sprite tools — local verification

Verified October 6, 2026 in `codex/editor-layered-weapons`, based on Editor `271fceb`, using the local development preview at `http://127.0.0.1:43287/`.

## Implemented

- Poses & effects includes Sprite Workshop and the approved art catalog / 76-cell armor matrix.
- Battlefield includes Combat Studio as a draft art study. Native HUD editing opens the existing Battlefield Layout.
- Portable ZIP packs resolve shared images into normal editable Sprite Workshop documents. Each armor has isolated browser recovery; the full-window link uses the same slot.
- Independent weapons fit to their assigned H1/H2 palm without moving the other weapon. Libraries render 24 thumbnails per page.
- The final bundled pack has 31 appearances, 35 armor mappings, 28 canonical armaments and 841 loadouts per appearance (26,071 total), including empty hands. These are idle equipment studies, not attack animations or runtime installation.

## Local checks

- Final art source: AshenSpire commit `4115a9c50d183abe64b897052ddd26da21f02a58` on `codex/class-armor-weapon-layers`, package `docs/design/class-armor-weapons-2026-10-06`. The final source commit added its README and checksums; the portable pack, images and rigs are unchanged from the final Editor vendor copy.
- Read the committed source reports: `validation.json` passes 31 projects, 35 armor records, 28 armaments, 26,071 poses, 50,344 contacts and 117,769 layers. `image-validation.json` passes 62 painted-palm checks and 28 painted weapon-grip checks with zero clipping failures. The clipping sweep covers 1,736 placements (31 appearances × 28 armaments × 2 hands). Source `visualApproval` remains false.
- `node scripts/vendor-sprite-pack.mjs <approved source package>` validated all projects and referenced images, then copied 31 projects / 91 files.
- `node --test tests/sprite-pack.test.mjs tests/combat-art.test.mjs public/sprite-workshop/*.test.mjs`: 43 passed.
- `npm run build`: passed production Vite compilation and Sites preparation.
- `npm run review:quick`: passed, 185 source files.
- `npm run test:sites`: 4 passed.

## Browser evidence

The Codex in-app browser loaded the Editor shell and the actual embedded tools. No browser console warning or error was reported during the recorded flow.

- Actual ZIP chooser import of the 23-appearance production sample exposed 841 poses, with 36 reachable pages. Reaver Straight Sword / Kite Shield opened as real body, weapon and foreground-finger layers. Toggling weapon visibility, editing its X position and fitting the selected hand worked. Reopening recovered the project-specific edits. See `workshop-841-loadouts.jpg` (sample).
- Final bundled catalog reported 31 armor projects. Starseer / Astral Vestment / Starstone Staff + Lantern opened with five separate layers. See `workshop-starseer-final.jpg`.
- Final Rogue / Nightveil Coat / Dagger + Buckler opened with four separate layers. Moving the right weapon changed X from 103.889 to 108.889; Fit selected weapon returned X to 103.889. See `workshop-rogue-final.jpg`.
- Art catalog filtering showed nine Starseer records with successfully loaded images; matrix navigation exposed supported mappings and unsupported reasons. See `art-catalog.jpg`.
- Art study loaded its backgrounds and actors, exposed class-qualified armor choices, and switched to its independently saved 390 × 844 phone composition. See `art-study-phone.jpg`. This is a phone composition test inside the desktop editor, not a physical-device test.

## Limits

Save project created a portable document Blob and the Workshop displayed its successful save / Download again UI. The in-app browser's download capture timed out twice, so a downloaded browser file was not independently re-imported. Portable image embedding and JSON round-trip are covered by model tests; actual browser download delivery remains unverified.

Only representative loadouts received browser visual review. Schema/contact coverage does not approve every painted hand overlap. Consolidated single-file builds display an availability explanation for these module-based tools; local and ordinary hosted builds serve them. No game checkout writes, runtime acceptance, CI run, merge or publication is claimed.

## Rear weapon view followup

Source b3f853d59775964496f2127e1f53651ffd0c2e24 adds 25 rear-view masters covering 28 armaments and updates all 31 layered projects. Passed full pose/contact/bounds checks, 15 focused model/import tests and production build. Chrome opened the new pack and Bastion Harness / Straight Sword + Kite Shield with five layers, including left-fingers over the inner shield grip. Screenshot: rear-weapon-views.png. Browser console returned no warnings/errors. The former source pack and its recovery ID remain separate; no runtime promotion or remote publication.

## Facing and body occlusion correction

The v2 bundle covers 31 appearances, 35 armor mappings and 26,071 loadouts. Full-source validation checks all 50,344 palm contacts, 16,182 mirrored weapon layers, and the complete body as the last-drawn layer in every pose. All 1,736 independent weapon placements remain within the source canvas. The kite shield is unchanged; the source `facing.json` records all 28 orientation decisions. Artwork pixels are unchanged.

All 46 Workshop/import tests passed, including reflection under transformed parents, grip fitting, group/ungroup, pivot edits, frame overrides and layer-preserving portable import. Production build passed. Source review sheets cover 25 weapons on all appearances and all five shields in both hands. Visually inspected the complete sword/tower roster, four class shield sheets and the Reaver weapon sheet; this is representative visual review, not approval of every possible overlap.

Chrome opened the v2 bundle and Bastion Harness / Tower Shield + Round Shield. Its Layers tab lists body above fingers and both weapons. Part showed Flip horizontally checked on the tower shield; a keyboard off/on toggle kept X at 100.07 and restored the intended facing. Screenshots: `corrected-facing-control.png` and `corrected-facing-layers.png`. No browser warnings/errors. Some automation mouse commands timed out; keyboard controls completed the review. Save/import reflection round-trip is model-tested; no new browser download claim. No runtime promotion or remote publication.
