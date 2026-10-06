# Card Assembler

Open **Cards → Assemble** in AshenedSpire Editor. The complete card stays fitted to the available workspace; the assembler supplies its own component library and layer controls. The editor's outer card library and inspector are hidden in this mode.

This tool builds on **Footer Atelier** and reuses its position, size, snapping and lock geometry. Its core catalog has 53 independent images and 12 presets: the 10 original layer-kit recipes, **Reference layout** with fully visible resource badges, and **Full-art banner layout**. The full-art preset uses seven exact PNG layers recovered from the original Gorefire source document; the earlier concept frames and panels are reconstructed layers. Five additional portrait paintings supply extra background above the subject. Resource icons retain their original artwork.

## Assemble a card

1. In **Presets**, choose a starting look. **Keep my card wording** is checked by default so changing the look retains your current title, rules, flavor and cost text. Undo restores the previous arrangement.
2. In **Parts**, choose the region to replace, then select a background, frame, panel, artwork or resource icon. Component IDs identify the same asset across layouts; **Copy component ID** copies the selected image's asset ID or the selected text layer's ID.
3. In **Text**, edit wording and cost values. Text also stays editable in the selected-part inspector; both controls update the same layer. **Outline all card text** adds a dark edge scaled to each font size. **Text styling → Outline color / Outline width** lets you adjust each layer or set its width to zero; outlines are preserved by JSON, PNG and SVG export.
4. In **Layers**, select, duplicate, reorder, hide or remove pieces, or add text. **Lock position** protects geometry. Drag unlocked pieces to move them and use the eight edge/corner handles to resize the selection; **Position & size** provides exact values. **Controls → Link cost pieces** keeps each cost icon and its related pieces together when moving or scaling. Undo and Redo include layout edits, presets and imports.
5. Use **Fit** to show all artwork, **Preview** to hide edit overlays, or the **Desktop · 260 px** and **Mobile · 170 px** size previews to inspect readability. **Focus canvas** hides side panels; **Full screen** expands the tool to the screen. The wheel zooms around the pointer, and **Pan**, Space + drag or middle-button drag moves the canvas view.
6. **Save design** exports an editable native JSON layout. **Open design** accepts that layout or an original layer-kit recipe. **Export PNG** and **SVG** produce assembled images. Browser autosave recovers the latest draft; keep a saved JSON copy for portable recovery.

The parent editor's **Export** button delegates to this tool's layout export. Assembler drafts have their own recovery and history, separate from native card definitions and the editor project. Exported compositions are artwork/layout drafts: they do not add cards to the game or write to a checkout.

## Mouse controls and unclipped exports

**Snap edges** aligns edges and centers. **Grid** offers independent Show grid and Snap to grid switches, spacing from 4–128 card pixels, and card center guides. The grid follows pan/zoom and thins dense lines when zoomed out. Grid preferences are recovered separately from the design; grid and center guides are never exported. Hold Ctrl while dragging to bypass snapping, or Shift to constrain movement to one axis. Shift + click adds to the selection; dragging empty canvas creates a selection box. Alt + click cycles overlapping layers. **Keep proportions** or Shift during resize preserves aspect ratio; Alt during resize scales from the center.

**Arrange** aligns left, center X, right, top, center Y and bottom. Align to Card moves the selection together; Align to Selection moves each independent piece/group to the selected bounds. Space horizontally/vertically creates equal gaps between at least three units, keeping the outermost units fixed. Locked selections cannot be arranged.

**Group** (Ctrl+G) joins selected pieces; **Ungroup** (Ctrl+Shift+G) removes their custom group. Groups move, resize and align together, persist in saved JSON and support Undo. Automatic cost linking remains a separate Controls option.

Right-click opens Copy, Paste, Duplicate, Group, Ungroup, ordering and Delete actions. Copied layers stay within the tool's layout clipboard. Arrow keys nudge, Shift + arrows nudge by 10 px, and Escape cancels an active manipulation. Double-click text to edit its wording or an image to choose a replacement part.

The document keeps its 1024 × 1536 coordinate system and permits negative positions, allowing badges to extend beyond the card body. Fit and PNG/SVG export include visible content overflow. The unchanged reference composition therefore exports at **1089 × 1536** rather than clipping its overhanging resource badges. Moving or resizing layers can change the export bounds.

## Portable tool and source

