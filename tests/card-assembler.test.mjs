import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as model from '../public/parts/card-assembler/model.mjs';
import * as footer from '../public/parts/footer-atelier/model.mjs';
import {RECIPES} from '../public/parts/card-assembler/catalog.mjs';

test('all ten source presets retain 19 ordered layers and six editable text layers', () => {
  assert.equal(model.ASSETS.length,53);
  assert.equal(new Set(model.ASSETS.map(a=>a.id)).size,53);
  assert.equal(model.PRESETS.length,10);
  for (const entry of model.PRESETS) {
    const doc = model.preset(entry.id);
    assert.equal(doc.items.length,19);
    assert.equal(doc.items.filter(n=>n.asset==='text').length,6);
    assert.ok(doc.items.some(n=>n.role==='rules-background'));
    assert.deepEqual(model.validate(doc),doc);
    assert.deepEqual(model.fromRecipe(model.toRecipe(doc)),doc);
    const source = RECIPES.find(r=>r.id===entry.id).layers;
    const order = [...source].sort((a,b)=>a.z-b.z).map(n=>n.id);
    assert.deepEqual(doc.items.map(n=>n.id),order);
    for (const original of source) {
      const item=doc.items.find(n=>n.id===original.id);
      assert.deepEqual([item.x,item.y,item.w,item.h],[original.x,original.y,original.width,original.height]);
      if(original.type==='text')assert.equal(item.text,original.text);
    }
  }
});

test('PNG import preserves each exact component byte hash', () => {
  const provenance=JSON.parse(readFileSync(new URL('../public/parts/card-assembler/provenance.json',import.meta.url)));
  for(const asset of model.ASSETS){
    assert.match(asset.src,/^assets\/[a-z-]+\/[a-z0-9-]+\.png$/);
    const data=readFileSync(new URL('../public/parts/card-assembler/'+asset.src,import.meta.url));
    assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(createHash('sha256').update(data).digest('hex'),provenance.assets.find(a=>a.id===asset.id).sha256);
  }
});

test('component replacement keeps placement, ordering, and unrelated background', () => {
  const doc=model.preset(),before=model.clone(doc);
  const target=doc.items.find(n=>n.role==='rules-background');
  target.asset='as.card.background.cinder.v1';
  const next=model.validate(doc);
  assert.equal(next.items.find(n=>n.id===target.id).asset,'as.card.background.cinder.v1');
  const restored=model.clone(next);restored.items.find(n=>n.id===target.id).asset=before.items.find(n=>n.id===target.id).asset;
  assert.deepEqual(restored,before);
});

test('text style, group, visibility and lock state survive recipe interchange', () => {
  const doc=model.preset(),text=doc.items.find(n=>n.role==='mana-value');
  Object.assign(text,{text:'12\nMana',fontFamily:'Arial',fontSize:75,color:'#abcdef',fontWeight:'bold',stroke:'#061018',strokeWidth:3,align:'end',italic:true,group:'costs',locked:true,visible:false,opacity:.5});
  assert.deepEqual(model.fromRecipe(model.toRecipe(doc)),doc);
  assert.equal(model.preset().items.find(n=>n.role==='mana-value').strokeWidth,3);
});

test('preset and history cloning keep undo snapshots independent', () => {
  const doc=model.preset(),snapshot=model.clone(doc);
  doc.items[0].x=999;doc.items.find(n=>n.asset==='text').text='Changed';
  assert.notDeepEqual(doc,snapshot);
  assert.deepEqual(model.preset(),snapshot);
  const restored=model.clone(snapshot);restored.items.pop();
  assert.equal(snapshot.items.length,19);
});

test('Footer Atelier geometry is reused directly with group and lock behavior', () => {
  for(const name of ['clone','clamp','bounds','selectedIds','move','snap','resize','attach'])assert.equal(model[name],footer[name]);
  const doc=model.preset(),a=doc.items[0],b=doc.items[1];a.group=b.group='attached';
  const ids=model.selectedIds(doc,a.id);
  assert.deepEqual(ids,[a.id,b.id]);
  const moved=model.move(doc,ids,10,-20);
  assert.equal(moved.items[0].x,a.x+10);assert.equal(moved.items[1].y,b.y-20);
  assert.equal(doc.items[0].x,a.x);
  const resized=model.resize(doc,[a.id],a.w/2,a.h/2);
  assert.equal(resized.items[0].w,a.w/2);assert.equal(resized.items[0].h,a.h/2);
  b.locked=true;
  assert.deepEqual(model.move(doc,ids,10,20),doc);
  assert.deepEqual(model.resize(doc,ids,100,100),doc);
  const snapped=model.snap({x:96,y:23,w:20,h:20},[{id:'edge',x:120,y:20,w:30,h:40}],{threshold:5});
  assert.equal(snapped.x,100);assert.equal(snapped.y,20);assert.equal(snapped.dock,'edge');
});

test('invalid IDs, geometry, dimensions and unsafe text styles are rejected', () => {
  const cases=[
    d=>{d.items[1].id=d.items[0].id;},d=>{d.items[0].asset='https://example.com/image.png';},
    d=>{d.items[0].id='<script>';},d=>{d.width=NaN;},d=>{d.items[0].x=Infinity;},
    d=>{d.items[0].w=-2;},d=>{d.items[0].opacity=2;},d=>{d.items[0].fit='unsafe';},
    d=>{d.items.find(n=>n.asset==='text').color='url(https://bad)';},
    d=>{d.items.find(n=>n.asset==='text').fontFamily='Georgia; background:url(bad)';},
    d=>{d.items.find(n=>n.asset==='text').fontWeight='900;display:none';},
    d=>{d.items.find(n=>n.asset==='text').stroke='url(#paint)';},
    d=>{d.items.find(n=>n.asset==='text').strokeWidth=21;},
    d=>{d.items.find(n=>n.asset==='text').align='center;bad';}
  ];
  for(const change of cases){const doc=model.preset();change(doc);assert.throws(()=>model.validate(doc));}
  const recipe=model.toRecipe(model.preset());recipe.layers[0].z=Infinity;
  assert.throws(()=>model.fromRecipe(recipe),/stacking/);
  assert.throws(()=>model.preset('missing'),/Unknown/);
  assert.throws(()=>model.fromRecipe({...RECIPES[0],schemaVersion:99}),/version/);
});

test('kit-compatible recipe export rejects incompatible canvas sizes', () => {
  const doc=model.preset();doc.width=768;
  assert.equal(model.validate(doc).width,768);
  assert.throws(()=>model.toRecipe(doc),/1024/);
  const recipe=model.toRecipe(model.preset());recipe.canvas.height=1400;
  assert.throws(()=>model.fromRecipe(recipe),/1536/);
});
