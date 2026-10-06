import test from 'node:test';
import assert from 'node:assert/strict';
import {contentBounds,resizeSelection,snapTranslation,hitHandles,selectionIds,selectionUnits,alignSelection,distributeSelection,groupSelection,ungroupSelection,canEditImageLayer} from '../public/parts/card-assembler/interaction.mjs';
import {bounds,preset,validate} from '../public/parts/card-assembler/model.mjs';
import {referencePreset} from '../public/parts/card-assembler/reference.mjs';

const layer=(id,x=100,y=200,w=100,h=80,extra={})=>({id,asset:'image',x,y,w,h,visible:true,locked:false,group:'',...extra});
const document=(items)=>({width:1024,height:1536,items});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('content bounds include negative overflow, text stroke, padding, and artboard',()=>{
  const doc=document([layer('left',-30,40,20,20),layer('text',1000,1510,80,50,{asset:'text',strokeWidth:10}),layer('hidden',-400,-400,20,20,{visible:false})]);
  assert.deepEqual(contentBounds(doc),{x:-30,y:0,w:1115,h:1565});
  assert.deepEqual(contentBounds(doc,20),{x:-50,y:-20,w:1155,h:1605});
  assert.deepEqual(contentBounds(document([])),{x:0,y:0,w:1024,h:1536});
});

test('card-clipped artwork never enlarges export bounds but unclipped badges still do',()=>{
  const doc=document([layer('cover',-400,-200,2000,2000,{clipToCard:true}),layer('outside',-5000,-5000,20,20,{clipToCard:true}),layer('badge',-65,200,260,310)]);
  assert.deepEqual(contentBounds(doc),{x:-65,y:0,w:1089,h:1536});
  doc.items[2].clipToCard=true;
  assert.deepEqual(contentBounds(doc),{x:0,y:0,w:1024,h:1536});
});

test('reference layout keeps negative resource badges inside expanded export bounds',()=>{
  const doc=referencePreset(),extent=contentBounds(doc);
  assert.deepEqual(validate(doc),doc);
  assert.deepEqual(extent,{x:-65,y:0,w:1089,h:1536});
  assert.ok(doc.items.find(n=>n.role==='action-icon').x<0);
  assert.ok(doc.items.find(n=>n.role==='mana-icon').x<0);
  for(const item of doc.items.filter(n=>n.visible)){
    const stroke=item.asset==='text'?item.strokeWidth/2:0;
    const translated={x:item.x-extent.x-stroke,y:item.y-extent.y-stroke,w:item.w+2*stroke,h:item.h+2*stroke};
    assert.ok(translated.x>=0&&translated.y>=0,item.id+' starts inside export');
    assert.ok(translated.x+translated.w<=extent.w&&translated.y+translated.h<=extent.h,item.id+' ends inside export');
  }
  const selected=selectionIds(doc,'layer.mana-icon');
  const moved=snapTranslation(doc,selected,-100,-240,{enabled:false}).doc;
  const next=contentBounds(moved);
  assert.equal(next.x,-165);assert.equal(next.y,-40);
  assert.equal(next.x+next.w,1024);assert.equal(next.y+next.h,1536);
});

test('all eight resize handles preserve their opposite anchor without aspect lock',()=>{
  for(const handle of ['nw','n','ne','e','se','s','sw','w']){
    const original=layer('a'),doc=document([original]),next=resizeSelection(doc,['a'],handle,20,10,{aspect:false}).items[0];
    if(handle.includes('w')){near(next.x+next.w,200);near(next.x,120);}else{near(next.x,100);near(next.w,handle.includes('e')?120:100);}
    if(handle.includes('n')){near(next.y+next.h,280);near(next.y,210);}else{near(next.y,200);near(next.h,handle.includes('s')?90:80);}
    assert.deepEqual(doc.items[0],original);
  }
});

