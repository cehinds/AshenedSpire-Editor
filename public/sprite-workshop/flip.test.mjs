import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localMatrix,worldMatrix,setWorldMatrix,point,inverse,movePivot,reparent,anchorWorld,fitWeapon,validateProject,effectivePose} from './core.mjs';
import {createLayerGroup,ungroupLayer,assertMovable} from './parts.mjs';

const near=(a,b)=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-7,`${a} != ${b}`));
const part=(id,extra={})=>({id,name:id,assetId:'art',x:0,y:0,rotation:0,scale:1,pivot:[256,256],anchors:[],visible:true,locked:false,opacity:1,...extra});
const starter=()=>JSON.parse(readFileSync(new URL('./starter.json',import.meta.url),'utf8'));

test('horizontal flip mirrors around the pivot and inverse hit coordinates match the source pixel',()=>{
  const l=part('shield',{x:13,y:-7,pivot:[200,250]});
  const pivot=point(localMatrix(l),l.pivot);
  l.flipX=true;
  near(point(localMatrix(l),l.pivot),pivot);
  near(point(localMatrix(l),[170,270]),[243,263]);
  near(point(inverse(localMatrix(l)),[243,263]),[170,270]);
  assert.equal(l.scale,1);
  l.flipX=false;
  near(point(localMatrix(l),[170,270]),[183,263]);
});

test('mirrored affine transforms survive parent changes and pivot edits without moving pixels',()=>{
  for(const parentFlip of [false,true])for(const childFlip of [false,true]){
    const parent=part('parent',{x:43,y:17,rotation:37,scale:1.4,scaleY:.7,skew:.15,flipX:parentFlip});
    const child=part('child',{x:5,y:21,rotation:-23,scale:.8,scaleY:1.2,skew:-.12,flipX:childFlip});
    const pose={layers:[parent,child]},before=worldMatrix(pose,child);
    reparent(pose,child,'parent');near(worldMatrix(pose,child),before);
    assert.equal(child.flipX,parentFlip!==childFlip);
    movePivot(child,[174,302]);near(worldMatrix(pose,child),before);
    setWorldMatrix(pose,child,before);near(worldMatrix(pose,child),before);
    reparent(pose,child,null);near(worldMatrix(pose,child),before);
    assert.equal(child.flipX,childFlip);assert.ok(child.scale>0&&child.scaleY>0);
  }
});

test('independent mirrored weapon fitting preserves direction, geometry and other layers',()=>{
  const body=part('body',{role:'body',anchors:[{id:'H2',kind:'grip',x:180,y:240}]}),
    parent=part('parent',{x:21,y:18,rotation:31,scale:1.2,flipX:true}),
    weapon=part('left-weapon',{role:'weapon',parentId:'parent',handAnchor:'H2',flipX:true,rotation:-20,pivot:[215,260],anchors:[{id:'grip',kind:'grip',x:215,y:260}]}),
    pose={gripMode:'independent',layers:[body,parent,weapon]},before=worldMatrix(pose,weapon),others=structuredClone(pose.layers.slice(0,2));
  fitWeapon(pose,'left-weapon');
  near(anchorWorld(pose,['left-weapon','grip']),anchorWorld(pose,['body','H2']));
  near(worldMatrix(pose,weapon).slice(0,4),before.slice(0,4));
  assert.equal(weapon.flipX,true);assert.deepEqual(pose.layers.slice(0,2),others);
});

test('grouping mirrored parts and ungrouping a mirrored group preserve world placement',()=>{
  const a=part('a',{flipX:true,x:30}),b=part('b',{rotation:15,y:19}),pose={layers:[a,b]};
  const before=[worldMatrix(pose,a),worldMatrix(pose,b)];
  const group=createLayerGroup(pose,['a','b'],'Pair','pair');
  near(worldMatrix(pose,a),before[0]);near(worldMatrix(pose,b),before[1]);
  group.flipX=true;group.rotation=26;
  const reflected=[worldMatrix(pose,a),worldMatrix(pose,b)];
  ungroupLayer(pose,group.id);
  near(worldMatrix(pose,a),reflected[0]);near(worldMatrix(pose,b),reflected[1]);
  assert.equal(a.flipX,false);assert.equal(b.flipX,true);
  const locked=structuredClone(pose);locked.layers[0].locked=true;
  const changed=structuredClone(locked);changed.layers[0].flipX=!changed.layers[0].flipX;
  assert.throws(()=>assertMovable(locked,changed),/Unlock/);
});

test('project and frame flips round-trip independently; malformed flip fields and negative scales fail validation',()=>{
  const p=starter(),frame=p.animations.attack.frames[0],weapon=p.poses[frame.poseId].layers.find(l=>l.id==='weapon');
  weapon.flipX=true;frame.overrides={weapon:{flipX:false}};
  const saved=validateProject(JSON.parse(JSON.stringify(p)));
  assert.equal(saved.poses[frame.poseId].layers.find(l=>l.id==='weapon').flipX,true);
  assert.equal(effectivePose(saved,saved.animations.attack.frames[0]).layers.find(l=>l.id==='weapon').flipX,false);
  for(const bad of ['true',1,null,{}]){
    const malformed=structuredClone(p);malformed.poses[frame.poseId].layers.find(l=>l.id==='weapon').flipX=bad;
    assert.throws(()=>validateProject(malformed),/horizontal flip/);
    const override=structuredClone(p);override.animations.attack.frames[0].overrides.weapon.flipX=bad;
    assert.throws(()=>validateProject(override),/horizontal flip/);
  }
  weapon.scale=-1;assert.throws(()=>validateProject(p),/Invalid transform/);
});
