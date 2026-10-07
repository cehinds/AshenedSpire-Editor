import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {clone,validateProject,worldMatrix,effectivePose,point} from './core.mjs';
import {descendants,createLayerGroup,ungroupLayer} from './parts.mjs';
import {upgradeHandComponents} from './hand-components.mjs';
const starter=()=>JSON.parse(readFileSync(new URL('./starter.json',import.meta.url),'utf8'));
const near=(a,b)=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-6));
test('all seven attacks get two individually selectable hands and a non-raster group',()=>{
 const p=starter();assert.equal(upgradeHandComponents(p),7);validateProject(p);
 for(let i=1;i<=7;i++){
  const pose=p.poses['ATK-0'+i],group=pose.layers.find(l=>l.id==='hands');assert.equal(group.role,'group');
  for(const id of ['hand-L','hand-R']){const h=pose.layers.find(l=>l.id===id);assert.equal(h.parentId,group.id);assert.equal(h.role,'part');assert.ok(h.anchors.some(a=>a.kind==='grip'));}
 }
 const saved=JSON.stringify(p);assert.equal(upgradeHandComponents(p),0);assert.equal(JSON.stringify(p),saved);
});
test('group/ungroup preserve authored hand placements and restore arm connections',()=>{
 const p=starter(),old=clone(p.poses['ATK-02']);upgradeHandComponents(p);const pose=p.poses['ATK-02'];
 for(const id of ['hand-L','hand-R'])near(worldMatrix(pose,pose.layers.find(l=>l.id===id)),worldMatrix(old,old.layers.find(l=>l.id===id)));
 assert.deepEqual(ungroupLayer(pose,'hands'),['hand-L','hand-R']);
 assert.equal(pose.layers.find(l=>l.id==='hand-L').parentId,'forearm-L');
 const group=createLayerGroup(pose,['hand-L','hand-R'],'Hands');assert.equal(descendants(pose,[group.id]).size,3);validateProject(p);
});
test('migration preserves existing parent and foreground frame transforms',()=>{
 const p=starter(),f=p.animations.attack.frames.find(f=>f.poseId==='ATK-04');
 f.overrides={body:{x:12,rotation:11},foreground:{x:-4,rotation:-7}};
 const old=effectivePose(p,f);upgradeHandComponents(p);const pose=effectivePose(p,f);
 near(worldMatrix(pose,pose.layers.find(l=>l.id==='hand-L')),worldMatrix(old,old.layers.find(l=>l.id==='body')));
 near(worldMatrix(pose,pose.layers.find(l=>l.id==='hand-R-fingers')),worldMatrix(old,old.layers.find(l=>l.id==='foreground')));
 validateProject(p);
});
test('imported group can ungroup without original arm parents',()=>{
 const p=starter();upgradeHandComponents(p);const source=p.poses['ATK-02'],included=descendants(source,['hands']);
 const pose={...clone(source),layers:clone(source.layers.filter(l=>included.has(l.id)))};
 const before=pose.layers.filter(l=>l.role!=='group').map(l=>[l.id,worldMatrix(pose,l)]);
 ungroupLayer(pose,'hands');for(const [id,m] of before)near(worldMatrix(pose,pose.layers.find(l=>l.id===id)),m);
 assert.ok(pose.layers.every(l=>l.parentId===null));
});