test('corner resizing preserves aspect by default; center mode retains selection center',()=>{
  const doc=document([layer('a')]);
  const normal=resizeSelection(doc,['a'],'nw',20,0).items[0];
  near(normal.w,80);near(normal.h,64);near(normal.x+normal.w,200);near(normal.y+normal.h,280);
  const centered=resizeSelection(doc,['a'],'se',25,0,{center:true}).items[0];
  near(centered.w,150);near(centered.h,120);near(centered.x+centered.w/2,150);near(centered.y+centered.h/2,240);
  const side=resizeSelection(doc,['a'],'e',25,30,{center:true}).items[0];
  near(side.w,150);near(side.h,80);near(side.x+side.w/2,150);
});

test('resize transforms grouped geometry, caps dimensions and scales editable text',()=>{
  const doc=document([layer('a',100,200,100,80),layer('b',200,240,50,40,{asset:'text',fontSize:100})]);
  const next=resizeSelection(doc,['a','b'],'se',150,80);
  assert.deepEqual(bounds(next.items),{x:100,y:200,w:300,h:160});
  assert.equal(next.items[1].fontSize,200);near(next.items[1].x,300);
  const huge=resizeSelection(doc,['a','b'],'se',100000,100000);
  assert.ok(huge.items.every(n=>n.w<=4096&&n.h<=4096));
  const tiny=resizeSelection(doc,['a','b'],'nw',100000,100000);
  assert.ok(tiny.items.every(n=>n.w>=8&&n.h>=8));
  assert.ok(tiny.items[1].fontSize>=6);
});

test('one locked member prevents resize and translation of the whole selection',()=>{
  const doc=document([layer('a'),layer('b',220,200,50,50,{locked:true})]);
  assert.deepEqual(resizeSelection(doc,['a','b'],'nw',15,20),doc);
  assert.deepEqual(snapTranslation(doc,['a','b'],15,20),{doc,guides:[]});
});

test('translation snaps to artboard center and edges; disabled mode preserves exact deltas',()=>{
  const doc=document([layer('a',100,200,100,80)]);
  const centered=snapTranslation(doc,['a'],360,529,{threshold:5});
  near(centered.doc.items[0].x+50,512);near(centered.doc.items[0].y+40,768);
  assert.deepEqual(centered.guides,[{axis:'x',value:512},{axis:'y',value:768}]);
  const edge=snapTranslation(doc,['a'],-97,-197,{threshold:5});
  near(edge.doc.items[0].x,0);near(edge.doc.items[0].y,0);
  const disabled=snapTranslation(doc,['a'],-97,-197,{enabled:false,grid:20});
  assert.deepEqual([disabled.doc.items[0].x,disabled.doc.items[0].y],[3,3]);assert.deepEqual(disabled.guides,[]);
  const grid=snapTranslation(doc,['a'],17,29,{grid:20,threshold:0});
  assert.deepEqual([grid.doc.items[0].x,grid.doc.items[0].y],[120,220]);
});

test('translation snaps the complete selected box to another visible object',()=>{
  const doc=document([layer('a',10,10,20,20),layer('b',40,10,20,20),layer('target',100,50,40,40)]);
  const next=snapTranslation(doc,['a','b'],38,38,{threshold:4});
  assert.deepEqual(bounds(next.doc.items.slice(0,2)),{x:50,y:50,w:50,h:20});
  near(next.doc.items[1].x-next.doc.items[0].x,30);
});

test('eight handle hit targets select nearest corner or edge and reject empty space',()=>{
  const box={x:100,y:200,w:100,h:80};
  const points={nw:[100,200],n:[150,200],ne:[200,200],e:[200,240],se:[200,280],s:[150,280],sw:[100,280],w:[100,240]};
  for(const [handle,[x,y]] of Object.entries(points))assert.equal(hitHandles(box,{x:x+1,y:y+1},5),handle);
  assert.equal(hitHandles(box,{x:150,y:240},5),null);
});

test('cost selection links values and mounts, plus hidden explicit group members',()=>{
  const doc=preset();
  assert.deepEqual(new Set(selectionIds(doc,'layer.action-icon')),new Set(['layer.action-rim','layer.action-icon','layer.action-value']));
  assert.deepEqual(new Set(selectionIds(doc,'layer.mana-value')),new Set(['layer.mana-icon','layer.mana-value']));
  const mana=doc.items.find(n=>n.role==='mana-icon');mana.group='mana-set';
  doc.items.push(layer('hidden-extra',0,0,20,20,{group:'mana-set',visible:false}));
  doc.items.push(layer('mount',0,0,20,20,{role:'mana-mount'}));
  assert.deepEqual(new Set(selectionIds(doc,'layer.mana-value')),new Set(['layer.mana-icon','layer.mana-value','hidden-extra','mount']));
  assert.deepEqual(selectionIds(doc,'layer.action-icon',false),['layer.action-icon']);
  assert.deepEqual(selectionIds(doc,'missing'),[]);
});

