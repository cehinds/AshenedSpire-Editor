import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCSV,toCSV,reparent,validateNodes,validateProject,historyState,commit,undo,redo,inspectERD,suppliedRows,mapTagRows,deckIssues} from '../src/core.mjs';
import {sample} from '../src/native/model/presentationSequence.js';
const nodes=parseCSV(readFileSync(new URL('../src/sources/nodes.csv',import.meta.url),'utf8'));
test('actual tag snapshot and quoted CSV round-trip preserve all columns',()=>{assert.deepEqual(validateNodes(nodes),[]);assert.deepEqual(parseCSV(toCSV(nodes)),nodes);assert.equal(nodes.find(n=>n.id==='guard').parentId,'card');});
test('reparent refuses cycles without mutating input',()=>{const before=structuredClone(nodes);assert.throws(()=>reparent(nodes,'card','guard'),/cycle/);assert.deepEqual(nodes,before);assert.throws(()=>reparent(nodes,'guard','missing'),/Missing parent/);});
test('history restores unknown fields across transactions',()=>{let h=historyState({foreign:{opaque:[1,2]},name:'a'});h=commit(h,{...h.present,name:'b'});assert.equal(undo(h).present.name,'a');assert.deepEqual(redo(undo(h)).present,h.present);assert.deepEqual(h.present.foreign,{opaque:[1,2]});});
const native={format:'erd-workbench',version:3,pages:[{id:'p1',nodes:[{id:'diagram-only',type:'entity',fields:[{name:'id'},{name:'parentId'},{name:'label'}]}],edges:[],data:{'diagram-only':{mode:'imported',rows:[['proposal:one','card','Example']]}}}]};
test('ERD mapping uses supplied values, never diagram node IDs',()=>{const pages=inspectERD(native),rows=suppliedRows(pages[0],'diagram-only'),result=mapTagRows(rows,{id:'id',parent:'parentId',label:'label'},nodes);assert.equal(result.proposed[0].id,'proposal:one');assert.deepEqual(result.errors,[]);});
test('schema-only and generated sample data supply zero records',()=>{const page=structuredClone(native.pages[0]);delete page.data;assert.deepEqual(suppliedRows(page,'diagram-only'),[]);page.data={'diagram-only':{mode:'generated',rows:[{id:'guessed'}]}};assert.deepEqual(suppliedRows(page,'diagram-only'),[]);});
test('native migration, invalid refs and hard limits checked before mapping',()=>{assert.equal(inspectERD({...native,version:2,...native.pages[0]}).length,1);const bad=structuredClone(native);bad.pages[0].edges=[{from:'diagram-only',to:'missing'}];assert.throws(()=>inspectERD(bad),/Dangling/);assert.throws(()=>inspectERD({...native,pages:Array(41).fill(native.pages[0])}),/1-40/);});
test('mapping duplicates and cycles refuse apply, inherited unknown fields remain',()=>{const result=mapTagRows([{id:'card',parentId:'guard',label:'Card'}],{id:'id',parent:'parentId',label:'label'},nodes);assert(result.errors.some(e=>e.includes('cycle')));assert.equal(result.proposed[0].blurb,nodes.find(n=>n.id==='card').blurb);const duplicate=mapTagRows([{id:'new',label:'A'},{id:'new',label:'B'}],{id:'id',parent:'parentId',label:'label'},nodes);assert(duplicate.errors.some(e=>e.includes('Duplicate')));});
test('deck fixture respects declared ownership and actual unlimited max default',()=>{assert.deepEqual(deckIssues(Array(11).fill('a'),{a:12},{deckMinSize:10,deckMaxSize:10,deckMaxUnlimited:true,classSpellPowerCopies:1},[{id:'a',type:'attack'}]),[]);assert(deckIssues(['a','a'],{a:1},{deckMinUnlimited:true,deckMaxUnlimited:true},[{id:'a',type:'attack'}]).some(e=>e.includes('only 1 owned')));});
const loadJSON=name=>JSON.parse(readFileSync(new URL('../src/'+name,import.meta.url),'utf8'));
function packageFixture(){
  const cards=loadJSON('cards.json'),config=loadJSON('pose-config.json');
  return {schema:'ashenspire.workbench/1',cards,nodes:structuredClone(nodes),deck:cards.slice(0,10).map(c=>c.id),styles:{},scenes:loadJSON('sources/prologue.json'),lab:{base:40,role:2,selected:true,policy:'overflow',cardScale:100},ui:loadJSON('sources/w4a-combat.json'),pose:{...config.components.starter,assets:loadJSON('pose-assets.json')},scenario:{ruleset:'foundations',cardId:cards[0].id,playerHp:40,enemyHp:30},owned:Object.fromEntries(cards.map(c=>[c.id,2])),scenePlacement:{},erdNative:null};
}
test('card proportions survive portable export and reject invalid presentation dimensions',()=>{
  const p=packageFixture();p.styles.ambush={ratioWidth:5,ratioHeight:7,foreign:'keep'};
  const recovered=JSON.parse(JSON.stringify(p));
  assert.deepEqual(validateProject(recovered),[]);
  assert.deepEqual(recovered.styles.ambush,p.styles.ambush);
  for(const value of [0,-1,21,Infinity,'5']){
    p.styles.ambush.ratioWidth=value;
    assert(validateProject(p).includes('Invalid card presentation sidecar'));
  }
});
test('portable source package and retained ERD mapping validate without losing unknown fields',()=>{
  const p=packageFixture();
  assert.deepEqual(validateProject(p),[]);
  p.foreign={opaque:['keep',42]};
  p.pose.foreign={retain:true};
  p.erdNative={raw:structuredClone(native),page:'p1',entity:'diagram-only',mapping:{id:'id',parent:'parentId',label:'label'},foreign:'keep'};
  const before=structuredClone(p);
  assert.deepEqual(validateProject(p),[]);
  assert.deepEqual(p,before);
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))),[]);
  p.erdNative.mapping.parent='';
  assert.deepEqual(validateProject(p),[]);
});

