# Footer Atelier

Open **UI settings → Footer Atelier** in the local AshenedSpire Editor. The standalone version is `public/footer-atelier.html`; all art and scripts are embedded so it can also be opened offline. The editable source lives in `public/parts/footer-atelier/`.

This tool authors modular artwork and independent game-bound text. Preview counts are samples. The local editor can review and save the layout into a connected game checkout; the game runtime applies it after rebuilding.

## Artwork

The current game footer inventory is the resource display, Draw pile, End Turn, Discard/Exhaust and Potions (`src/ui/components/combatActionRow.js` in AshenSpire). New transparent PNG illustrations supply a button plate, Draw cradle, spent-card cradle, potion tray and connecting rail. The original circular frame, green orb, action sigil and lit/spent sapphire gems are copied unchanged from the **Replace action costs with stamina** chat's SP Atelier. The assembly begins at twelve o'clock and follows the counterclockwise mana ring reference.

The [component manifest](../public/parts/footer-atelier/manifest.json) records provenance, hashes and paths. [New generation prompts](../public/parts/footer-atelier/prompts.json) and [resource generation prompts](../public/parts/footer-atelier/resource-prompts.json) preserve the built-in Image Generation specifications. PNG masters retain their alpha; the renderer calculates visible alpha bounds without rewriting source images.

## Controls

- Drag a piece, or edit X/Y/width/height. Drag the lower-right handle to resize; Keep proportions or Shift preserves the aspect ratio.
- Grid spacing is selectable. Snap to pieces aligns edges and centres, showing gold guides. Attach on snap joins touching pieces into a group; distant alignment does not attach.
- Move group moves and resizes all attached pieces. Turn it off or hold Alt during drag to adjust one member. Detach piece removes a member from its group.
- Layer selection, visibility, locking, opacity, text/color/type size, duplication, ordering and deletion are available in the inspector. Undo/redo includes preset changes and imports. Arrow keys nudge by one pixel, or ten with Shift; Escape cancels a drag.
- Assembled edits the layout; Components shows all ten independent source assets; Clean preview hides selection and grid. Desktop and compact presets are included.
- Browser recovery stores the layout separately from the editor project. Save layout / Import round-trip a versioned JSON document. Export PNG creates the current assembly or component sheet on transparent pixels. The parent editor's Export also exports the active footer layout.

## Development

`npm run build:footer` rebuilds the portable HTML from source and PNG masters. `predev` and `prebuild` keep it current. `npm run test:footer` checks presets, alpha-component references, mana ordering, docking/group geometry, locks, proportional resize and rejected imports.

The source artwork, portable editor and live game runtime are separate artifacts. Production builds and public publication are distinct validation gates; exporting or saving a draft alone does not publish a game release.

## Game text and checkout saves

Every caption is a separate `asset: "text"` layer. The version 1 `ashenspire.footer` document retains editable `x`, `y`, `w`, `h`, `fontSize`, `color`, `fontFamily` (`serif`, `sans`, `mono`), `fontWeight` (400, 600, 700), `fontStyle` (`normal`, `italic`) and `textAlign` (`left`, `center`, `right`). Fonts are named local families, never external URLs. Legacy documents default to static, regular, centered serif text.

`binding` is `static`, `sp`, `spLabel`, `draw`, `drawLabel`, `discard`, `exhaust`, `endTurn`, `endTurnKey` or `potions`. For bound layers, `{value}` in `text` is replaced with the live game value; `{label}` supplies the translated Discard or Exhaust label. The canvas uses sample counts only. Artwork contains no baked game labels or counts. Disable Move group to position a text layer independently; its existing group can still move with its artwork.

Save layout exports the portable raw document. In the local editor, expand **Save footer layout to game checkout**, find a connected local checkout, and load or review its `content/config/ui/presentation/footerLayout.json`. The game wrapper is `{ "components": { "layout": <document> } }`. Review preserves unrelated wrapper fields. Saving requires the same reviewed draft, target checkout and file revision; the host also enforces CSRF and branch/path protections. Save does not commit, push or rebuild. Public Pages builds remain draft/export only.

The generated `public/footer-atelier.html` is ignored and recreated by predev, prebuild and prebuild:pages. Artwork masters and generation prompts remain in `public/parts/footer-atelier/`. Game builds ship their own optimized assets, including the low-resolution variants.
