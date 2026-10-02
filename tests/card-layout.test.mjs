import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {CARD_LAYOUT_PARTS,validateCardLayout,normalizeCardLayout,snapCardValue,translateCardLayout,reorderCardLayout,applyCardLayout} from '../src/card-layout.mjs';

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
    get offsetWidth(){return this.rect.width;}get offsetHeight(){return this.rect.height;}
    getBoundingClientRect(){return {left:this.rect.x*zoom,top:this.rect.y*zoom,width:this.rect.width*zoom,height:this.rect.height*zoom};}
    append(child){if(child.parentNode)child.parentNode.children.splice(child.parentNode.children.indexOf(child),1);this.children.push(child);child.parentNode=this;}
    before(sibling){const parent=this.parentNode;parent.children.splice(parent.children.indexOf(this),0,sibling);sibling.parentNode=parent;}
    replaceWith(element){const parent=this.parentNode,index=parent.children.indexOf(this);if(element.parentNode)element.parentNode.children.splice(element.parentNode.children.indexOf(element),1);parent.children.splice(parent.children.indexOf(this),1,element);element.parentNode=parent;this.parentNode=null;}
    querySelector(selector){for(const child of this.children){if(child.name===selector)return child;const found=child.querySelector(selector);if(found)return found;}return null;}
    getAttribute(key){return key==='style'?(Object.keys(this.style).length?JSON.stringify(this.style):null):this.attrs.get(key)??null;}
    setAttribute(key,value){if(key==='style')this.style=JSON.parse(value);else this.attrs.set(key,value);}
    removeAttribute(key){if(key==='style')this.style={};else this.attrs.delete(key);}
  }
  const doc={defaultView:{getComputedStyle:()=>({position:'relative'})},createComment:name=>new Element('#'+name)};
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
