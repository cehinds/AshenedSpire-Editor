import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {CARD_LAYOUT_PARTS,getCardLayoutParts,validateCardLayout,normalizeCardLayout,snapCardValue,translateCardLayout,reorderCardLayout,applyCardLayout,addCardLayoutComponent,getCardLayoutGroupMembers,isCardLayoutEditable,setCardLayoutPartState} from '../src/card-layout.mjs';

test('layout JSON roundtrip preserves full presentation without modifying the input',()=>{
  const source={parts:{art:{x:10,y:-12,width:180,height:150,rotation:15,opacity:.5,visible:true,backgroundVisible:false,backgroundArt:'data:image/png;base64,AQID',groupId:'illustration',zIndex:2},rules:{textAlign:'left'}},order:['rules','art']};
  const copy=JSON.stringify(source),result=normalizeCardLayout(source);
  assert.deepEqual(validateCardLayout(result),[]);
  assert.deepEqual(normalizeCardLayout(JSON.parse(JSON.stringify(result))),result);
  assert.equal(JSON.stringify(source),copy);
  assert.deepEqual(result.order,['rules','art','identity','type','footer','tags','costs']);
  assert.equal(result.parts.footer.visible,true);
  assert.equal(result.parts.footer.width,undefined);
  assert.equal(result.parts.art.backgroundArt,source.parts.art.backgroundArt);
});

test('validation rejects executable styles, malformed records and unsafe ranges',()=>{
  const invalid=[null,[],{parts:[]},{parts:{alien:{}}},{parts:{art:null}},{parts:{art:{x:Infinity}}},{parts:{art:{y:-4097}}},{parts:{art:{width:0}}},{parts:{art:{height:4097}}},{parts:{art:{rotation:361}}},{parts:{art:{opacity:1.1}}},{parts:{art:{visible:'false'}}},{parts:{art:{backgroundVisible:0}}},{parts:{art:{zIndex:.5}}},{parts:{art:{zIndex:101}}},{parts:{art:{groupId:'../other'}}},{parts:{art:{groupId:'x'.repeat(49)}}},{parts:{art:{textAlign:'justify'}}},{parts:{art:{transform:'url(javascript:evil)'}}},{parts:{art:{backgroundArt:'https://example.org/image.png'}}},{parts:{art:{backgroundArt:'data:image/svg+xml;base64,AQID'}}},{parts:{art:{backgroundArt:'data:image/png;base64,'+'A'.repeat(3_000_000)}}},{order:['art','art']},{order:['unknown']},{order:'art'},{gridSize:10}];
  for(const layout of invalid) assert.ok(validateCardLayout(layout).length,JSON.stringify(layout).slice(0,180));
  assert.deepEqual(validateCardLayout(undefined),[]);
  assert.deepEqual(validateCardLayout({parts:{rules:{x:-4096,y:4096,width:1,height:4096,rotation:-360,opacity:0,zIndex:-100,groupId:''}}}),[]);
  assert.throws(()=>normalizeCardLayout({parts:{art:{opacity:NaN}}}));
});

test('translation snaps the anchor while preserving grouped spacing and clamping as a unit',()=>{
  const start={parts:{art:{x:3,y:4,groupId:'artwork'},tags:{x:8,y:9,groupId:'artwork'},rules:{x:7,y:2}}};
  const moved=translateCardLayout(start,'art',13,11,{snap:true,gridSize:10});
  assert.equal(moved.parts.art.x,20);assert.equal(moved.parts.art.y,20);
  assert.equal(moved.parts.tags.x,25);assert.equal(moved.parts.tags.y,25);
  assert.equal(moved.parts.rules.x,7);assert.equal(start.parts.art.x,3);
  const bounded=translateCardLayout(moved,'art',10000,-10000);
  assert.equal(bounded.parts.tags.x,4096);assert.equal(bounded.parts.art.x,4091);
  assert.equal(bounded.parts.art.y,-4096);assert.equal(bounded.parts.tags.y,-4091);
  assert.deepEqual(validateCardLayout(bounded),[]);
  assert.equal(snapCardValue(23,15),30);
  assert.throws(()=>snapCardValue(1,0));assert.throws(()=>translateCardLayout(start,'unknown',0,0));
});

