import test from 'node:test';
import assert from 'node:assert/strict';
import {recolorPixels,manaTrimMask} from '../public/parts/card-assembler/appearance.mjs';
import {preset,validate,toRecipe,fromRecipe} from '../public/parts/card-assembler/model.mjs';
const pixels = (...rgba) => new Uint8ClampedArray(rgba.flat());

test('optional image appearance survives native and recipe roundtrip without new defaults',()=>{
  const original=preset();assert.deepEqual(validate(original),original);
  assert.ok(original.items.every(n=>!Object.hasOwn(n,'tintColor')));
  const image=original.items.find(n=>n.role==='mana-icon');
  Object.assign(image,{tintColor:'#11aa44',tintAmount:.35,trimColor:'#d5aa52',trimAmount:1});
  assert.deepEqual(validate(original),original);
  assert.deepEqual(fromRecipe(toRecipe(original)),original);
  const partial=preset();partial.items[0].tintAmount=0;
  assert.equal(validate(partial).items[0].tintAmount,0);
  assert.equal(Object.hasOwn(validate(partial).items[0],'tintColor'),false);
});

test('invalid appearance data is rejected in documents and the pixel API',()=>{
  for(const patch of [{tintColor:'url(bad)'},{trimColor:'#fff'},{tintAmount:NaN},{trimAmount:Infinity},{trimAmount:-1},{tintAmount:1.1}]){
    const doc=preset();Object.assign(doc.items[0],patch);assert.throws(()=>validate(doc));
    assert.throws(()=>recolorPixels(pixels([100,100,100,255]),patch));
  }
  const doc=preset();doc.items.find(n=>n.asset==='text').tintAmount=0;assert.throws(()=>validate(doc),/image layers/);
  assert.throws(()=>recolorPixels(new Uint8ClampedArray(3)),/RGBA/);
  assert.throws(()=>recolorPixels([1,2,3,4]),/RGBA/);
  assert.throws(()=>recolorPixels(pixels([1,2,3,4]),{manaTrim:'true'}),/boolean/);
});

test('zero effect returns an independent exact copy; every alpha byte is retained',()=>{
  const source=pixels([10,40,80,0],[80,100,120,77],[200,150,50,255]);
  const unchanged=recolorPixels(source);assert.deepEqual(unchanged,source);assert.notEqual(unchanged,source);
  const result=recolorPixels(source,{tintColor:'#aa3377',tintAmount:1,trimAmount:1,manaTrim:true});
  assert.deepEqual([result[3],result[7],result[11]],[0,77,255]);
  assert.deepEqual(result.slice(0,4),source.slice(0,4));
  assert.deepEqual(source,pixels([10,40,80,0],[80,100,120,77],[200,150,50,255]));
});

test('metal becomes gold while dark relief and bright highlights remain distinct',()=>{
  const source=pixels([35,35,35,255],[128,128,128,255],[225,225,225,255],[100,75,40,255],[255,255,255,255]);
  const result=recolorPixels(source,{manaTrim:true,trimAmount:1});
  for(const index of [0,4,8,12])assert.ok(result[index]>result[index+1]&&result[index+1]>result[index+2]);
  assert.ok(result[0]<result[4]&&result[4]<result[8]);
  assert.ok(result[4]-result[6]>100,'midtone trim has a visible gold hue');
  assert.deepEqual(result.slice(16),source.slice(16),'white specular reflection stays white');
  assert.equal(manaTrimMask(100,75,40),1);
});

test('selective trim preserves saturated blue, cyan and pale blue gem facets exactly',()=>{
  const source=pixels([0,30,220,255],[5,190,255,255],[100,240,255,255],[220,245,255,255],[255,255,255,255]);
  assert.deepEqual(recolorPixels(source,{manaTrim:true,trimAmount:1}),source);
  const a=manaTrimMask(100,100,104),b=manaTrimMask(100,100,109),c=manaTrimMask(100,100,115);
  assert.ok(a>b&&b>c&&c===0,'blue protection transitions smoothly');
});

test('whole-component tint works independently and trim only affects its metal mask',()=>{
  const source=pixels([0,30,220,255],[128,128,128,255]);
  assert.deepEqual(recolorPixels(source,{trimAmount:1,manaTrim:false}),source);
  const tinted=recolorPixels(source,{tintColor:'#aa3377',tintAmount:.8});
  assert.notDeepEqual(tinted.slice(0,3),source.slice(0,3));
  const both=recolorPixels(source,{tintColor:'#aa3377',tintAmount:.8,trimAmount:1,manaTrim:true});
  assert.deepEqual(both.slice(0,4),tinted.slice(0,4));
  assert.notDeepEqual(both.slice(4,7),tinted.slice(4,7));
  assert.ok(both[4]>both[5]&&both[5]>both[6]);
});
