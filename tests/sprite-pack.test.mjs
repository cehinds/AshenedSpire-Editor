import test from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,strToU8} from 'fflate';
import {safePackPath,validatePack,unpackSpritePack,portablePackProject,projectPoseRows,PACK_SCHEMA} from '../src/sprite-pack.mjs';
import {acceptsParentMessage,validateBridgeRequest} from '../public/sprite-workshop/parent-bridge.mjs';

const manifest=()=>({schema:PACK_SCHEMA,id:'review',title:'Layered armor',projects:[{id:'reaver-default',label:'Reaver / default',classId:'reaver',armorId:'default',projectPath:'reaver.rig.json'}]});
const rig=()=>({schemaVersion:1,id:'reaver',canvas:{width:512,height:512},assets:{body:{id:'body',src:'assets/body.png'}},poses:{idle:{id:'idle',name:'Sword and shield',weaponType:'sword',offhandType:'shield',gripMode:'one-handed',reviewed:false,layers:[{id:'body',assetId:'body',role:'body',x:0,y:0,scale:1,rotation:0,pivot:[256,256],opacity:1,visible:true,locked:false,anchors:[]}]}},animations:{idle:{id:'idle',frames:[{id:'idle-frame',poseId:'idle',duration:1000}]}},queues:{review:{id:'review',items:[{id:'idle-item',animationId:'idle',repeats:1,pause:0}]}}});
test('portable pack resolves shared artwork and retains editable pose metadata',async()=>{
  const bytes=zipSync({'manifest.json':strToU8(JSON.stringify(manifest())),'reaver.rig.json':strToU8(JSON.stringify(rig())),'assets/body.png':new Uint8Array([1,2,3])});
  const pack=unpackSpritePack(bytes), project=await portablePackProject(pack,pack.manifest.projects[0]);
  assert.equal(project.assets.body.src,'data:image/png;base64,AQID');
  assert.equal(project.poses.idle.layers[0].role,'body');
  assert.deepEqual(projectPoseRows(project),[{id:'idle',label:'Sword and shield',weaponType:'sword',offhand:'shield',reviewed:false}]);
});
test('portable import preserves body-above-weapon order and reversible weapon facing',async()=>{
  const source=rig(), body=source.poses.idle.layers[0];
  source.assets.shield={id:'shield',src:'assets/shield.png'};
  source.poses.idle.layers=[{...body,id:'shield',assetId:'shield',role:'weapon',flipX:true,anchors:[{id:'grip',x:256,y:256}]},body];
  const bytes=zipSync({'manifest.json':strToU8(JSON.stringify(manifest())),'reaver.rig.json':strToU8(JSON.stringify(source)),'assets/body.png':new Uint8Array([1,2,3]),'assets/shield.png':new Uint8Array([4,5,6])});
  const pack=unpackSpritePack(bytes), imported=await portablePackProject(pack,pack.manifest.projects[0]);
  assert.deepEqual(imported.poses.idle.layers,source.poses.idle.layers);
  assert.equal(imported.poses.idle.layers.at(-1).role,'body');
  assert.equal(imported.poses.idle.layers[0].flipX,true);
});
test('pack paths reject traversal, absolute paths and remote sources',()=>{
  for(const path of ['../outside','/absolute','C:/private','https://example.com/art.png','assets/../secret','assets\\image.png','%2e%2e/file','./image.png'])assert.throws(()=>safePackPath(path));
  assert.equal(safePackPath('assets/reaver.png'),'assets/reaver.png');
});
test('pack metadata and missing projects fail before replacing current work',()=>{
  const duplicate=manifest();duplicate.projects.push({...duplicate.projects[0]});assert.throws(()=>validatePack(duplicate),/duplicate/);
  assert.throws(()=>unpackSpritePack(zipSync({'manifest.json':strToU8(JSON.stringify(manifest()))})),/Missing project/);
});
test('missing referenced image fails portable loading',async()=>{
  const pack=unpackSpritePack(zipSync({'manifest.json':strToU8(JSON.stringify(manifest())),'reaver.rig.json':strToU8(JSON.stringify(rig()))}));
  await assert.rejects(portablePackProject(pack,pack.manifest.projects[0]),/Missing pack file/);
});
test('Workshop bridge accepts only its parent origin and embedded artwork',()=>{
  const parent={},event={source:parent,origin:'http://localhost',data:{type:'sprite-workshop:open'}};
  assert.equal(acceptsParentMessage(event,parent,'http://localhost'),true);
  assert.equal(acceptsParentMessage({...event,source:{}},parent,'http://localhost'),false);
  assert.equal(acceptsParentMessage({...event,origin:'https://other.example'},parent,'http://localhost'),false);
  assert.throws(()=>validateBridgeRequest({type:'sprite-workshop:open',requestId:'request',recoveryKey:'pack:review:reaver',project:rig()}),/embedded/);
  const project=rig();project.assets.body.src='data:image/png;base64,AQID';
  assert.equal(validateBridgeRequest({type:'sprite-workshop:open',requestId:'request',recoveryKey:'pack:review:reaver',project}).project,project);
});
