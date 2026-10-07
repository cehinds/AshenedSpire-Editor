# Sprite workshop

Run `python art/sprite-rig-editor/serve.py`, then open http://127.0.0.1:8795/art/sprite-rig-editor/index.html. This server explicitly serves JavaScript modules with the correct MIME type on Windows. It binds to localhost, reads workspace files, and has no write endpoint.

## Finding controls

The canvas is the main workspace. The title, menus and Save share a horizontal header; zoom and coordinates sit on the canvas header. Side panels use the page scrollbar rather than nested vertical scrolling. File contains project opening, saving, revisions and handoff; Edit contains undo, component and pose actions; View toggles panels and the clean preview; Export collects image and configuration exports; Settings opens input preferences. Save project stays in the header.

Use Components, Animation, Queues and Overview tabs below the canvas. Components can browse other frames without changing the current one. The inspector has Layers, Part, Rig and Review tabs. Right-click a component for relevant grouping, lock, transform and export actions; an anchor for connections; a timeline frame for frame actions; or empty canvas for view and import actions. Shift+F10 opens the same menus from focused items. The component action ellipsis provides an alternative to right-clicking. Horizontal ellipses hold frame/set/section actions; vertical ellipses hold per-layer and secondary import/export actions, with labels and tooltips.

Snapping and overlay switches live in toolbar dropdowns. How to edit contains the longer instructions. On a narrow screen, Browse poses expands the library. Menu actions keep their existing undo and save behavior.

## Editing

Select a pose in the left library, then click a painted part to drag it in either preview. Selecting a part in the layer list switches to Move selected mode so overlapping art cannot steal the selection. Use its labeled MOVE and ROTATE handles, or toggle Pick parts by clicking artwork to select another part. You can also drag on the canvas, nudge with arrow keys (Shift = 10 px), or enter coordinates in the inspector. Use the tool menu to rotate, move a pivot without moving its artwork, or add/move anchors. Alt temporarily disables snapping. Grid/rulers use 512 × 512 source coordinates, regardless of zoom.

ATK-02 starts with independently editable parts: core body/cape, head, upper arms, forearms, hands, boots, lantern, and the Version A axe. Its two hands draw above the axe. Parent connections carry child parts when an arm moves. All seven attack poses expose Left hand and Right hand inside a Hands group, with finger overlays following each hand. Partly hidden hands contain only the visible artwork; residual grip pixels remain separately labeled for review. Other poses retain body, axe, and provisional foreground masks. Imported circular masks and inherited hand anchors are not anatomical approvals.

Skeletons are draft guides. Select the layer holding a joint, enable Anchors, and move that joint with the anchor tool. Add connected joints from the inspector. A pinned anchor blocks edits that would move it; locking bone lengths blocks stretching (this version does not solve inverse kinematics).

Use polygon tools to cut a part from an existing layer, add a foreground mask, or erase a region. Click vertices and choose Finish polygon. Cutting removes the corresponding pixels and transfers enclosed anchors to the new part. No hidden artwork is invented: moving a cut part can expose a hole requiring painted repair. Import revised artwork with + Artwork or drag an image onto the canvas.

Select a weapon view to use existing front/back/side/edge-on/three-quarter artwork. This is a 2D view replacement, not true 3D pitch. Hand contacts H1/H2 must be placed on painted palms before Fit axe. Fitting preserves weapon scale and flags impossible grips.

## Resize, snapping, and controls

Select a part or group and drag its corner squares to resize proportionally. Stretch freely is off by default; enable it for separate width/height resizing using side or corner handles. Shift temporarily preserves proportions when stretching; Ctrl/Cmd resizes from the component pivot. Scale X/Y are also editable in the inspector. Scale snapping defaults to 5% increments relative to the drag start.

Move snapping, Rotation snapping, and Scale snapping have separate toolbar toggles. Move snapping controls the existing grid and anchor snapping choices. Alt temporarily bypasses snapping; Shift constrains movement to one axis. Ctrl/Cmd+wheel zooms around the cursor, Shift+wheel pans horizontally, and middle-drag or Space+drag pans. Arrow keys nudge by 1 pixel; Shift+arrows by 10. V selects Move, R selects Rotate, and F fits the canvas.

Settings & controls configures snapping, modifiers, wheel behavior, navigation, nudge distances, and tool keys. Preferences persist in the browser and travel with saved projects; Export controls downloads just these settings. Reset controls restores the defaults. Undo restores component resizing as well as movement and grouping.

## Components and layers

The Components from selector browses the current canvas, any animation frame (including its transform overrides), or any pose in the library. Browsing never changes the destination canvas. Select a source thumbnail and use Add selected component, or drag it onto the canvas; the source artwork remains unchanged. Copies include anchors and connected descendants. Drag a tile to either canvas to add a copy, with a translucent placement preview and a snapped pivot. Clicking a tile only selects it; Duplicate selected component explicitly creates a copy. Add component accepts PNG/WebP/JPEG or an editable component JSON. Delete selected component is beside the canvas and in the right-click menu, supports multiple selections, keeps unselected child parts in place, and can be undone. Drag a layer row by its dotted grip onto a canvas to move existing parts, or between rows to reorder them; the green insertion line shows the destination. Top rows draw in front. External images can also be dropped onto a canvas; their artwork appears after decoding.