test('grid snapping remains independent when edge and object snapping is disabled',()=>{
  const doc=document([layer('a',100,200,100,80),layer('near',119,220,100,80)]);
  const result=snapTranslation(doc,['a'],17,29,{grid:20,threshold:8,edges:false});
  assert.deepEqual([result.doc.items[0].x,result.doc.items[0].y],[120,220]);
  assert.deepEqual(result.guides,[]);
});

test('selection units merge reference cost pieces and retain explicit groups when cost links are off',()=>{
  const doc=referencePreset();
  const units=selectionUnits(doc,['layer.action-value','layer.mana-icon','layer.artwork']);
  assert.equal(units.length,3);
  const action=units.find(u=>u.ids.includes('layer.action-value'));
  assert.equal(action.ids.length,3);
  const mana=units.find(u=>u.ids.includes('layer.mana-icon'));
  assert.equal(mana.ids.length,3);
  assert.ok(mana.ids.includes('layer.mana-mount'));
  const a=doc.items.find(n=>n.id==='layer.action-value'),b=doc.items.find(n=>n.id==='layer.flavor');
  a.group=b.group='authored';
  assert.deepEqual(new Set(selectionIds(doc,a.id,false)),new Set([a.id,b.id]));
  assert.equal(selectionUnits(doc,[a.id,b.id],{linked:false}).length,1);
  assert.equal(selectionUnits(doc,[a.id,'layer.action-icon'],{linked:false}).length,2);
});

test('all six alignments move card selections as one unit and preserve group geometry',()=>{
  const doc=document([layer('a',100,200,20,40,{group:'g'}),layer('b',140,260,30,20,{group:'g'}),layer('untouched',800,900)]);
  const before=JSON.stringify(doc),modes={left:['x','w',0],'center-x':['x','w',.5],right:['x','w',1],top:['y','h',0],'center-y':['y','h',.5],bottom:['y','h',1]};
  for(const [mode,[axis,size,factor]] of Object.entries(modes)){
    const next=alignSelection(doc,['a'],mode,{linked:false}),box=bounds(next.items.slice(0,2));
    near(box[axis]+box[size]*factor,(axis==='x'?doc.width:doc.height)*factor);
    near(next.items[1].x-next.items[0].x,40);near(next.items[1].y-next.items[0].y,60);
    assert.deepEqual(next.items[2],doc.items[2]);
  }
  assert.equal(JSON.stringify(doc),before);
});

test('selection alignment aligns grouped units without separating cost values',()=>{
  const doc=referencePreset(),ids=['layer.action-value','layer.mana-value'];
  const before=selectionUnits(doc,ids),combined=bounds(before.map(u=>u.box));
  for(const [mode,axis,size,factor]of [['left','x','w',0],['center-x','x','w',.5],['right','x','w',1],['top','y','h',0],['center-y','y','h',.5],['bottom','y','h',1]]){
    const next=alignSelection(doc,ids,mode,{target:'selection'}),after=selectionUnits(next,ids);
    for(let i=0;i<after.length;i++){
      near(after[i].box[axis]+after[i].box[size]*factor,combined[axis]+combined[size]*factor);
      const offset=after[i].box[axis]-before[i].box[axis];
      for(const id of after[i].ids)near(next.items.find(n=>n.id===id)[axis]-doc.items.find(n=>n.id===id)[axis],offset);
    }
  }
});

