import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localMatrix,worldMatrix,point,reparent,validateProject,clone} from './core.mjs';
import {createLayerGroup,ungroupLayer} from './parts.mjs';
import {resizeMatrix,readControls} from './transform-tools.mjs';
const near=(a,b)=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-7,`${a} != ${b}`));
const part=(id,more={})=>({id,name:id,assetId:'a',x:0,y:0,rotation:0,scale:1,pivot:[0,0],anchors:[],...more});
test('default uniform corner resize snaps while keeping opposite corner fixed',()=>{
 const box=[10,20,110,70],m=localMatrix(part('a',{rotation:30,x:40,y:50}));
 const out=resizeMatrix(m,box,'se',point(m,[133,81.5]),{step:.05});
 near(point(out,[10,20]),point(m,[10,20]));near(point(out,[110,70]),point(m,[135,82.5]));
});
test('side handles stretch one axis; center resize preserves pivot',()=>{
 const box=[10,20,110,70],m=localMatrix(part('a',{rotation:-23,x:11,y:7}));
 const side=resizeMatrix(m,box,'e',point(m,[160,45]),{uniform:false});
 near(point(side,[10,20]),point(m,[10,20]));near(point(side,[110,70]),point(m,[160,70]));
 const center=resizeMatrix(m,box,'se',point(m,[160,95]),{center:[60,45]});
 near(point(center,[60,45]),point(m,[60,45]));near(point(center,[110,70]),point(m,[160,95]));
});
test('stretch groups and reparent under rotated anisotropic parents without drifting',()=>{
 const a=part('a',{x:17,rotation:38,scale:1.7,scaleY:.6}),b=part('b',{y:33,rotation:-28,scale:.7,scaleY:1.9}),p={layers:[a,b],bones:[]};
 const before=worldMatrix(p,b);reparent(p,b,'a');near(worldMatrix(p,b),before);
 p.layers.push(part('c',{x:60,y:90}));const group=createLayerGroup(p,['b','c'],'Hands');group.scale=1.3;group.scaleY=.7;group.rotation=21;
 const stretched=worldMatrix(p,b);ungroupLayer(p,group.id);near(worldMatrix(p,b),stretched);
});
test('axis scales and shear survive JSON and frame validation; invalid scales rejected',()=>{
 const p=JSON.parse(readFileSync(new URL('./starter.json',import.meta.url),'utf8'));
 const l=p.poses['ATK-02'].layers[0];l.scaleY=.8;l.skew=.2;
 p.animations.attack.frames[0].overrides={weapon:{scale:1.1,scaleY:.7,skew:.1}};
 validateProject(JSON.parse(JSON.stringify(p)));
 const bad=clone(p);bad.animations.attack.frames[0].overrides.weapon.scaleY=0;assert.throws(()=>validateProject(bad));
});
test('controls default to uniform snapped scaling and sanitize malformed saves',()=>{
 assert.equal(readControls().freeScale,false);assert.equal(readControls().scaleSnap,true);
 assert.deepEqual(readControls(null),readControls());assert.equal(readControls({scaleStep:-5,bypassKey:'bad'}).scaleStep,5);
});
