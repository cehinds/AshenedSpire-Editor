import {BOOK_ART_PRESETS} from './book-art/presets.js';
import {bookArtProblems} from './book-art/catalog.js';
import {scanJs, unquote} from './native-js-source.mjs';

export const BOOK_SOURCE = 'src/content/bookArtPresets.js';
export const BOOK_NAMES = {bladeManual:'Blade manual',shieldManual:'Shield manual',focusTreatise:'Focus treatise',pairedStepsPrimer:'Paired steps primer',spellbook:'Spellbook',universalTome:'Universal tome',reaverClassBook:'Reaver class book',starseerClassBook:'Starseer class book',rogueClassBook:'Rogue class book',heraldClassBook:'Herald class book',featBook:'Feat book'};
export const defaultBooks = () => structuredClone(BOOK_ART_PRESETS);

export function bookRecipesProblems(recipes) {
  if (!recipes || typeof recipes !== 'object' || Array.isArray(recipes)) return ['Expected book recipes keyed by book ID.'];
  const errors = [];
  if (!Object.keys(recipes).length || Object.keys(recipes).length > 200) errors.push('Expected 1–200 book recipes.');
  for (const [id, recipe] of Object.entries(recipes)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,79}$/.test(id) || ['__proto__','constructor','prototype'].includes(id)) errors.push('Invalid book ID.');
    errors.push(...bookArtProblems(recipe).map(message => `${id}: ${message}`));
  }
  return errors;
}

export function importBookRecipes(text) {
  const value = JSON.parse(text);
  const recipes = value.recipes ?? value;
  const errors = bookRecipesProblems(recipes);
  if (errors.length) throw new Error(errors.join(' '));
  return structuredClone(recipes);
}

export function exportBookRecipes(recipes) {
  const errors = bookRecipesProblems(recipes);
  if (errors.length) throw new Error(errors.join(' '));
  return '// Authored artwork only. Gameplay rules remain in the game.\nexport const BOOK_ART_PRESETS = ' + JSON.stringify(recipes, null, 2) + ';\n';
}

// This restricted reader accepts only the data literal, never evaluates source.
export function readBookSource(source) {
  const tokens = scanJs(source);
  const matches = tokens.map((token, index) => token.value === 'BOOK_ART_PRESETS' && tokens[index - 1]?.value === 'const' && tokens[index - 2]?.value === 'export' && tokens[index + 1]?.value === '=' ? index + 2 : -1).filter(index => index >= 0);
  if (matches.length !== 1) throw new Error('Expected one exported BOOK_ART_PRESETS literal.');
  let index = matches[0];
  const start = tokens[index].start;
  function parse() {
    const token = tokens[index++];
    if (token?.type === 'string') return unquote(token.value);
    if (token?.value !== '{') throw new Error('Book artwork source must contain only object and string literals.');
    const value = Object.create(null);
    while (tokens[index]?.value !== '}') {
      const keyToken = tokens[index++];
      const key = keyToken?.type === 'string' ? unquote(keyToken.value) : keyToken?.type === 'name' ? keyToken.value : null;
      if (!key || ['__proto__','constructor','prototype'].includes(key) || Object.hasOwn(value, key) || tokens[index++]?.value !== ':') throw new Error('Invalid or duplicate book artwork property.');
      value[key] = parse();
      if (tokens[index]?.value === ',') index++;
      else if (tokens[index]?.value !== '}') throw new Error('Unsupported book artwork expression.');
    }
    index++;
    return value;
  }
  const recipes = parse();
  if (tokens[index]?.value !== ';' && tokens[index] !== undefined) throw new Error('Unsupported book artwork expression.');
  const errors = bookRecipesProblems(recipes);
  if (errors.length) throw new Error(errors.join(' '));
  return {recipes, start, end: tokens[index - 1].end};
}

export function reviewBookSource(source, recipes) {
  const before = readBookSource(source);
  const errors = bookRecipesProblems(recipes);
  if (errors.length) throw new Error(errors.join(' '));
  // Omitted or newer checkout records survive importing an older recipe export.
  const merged = {...before.recipes, ...recipes};
  const after = source.slice(0, before.start) + JSON.stringify(merged, null, 2) + source.slice(before.end);
  return {before: source, after, recipes: merged};
}
