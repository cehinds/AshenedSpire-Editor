import test from 'node:test';
import assert from 'node:assert/strict';
import {fitWeapon,anchorWorld,checkPose} from './core.mjs';
const layer=(id,role,x,anchors=[])=>({id,name:id,role,x,y:0,rotation:25,scale:1,pivot:[0,0],anchors,locked:false,visible:true,opacity:1});
function pose(){return {gripMode:'independent',reviewed:false,layers:[
  {...layer('body','body',0,[{id:'H1',kind:'grip',x:300,y:250},{id:'H2',kind:'grip',x:180,y:250}]),rotation:0},
  {...layer('left-weapon','weapon',30,[{id:'grip',kind:'grip',x:0,y:0}]),handAnchor:'H2'},
  {...layer('right-weapon','weapon',50,[{id:'grip',kind:'grip',x:0,y:0}]),handAnchor:'H1'}
]};}
test('independent fitting moves only the selected weapon to its assigned palm',()=>{
  const p=pose(),right=structuredClone(p.layers[2]);fitWeapon(p,'left-weapon');
  assert.deepEqual(anchorWorld(p,['left-weapon','grip']),[180,250]);assert.deepEqual(p.layers[2],right);
  assert.ok(Math.abs(p.layers[1].rotation-25)<1e-9);assert.ok(Math.abs(p.layers[1].scale-1)<1e-9);
  assert.ok(checkPose(p).some(message=>message.includes('right-weapon')));
  assert.ok(!checkPose(p).some(message=>message.includes('left-weapon')));
});
test('independent fitting requires a selected, assigned, unlocked weapon',()=>{
  const p=pose(),before=structuredClone(p);assert.throws(()=>fitWeapon(p),/Select/);assert.deepEqual(p,before);
  p.layers[1].locked=true;assert.throws(()=>fitWeapon(p,'left-weapon'),/Unlock/);
  p.layers[1].locked=false;p.layers[1].id='unassigned';delete p.layers[1].handAnchor;
  assert.throws(()=>fitWeapon(p,'unassigned'),/assigned/);
});
