import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ASSETS,validate,fromRecipe,toRecipe} from '../public/parts/card-assembler/model.mjs';
import {fullArtPreset,FULL_ART_LEGACY_LAYERS,FULL_ART_ROLES,CARD_CLIP_POLYGON,cardClipPath} from '../public/parts/card-assembler/full-art.mjs';
import {fromLegacyCard,isLegacyCard} from '../public/parts/card-assembler/legacy-card.mjs';

const assets=new Map(ASSETS.map(a=>[a.id,a]));
const dataUri=id=>'data:image/png;base64,'+readFileSync(new URL('../public/parts/card-assembler/'+assets.get(id).src,import.meta.url)).toString('base64');
const originals=new Map(FULL_ART_LEGACY_LAYERS.filter(n=>n.type==='image').map(n=>[n.id,dataUri('as.card.full-art.'+FULL_ART_ROLES[n.id][0]+'.v1')]));
function legacy(){return {id:'gorefire',name:'Gorefire Slash',group:'Cards',width:360,height:540,clipShape:'card',layers:FULL_ART_LEGACY_LAYERS.map(n=>({...structuredClone(n),...(n.type==='image'?{src:originals.get(n.id)}:{})}))};}

test('full art preserves the original 13-layer stack and exact source crops',()=>{
 const doc=fullArtPreset(),scale=1024/360;
 assert.equal(doc.width,1024);assert.equal(doc.height,1536);assert.equal(doc.clipShape,'card');
 assert.deepEqual(doc.items.map(n=>n.role),['outer-frame','artwork','rules-container','cost-banner','title','rules','action-icon','action-value','mana-icon','mana-value','stamina-icon','stamina-value','type']);
 assert.equal(doc.items.filter(n=>n.asset==='text').length,6);
 for(const [i,original] of FULL_ART_LEGACY_LAYERS.entries()){
  const item=doc.items[i];
  assert.deepEqual([item.x,item.y,item.w,item.h],[original.x*scale,original.y*scale,original.w*scale,original.h*scale]);
  assert.deepEqual(item.sourceRect,original.trim);
  if(original.type==='text'){assert.equal(item.text,original.text);assert.equal(item.fontSize,original.fontSize*scale);}
 }
 assert.equal(doc.items[0].locked,true);
 assert.deepEqual(doc.items.filter(n=>n.clipToCard).map(n=>n.id),['layer.artwork']);
 assert.deepEqual(fromRecipe(toRecipe(doc)),doc);
});

test('three independent cost pairs leave the hanging banner separate',()=>{
 const doc=fullArtPreset();
 for(const cost of ['action','mana','stamina'])assert.deepEqual(doc.items.filter(n=>n.group==='cost-'+cost).map(n=>n.role),[cost+'-icon',cost+'-value']);
 assert.equal(doc.items.find(n=>n.role==='cost-banner').group,'');
 assert.equal(doc.items.find(n=>n.role==='action-value').text,'1');
 assert.equal(doc.items.find(n=>n.role==='mana-value').text,'0');
 assert.equal(doc.items.find(n=>n.role==='stamina-value').text,'2');
});

test('card clip reproduces the native chamfer path independently of image crop',()=>{
 assert.deepEqual(CARD_CLIP_POLYGON,[[.12,.04],[.88,.04],[.95,.11],[.95,.9],[.88,.966],[.12,.966],[.052,.9],[.052,.11]]);
 const points=[...cardClipPath(360,540).matchAll(/[ML]([^ ]+) ([^ ]+)/g)].map(m=>[Number(m[1]),Number(m[2])]);
 assert.deepEqual(points,CARD_CLIP_POLYGON.map(([x,y])=>[x*360,y*540]));
 assert.ok(cardClipPath(360,540).endsWith(' Z'));
});

test('legacy original bytes resolve to bundled images and preserve every normalized layer',async()=>{
 const input=legacy();assert.equal(isLegacyCard(input),true);
 const result=await fromLegacyCard(input);
 assert.deepEqual(result.items,fullArtPreset().items);
 assert.equal(result.customAssets,undefined);
 assert.equal(result.name,'Gorefire Slash');
 assert.equal(result.presetId,'legacy.gorefire');
 assert.deepEqual(validate(result),result);
});

test('legacy importer refuses unsupported geometry and wrong document kinds',async()=>{
 const rotated=legacy();rotated.layers[0].rotation=45;
 await assert.rejects(()=>fromLegacyCard(rotated),/Rotate legacy layers/);
 const scaled=legacy();scaled.layers[1].artScale=150;
 await assert.rejects(()=>fromLegacyCard(scaled),/art scale must be 100/);
 assert.equal(isLegacyCard(fullArtPreset()),false);
 await assert.rejects(()=>fromLegacyCard(fullArtPreset()),/original layered card/);
 const duplicate=legacy();duplicate.layers[1].id=duplicate.layers[0].id;
 await assert.rejects(()=>fromLegacyCard(duplicate),/unique IDs/);
});

test('legacy importer rejects external image references and forged PNG data',async()=>{
 for(const src of ['https://example.com/art.png','data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=','data:image/png;base64,AAAA']){
  const input=legacy();input.layers[0].src=src;
  await assert.rejects(()=>fromLegacyCard(input),/embedded PNG|Invalid legacy PNG/);
 }
 const input=legacy();input.layers[0].trim=[0,0,9000,9000];
 await assert.rejects(()=>fromLegacyCard(input),/source|crop/i);
});

test('an unfamiliar embedded PNG remains a portable custom asset without changing artwork placement',async()=>{
 const input=legacy(),art=input.layers.find(n=>n.id==='art');
 art.src=dataUri('as.card.background.charcoal.v1');
 const result=await fromLegacyCard(input),custom=result.customAssets;
 assert.equal(custom.length,1);assert.match(custom[0].id,/^custom\.legacy-[a-f0-9]{64}$/);
 assert.equal(custom[0].src,art.src);assert.equal(custom[0].width,1024);assert.equal(custom[0].height,1536);
 const actual=result.items.find(n=>n.role==='artwork'),expected=fullArtPreset().items.find(n=>n.role==='artwork');
 assert.equal(actual.asset,custom[0].id);assert.deepEqual({...actual,asset:expected.asset},expected);
 assert.deepEqual(fromRecipe(toRecipe(result)),result);
});
