// Fixture with the shape of AshenSpire src/content/balance.js: an import, a
// symbol-keyed note, comments, and balance.ui.combatantStage tokens.
import { tooltipHelp } from './tooltipHelp.js';

export const NOTE = Symbol.for('ashenspire.balance.note');

export const balance = {
  help: tooltipHelp,
  ui: {
    hudQuickSettings: { places: ['title', 'map', 'combat'], edgeGapPx: 4 },
    // BattlefieldStageModel owns the protected vertical corridor between the
    // shared run HUD and the hand. { centerPct: 99 } in a comment is ignored.
    combatantStage: {
      hudClearanceViewportPct: 3,
      actionClearanceViewportPct: 3,
      intentGapPx: 6,
      centerPct: 50,
    },
    other: { pattern: /a{2}[}]/.source, label: `stage ${'}'}` },
  },
  [NOTE]: 'symbol keys stay out of the comparison',
};
