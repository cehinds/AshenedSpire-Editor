import test from 'node:test';
import assert from 'node:assert/strict';
import {preset,validate,toRecipe,fromRecipe,ASSETS,MAX_CUSTOM_IMAGE_BYTES,MAX_CUSTOM_TOTAL_BYTES,MAX_CUSTOM_ASSETS} from '../public/parts/card-assembler/model.mjs';

const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=';
const asset=(extra={})=>({id:'custom.example',name:'Imported ability art',width:1,height:1,src:PNG,...extra});
function customDoc(){const doc=preset();doc.customAssets=[asset()];const art=doc.items.find(n=>n.role==='artwork');Object.assign(art,{asset:'custom.example',cropX:.2,cropY:.8,fit:'cover',tintColor:'#aabbcc',tintAmount:.3});return doc;}

test('custom raster references, crop positions and appearance survive native and recipe interchange',()=>{
  const doc=customDoc();assert.deepEqual(validate(doc),doc);assert.deepEqual(fromRecipe(toRecipe(doc)),doc);
  const native=validate(doc);native.customAssets[0].name='Changed';assert.equal(doc.customAssets[0].name,'Imported ability art');
  assert.equal(Object.hasOwn(validate(preset()),'customAssets'),false);
  assert.equal(Object.hasOwn(toRecipe(preset()),'customAssets'),false);
  const empty=preset();empty.customAssets=[];assert.deepEqual(fromRecipe(toRecipe(empty)),empty);
});

test('PNG/JPEG/WebP magic checks reject remote URLs, SVG, malformed base64 and MIME spoofing',()=>{
  const invalid=['https://example.com/a.png','data:image/svg+xml;base64,PHN2Zy8+','data:image/png;base64,PHN2Zy8+','data:image/jpeg;base64,aGVsbG8=','data:image/webp;base64,aGVsbG8=','data:image/png;base64,abcd!===','data:image/png;base64,ab=c','data:image/png;base64,'];
  for(const src of invalid){const doc=customDoc();doc.customAssets[0].src=src;assert.throws(()=>validate(doc));}
  const jpeg='data:image/jpeg;base64,'+Buffer.from([255,216,255,224,0,2,255,217]).toString('base64');
  const webp='data:image/webp;base64,'+Buffer.from('RIFF1234WEBPVP8 ','ascii').toString('base64');
  for(const src of [jpeg,webp]){const doc=customDoc();doc.customAssets[0].src=src;assert.equal(validate(doc).customAssets[0].src,src);}
});

test('custom IDs are unique, safe, noncolliding and all image references must resolve',()=>{
  for(const id of ['builtin','custom.','custom.<svg>','as.card.frame.balanced.v1']){const doc=customDoc();doc.customAssets[0].id=id;assert.throws(()=>validate(doc),/ID/);}
  const duplicate=customDoc();duplicate.customAssets.push(asset());assert.throws(()=>validate(duplicate),/unique/);
  const missing=customDoc();missing.customAssets=[];assert.throws(()=>validate(missing),/Unknown component/);
  const orphan=customDoc();orphan.items.find(n=>n.role==='artwork').asset='custom.missing';assert.throws(()=>validate(orphan),/Unknown component/);
});

test('asset dimensions are bounded integers and PNG dimensions must match header metadata',()=>{
  for(const extra of [{width:0},{height:4097},{width:1.5},{height:Infinity},{width:2},{height:2}]){const doc=customDoc();Object.assign(doc.customAssets[0],extra);assert.throws(()=>validate(doc),/dimensions/);}
});

test('encoded image, total, and asset-count limits reject oversized imports before decode',()=>{
  assert.equal(MAX_CUSTOM_IMAGE_BYTES,12*1024*1024);assert.equal(MAX_CUSTOM_TOTAL_BYTES,40*1024*1024);assert.equal(MAX_CUSTOM_ASSETS,30);
  const count=customDoc();count.customAssets=Array.from({length:31},(_,i)=>asset({id:'custom.'+i}));assert.throws(()=>validate(count),/30/);
  const large=customDoc();large.customAssets[0].src='data:image/png;base64,'+'A'.repeat(MAX_CUSTOM_IMAGE_BYTES+4);assert.throws(()=>validate(large),/encoded limit/);
  const encoded=PNG.split(',')[1],padded=encoded.slice(0,-1)+'A'.repeat(11*1024*1024-encoded.length)+'=';
  const total=preset();total.customAssets=Array.from({length:4},(_,i)=>asset({id:'custom.'+i,src:'data:image/png;base64,'+padded}));
  assert.throws(()=>validate(total),/40 MB/);
});

test('crop fields are optional image-only finite numbers within zero and one',()=>{
  const existing=preset();assert.ok(validate(existing).items.every(n=>!Object.hasOwn(n,'cropX')));
  for(const value of [-.01,1.01,NaN,Infinity,'0.5']){const doc=customDoc();doc.items[0].cropX=value;assert.throws(()=>validate(doc),/crop positions/);}
  const text=customDoc();text.items.find(n=>n.asset==='text').cropY=.5;assert.throws(()=>validate(text),/crop positions/);
  const edge=customDoc();Object.assign(edge.items[0],{cropX:0,cropY:1});assert.deepEqual(validate(edge),edge);
});

test('source rectangles and card clipping retain normalized source geometry in both formats',()=>{
  const doc=customDoc();doc.clipShape='card';
  const art=doc.items.find(n=>n.role==='artwork');Object.assign(art,{sourceRect:[.1,.2,.5,.6],clipToCard:true});
  assert.deepEqual(fromRecipe(toRecipe(doc)),doc);
  const output=validate(doc);output.items.find(n=>n.role==='artwork').sourceRect[0]=.2;
  assert.equal(art.sourceRect[0],.1);
  const builtin=doc.items[0],source=ASSETS.find(n=>n.id===builtin.asset);
  builtin.sourceRect=[0,0,source.width,source.height];builtin.clipToCard=false;
  assert.deepEqual(validate(doc),doc);
  assert.equal(Object.hasOwn(validate(preset()),'clipShape'),false);
});

test('invalid source rectangle bounds, text clipping and unknown clip shapes are rejected',()=>{
  for(const rect of [[0,0,2,1],[-1,0,1,1],[0,0,0,1],[0,0,1,Infinity],[0,0,1],[.5,.5,.6,.6],'bad']){
    const doc=customDoc();doc.items.find(n=>n.role==='artwork').sourceRect=rect;assert.throws(()=>validate(doc),/Source rectangle/);
  }
  for(const fields of [{sourceRect:[0,0,1,1]},{clipToCard:true}]){const doc=customDoc();Object.assign(doc.items.find(n=>n.asset==='text'),fields);assert.throws(()=>validate(doc));}
  const flag=customDoc();flag.items[0].clipToCard='true';assert.throws(()=>validate(flag),/boolean/);
  const shape=customDoc();shape.clipShape='<svg>';assert.throws(()=>validate(shape),/clipping shape/);
});
