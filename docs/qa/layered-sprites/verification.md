# Layered sprite tools — local verification

Verified October 6, 2026 in `codex/editor-layered-weapons`, based on Editor `271fceb`, using the local development preview at `http://127.0.0.1:43287/`.

## Implemented

- Poses & effects includes Sprite Workshop and the approved art catalog / 76-cell armor matrix.
- Battlefield includes Combat Studio as a draft art study. Native HUD editing opens the existing Battlefield Layout.
- Portable ZIP packs resolve shared images into normal editable Sprite Workshop documents. Each armor has isolated browser recovery; the full-window link uses the same slot.
- Independent weapons fit to their assigned H1/H2 palm without moving the other weapon. Libraries render 24 thumbnails per page.
- The final bundled pack has 31 appearances, 35 armor mappings, 28 canonical armaments and 841 loadouts per appearance (26,071 total), including empty hands. These are idle equipment studies, not attack animations or runtime installation.

## Local checks

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
