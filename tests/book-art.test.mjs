import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {defaultBooks, importBookRecipes, exportBookRecipes, readBookSource, reviewBookSource, bookRecipesProblems} from '../src/book-art-model.mjs';
import {BOOK_COVERS, BOOK_SYMBOLS} from '../src/book-art/catalog.js';

test('approved palette and painted layers are complete, including feat emblems', async () => {
  const recipes = defaultBooks();
  assert.equal(Object.keys(recipes).length, 10);
  assert.equal(recipes.bladeManual.color, '#277348');
  assert.equal(recipes.universalTome.color, '#247c7a');
  assert.ok(BOOK_SYMBOLS.includes('feat'));
  for (const [directory, names] of [['covers',BOOK_COVERS],['symbols',BOOK_SYMBOLS]]) for (const name of names) {
    const data = await readFile(new URL(`../public/assets/books/${directory}/${name}.webp`, import.meta.url));
    assert.equal(data.subarray(8,12).toString(), 'WEBP');
  }
});
test('plain and wrapped JSON imports preserve recipes and refuse invalid partial data', () => {
  const recipes = defaultBooks();
  assert.deepEqual(importBookRecipes(JSON.stringify(recipes)), recipes);
  assert.deepEqual(importBookRecipes(JSON.stringify({recipes})), recipes);
  recipes.bladeManual.color = 'red';
  assert.throws(() => importBookRecipes(JSON.stringify(recipes)), /six-digit/);
  assert.ok(bookRecipesProblems({bad:{}}).length);
  assert.throws(() => importBookRecipes('{"__proto__": {}}'), /Invalid book ID/);
});
test('source reader accepts current game syntax without executing modules', async () => {
  const current = await readFile(new URL('../src/book-art/presets.js', import.meta.url), 'utf8');
  assert.deepEqual(JSON.parse(JSON.stringify(readBookSource(current).recipes)), defaultBooks());
  assert.throws(() => readBookSource('export const BOOK_ART_PRESETS = (()=>{throw Error("executed")})();'), /only object/);
  assert.throws(() => readBookSource('export const BOOK_ART_PRESETS = { x: {get color(){return "red"}} };'), /Invalid/);
  assert.throws(() => readBookSource('export const BOOK_ART_PRESETS = {x:{}} || dangerous();'), /Unsupported/);
  assert.deepEqual(JSON.parse(JSON.stringify(readBookSource(exportBookRecipes(defaultBooks())).recipes)), defaultBooks());
});
test('review splices only literal, preserves other records and rejects invalid data', () => {
  const recipes = defaultBooks();
  const future = {...recipes.universalTome, symbol:'feat'};
  const source = '// prefix\n' + exportBookRecipes({...recipes,futureBook:future}) + '// keep this\nexport const version = 2;\n';
  recipes.bladeManual.color = '#223344';
  const review = reviewBookSource(source, recipes);
  assert.ok(review.after.startsWith('// prefix\n'));
  assert.ok(review.after.endsWith('// keep this\nexport const version = 2;\n'));
  assert.equal(readBookSource(review.after).recipes.bladeManual.color, '#223344');
  assert.deepEqual(JSON.parse(JSON.stringify(review.recipes.futureBook)), future);
  assert.throws(() => reviewBookSource(source, {broken:{}}), /Unknown/);
});