`public/card-assembler.html` is the standalone tool. It embeds application code, styles and PNG assets, so the generated file can be opened offline without its source folder. `public/parts/card-assembler/` contains the editable source, catalog, original component images and provenance. PNG embedding also preserves raster layers in SVG-based rendering pipelines that cannot read embedded WebP images.

Run `npm run build:cards` to regenerate the portable file. `predev`, `prebuild` and `prebuild:pages` refresh it alongside Footer Atelier. The consolidated Pages builder embeds the generated HTML through the existing resource mechanism. A local build is distinct from publishing a new Pages preview or integrating a game renderer.

The layout schema is `ashenspire.card-assembler`, version 1. Stable component IDs use the `as.card.*.v1` namespace; imported raster assets use unique `custom.*` IDs. Native JSON preserves canvas coordinates, stacking, visibility, opacity, text styles, crop/clipping, component references and embedded custom images. The model also provides `toRecipe` for conversion back to a layer-kit recipe, but **Save design** exports native JSON.

## Full-art cards and imported components

### Mouse cropping and extra background

Select an unlocked artwork layer and click **Use extra background** for the matching extended portrait. The original art remains in the component library. Use **Crop / trim**, double-click an image, or press **C** to edit its crop. Drag inside the gold rectangle to reposition the painting; drag any of its eight handles to trim or reveal pixels. The faint outer image shows the available background, and the camera fits that whole extent. **Done** or Enter leaves crop mode. Escape cancels an active gesture; Undo restores each completed gesture. **Reset crop** reveals the original image at its current scale. Card-shape clipping remains independent. PNG, SVG and saved layouts use the same original source rectangle without destructively cutting the painting.

The five extended PNGs are in `public/parts/card-assembler/assets/extended-art/`. They were made with built-in image generation; complete prompts and byte hashes are recorded in `provenance.json`. They add painted scenery, not blurred or mirrored padding. The crop implementation and existing card assembler passed 56 focused tests and the local portable/production builds before the full-roster library was added.

In **Presets**, select **Full-art banner layout**. Uncheck **Keep my card wording** to use the original Gorefire wording and values. Its 13 editable layers separate the knight scene, gilded frame, parchment, hanging banner, three resource symbols and six text layers. Each resource value is grouped with its symbol. The frame starts position-locked; unlock it before moving or resizing it.

**Parts → Add / import layers** adds any library component, editable text or another cost badge. **Import image…** or dropping a file on the canvas adds PNG, JPEG or WebP artwork. Select an existing image and choose **Replace image…** to retain its placement. **Image composition → Fill card** expands it to the card with shape clipping; **Image fit → Crop to fill** and the two crop sliders choose the visible part. Use layer ordering to place scenes behind parchment, banners and text. Component colors, trim, outlines, grouping, snapping and resizing also work on this layout.

Imported images stay embedded in saved JSON and browser recovery. Limits are 4096 pixels per side, 9 MiB per source file (12 MiB encoded), 30 imported images and 40 MiB total encoded image data. Browser recovery uses IndexedDB, with localStorage fallback for small drafts. If recovery is unavailable, save a JSON copy.

**Open design** also accepts the original embedded-PNG layered card format used by `gorefire.json`. Known original images resolve to the bundled assets; other embedded PNGs become custom components. This adapter rejects unsupported rotation, non-default art scale and external image references rather than silently changing the composition.

## Validation for this delivery

Thirty-one tests passed. The portable build and Vite production build passed. Browser checks exercised Cards → Assemble, frame and rules-background swaps, text/inspector synchronization, wording retention across presets, reload recovery, direct dragging with Undo, and native JSON import through the file chooser with Undo. The full card fit the desktop workspace and the integrated 390 × 844 viewport; no console errors were observed during those checks. Follow-up browser checks verified the current reference layout without clipped resource badges, linked action-cost resizing, wheel zoom, panning and fullscreen.

Screenshots: [desktop](../output/card-assembler-qa/editor-desktop.jpg) and [mobile](../output/card-assembler-qa/editor-mobile.jpg).

PNG and SVG handlers reported exported files, but the in-app browser's download capture timed out. The downloaded files were not independently verified. These checks establish local authoring behavior, not publication or game runtime integration.

Grid/alignment follow-up: browser checks enabled the visible grid, snapping and center guides; centered the linked action badge with Undo; distributed three text layers with Undo; grouped and ungrouped them; and checked the Arrange menu at 390 × 844. Desktop screenshot: `output/card-assembler-qa/grid-arrange-desktop.jpg`.

## Component colors and mana trim