Use layer checkboxes or Shift-click names for multiple selection. Group components creates a separate group handle and preserves world placement and draw order. Move, rotate, or scale that group to carry its children. Ungroup components works on the group or a selected child and restores original parent connections when available. Cross-frame copies keep both hand parts and their finger overlays; you can add either hand individually or the Hands group. Lock icons lock the part and its descendants; locked children block parent movement.

Right-click artwork, a layer, or a visible anchor for actions (Part actions is a keyboard-accessible alternative). Connect anchors adds a skeleton line; Snap anchor moves the source part to the target and establishes a parent attachment. Click the target anchor to finish, or Escape to cancel. Pinned anchors and locked lengths still apply.

Save components exports a self-contained editable `.component.json` with selected parts, their descendants, embedded artwork, and internal anchor connections. Import components or drop that file on a canvas to reuse it. Save selection PNG exports a transparent 512-pixel composition. Drag selected components out advertises an editable file to browsers/desktops supporting DownloadURL; support depends on the host. Use Save components when the host does not accept the drag. Native desktop drag-out is not guaranteed in the in-app browser.

## Animation and saving

The toolbar beside the canvas has Add frame, Delete frame, and previous/next controls with the active animation and frame number. Add frame inserts an independent copy after the selection, including its visible frame overrides. Delete frame removes only the selected timeline entry and selects the next available frame; the source pose stays in the library. Empty sets can receive a new frame. Undo restores these changes.

Drag library poses to the timeline; drag frame cards to reorder them. Each instance has its own duration, event and transform overrides. The Edit selector distinguishes Shared pose from Selected frame transforms. When using Selected frame transforms, component additions, deletions and group edits automatically create an independent pose with the current overrides baked in. Other frames keep their existing artwork. Previous/next/scrubber pause playback; Play resumes a paused set or queue.

Create sets and queues, drag set chips into a queue, then set repeats, pause durations, and loop behavior. No interpolation or fading is applied. Playback speed is only a preview preference and does not alter exported durations.

- Quick save / Save project / Ctrl+S: downloads the current editable project with embedded artwork, excluding named revision history to keep the file small. Open project restores it without external asset files. The fixed save bar shows the filename and a Download again link. Browser settings determine the destination (usually Downloads).
- Settings only: advanced JSON with external asset references and named revisions; keep it beside the workspace assets.
- Save revision: up to ten named snapshots within the current project; revisions are included in Settings only.
- Autosave: IndexedDB on this browser origin. Download a file for durable sharing or transfer.
- Copy handoff: exact selected pose, parts/anchors, animation order, queue, notes, and warnings. Send the portable bundle too when artwork changed.
- Pose/set/queue config exports: self-contained selections with embedded required artwork. Import config merges with fresh IDs, preserving existing work.
- Image exports: transparent PNG/WebP, marked sprite, sheet with metadata, ZIP of individual frames, and animated WebP. Queue exports preserve repeats and pauses. Exported clean frames use the same renderer as the clean preview.

## Scope and review status

This is an authoring preview, not game integration. Sixteen Emberhabit poses and ten initial animation sets are available. ATK-02 has a generated single-lantern body repair and manually authored editable cutout partitions. ATK-01 extra-arm anatomy and ATK-04/05 ambiguous grips remain explicitly unapproved source-art findings. Other outfits/classes can be imported as project configurations; they have not been redrawn or automatically rigged by this editor.

Layering and geometry checks cannot prove a correct painted hand. Polygon cuts also do not repaint hidden body surfaces. Every pose remains unreviewed until a person checks its anatomy, finger overlap, accessory consistency, and motion.

## Validation

`node --test art/sprite-rig-editor/core.test.mjs` covers rigid two-hand fitting, transformed parents, unchanged placement when reparenting or moving pivots, invalid import rejection, queue timing/size limits, and frame-state isolation.

`qa/export-validation.json` records independent PIL decode/pixel/duration checks and ZIP CRC/content verification. Browser checks covered rendering, coordinate editing, autosave recovery, pause/play, skeleton toggles, and a downloaded portable pose config validated with the same schema validator.

## Rebuilding assets

`python art/sprite-rig-editor/build_assets.py` reuses the original compositor with opt-in layer exports and one common crop/scale per pose. It only writes editor assets, not integrated game assets. Keep hand points separate from weapon design anchors. Generation prompts and source provenance are in `source/provenance.json`.

`parts.test.mjs` covers group placement, ancestor/descendant grouping, layer draw order, locked children, exact anchor attachment, and cycle rejection. Browser checks also exercised portable saving, component export/import, grouping, visible locks, and component drag into the canvas.

`hand-components.test.mjs` covers hand migration and group/copy placement. `transform-tools.test.mjs` covers snapped corner resizing, side stretching, pivot resizing, and affine transform preservation through groups and project saves.
