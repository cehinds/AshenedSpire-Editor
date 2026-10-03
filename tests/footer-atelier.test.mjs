import test from 'node:test';
import assert from 'node:assert/strict';
import {preset,validate,bounds,snap,move,resize,attach,selectedIds,textContent,TEXT_DEFAULTS} from '../public/parts/footer-atelier/model.mjs';

test('desktop and compact layouts round trip without leaving the canvas',()=>{
 for(const kind of ['desktop','compact']){const doc=preset(kind);assert.deepEqual(validate(JSON.parse(JSON.stringify(doc))),doc);for(const n of doc.items){assert.ok(n.x>=0&&n.y>=0,n.id);assert.ok(n.x+n.w<=doc.width&&n.y+n.h<=doc.height,n.id);}}
});
test('mana starts at twelve and proceeds counterclockwise, keeping original components',()=>{
 const doc=preset(),first=doc.items.find(n=>n.id==='mana-0'),second=doc.items.find(n=>n.id==='mana-1');assert.equal(first.x+first.w/2,120);assert.equal(first.y+first.h/2,109);assert.ok(second.x<first.x);assert.equal(doc.items.filter(n=>n.asset==='diamond').length,8);assert.equal(doc.items.filter(n=>n.asset==='spent').length,4);
});
test('compact control groups have no overlapping bounds',()=>{const doc=preset('compact'),groups=['sp','draw','end','discard','potions'].map(id=>bounds(doc.items.filter(n=>n.group===id)));for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){const a=groups[i],b=groups[j];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y);}});
test('edge docking beats grid rounding and preserves relative group offsets',()=>{
 const result=snap({x:92,y:21,w:50,h:40},[{id:'target',x:150,y:20,w:80,h:40}],{grid:8,threshold:9});assert.equal(result.x,100);assert.equal(result.y,20);assert.equal(result.dock,'target');
 const doc=preset(),ids=selectedIds(doc,'sp-frame'),out=move(doc,ids,13,-8);for(const id of ids){const a=doc.items.find(n=>n.id===id),b=out.items.find(n=>n.id===id);assert.equal(b.x-a.x,13);assert.equal(b.y-a.y,-8);}assert.deepEqual(out.items.find(n=>n.id==='draw-art'),doc.items.find(n=>n.id==='draw-art'));
});
test('alignment across separate rows does not attach distant pieces',()=>{assert.equal(snap({x:93,y:300,w:50,h:40},[{id:'target',x:150,y:20,w:80,h:40}],{threshold:8}).dock,null);});
test('attachment merges both complete groups and detach permits independent movement',()=>{const doc=preset(),ids=selectedIds(doc,'draw-art'),out=attach(doc,ids,'end-plate');assert.equal(selectedIds(out,'draw-art').length,6);const n=out.items.find(n=>n.id==='draw-art');n.group='';assert.deepEqual(selectedIds(out,'draw-art'),['draw-art']);});
test('resizing scales all joined geometry and locks block the complete operation',()=>{const doc=preset(),ids=selectedIds(doc,'end-plate'),b=bounds(doc.items.filter(n=>ids.includes(n.id))),out=resize(doc,ids,b.w*2,b.h*2),after=bounds(out.items.filter(n=>ids.includes(n.id)));assert.equal(after.w,b.w*2);assert.equal(after.h,b.h*2);assert.equal(out.items.find(n=>n.id==='end-label').fontSize,54);doc.items.find(n=>n.id==='end-label').locked=true;assert.deepEqual(resize(doc,ids,500,500),doc);assert.deepEqual(move(doc,ids,20,20),doc);});
test('untrusted imports reject external assets, duplicate IDs and invalid numbers',()=>{for(const edit of [d=>d.items[0].asset='https://example.com/remote.png',d=>d.items[0].x=NaN,d=>d.items[0].w=-10,d=>d.items[1].id=d.items[0].id,d=>d.items.find(n=>n.asset==='text').color='url(evil)']){const d=preset();edit(d);assert.throws(()=>validate(d));}});

import {readFooterSource,reviewFooterSource,FOOTER_SOURCE} from '../src/footer-layout-source.mjs';
test('live counts and labels stay separate from artwork and interpolate only known game values',()=>{
 const doc=preset();
 const count=doc.items.find(n=>n.id==='discard-count');
 assert.equal(textContent(count,{discard:27,discardLabel:'ABLAGE'}),'ABLAGE  27');
 assert.equal(textContent(doc.items.find(n=>n.id==='end-label'),{endTurn:'FINISH'}),'FINISH');
 assert.ok(doc.items.filter(n=>n.asset!=='text').every(n=>!Object.hasOwn(n,'text')));
 const staticNode={...count,binding:'static',text:'Literal {value}'};
 assert.equal(textContent(staticNode,{discard:27}),'Literal {value}');
});
test('legacy version 1 labels gain safe static typography defaults',()=>{
 const doc=preset();for(const n of doc.items)if(n.asset==='text')for(const k of Object.keys(TEXT_DEFAULTS))delete n[k];
 const node=validate(doc).items.find(n=>n.asset==='text');
 for(const [k,v] of Object.entries(TEXT_DEFAULTS))assert.equal(node[k],v);
});
test('independent text geometry and fonts roundtrip; external font URLs and unknown bindings fail',()=>{
 const doc=preset(),text=doc.items.find(n=>n.id==='end-label');
 Object.assign(text,{x:512,y:185,fontFamily:'sans',fontWeight:700,fontStyle:'italic',textAlign:'right'});
 assert.deepEqual(validate(JSON.parse(JSON.stringify(doc))),doc);
 for(const patch of [{fontFamily:'url(https://example.com/font.woff)'},{fontFamily:'__proto__'},{fontWeight:401},{fontStyle:'oblique'},{binding:'player.secret'},{textAlign:'justify'}]){
  const copy=structuredClone(doc);Object.assign(copy.items.find(n=>n.id==='end-label'),patch);assert.throws(()=>validate(copy));
 }
});
test('reviewed game source preserves wrapper settings and rejects unrelated JSON',()=>{
 const before=JSON.stringify({components:{layout:preset(),extra:'keep'},note:'existing'}),next=preset();
 next.items.find(n=>n.id==='sp-number').fontWeight=700;
 const review=reviewFooterSource(before,next),after=JSON.parse(review.after);
 assert.equal(FOOTER_SOURCE,'content/config/ui/presentation/footerLayout.json');
 assert.equal(review.before,before);assert.equal(after.note,'existing');assert.equal(after.components.extra,'keep');
 assert.deepEqual(readFooterSource(review.after),next);assert.throws(()=>readFooterSource(JSON.stringify(next)));
 assert.throws(()=>reviewFooterSource('{}',next));
});

import {footerMessageTarget,footerMessageOrigin} from '../public/parts/footer-atelier/bridge.mjs';
test('downloaded file and opaque blob frames communicate without trusting foreign HTTP origins',()=>{
 for(const location of [{protocol:'file:',origin:'file://'},{protocol:'file:',origin:'null'},{protocol:'blob:',origin:'null'}]){
  assert.equal(footerMessageTarget(location),'*');assert.equal(footerMessageOrigin('null',location),true);assert.equal(footerMessageOrigin('https://foreign.test',location),false);
 }
 const location={protocol:'https:',origin:'https://editor.test'};
 assert.equal(footerMessageTarget(location),'https://editor.test');assert.equal(footerMessageOrigin('https://editor.test',location),true);assert.equal(footerMessageOrigin('null',location),false);assert.equal(footerMessageOrigin('https://foreign.test',location),false);
});