Select an image layer, then use **Component colors** in the inspector. Color presets, a custom picker/hex value and strength adjust that component while retaining shading and transparency. Original art is preserved, and Reset component color removes the adjustment. Text colors remain under Text styling.

The blue mana icon also exposes **Mana trim**, with polished/antique/pale gold, bright silver, bronze, copper, emerald, crimson, amethyst, obsidian and custom finishes. The trim control targets the metal rim independently from the crystal. Color adjustments survive Undo, browser recovery and JSON/recipe interchange; PNG and SVG use the same recolored component pixels as the canvas.

Color follow-up: 31 focused tests passed, including tint/trim validation, recipe roundtrip, alpha preservation, shading and protected blue facets. Browser checks exercised polished gold and amethyst mana finishes, Undo, independent emerald component tint, reset, and reload recovery of the gold trim. The original card palette was restored after the tint demonstration.

Full-art follow-up: 49 focused tests passed across the model, appearance, interaction, custom assets, source-card import and crop placement suites. The 48-image portable build and Vite production build passed (Vite retained its existing large-chunk warning). Browser checks loaded the exact full-art starter, selected its clipped artwork directly, imported a PNG, filled/cropped it, recovered that image and crop after reload, and added a grouped mana badge with Undo. The starter fitted both 1440 × 1000 and 390 × 844 viewports, and no console errors appeared during the checked flow. Screenshots: [desktop](../output/card-assembler-qa/full-art-desktop.png) and [mobile](../output/card-assembler-qa/full-art-mobile.png). Original layered JSON conversion is covered by unit tests; PNG/SVG downloads were not independently reverified in this follow-up. This remains local authoring work, without a remote release or game integration.


## Card artwork library

Parts → Card artwork library opens an optional external catalog. Search by card name or canonical ID and filter by class. Artwork thumbnails load lazily; card artwork is not embedded into the portable assembler or decoded during startup. Selecting an entry replaces the selected artwork layer, keeping its layout with a fresh crop. When another type of layer is selected, the entry adds a separate artwork layer beside the existing artwork in the stack. Locked artwork must be unlocked before replacement.

Each chosen file goes through the existing image import validation and becomes an embedded custom image in Save design, exports, Undo, and browser recovery. The standalone assembler requires its library folder alongside it. Without that folder it shows an unavailable message while normal image import remains usable. The consolidated Editor Pages build includes the library through its parent asset registry and resolves chosen images lazily from that registry.

Catalog location: `public/parts/card-assembler/card-art-library/catalog.json`.

```json
{
  "version": 1,
  "totalSubjects": 237,
  "complete": true,
  "cards": [
    {"id":"card:canonical-card-id", "name":"Card name", "class":"Reaver", "src":"art/card-id.webp", "width":1024, "height":1536}
  ]
}
```

IDs are unique. Image paths must stay within the catalog folder; PNG, JPEG and WebP are accepted, up to 4096 pixels per side and the existing 9 MB file import limit. The saved design embeds only the selected image bytes, so it remains independent of subsequent library changes. Development loads the source assembler directly to avoid reparsing the embedded portable component bundle on every edit; production continues to load the portable assembler.

Additional standalone illustrations can be supplied in `card-art-library/variants.json` using the same version-1 cards schema and unique `variant:` IDs, with images in `variants/`. The optional catalog merges when the library is opened; alternate counts remain separate from canonical game-card coverage. It does not change game definitions or choose runtime card replacements.

## Hosted preview and standalone HTML

The complete Editor build remains one self-contained `dist/pages/index.html` artifact. Large hosted previews use lossless compressed chunks because the full illustrated library exceeds GitHub's per-file storage limit. The hosted loader verifies every chunk and the reconstructed HTML before opening the editor at the same URL. Download mode provides the exact original HTML bytes for standalone use; the compression changes delivery only, without reducing artwork quality or omitting the library. Existing small previews and immutable build identities remain unchanged.

## Artwork source archive

Canonical PNG masters and receipts are delivered through the AshenSpire-art repository. The local authoring archive is `D:/repos/AshenedSpire-Editor/art/card-portraits-2026-10-05/masters`; alternate PNG masters are under `D:/repos/AshenedSpire-Editor/art/card-variants-2026-10-06/masters`. These large authoring files stay outside Editor public builds and this feature commit. Source receipts retain generation prompts, original output paths, dimensions and SHA-256 hashes. Optimized WebP copies are committed in `public/parts/card-assembler/card-art-library/`, and the game exporter validates them against receipts before publishing through the pinned art release.
