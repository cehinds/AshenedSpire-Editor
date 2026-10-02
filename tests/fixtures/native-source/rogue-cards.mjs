// src/content/cards/rogue.js — Rogue parity slice.
//
// Prepared is a content-owned one-hit opening: Rogue attacks read it before
// removing it. Venom is a normal status hook. No Rogue behavior needs a new
// opcode, predicate, formula, or script.

const one = { f: 'add', args: [1] };
const PREPARED = { p: 'hasStatus', of: 'self', status: 'prepared' };
const TARGET_WEAK = { p: 'hasStatus', of: 'target', status: 'weak' };
const TARGET_VULNERABLE = { p: 'hasStatus', of: 'target', status: 'vulnerable' };
const TARGET_BLEED = { p: 'hasStatus', of: 'target', status: 'bleed' };
const TARGET_VENOM = { p: 'hasStatus', of: 'target', status: 'venom' };
const prepare = () => ({ op: 'applyStatus', target: 'self', status: 'prepared', stacks: one });
const spendPrepared = () => ({ op: 'removeStatus', target: 'self', status: 'prepared' });

export const rogueCards = [
  // ---- Non-reward cards: signature + two generated tools -----------------
  {
    id: 'ambush', name: 'Ambush', class: 'rogue', rarity: 'starter', cost: 1, staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "Opening of the frozen docks.\n\nStrike from beneath a bridge, from behind, before the other has decided there is a fight at all. The docks learned it from the Court's surgeons, who walked the bridges by night with their bags, and always arrived first.\n\nTheir day-books record house calls, but no houses.",
    keywords: [], icon: '🗡',
    effects: [
      { op: 'damage', target: 'enemy', amount: 5 },
      { op: 'damage', target: 'enemy', amount: 8, if: PREPARED },
      { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 1 },
      spendPrepared(),
    ],
    textTemplate: 'Deal {damage} damage. Prepared: deal {damage.2} more. Apply {vulnerable} Vulnerable. Consume Prepared.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 7 },
        { op: 'damage', target: 'enemy', amount: 10, if: PREPARED },
        { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 2 },
        spendPrepared(),
      ],
    },
  },
  {
    id: 'rogueShiv', name: 'Shiv', class: 'rogue', rarity: 'special', cost: 0, type: 'attack',
    flavor: "Sliver of iron from the rail of the Fourth Bridge.\n\nThe ironwork froze brittle the night the Court Flame died. Dock children say the railings were cast from the Court's melted oath-tokens, and so are worth more than any blade in the right hands.\n\nWhose hands are right, the children will not tell.",
    keywords: ['exhaust'], icon: '🔪',
    effects: [{ op: 'damage', target: 'enemy', amount: 4 }],
    textTemplate: 'Deal {damage} damage. Exhaust.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 6 }] },
  },
  {
    id: 'smokePellet', name: 'Smoke Pellet', class: 'rogue', rarity: 'special', cost: 0, type: 'skill',
    flavor: "Tallow and ash, rolled in a back room on the Chandlers' Stair.\n\nSold as lamp-starters. The chandler says the recipe was his grandmother's, taken from a Court surgeon, though in his telling the surgeon is sometimes a knight.\n\nThe docks buy more of them each winter.",
    keywords: ['exhaust'], icon: '🌫',
    effects: [{ op: 'block', target: 'self', amount: 3 }, prepare()],
    textTemplate: 'Gain {block} Block. Become Prepared. Exhaust.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 5 }, prepare()] },
  },

  // ---- Commons (13) -------------------------------------------------------
  {
    id: 'quickCut', name: 'Quick Cut', class: 'rogue', rarity: 'common', cost: 0, type: 'attack', keywords: [], icon: '╱',
    flavor: "Knife-work of the Tollmouth fence.\n\nHe pays only for quick cuts, holding that a slow cut is a confession and a quick one an accident. Before the Decree, a dock child caught with a knife was hanged, not branded.\n\nThe fence considers that the better age.",
    effects: [{ op: 'damage', target: 'enemy', amount: 3 }, { op: 'damage', target: 'enemy', amount: 3, if: PREPARED }, spendPrepared()],
    textTemplate: 'Deal {damage} damage. Prepared: deal {damage.2} more. Consume Prepared.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 4 }, { op: 'damage', target: 'enemy', amount: 4, if: PREPARED }, spendPrepared()] },
  },
  {
    id: 'feint', name: 'Feint', class: 'rogue', rarity: 'common', cost: 0, type: 'skill', keywords: [], icon: '↝',
    flavor: "Oldest trick of the frozen docks.\n\nEyes on the purse, hand on the knife. The docks say the Court's knights were easily taken, for they had sworn to look wherever a threat was declared.\n\nNo such clause appears in their oath-book. The knights wrote the oath-book.",
    effects: [prepare(), { op: 'draw', amount: 1 }],
    textTemplate: 'Become Prepared. Draw {draw} card.',
    upgrade: { effects: [prepare(), { op: 'draw', amount: 1 }, { op: 'block', target: 'self', amount: 3 }], textTemplate: 'Become Prepared. Draw {draw} card. Gain {block} Block.' },
  },
  // Editor scanner fixture: braces, brackets and fake ids inside strings,
  // comments, templates and regular expressions must not confuse the splice.
  /* { id: 'commentDecoy' }, ] */
  {
    id: `scannerProbe`, name: 'Scanner probe', class: 'rogue', rarity: 'special', cost: 0, type: 'skill', keywords: [], icon: '?',
    flavor: `Template ${['}', ']'].join(' ')} with { id: 'templateDecoy' } and ${`nested ${'}'}`}`,
    note: /[\]}{,]+\/ id: 'regexDecoy'/.source,
    effects: [{ op: 'draw', amount: 1 }],
    textTemplate: "Draw {draw} card. }] // not a comment",
  },
];
