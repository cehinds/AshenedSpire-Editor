# In-game previews

Every workspace has an **In game** tab. Previews run the bundled AshenSpire renderers in script-only sandboxed frames. The frame acknowledges applied draft revisions; errors remain inside the preview. Preview encounters do not load or write saved games, and no checkout file is changed.

## Scenes

Compose and In game share **Play preview**, Pause/Resume, Restart and Stop. The native opening renderer supplies artwork, transitions, camera motion, text substitutions, scene ordering, enabled scenes, timing, Continue and Replay. Desktop/tablet/phone targets change the frame viewport. Draft edits restart the selected scene after a short delay.

The inspector writes native scene text, timing, input gates and traveller staging. Traveller x and footline y are percentages measured from the top-left; height excludes the native shadow. Previous `scenePlacement` sidecars remain in exports but are not silently converted to a different coordinate system. Audio is not connected.

## Cards, Decks and Tags

The game's card renderer and token resolver render the selected definition, ordered deck cards, or cards linked to the selected tag and its descendants. Definition changes, tag labels, artwork and font overrides refresh the native faces. The upgrade control previews native upgraded effects. This view renders card faces; the combat view executes game actions.

## Playable encounter

Battlefield, UI settings, Poses/effects, Combat workshop and Project tools share an isolated encounter using the native combat engine. It uses drafted card definitions and deck, the selected scenario card, seed, ruleset and HP, and supported native UI/game settings. Draft changes restart the encounter. Full screen provides more room to play.

Poses/effects also offers native presentation playback for the authored pose and matching bindings. Presentation-only playback does not inflict damage. Battlefield Lab's proposal controls remain separate from native layout settings, and the private Combat Workshop service is not connected. The preview states these boundaries alongside the game.

## Source snapshot and delivery

`src/native/game-preview/provenance.json` records the game revision, whether its working tree had changes, and hashes for the bundled renderer snapshot. Original source and asset notices remain with the snapshot. The game's compact mobile art pack keeps the preview smaller; these are real game assets, with lower resolution than the desktop pack.

The maintenance command `node scripts/vendor-game-preview.mjs <game-source-directory>` refreshes the snapshot explicitly. Normal builds and CI use the committed snapshot and do not require another checkout. GitHub Pages consolidation embeds these runtime assets in the versioned editor HTML.