test('order moves are bounded, unique and independent of source data',()=>{
  const start=normalizeCardLayout();
  const moved=reorderCardLayout(start,'footer',0);
  assert.equal(moved.order[0],'footer');assert.equal(new Set(moved.order).size,7);
  assert.equal(start.order[4],'footer');
  assert.throws(()=>reorderCardLayout(start,'art',7));assert.throws(()=>reorderCardLayout(start,'art',.5));
});

// A small DOM contract fixture supplies measured native boxes. This tests the
// sandbox function's mutations/restoration; browser QA owns CSS layout fidelity.
function faceFixture(width=280,zoom=2) {
  class Element {
    constructor(name,rect={x:0,y:0,width:0,height:0}) {this.name=name;this.rect=rect;this.children=[];this.style={};this.attrs=new Map();this.parentNode=null;this.clientLeft=0;this.clientTop=0;this.ownerDocument=doc;}
    get firstChild(){return this.children[0]||null;}
    get textContent(){return this.name==='#text'?this.value||'':this.children.map(child=>child.textContent).join('');}
    set textContent(value){for(const child of this.children)child.parentNode=null;this.children=[];if(value){const text=new Element('#text');text.value=String(value);this.append(text);}}
    get offsetWidth(){return this.rect.width;}get offsetHeight(){return this.rect.height;}
    getBoundingClientRect(){return {left:this.rect.x*zoom,top:this.rect.y*zoom,width:this.rect.width*zoom,height:this.rect.height*zoom};}
    append(child){if(child.parentNode)child.parentNode.children.splice(child.parentNode.children.indexOf(child),1);this.children.push(child);child.parentNode=this;}
    insertBefore(child,before){child.remove();this.children.splice(this.children.indexOf(before),0,child);child.parentNode=this;}
    remove(){if(this.parentNode)this.parentNode.children.splice(this.parentNode.children.indexOf(this),1);this.parentNode=null;}
    before(sibling){const parent=this.parentNode;parent.children.splice(parent.children.indexOf(this),0,sibling);sibling.parentNode=parent;}
    replaceWith(element){const parent=this.parentNode,index=parent.children.indexOf(this);if(element.parentNode)element.parentNode.children.splice(element.parentNode.children.indexOf(element),1);parent.children.splice(parent.children.indexOf(this),1,element);element.parentNode=parent;this.parentNode=null;}
    querySelector(selector){for(const child of this.children){const match=selector.match(/^\[([^=\]]+)(?:="([^"]+)")?\]$/);if(child.name===selector||match&&child.attrs.has(match[1])&&(match[2]===undefined||child.attrs.get(match[1])===match[2]))return child;const found=child.querySelector(selector);if(found)return found;}return null;}
    getAttribute(key){return key==='style'?(Object.keys(this.style).length?JSON.stringify(this.style):null):this.attrs.get(key)??null;}
    setAttribute(key,value){if(key==='style')this.style=JSON.parse(value);else this.attrs.set(key,value);}
    removeAttribute(key){if(key==='style')this.style={};else this.attrs.delete(key);}
  }
  const doc={defaultView:{getComputedStyle:element=>({position:'relative',display:element.name==='.card-cost-rail'?'flex':'block',flexDirection:'column',textAlign:'center',get overflow(){return element.style.overflow||'visible';},get overflowX(){return element.style.overflowX||element.style.overflow||'visible';},get overflowY(){return element.style.overflowY||element.style.overflow||'visible';}})},createComment:name=>new Element('#'+name),createElement:name=>new Element(name)};
  const face=new Element('.card',{x:100,y:50,width,height:width*1.4});
  const parts={};
  for(const [index,part] of CARD_LAYOUT_PARTS.entries()) {
    parts[part.id]=new Element(part.selector,{x:110,y:60+index*20,width:width-20,height:20});
    face.append(parts[part.id]);
  }
  parts.art.append(parts.tags);
  const body=new Element('.cd-body');face.append(body);body.append(parts.type);body.append(parts.rules);
  parts.art.style.background='native-art';parts.rules.style.color='native-ink';
  return {face,parts,body};
}

test('serialized sandbox function retains native defaults and restores exact nesting after repeated edits',()=>{
  const apply=vm.runInNewContext('('+applyCardLayout.toString()+')');
  const {face,parts,body}=faceFixture(),originalChildren=[...face.children];
  const defaults=normalizeCardLayout();
  const boxes=apply(face,defaults);
  assert.equal(boxes.identity.x,10);assert.equal(boxes.identity.y,10);
  assert.deepEqual(face.children,originalChildren);assert.equal(parts.tags.parentNode,parts.art);
  apply(face,{parts:{art:{x:20,rotation:15,backgroundVisible:false},tags:{visible:false},rules:{textAlign:'left',opacity:.4}},order:['footer','rules']});
  assert.equal(parts.art.style.transform,'translate(20px, 0px) rotate(15deg)');
  assert.equal(parts.art.style.background,'transparent');assert.equal(parts.tags.parentNode,face);
  assert.equal(parts.tags.style.visibility,'hidden');assert.equal(parts.rules.style.opacity,'0.4');
  assert.equal(parts.rules.style.textAlign,'left');
  assert.ok(Number(parts.rules.style.zIndex)>Number(parts.footer.style.zIndex));
  apply(face,{parts:{art:{x:5}}});
  assert.equal(parts.art.style.transform,'translate(5px, 0px) rotate(0deg)');
  assert.equal(parts.art.style.background,'native-art');
  assert.ok(Number(parts.costs.style.zIndex)>Number(parts.art.style.zIndex));
  apply(face,undefined);
  assert.deepEqual(face.children,originalChildren);assert.equal(parts.tags.parentNode,parts.art);
  assert.equal(parts.rules.parentNode,body);assert.deepEqual(parts.rules.style,{color:'native-ink'});
  assert.deepEqual(face.style,{});
});

test('native combat sizes scale reference offsets and dimensions without accepting arbitrary background URLs',()=>{
  const {face,parts}=faceFixture(140);
  const boxes=applyCardLayout(face,{parts:{art:{x:40,y:20,width:100,height:80,rotation:30,backgroundArt:'data:image/webp;base64,AQID'}}});
  assert.equal(parts.art.style.transform,'translate(20px, 10px) rotate(30deg)');
  assert.equal(parts.art.style.width,'50px');assert.equal(parts.art.style.height,'40px');
  assert.equal(boxes.art.width,50);assert.equal(boxes.art.x,30);
  assert.equal(parts.art.style.backgroundImage,'url("data:image/webp;base64,AQID")');
  applyCardLayout(face,{parts:{art:{backgroundArt:'javascript:bad'}}});
  assert.equal(parts.art.style.backgroundImage,undefined);
});

test('custom components validate IDs, payloads, count and lifecycle fields',()=>{
  const definition={kind:'text',label:'Annotation',text:'<script>not executable</script>'};
  const valid={custom:{'component-1':definition},parts:{'component-1':{locked:true,enabled:false,removed:true,textRotation:'follow'}},order:['component-1']};
  assert.deepEqual(validateCardLayout(valid),[]);
  assert.deepEqual(normalizeCardLayout(JSON.parse(JSON.stringify(valid))),normalizeCardLayout(valid));
  assert.deepEqual(getCardLayoutParts(valid).at(-1),{id:'component-1',label:'Annotation',kind:'text',selector:'[data-card-component="component-1"]'});
  const invalid=[{custom:[]},{custom:{'component-0':definition}},{custom:{'component-01':definition}},{custom:{'component-1\"] div':definition}},{custom:{['component-'+'9'.repeat(60)]:definition}},{custom:{'component-1':{...definition,label:'x'.repeat(81)}}},{custom:{'component-1':{...definition,label:' '}}},{custom:{'component-1':{...definition,text:'x'.repeat(10001)}}},{custom:{'component-1':{...definition,kind:'html'}}},{custom:{'component-1':{...definition,onClick:'alert(1)'}}},{custom:{'component-1':{kind:'image',label:'Art',image:'https://example.com/art.png'}}},{custom:{'component-1':{kind:'image',label:'Art',image:'data:image/svg+xml;base64,AQID'}}},{custom:{'component-1':{kind:'image',label:'Art',text:'Wrong payload'}}},{parts:{art:{locked:1}}},{parts:{art:{enabled:null}}},{parts:{art:{removed:'true'}}},{parts:{art:{textRotation:'automatic'}}},{parts:{'component-1':{x:2}}},{custom:Object.fromEntries(Array.from({length:33},(_,index)=>['component-'+(index+1),definition]))}];
  for(const layout of invalid)assert.ok(validateCardLayout(layout).length,JSON.stringify(layout).slice(0,150));
});

test('custom add, group lifecycle and reorder preserve complete linked groups',()=>{
  const first=addCardLayoutComponent(undefined,{kind:'text',label:'Note',text:'Native text'});
  assert.equal(first.id,'component-1');
  assert.deepEqual({x:first.layout.parts[first.id].x,y:first.layout.parts[first.id].y,width:first.layout.parts[first.id].width,height:first.layout.parts[first.id].height},{x:20,y:20,width:160,height:60});
  const second=addCardLayoutComponent(first.layout,{kind:'image',label:'Art',image:'data:image/png;base64,AQID'});
  assert.equal(second.id,'component-2');assert.equal(first.layout.custom['component-2'],undefined);
  second.layout.parts.identity.groupId='heading';second.layout.parts['component-1'].groupId='heading';
  const moved=translateCardLayout(second.layout,'component-1',10,0);
  assert.equal(moved.parts.identity.x,10);assert.equal(moved.parts['component-1'].x,30);
  const ordered=reorderCardLayout(moved,'component-1',0);
  assert.deepEqual(ordered.order.slice(0,2),['identity','component-1']);
  const locked=setCardLayoutPartState(moved,['identity'],{locked:true});
  assert.equal(locked.parts['component-1'].locked,true);
  assert.deepEqual(getCardLayoutGroupMembers(locked,['identity'],{editableOnly:true}),[]);
  assert.equal(isCardLayoutEditable(locked,['component-1']),false);
  assert.throws(()=>translateCardLayout(locked,'component-1',10,0));
  assert.throws(()=>reorderCardLayout(locked,'component-1',0));
  const inactive=setCardLayoutPartState(locked,['component-1'],{locked:false,enabled:false,removed:true});
  assert.equal(inactive.parts.identity.removed,true);assert.equal(isCardLayoutEditable(inactive,['identity']),false);
  const restored=setCardLayoutPartState(inactive,['identity'],{enabled:true,removed:false});
  assert.equal(isCardLayoutEditable(restored,['component-1']),true);
  assert.equal(restored.custom['component-1'].text,'Native text');
  assert.throws(()=>setCardLayoutPartState(restored,['identity'],{rotation:90}));
  let full=normalizeCardLayout();for(let index=0;index<32;index++)full=addCardLayoutComponent(full,{kind:'text',label:'Note'}).layout;
  assert.throws(()=>addCardLayoutComponent(full,{kind:'text',label:'Overflow'}));
});

test('a single locked or inactive peer excludes the whole group from editable selection',()=>{
  for(const state of [{locked:true},{enabled:false},{removed:true}]){
    const layout={parts:{identity:{groupId:'one'},rules:{groupId:'one',...state},footer:{}}};
    assert.deepEqual(getCardLayoutGroupMembers(layout,['identity','footer'],{editableOnly:true}),['footer']);
    assert.deepEqual(getCardLayoutGroupMembers(layout,['identity']),['identity','rules']);
    assert.equal(isCardLayoutEditable(layout,['identity','footer']),false);
    assert.equal(isCardLayoutEditable(layout,['unknown']),false);
  }
});

test('reordering crosses both edges of a neighboring group without splitting either group',()=>{
  const layout=normalizeCardLayout({parts:{art:{groupId:'A'},identity:{groupId:'A'},type:{groupId:'B'},rules:{groupId:'B'}},order:['art','identity','type','rules','footer','tags','costs']});
  const forward=['type','rules','art','identity','footer','tags','costs'];
  // Slots refer to the remaining order: slot 1 bisects B, slot 2 follows B.
  for(const selected of ['art','identity'])for(const destination of [1,2])assert.deepEqual(reorderCardLayout(layout,selected,destination).order,forward);
  for(const selected of ['type','rules'])for(const destination of [0,1])assert.deepEqual(reorderCardLayout(layout,selected,destination).order,['type','rules','art','identity','footer','tags','costs']);
  // Direction comes from the moving group's first member, not its selected peer.
  assert.deepEqual(reorderCardLayout(layout,'art',1).order,forward);
  assert.deepEqual(reorderCardLayout(layout,'rules',1).order,forward);
  assert.deepEqual(reorderCardLayout(layout,'art',0).order,layout.order);
  assert.deepEqual(reorderCardLayout({parts:layout.parts,order:forward},'identity',1).order,layout.order);
  assert.deepEqual(reorderCardLayout(layout,'art',3).order,['type','rules','footer','art','identity','tags','costs']);
  // An ungrouped component may cross either edge, but never land inside a group.
  for(const destination of [0,1])assert.deepEqual(reorderCardLayout(layout,'footer',destination).order,['footer','art','identity','type','rules','tags','costs']);
  assert.deepEqual(layout.order,['art','identity','type','rules','footer','tags','costs']);
});

test('upright text counter-rotates existing native child nodes and resets without nested wrappers',()=>{
  const apply=vm.runInNewContext('('+applyCardLayout.toString()+')');
  const {face,parts}=faceFixture();
  parts.identity.textContent='Ambush';
  parts.identity.className='cname native-card-part-editable';
  parts.identity.style.overflow='hidden';
  const token=face.ownerDocument.createElement('b');token.textContent='12';token.style.color='gold';parts.rules.append(token);
  const cost=face.ownerDocument.createElement('div');cost.className='cost';cost.textContent='2';parts.costs.append(cost);
  const labelNode=parts.identity.firstChild;
  apply(face,{parts:{identity:{rotation:45},rules:{rotation:-30},costs:{rotation:15}}});
  assert.equal(parts.identity.firstChild.getAttribute('data-card-upright'),'');
  assert.equal(parts.identity.firstChild.style.transform,'rotate(-45deg)');
  assert.equal(parts.identity.style.overflow,'visible');
  assert.equal(parts.identity.firstChild.style.overflow,'hidden');
  assert.equal(parts.identity.firstChild.style.overflowX,'hidden');
  assert.equal(parts.identity.firstChild.style.overflowY,'hidden');
  assert.equal(parts.identity.firstChild.className,'cname');
  assert.equal(parts.identity.className,'cname native-card-part-editable');
  assert.equal(parts.identity.firstChild.firstChild,labelNode);
  assert.equal(parts.rules.firstChild.firstChild,token);assert.deepEqual(token.style,{color:'gold'});
  assert.equal(parts.costs.firstChild.style.display,'flex');assert.equal(parts.costs.firstChild.firstChild,cost);
  apply(face,{parts:{identity:{rotation:60},rules:{rotation:-30}}});
  assert.equal(parts.identity.children.length,1);assert.equal(parts.identity.firstChild.firstChild,labelNode);
  assert.equal(parts.identity.firstChild.style.transform,'rotate(-60deg)');
  apply(face,{parts:{identity:{rotation:60,textRotation:'follow'}}});
  assert.equal(parts.identity.firstChild,labelNode);assert.equal(parts.identity.querySelector('[data-card-upright]'),null);
  apply(face,undefined);
  assert.equal(parts.identity.firstChild,labelNode);assert.equal(parts.rules.firstChild,token);assert.equal(parts.costs.firstChild,cost);
  assert.equal(parts.identity.style.overflow,'hidden');
  assert.deepEqual(token.style,{color:'gold'});assert.equal(face.querySelector('[data-card-upright]'),null);
});

test('removed, disabled and visibility flags hide independently and restore native elements reversibly',()=>{
  const {face,parts,body}=faceFixture(),original=[...face.children];
  parts.rules.textContent='Deal 12 damage.';const text=parts.rules.firstChild;
  applyCardLayout(face,{parts:{identity:{enabled:false},rules:{removed:true},footer:{visible:false}}});
  for(const part of [parts.identity,parts.rules,parts.footer])assert.equal(part.style.visibility,'hidden');
  assert.equal(parts.rules.firstChild,text);assert.equal(parts.rules.parentNode,face);
  applyCardLayout(face,undefined);
  assert.deepEqual(face.children,original);assert.equal(parts.rules.parentNode,body);assert.equal(parts.rules.firstChild,text);
  assert.equal(parts.identity.style.visibility,undefined);
  applyCardLayout(face,{parts:{identity:{locked:true,textRotation:'upright'}}});
  assert.deepEqual(face.children,original);assert.deepEqual(parts.identity.style,{});
});

test('custom text and allowlisted artwork use safe nodes, scale, counter-rotate and clean up on reset',()=>{
  const apply=vm.runInNewContext('('+applyCardLayout.toString()+')');
  const {face}=faceFixture(140),original=[...face.children];
  const layout={custom:{'component-1':{kind:'text',label:'Caption',text:'<img src=x onerror=evil()>'},'component-2':{kind:'image',label:'Badge',image:'data:image/webp;base64,AQID'}},parts:{'component-1':{rotation:90}}};
  const boxes=apply(face,layout),text=face.querySelector('[data-card-component="component-1"]'),art=face.querySelector('[data-card-component="component-2"]');
  assert.equal(text.textContent,'<img src=x onerror=evil()>');assert.equal(text.firstChild.style.transform,'rotate(-90deg)');
  assert.equal(text.style.width,'80px');assert.equal(boxes['component-1'].x,10);
  assert.equal(art.firstChild.src,'data:image/webp;base64,AQID');assert.equal(art.firstChild.alt,'Badge');
  text.setAttribute('data-editor-part','component-1');
  text.setAttribute('aria-label','Caption component. Selected. Arrow keys move.');
  apply(face,{...layout,parts:{'component-1':{removed:true}}});
  assert.equal(face.querySelector('[data-card-component="component-1"]'),text);assert.equal(text.getAttribute('data-editor-part'),'component-1');assert.equal(text.style.visibility,'hidden');
  assert.equal(text.getAttribute('aria-label'),'Caption component. Selected. Arrow keys move.');
  apply(face,undefined);
  assert.deepEqual(face.children,original);assert.equal(face.querySelector('[data-card-component="component-1"]'),null);
  apply(face,{custom:{'component-3':{kind:'image',label:'Unsafe',image:'javascript:evil()'}}});
  assert.equal(face.querySelector('[data-card-component="component-3"]').firstChild,null);
});
