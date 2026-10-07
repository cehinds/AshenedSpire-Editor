import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createDocument,validateDocument} from '../public/combat-art/editor/studio-model.mjs';

const root=new URL('../public/combat-art/',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('catalog.json',root),'utf8'));
const matrix=JSON.parse(await readFile(new URL('matrix.json',root),'utf8'));
const library=JSON.parse((await readFile(new URL('editor/library-data.js',root),'utf8')).replace(/^window\.BATTLEFIELD_LIBRARY\s*=\s*/,'').replace(/;\s*$/,''));
test('approved art previews retain verifiable bytes and source provenance',async()=>{
  for(const entry of catalog.entries){
    assert.match(entry.sourceMaster.sha256,/^[a-f0-9]{64}$/);
    assert.equal(createHash('sha256').update(await readFile(new URL(entry.file,root))).digest('hex'),entry.previewSha256);
    assert.ok(entry.validation.visibleBounds[2]<=entry.validation.size[0]);
    assert.ok(entry.validation.visibleBounds[3]<=entry.validation.size[1]);
    if(entry.classId)assert.equal(entry.family,'armor','Armor must remain selectable in Combat Studio.');
  }
});
test('every supported armor matrix cell resolves to artwork; unsupported cells state a reason',()=>{
  assert.equal(matrix.length,76);
  for(const cell of matrix)if(cell.supported)assert.ok(catalog.entries.some(entry=>entry.id===cell.appearanceId),cell.appearanceId);else assert.ok(cell.reason);
});
test('Combat Studio retains separate desktop and phone layouts through export/import',()=>{
  const doc=createDocument(catalog.entries),phone=structuredClone(doc.profiles.phone);
  doc.profiles.desktop.objects.find(row=>row.id==='hero').x+=123;
  const imported=validateDocument(JSON.parse(JSON.stringify(doc)),catalog.entries,library,[]);
  assert.deepEqual(imported.profiles.phone,phone);
  assert.equal(imported.profiles.desktop.objects.find(row=>row.id==='hero').x,doc.profiles.desktop.objects.find(row=>row.id==='hero').x);
});