test('horizontal and vertical distribution equalizes gaps while anchoring end units',()=>{
  for(const axis of ['x','y']){
    const doc=document([layer('a',10,10,20,20),layer('b',70,70,20,20,{group:'g'}),layer('c',100,100,20,20,{group:'g'}),layer('d',300,300,30,30)]);
    const before=JSON.stringify(doc),ids=['a','b','d'];
    const next=distributeSelection(doc,ids,axis,{linked:false}),units=selectionUnits(next,ids,{linked:false}),size=axis==='x'?'w':'h';
    const gapA=units[1].box[axis]-units[0].box[axis]-units[0].box[size];
    const gapB=units[2].box[axis]-units[1].box[axis]-units[1].box[size];
    near(gapA,gapB);near(gapA,110);
    assert.deepEqual(next.items[0],doc.items[0]);assert.deepEqual(next.items[3],doc.items[3]);
    near(next.items[2][axis]-next.items[1][axis],30);
    assert.equal(JSON.stringify(doc),before);
  }
  const overlap=document([layer('a',0,0,100,100),layer('b',10,10,100,100),layer('c',40,40,100,100)]);
  assert.equal(distributeSelection(overlap,['a','b','c'],'x').items[1].x,20);
  assert.deepEqual(distributeSelection(overlap,['a','b'],'x'),overlap);
});

test('grouping merges entire old groups, ungrouping clears them, and inputs stay unchanged',()=>{
  const doc=document([layer('a',0,0,20,20,{group:'one'}),layer('b',30,0,20,20,{group:'one',visible:false}),layer('c',60,0,20,20,{group:'two'}),layer('d',90,0,20,20,{group:'two'}),layer('extra')]);
  const before=JSON.stringify(doc),grouped=groupSelection(doc,['a','c'],'merged');
  assert.deepEqual(grouped.items.map(n=>n.group),['merged','merged','merged','merged','']);
  assert.deepEqual(grouped.items.map(n=>[n.x,n.y,n.w,n.h]),doc.items.map(n=>[n.x,n.y,n.w,n.h]));
  assert.ok(ungroupSelection(grouped,['c']).items.every(n=>n.group===''));
  assert.equal(JSON.stringify(doc),before);
  assert.deepEqual(groupSelection(doc,['extra'],'single'),doc);
});

test('locked group members prevent all alignment, distribution, grouping and ungrouping',()=>{
  const doc=document([layer('a',0,0,20,20,{group:'g'}),layer('b',30,0,20,20,{group:'g',locked:true}),layer('c',60,0,20,20),layer('d',90,0,20,20)]);
  for(const result of [alignSelection(doc,['a'],'left'),alignSelection(doc,['a','c'],'right',{target:'selection'}),distributeSelection(doc,['a','c','d'],'x'),groupSelection(doc,['a','c'],'new'),ungroupSelection(doc,['a'])]){
    assert.deepEqual(result,doc);assert.notEqual(result,doc);
  }
  assert.throws(()=>alignSelection(doc,['a'],'diagonal'),/alignment/);
  assert.throws(()=>alignSelection(doc,['a'],'left',{target:'unknown'}),/target/);
  assert.throws(()=>distributeSelection(doc,['a'],'diagonal'),/axis/);
  assert.throws(()=>groupSelection(doc,['a'],'unsafe id'),/safe ID/);
});

test('crop and image replacement respect direct, grouped and linked cost locks',()=>{
  const doc=document([layer('art',0,0,100,100,{group:'custom'}),layer('frame',0,0,100,100,{group:'custom',locked:true}),layer('mana',0,0,100,100,{role:'mana-icon'}),layer('value',0,0,100,100,{role:'mana-value',asset:'text',locked:true})]);
  assert.equal(canEditImageLayer(doc,'art'),false);
  assert.equal(canEditImageLayer(doc,'art',false),false,'explicit groups remain attached when resource linking is off');
  assert.equal(canEditImageLayer(doc,'frame'),false);
  assert.equal(canEditImageLayer(doc,'mana'),false);
  assert.equal(canEditImageLayer(doc,'mana',false),true,'resource linking can be explicitly disabled');
  doc.items[1].visible=false;assert.equal(canEditImageLayer(doc,'art'),false,'hidden locked members still protect their group');
  doc.items[1].locked=false;assert.equal(canEditImageLayer(doc,'art'),true,'visibility is not an inactive flag; hidden members stay attached for aligned restoration');
  assert.equal(canEditImageLayer(doc,'value'),false);assert.equal(canEditImageLayer(doc,'missing'),false);
});
