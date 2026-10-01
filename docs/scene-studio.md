# Scene studio

Open **Scenes → Compose**. The studio follows `design/scene-studio-reference.png` and uses the bundled AshenSpire opening-sequence renderer and artwork.

## Content

Select a thumbnail to inspect a scene. Search filters the rail; the up/down controls change native playback order. **Add scene** activates an existing disabled native slot. The native document has nine fixed slots; arbitrary extra scenes and sprite layers are unavailable in this renderer snapshot.

## Presentation

Select the traveller, narration, background, or audio using the tool strip or timeline. Unlock the traveller before moving it. Drag to place it; the top handle changes its proportional height. Arrow keys move one percent, or five with Shift. Drag narration to create an anchored overlay. Drag the background to change its crop focus. Each completed drag produces one draft undo step. Escape cancels the active transform.

Use **Desktop / Phone** to edit independent actor coordinates. The adjacent phone preview uses the actual mobile renderer. Grid, one-percent snap, safe guides, zoom, fit, and pan are editor aids. V selects; H pans. The inspector becomes a drawer at narrower widths.

## Settings

The inspector edits native transforms, image treatment, narration, transitions, and audio cues. Scene staging inherits sequence defaults until an override is activated. **Reset to shared** returns effective staging to the sequence defaults. **Reset native placement** applies the renderer's actor defaults for that slot and device.

## Source control

All composition changes edit the browser draft. **Save draft** saves that draft locally. **Checkout…** opens the existing local load/review/revision-save flow; canvas gestures never write checkout files. An offline authoring preview grants no repository access. Accounts are currently paused under the project's latest local-host direction.

## Verification

**Play preview**, the playhead, and Space drive native animation time and narration reveal. Scrubbing pauses playback; playing at the end restarts the selected scene. Desktop and phone receive the same playback commands. The timeline divider can be dragged or adjusted with arrow keys.

Audio is an explicit **Audition native cues** action using the game's procedural music and SFX. **Stop audio** silences both buses. Changing the selected scene/cue or leaving the studio stops auditioning. Music does not seek with animation time. The timeline shows cue names, without a fabricated waveform or independent keyframe tracks.

The native frame adapter checks its source instrumentation and reports incompatible bundles. Runtime and audio provenance, retained licenses, and credits are in `src/native/game-preview/` and `src/native/scene-audio/`. Refresh audio intentionally with `node scripts/vendor-scene-audio.mjs <AshenSpire-checkout>`.

Run `npm run test:studio` for native model, actual animation-clock, frame security, responsive remount, and audio contracts. `npm test` includes these alongside the existing editor suites. Browser evidence and visual acceptance are recorded in `design-qa.md`.

## Interchange

The existing File/Export and native document review flows retain their formats. Workspace selection exposes all nine workspaces. **In game**, **Words & sound**, and **JSON** keep their existing integrations.

## Delivery

`npm run build` prepares local/Sites outputs. `npm run build:pages` also prepares the consolidated offline HTML at `dist/pages/index.html`. Static previews provide public draft authoring; repository writes require the local host. The implementation is checked locally before feature → dev → test promotion. Published previews remain draft authoring; immutable build links identify the exact delivered version.

## Movable layout

Drag a menu by its dotted header. Pin keeps it open while choosing actions or interacting with the canvas. Use its reset/close buttons, or Escape to close. Focus the move handle and use arrow keys (10 px), Shift+arrow keys (40 px), or Home to reset. Floating menus and authoring dialogs stay inside the viewport and remember their positions.

The inspector header offers Float/Dock and Close. The toolbar inspector toggle or Window → Inspector reopens it. Drag its floating header or move it with the same keys. Drag scene-library, docked-inspector and timeline separators; arrow keys adjust their sizes, Shift increases the step, and Home or double-click restores the default. Layout preferences are separate from draft history. Reset studio layout restores studio defaults; Window → Reset window positions and Restore default layout recover moved panels without changing authoring records.

See [button-audit.md](button-audit.md) for action wiring, browser coverage and host-only verification boundaries.

Playback controls stay together above the canvas. Play starts from the current playhead; Pause freezes native animation and Resume continues it. Restart plays the selected scene from zero. Stop pauses at zero and ends any active native cue audition. These controls affect preview state without changing the authoring draft.

## Master default

Scenes and Master default share the scene-library header. Master default groups Text box, Background, Effects and Playback & controls. These controls update `sequence.presentation`; sparse `scene.stage` overrides remain independent and take precedence when `ownStaging` is enabled. Individual narration, artwork, actors and audio cues stay with each scene.

Text-box height is measured in the preview viewport’s vh. Changing master height enables fixed sizing; each scene can override it or return to shared staging. `captionFixedHeight` and `captionHeightVh` are retained in native document exports and applied by an explicit editor preview adapter in Compose and In game. The currently bundled game renderer does not consume these fields without that adapter; ordinary checkout gameplay still uses automatic caption sizing.

The scene transport uses icon buttons in Restart, Play/Pause/Resume, Stop order, with hover titles and accessible names. The size/device selector sits at the far right of the composition toolbar.
