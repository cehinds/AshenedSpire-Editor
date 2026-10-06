import test from 'node:test';
import assert from 'node:assert/strict';
import {imagePlacement} from '../public/parts/card-assembler/image-placement.mjs';
test('cover crop pans source without changing the image region',()=>{
 const n={x:10,y:20,w:100,h:200,fit:'cover'};
 assert.deepEqual(imagePlacement(n,200,200),{x:-40,y:20,w:200,h:200});
 assert.deepEqual(imagePlacement({...n,cropX:0},200,200),{x:10,y:20,w:200,h:200});
 assert.deepEqual(imagePlacement({...n,cropX:1},200,200),{x:-90,y:20,w:200,h:200});
 assert.equal(n.x,10);
});
test('contain, stretch and vertical crop share canvas and SVG geometry',()=>{
 const n={x:10,y:20,w:200,h:100,fit:'contain'};
 assert.deepEqual(imagePlacement(n,200,200),{x:60,y:20,w:100,h:100});
 assert.deepEqual(imagePlacement({...n,fit:'cover',cropY:1},200,200),{x:10,y:-80,w:200,h:200});
 assert.deepEqual(imagePlacement({...n,fit:'stretch'},200,200),{x:10,y:20,w:200,h:100});
});
