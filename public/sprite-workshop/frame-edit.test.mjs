import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {clone,validateProject} from './core.mjs';
import {addFrame,removeFrame,makeFrameIndependent} from './frame-edit.mjs';
const starter=()=>JSON.parse(readFileSync(new URL('./starter.json',import.meta.url),'utf8'));
test('adding a frame creates independent editable layers and inserts after selection',()=>{
  const p=starter(),before=clone(p.poses['ATK-02']),count=p.animations.attack.frames.length;
  const next=addFrame(p,'attack',2,p.poses['ATK-02']);
  assert.equal(next.index,3);assert.equal(p.animations.attack.frames.length,count+1);
  p.poses[next.poseId].layers.push({...clone(p.poses[next.poseId].layers.at(-1)),id:'new-component'});assert.deepEqual(p.poses['ATK-02'],before);validateProject(p);
});
test('frame-specific component edits bake overrides without modifying shared poses',()=>{
  const p=starter(),f=p.animations.attack.frames[2],old=f.poseId,original=clone(p.poses[old]);
  const id=original.layers[0].id;f.overrides={[id]:{x:77}};
  const detached=makeFrameIndependent(p,'attack',2);
  assert.equal(p.poses[detached].layers[0].x,77);assert.deepEqual(f.overrides,{});
  p.poses[detached].layers.push({...clone(p.poses[detached].layers.at(-1)),id:'new-component'});assert.deepEqual(p.poses[old],original);validateProject(p);
});
test('delete chooses the next frame, then the previous at the end; empty set supports add',()=>{
  const p=starter(),frames=p.animations.attack.frames,expected=frames[3].poseId;
  assert.equal(removeFrame(p,'attack',2).poseId,expected);
  while(frames.length)removeFrame(p,'attack',frames.length-1);
  assert.throws(()=>removeFrame(p,'attack',0),/no selected frame/);
  const next=addFrame(p,'attack',0,p.poses['ATK-02']);assert.equal(next.index,0);validateProject(p);
});