test('native tagging persists as separate draft data and invalid or duplicate association rows are rejected',()=>{
  const p=packageFixture();
  p.tagging=parseCSV(readFileSync(new URL('../src/sources/tagging.csv',import.meta.url),'utf8'));
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))),[]);
  p.tagging.push({...p.tagging[0]});
  assert(validateProject(p).includes('Duplicate native tag assignment'));
  for(const tagging of [null,{},[null],[{family:'card',objectId:'ambush',tagId:'blade'}]]){
    assert(validateProject({...p,tagging}).includes('Malformed native tag assignments'));
  }
});
test('package import and recovery reject malformed retained ERD before Tags render',()=>{
  const invalid=[
    {raw:{}},
    {raw:native,page:'missing',entity:'diagram-only',mapping:{id:'id',parent:'parentId',label:'label'}},
    {raw:native,page:'p1',entity:'missing',mapping:{id:'id',parent:'parentId',label:'label'}},
    {raw:native,page:'p1',entity:'diagram-only',mapping:{id:'absent',parent:'parentId',label:'label'}},
    {raw:native,page:'p1',entity:'diagram-only',mapping:{id:'id',parent:[],label:'label'}}
  ];
  for(const retained of invalid){const p=packageFixture();p.erdNative=structuredClone(retained);assert(validateProject(p).some(e=>e.startsWith('ERD mapping:')));}
  for(const mutate of [p=>p.nodes.push(null),p=>p.nodes[0].fields=null,p=>p.data['diagram-only'].rows.push(null)]){
    const raw=structuredClone(native);mutate(raw.pages[0]);
    assert.throws(()=>inspectERD(raw));
    const p=packageFixture();p.erdNative={raw,page:'p1',entity:'diagram-only',mapping:{id:'id',parent:'parentId',label:'label'}};
    assert(validateProject(p).some(e=>e.startsWith('ERD mapping:')));
  }
});
test('package validation rejects native pose data that can crash or corrupt sampler',()=>{
  const clip={id:'clip.contact',effect:'shieldBash',cue:'contact',offset:0,duration:430,anchor:'torso',x:0,y:0,size:180,rotation:0,opacity:1,layer:'front',travel:true,muted:false};
  const p=packageFixture();p.pose.clips=[clip];
  assert.deepEqual(validateProject(p),[]);
  assert.doesNotThrow(()=>sample(p.pose,p.pose.duration*.5));
  for(const mutate of [q=>q.anchors={},q=>q.anchors.target=null,q=>q.clips[0].duration=-1,q=>q.clips[0].cue='missing',q=>q.clips.push(null),q=>q.assets={'pose:ATK-01':'invalid'},q=>q.bindings[0].all=null]){
    const invalid=structuredClone(p);mutate(invalid.pose);
    assert(validateProject(invalid).some(e=>e.startsWith('Presentation:')||e==='Malformed presentation project'));
  }
});

test('CSV interchange preserves multiline unicode, escaped headers and literal comment-looking data',()=>{
 const rows=[{'id':'#literal','label,detail':'Rune \"α\"\nSecond\r\nThird','foreign':'x,y'},{'id':'normal','label,detail':'保持','foreign':''}];
 assert.deepEqual(parseCSV(toCSV(rows)),rows);
 assert.deepEqual(parseCSV('#comment\r\nid,label\r\na,"One\r\nTwo"\r\n'),[{id:'a',label:'One\r\nTwo'}]);
 assert.throws(()=>parseCSV('id,id\na,b'),/headers/);assert.throws(()=>parseCSV('id,label\na,"unclosed'),/Unclosed/);
});
