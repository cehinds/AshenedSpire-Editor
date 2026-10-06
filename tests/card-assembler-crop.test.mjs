import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizedCrop,fullImageBounds,panCrop,trimCrop,resetCrop} from '../public/parts/card-assembler/crop-geometry.mjs';
import {validate,fromRecipe,toRecipe,ASSETS} from '../public/parts/card-assembler/model.mjs';
import {fullArtPreset} from '../public/parts/card-assembler/full-art.mjs';
const layer={x:100,y:200,w:400,h:600,fit:'stretch',sourceRect:[100,200,400,600]};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('trimming preserves the source-to-card pixel transform and leaves source untouched',()=>{
 const before=structuredClone(layer),n=trimCrop(layer,800,1200,'nw',80,90);
 assert.deepEqual(n.sourceRect,[180,290,320,510]);assert.equal(n.x,180);assert.equal(n.y,290);
 assert.deepEqual(fullImageBounds(n,800,1200),fullImageBounds(layer,800,1200));assert.deepEqual(layer,before);
});
test('all eight handles keep the opposite edge fixed and can reveal previously trimmed pixels',()=>{
 for(const handle of ['nw','n','ne','e','se','s','sw','w']){
  const n=trimCrop(layer,800,1200,handle,handle.includes('w')?-100:100,handle.includes('n')?-100:100);
  assert.deepEqual(fullImageBounds(n,800,1200),fullImageBounds(layer,800,1200));
  if(handle.includes('w'))assert.equal(n.x+n.w,500);if(handle.includes('e'))assert.equal(n.x,100);
  if(handle.includes('n'))assert.equal(n.y+n.h,800);if(handle.includes('s'))assert.equal(n.y,200);
 }
});
test('panning moves source pixels under a fixed aperture and clamps at original edges',()=>{
 const n=panCrop(layer,800,1200,50,-100);assert.deepEqual(n.sourceRect,[50,300,400,600]);
 assert.deepEqual([n.x,n.y,n.w,n.h],[100,200,400,600]);
 assert.deepEqual(panCrop(layer,800,1200,1e6,-1e6).sourceRect,[0,600,400,600]);
});
test('cover and contain normalize without altering visible pixels',()=>{
 const covered=normalizedCrop({x:20,y:30,w:200,h:300,fit:'cover',cropX:.25},800,600);
 assert.deepEqual(covered.sourceRect,[100,0,400,600]);assert.deepEqual([covered.x,covered.y,covered.w,covered.h],[20,30,200,300]);
 const contained=normalizedCrop({x:20,y:30,w:200,h:300,fit:'contain'},800,600);
 assert.deepEqual([contained.x,contained.y,contained.w,contained.h],[20,105,200,150]);
});
test('nested fractional crops preserve anisotropic scale and stay within image bounds',()=>{
 const first=trimCrop({...layer,w:333,h:517},800,1200,'nw',21.2,37.1);
 const next=trimCrop(first,800,1200,'se',1e6,1e6),r=next.sourceRect;
 assert.ok(r[0]+r[2]<=800&&r[1]+r[3]<=1200);near(next.w/r[2],333/400);near(next.h/r[3],517/600);
});
test('minimum aperture, reset and locked layers are safe',()=>{
 const small=trimCrop(layer,800,1200,'se',-1e6,-1e6);assert.equal(small.w,4);assert.equal(small.h,4);
 const reset=resetCrop(layer,800,1200);assert.equal(reset.sourceRect,undefined);assert.deepEqual([reset.x,reset.y,reset.w,reset.h],[0,0,800,1200]);
 const locked={...layer,locked:true};for(const n of [panCrop(locked,800,1200,5,5),trimCrop(locked,800,1200,'se',5,5),resetCrop(locked,800,1200)])assert.deepEqual(n,locked);
});
test('trimmed full-art scene survives save, reload and recipe interchange with card clipping',()=>{
 const doc=fullArtPreset(),index=doc.items.findIndex(n=>n.asset==='as.card.full-art.knight-scene.v1'),asset=ASSETS.find(a=>a.id===doc.items[index].asset);
 doc.items[index]=trimCrop(doc.items[index],asset.width,asset.height,'nw',61.25,109.75);
 doc.items[index]=panCrop(doc.items[index],asset.width,asset.height,-25,80);
 const saved=validate(JSON.parse(JSON.stringify(doc))),recipe=fromRecipe(toRecipe(doc));
 for(const result of [saved,recipe]){assert.deepEqual(result.items[index].sourceRect,doc.items[index].sourceRect);assert.equal(result.items[index].clipToCard,true);assert.deepEqual(fullImageBounds(result.items[index],asset.width,asset.height),fullImageBounds(doc.items[index],asset.width,asset.height));}
});
