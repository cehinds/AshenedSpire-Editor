# Local game workflow

1. Set up the editor owner account on first local-host visit. No default credentials exist.
2. Project tools → Repositories: add an absolute ordinary local Git folder, then Open local checkout. Only committed source is copied; the original directory stays unchanged. Bare repos, linked worktrees, network shares and symlinked source folders are unsupported.
3. Create a local branch before editing. Clean checkout and saved/discarded text buffer are required for switching; use Git to commit or resolve checkout changes before switching. Current and main/test/dev branches stay protected.
4. Files can explicitly save any permitted UTF-8 source text with revision protection. For Tags, Scenes or UI, File → Load / save native checkout document loads an existing native file into the draft. Close to edit, reopen to review, then Save reviewed native document. Loading replaces that workspace draft and is undoable; checkout writes use separate revision checks.
5. Project → Game settings imports actual native settings JSON or edits typed overrides. To write game defaults, find supported local game checkout, inspect profile and target, check review confirmation, then Promote. The actual game tool validates individual keys and replaces promoted defaults. Empty overrides clear them; device/local settings are excluded. Inspect job logs and changed source.
6. Builds runs real declared/native build commands. Open verified HTML artifact to check game behavior. Built preview is an opaque sandbox with user downloads enabled; settings storage/clipboard can be restricted.
7. File exports native/current JSON, whole recoverable project, primary table CSV or genuine Excel workbook. JSON includes sidecars; Excel tables omit image bytes and serialize nested values as JSON cells. XLSX import is unavailable.

Cards and wireframes can be created as reviewed drafts. Card definitions/decks/effect bindings/battlefield proposals still need specialized source adapters; use explicit Files editing for current game source. Named wireframe snapshots can be applied to native UI draft, then saved through its native document bridge. Combat Workshop execution needs its private engine integration.

All checkout actions require authenticated local Node/Git host. Static HTML supports explicit offline authoring and export, with source/branch/build/promotion operations disabled. No remote sign-in, fetch, push or deployment is performed by visible local repository tools.
