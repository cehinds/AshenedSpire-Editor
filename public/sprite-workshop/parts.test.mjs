import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,worldMatrix,anchorWorld,reparent} from './core.mjs';
import {descendants,groupParts,reorderParts,attachAnchors,assertMovable} from './parts.mjs';
const layer=(id,x,y,parentId=null)=>({id,name:id,x,y,rotation:25,scale:1.2,pivot:[10,20],parentId,locked:false,anchors:[{id:'grip',x:8,y:9}]});
const pose=()=>({layers:[layer('body',20,30),layer('arm',100,80,'body'),layer('hand',10,5,'arm'),layer('axe',40,70)],bones:[]});
const near=(a,b)=>a.forEach((n,i)=>assert.ok(Math.abs(n-b[i])<1e-7));
test('group preserves world geometry and internal unselected children',()=>{
  const p=pose(),before=clone(p);groupParts(p,['arm','axe'],'axe');
  for(const l of p.layers)near(worldMatrix(p,l),worldMatrix(before,before.layers.find(x=>x.id===l.id)));
  assert.equal(p.layers[1].parentId,'axe');assert.equal(p.layers[2].parentId,'arm');
  assert.deepEqual([...descendants(p,['axe'])].sort(),['arm','axe','hand']);
  reparent(p,p.layers[1],null);near(worldMatrix(p,p.layers[2]),worldMatrix(before,before.layers[2]));
});
test('grouping ancestor beneath descendant does not create a cycle',()=>{
  const p=pose(),before=clone(p);groupParts(p,['body','hand'],'hand');
  for(const l of p.layers)near(worldMatrix(p,l),worldMatrix(before,before.layers.find(x=>x.id===l.id)));
});
test('reorder multiple layers keeps their draw order and locks reject movement',()=>{
  const p=pose();reorderParts(p,['body','hand'],'axe',true);
  assert.deepEqual(p.layers.map(l=>l.id),['arm','axe','body','hand']);
  p.layers[2].locked=true;const before=clone(p);assert.throws(()=>reorderParts(p,['body'],'arm',false),/Unlock/);assert.deepEqual(p,before);
});
test('anchor attachment aligns transformed anchors without scale or angle drift',()=>{
  const p=pose(),axe=p.layers[3],before=worldMatrix(p,axe);attachAnchors(p,['axe','grip'],['hand','grip'],true);
  near(anchorWorld(p,['axe','grip']),anchorWorld(p,['hand','grip']));near(worldMatrix(p,p.layers[3]).slice(0,4),before.slice(0,4));
  assert.equal(p.layers[3].parentId,'hand');assert.equal(p.bones.length,1);
});
test('locked child blocks movement through its parent',()=>{
  const p=pose();p.layers[2].locked=true;const next=clone(p);next.layers[1].x+=20;
  assert.throws(()=>assertMovable(p,next),/Unlock hand/);
});
test('connecting guides leaves artwork fixed and rejects cyclic attachment atomically',()=>{
  const p=pose(),before=clone(p);attachAnchors(p,['axe','grip'],['hand','grip']);assert.deepEqual(p.layers,before.layers);
  const connected=clone(p);assert.throws(()=>attachAnchors(p,['body','grip'],['hand','grip'],true),/cycle/);assert.deepEqual(p,connected);
});
