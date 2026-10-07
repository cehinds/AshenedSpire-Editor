# Sprite Workshop and combat art

Open **Poses & effects → Sprite Workshop** for the existing layered authoring tool. It now accepts portable armor/weapon packs, alongside the earlier hammer projects and workshop example. **Art catalog** shows approved character/armor and roster previews, source PNG hashes and the full 76-cell armor restriction matrix. **Battlefield → Art study** integrates the prior Combat Studio’s independent desktop/phone compositions, placement, component ordering, effects, source library and portable layout files.

The native HUD, cards and footer remain in **Battlefield → Layout**. Art study preserves imported UI override data for interchange but does not embed the game checkout’s `index.html` or pretend to run the native interface. It uses an independent browser draft key. These tools do not write game source files or install runtime sprites.

## Portable sprite pack

Import a ZIP with `manifest.json` at its root. The manifest format is:

```json
{
  "schema": "ashenspire.sprite-project-pack.v1",
  "id": "class-armor-weapons-2026-10-06",
  "title": "Class armor weapon layers",
  "provenance": {"sourceCommit": "..."},
  "projects": [{
    "id": "reaver-default",
    "label": "Reaver / Wayfarer Plate",
    "classId": "reaver",
    "armorId": "default",
    "weaponType": "multiple",
    "projectPath": "reaver-default.rig.json"
  }]
}
```

Each project is a normal Sprite Workshop `schemaVersion: 1` document on a 512 × 512 source canvas. Keep root-level project files and shared image paths such as `assets/body.png`. Paths cannot be absolute, remote, percent-encoded or traverse directories. Images may alternatively be embedded data URLs. The import resolves and embeds the selected project’s images before handing it to the workshop; project transforms, masks, layer roles, anchors, pose metadata, animation timing and review status stay intact.

One armor project can contain many loadout poses. Pose fields `weaponType` (or `weapon`), `offhandType` (or `offhand`), `name` and `reviewed` populate the browser. Selecting filters or inspecting a pack does not replace the canvas; **Open in Workshop** is explicit. Each pack/project pair has its own recovery slot. Reopening restores that project’s edits and selects the requested pose. **Full window** opens that same recovered project; use one editing view at a time.

For independent hand equipment, use `gripMode: "independent"`, put H1/H2 on the body’s painted right/left palms, and give each weapon a `grip` anchor plus `handAnchor: "H1"` or `"H2"`. **Fit selected weapon** translates only the selected weapon to its assigned palm while preserving rotation and proportions. It never fits the opposite weapon or interprets two independently held objects as one two-hand weapon. Keep movable weapon anchors unpinned; body hand anchors may stay pinned. The pose library and overview page 24 previews at a time so large equipment families stay usable.

Use the Workshop’s **Save project** to download a portable `.rig.json` with embedded artwork. This document is separate from the editor’s general authoring draft and undo history. PNG/WebP composition exports remain separate from editable project exports. Geometry/schema checks do not approve painted anatomy or grip occlusion.

Local/ordinary hosted builds serve Workshop modules normally. The consolidated single-file Pages build presents an explicit availability note because it does not rewrite the tool’s ES-module graph. It does not claim a functioning embedded workshop.

## Bundled source packs and provenance

`public/sprite-packs/current/manifest.json` is the optional bundled armor pack entry point. The import path remains available for portable packs without a rebuild. `scripts/vendor-sprite-pack.mjs` validates an approved local pack and copies only its manifest, rig JSON and referenced artwork into this directory.

The original layered armor/weapon pack came from AshenSpire commit `4115a9c50d183abe64b897052ddd26da21f02a58`, branch `codex/class-armor-weapon-layers`, at `docs/design/class-armor-weapons-2026-10-06`. Its source package includes `SHA256SUMS.txt`, `validation.json` and `image-validation.json`. Final source checks passed 62 painted-palm checks, 28 painted weapon-grip checks and 1,736 weapon placements (31 appearances × 28 armaments × 2 hands), with no clipping failures. These checks establish source coverage and bounds, not visual approval of every overlap.

The imported Workshop source was copied from the existing local Editor authoring tool, including the six hammer projects and their existing review caveats. The combat art review package derives from AshenSpire commits `41ae95ae42cce66e56805cc35ae1903a92a4d5a5` and `f1bad442950d43739a6f1726d63be3555b24838b`. `scripts/vendor-combat-art.py` makes bounded transparent WebP previews from the source PNGs and records source hashes; these review copies are not replacements for the original masters. Matrix restrictions and canonical IDs come from the approved armor package.

## Validation

Run `node --test tests/sprite-pack.test.mjs public/sprite-workshop/*.test.mjs` for pack path boundaries, missing-image handling, layer-preserving imports, isolated recovery keys and the existing Workshop geometry/interaction model tests. Browser acceptance additionally exercises a real layered project, overlapping layers, project reopening, gallery/matrix navigation and desktop/phone Art study edits.


### Rear-view weapon edition

The first rear-view edition came from AshenSpire commit b3f853d59775964496f2127e1f53651ffd0c2e24 at docs/design/rear-weapon-views-2026-10-06. It contains 25 newly painted rear three-quarter masters covering 28 canonical armaments, with the same three explicit aliases. All 31 appearances retain 841 loadouts. Source validation passed 50,344 contacts, 28 painted grips and 1,736 hand-placement bounds checks. Representative visual review remains distinct from approval of every overlap or game integration.

The current v2 pack (`rear-weapon-views-2026-10-06-v2`) corrects facing against the kite shield reference and puts the complete body at the top of every loadout. Both weapons draw underneath the hand components and body. Nine armament entries use reversible `flipX` transforms: buckler, tower shield, round shield, spiked shield, shortbow, battleaxe, halberd and the two canonical axe/halberd aliases. Source pixels and grip positions remain unchanged. Select a weapon and open **Part → Flip horizontally** to change its facing; the setting survives portable import/export and frame overrides. The new recovery ID preserves edits to the earlier edition. All 26,071 loadouts were rebuilt and checked; 46 Workshop/import tests and the production build passed. The source package includes facing rules and per-appearance review sheets.
