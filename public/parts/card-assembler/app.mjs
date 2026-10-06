import {footerMessageOrigin} from '../footer-atelier/bridge.mjs';
import {ASSETS,PRESETS,preset,validate,fromRecipe,toRecipe,clone,clamp,move,snap,resize,bounds} from './model.mjs';
import {contentBounds,resizeSelection,snapTranslation,hitHandles,selectionIds,selectionUnits,alignSelection,distributeSelection,groupSelection,ungroupSelection} from './interaction.mjs';
import {recolorPixels} from './appearance.mjs';
import {fullArtPreset,cardClipPath} from './full-art.mjs';
import {fromLegacyCard,isLegacyCard} from './legacy-card.mjs';
import {imagePlacement} from './image-placement.mjs';
import {normalizedCrop,fullImageBounds,panCrop,trimCrop,resetCrop} from './crop-geometry.mjs';
import {readDraft,writeDraft} from './draft-storage.mjs';
import {mountCardArtLibrary,fetchCardArtwork} from './card-art-library.mjs';
import {referencePreset} from './reference.mjs';
const REFERENCE=referencePreset(),ALL_PRESETS=[{id:REFERENCE.presetId,name:'Reference · full resource badges',doc:REFERENCE},{id:'as.card.preset.full-art.v1',name:'Full-art · parchment & cost banner',doc:fullArtPreset()},...PRESETS];
const assetRects=new Map(ALL_PRESETS.find(p=>p.id==='as.card.preset.full-art.v1').doc.items.filter(n=>n.sourceRect).map(n=>[n.asset,n.sourceRect]));
const extraBackgroundFor=new Map([['as.card.full-art.knight-scene.v1','as.card.artwork.extended-knight.v1'],['as.card.artwork.hand-gorefire-slash.v1','as.card.artwork.extended-gorefire.v1'],['as.card.artwork.hand-shield-defend.v1','as.card.artwork.extended-shield.v1'],['as.card.artwork.draft-kindle.v1','as.card.artwork.extended-kindle.v1'],['as.card.artwork.forge-guides-strike.v1','as.card.artwork.extended-strike.v1']]);
const isManaAsset=id=>['as.card.icon.mana-blue.v1','as.card.full-art.mana-diamond.v1'].includes(id);
const $=id=>document.getElementById(id),canvas=$('canvas'),context=canvas.getContext('2d'),KEY='ashenedspire.card-assembler.v1';
const byId=new Map(ASSETS.map(a=>[a.id,a])),images=new Map(),customImages=new Map(),past=[],future=[];
const labels={'background':'Card material','rules-background':'Rules material','artwork':'Ability artwork','art-border':'Artwork border','title-container':'Title container','type-strip':'Card type strip','rules-container':'Rules container','flavor-divider':'Flavor divider','outer-frame':'Outer frame','cost-rail':'Cost container','mana-mount':'Mana container','action-rim':'Action rim','action-icon':'Action icon','mana-icon':'Mana icon','title':'Card name','type':'Card type','rules':'Ability text','flavor':'Flavor text','action-value':'Action cost','mana-value':'Mana cost'};
const nice=n=>labels[n.role]||n.name||'Custom layer';
const assetInfo=id=>byId.get(id)||doc.customAssets?.find(a=>a.id===id);
const allAssets=()=>[...ASSETS,...(doc.customAssets||[]).map(a=>({...a,category:'imported'}))];
let cropMode=null;
let doc=referencePreset(),selected='layer.outer-frame',extraSelection=new Set(),tab='parts',zoom=.4,preview=false,drag=null,guides=[],autoFit=true,ready=false,storageOK=true,camera={x:0,y:0},spaceDown=false,handMode=false,clipboard=null,clipboardAssets=[],contextPoint=null;
const activeIds=()=>cropMode?[cropMode]:[...new Set([selected,...extraSelection].flatMap(id=>selectionIds(doc,id,$('linked').checked)))];
const selectedBox=()=>bounds(doc.items.filter(n=>activeIds().includes(n.id)));
const handlePoints=b=>[['nw',b.x,b.y],['n',b.x+b.w/2,b.y],['ne',b.x+b.w,b.y],['e',b.x+b.w,b.y+b.h/2],['se',b.x+b.w,b.y+b.h],['s',b.x+b.w/2,b.y+b.h],['sw',b.x,b.y+b.h],['w',b.x,b.y+b.h/2]];
const status=(message,error=false)=>{$('status').textContent=message;$('status').classList.toggle('error',error);};
let recoveryMessage='Ready · Select a part and choose its look.';
try{const saved=await readDraft();if(saved){doc=fromRecipe(saved);recoveryMessage='Recovered your last design.';}}catch{recoveryMessage='Recovery could not be read. A fresh preset is open.';}
function current(){return doc.items.find(n=>n.id===selected);}
let persistQueue=Promise.resolve();
function persist(){const snapshot=clone(doc);$('recovery').textContent='Saving draft…';persistQueue=persistQueue.catch(()=>{}).then(()=>writeDraft(snapshot)).then(()=>{storageOK=true;$('recovery').textContent='Draft saved in this browser';}).catch(()=>{storageOK=false;$('recovery').textContent='Recovery unavailable · Save design to keep imported images';});}
function remember(before){if(JSON.stringify(before)===JSON.stringify(doc))return;past.push(before);if(past.length>80)past.shift();future.length=0;persist();}
function update(fn,message='Design updated',light=false){cropMode=null;const before=clone(doc);try{fn();doc=validate(doc);remember(before);status(message);}catch(error){doc=before;status(error.message,true);}light?(controls(),syncCopy(),draw()):refresh();}
function setValue(id,value){if(document.activeElement!==$(id))$(id).value=value;}
function source(n){const a=doc.customAssets?.find(a=>a.id===n.asset);return a?customImages.get(a.id)?.get(a.src):images.get(n.asset);}
const appearanceCache=new Map();
function styledImage(n){
 const original=source(n)?.img;if(!original)return null;
 const trim=isManaAsset(n.asset)&&(n.trimAmount||0)>0,tint=(n.tintAmount||0)>0;
 if(!trim&&!tint&&!n.sourceRect)return original;
 const key=JSON.stringify([n.asset,source(n)?.version,n.tintColor,n.tintAmount,trim&&n.trimColor,trim&&n.trimAmount,n.sourceRect]);
 if(appearanceCache.has(key)){const cached=appearanceCache.get(key);appearanceCache.delete(key);appearanceCache.set(key,cached);return cached;}
 const rect=n.sourceRect||[0,0,original.width,original.height],c=document.createElement('canvas');c.width=Math.round(rect[2]);c.height=Math.round(rect[3]);const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(original,...rect,0,0,c.width,c.height);const pixels=g.getImageData(0,0,c.width,c.height);
 pixels.data.set(recolorPixels(pixels.data,{tintColor:n.tintColor||'#d6af5e',tintAmount:n.tintAmount||0,trimColor:n.trimColor||'#d6af5e',trimAmount:trim?n.trimAmount:0,manaTrim:trim}));g.putImageData(pixels,0,0);appearanceCache.set(key,c);if(appearanceCache.size>32)appearanceCache.delete(appearanceCache.keys().next().value);return c;
}
function art(g,n,layout=doc){if(!n.visible)return;g.save();g.globalAlpha=n.opacity;
 if(n.asset==='text'){
  g.font=`${n.italic?'italic ':''}${n.fontWeight==='bold'?'bold ':''}${n.fontSize}px "${n.fontFamily||'Georgia'}"`;
  g.textAlign=n.align==='start'?'left':n.align==='end'?'right':'center';g.textBaseline='alphabetic';g.fillStyle=n.color;g.strokeStyle=n.stroke||'#000000';g.lineWidth=n.strokeWidth||0;g.lineJoin='round';
  const lines=n.text.split('\n'),x=n.align==='start'?n.x:n.align==='end'?n.x+n.w:n.x+n.w/2;
  lines.forEach((line,i)=>{const y=n.y+n.h/2+(i-(lines.length-1)/2)*n.fontSize*1.2+n.fontSize*.35;if(n.strokeWidth)g.strokeText(line,x,y);g.fillText(line,x,y);});
 }else{
  const a=source(n);if(a){const img=styledImage({...n,sourceRect:undefined}),r=n.sourceRect||[0,0,img.width,img.height],{x,y,w,h}=imagePlacement(n,r[2],r[3]);if(n.clipToCard)g.clip(new Path2D(cardClipPath(layout.width,layout.height)));
   g.beginPath();g.rect(n.x,n.y,n.w,n.h);g.clip();g.drawImage(img,...r,x,y,w,h);
  }
 }g.restore();
}
function renderDoc(g,layout){layout.items.forEach(n=>art(g,n,layout));}
function drawGrid(){
 const g=context,host=$('viewport'),left=-camera.x/zoom,top=-camera.y/zoom,right=left+host.clientWidth/zoom,bottom=top+host.clientHeight/zoom;
 g.save();g.lineWidth=1/zoom;
 if($('show-grid').checked){let step=Number($('grid-size').value);while(step*zoom<9)step*=2;
  for(const major of [false,true]){g.strokeStyle=major?'#d7dab744':'#d7dab71c';g.beginPath();
   for(let i=Math.ceil(left/step);i<=Math.floor(right/step);i++){if((i%4===0)!==major)continue;g.moveTo(i*step,top);g.lineTo(i*step,bottom);}
   for(let i=Math.ceil(top/step);i<=Math.floor(bottom/step);i++){if((i%4===0)!==major)continue;g.moveTo(left,i*step);g.lineTo(right,i*step);}g.stroke();
  }
 }
 if($('center-guides').checked){g.strokeStyle='#7bccc5aa';g.setLineDash([6/zoom,5/zoom]);g.beginPath();g.moveTo(doc.width/2,top);g.lineTo(doc.width/2,bottom);g.moveTo(left,doc.height/2);g.lineTo(right,doc.height/2);g.stroke();}g.restore();
}
function startCrop(){
 const n=current();if(!ready||!n||n.asset==='text'||n.locked||!n.visible){status('Select a visible, unlocked image to crop.');return;}
 if(drag)finishDrag(true);cropMode=n.id;extraSelection.clear();handMode=false;preview=false;$('pan').setAttribute('aria-pressed','false');$('edit').setAttribute('aria-pressed','true');$('clean').setAttribute('aria-pressed','false');document.body.classList.remove('preview');controls();fit();canvas.focus();status('Crop mode · Drag artwork to reposition; drag gold handles to trim. Enter finishes.');
}
function drawCropOverlay(){
 const n=current(),a=n&&source(n);if(!a)return;const crop=normalizedCrop(n,a.img.width,a.img.height),full=fullImageBounds(n,a.img.width,a.img.height),g=context;
 g.save();g.beginPath();g.rect(full.x,full.y,full.w,full.h);g.rect(crop.x,crop.y,crop.w,crop.h);g.clip('evenodd');g.globalAlpha=.35;g.drawImage(a.img,full.x,full.y,full.w,full.h);g.restore();
 g.save();g.strokeStyle='#92b6bf';g.lineWidth=1/zoom;g.setLineDash([5/zoom,5/zoom]);g.strokeRect(full.x,full.y,full.w,full.h);g.setLineDash([]);g.strokeStyle='#f6d591';g.lineWidth=2/zoom;g.strokeRect(crop.x,crop.y,crop.w,crop.h);
 g.lineWidth=1/zoom;g.globalAlpha=.55;g.beginPath();for(const fraction of [1/3,2/3]){g.moveTo(crop.x+crop.w*fraction,crop.y);g.lineTo(crop.x+crop.w*fraction,crop.y+crop.h);g.moveTo(crop.x,crop.y+crop.h*fraction);g.lineTo(crop.x+crop.w,crop.y+crop.h*fraction);}g.stroke();g.globalAlpha=1;
 for(const [handle,x,y]of handlePoints(crop)){g.fillStyle='#f6d591';g.fillRect(x-5/zoom,y-5/zoom,10/zoom,10/zoom);g.strokeStyle='#151c17';g.strokeRect(x-5/zoom,y-5/zoom,10/zoom,10/zoom);}g.restore();
}
$('extra-background').onclick=()=>{const n=current(),asset=n&&extraBackgroundFor.get(n.asset);if(!asset||n.locked||!byId.has(asset))return;update(()=>{n.asset=asset;n.fit='cover';n.cropX=.5;n.cropY=.65;delete n.sourceRect;},'Extra background applied · drag the picture to choose your crop');startCrop();};
$('crop-tool').onclick=()=>cropMode?$('crop-done').click():startCrop();
$('crop-done').onclick=()=>{if(drag)finishDrag();cropMode=null;controls();draw();status('Crop saved · original pixels remain available');};
$('reset-crop').onclick=$('crop-reset-inline').onclick=()=>{const n=current(),a=n&&source(n);if(!n||n.locked||!a)return;update(()=>{doc.items[doc.items.indexOf(n)]=resetCrop(n,a.img.width,a.img.height);},'Original image extent restored · card clipping stays on');startCrop();};
function draw(){const ratio=devicePixelRatio||1;context.setTransform(1,0,0,1,0,0);context.clearRect(0,0,canvas.width,canvas.height);context.setTransform(ratio*zoom,0,0,ratio*zoom,ratio*camera.x,ratio*camera.y);
 if(!preview){context.save();context.strokeStyle='#8c967735';context.lineWidth=1/zoom;context.setLineDash([3/zoom,5/zoom]);context.strokeRect(0,0,doc.width,doc.height);context.restore();}
 renderDoc(context,doc);if(!preview)drawGrid();const b=selectedBox(),nodes=doc.items.filter(n=>activeIds().includes(n.id));
 if(!preview&&!cropMode&&nodes.length){context.save();context.strokeStyle=nodes.some(n=>n.locked)?'#829283':'#f1d38d';context.lineWidth=1/zoom;context.strokeRect(b.x,b.y,b.w,b.h);if(!nodes.some(n=>n.locked)){for(const [handle,x,y]of handlePoints(b)){context.fillStyle='#202a20';context.fillRect(x-5/zoom,y-5/zoom,10/zoom,10/zoom);context.strokeRect(x-5/zoom,y-5/zoom,10/zoom,10/zoom);}}context.restore();}
 if(!preview&&cropMode)drawCropOverlay();
 if(!preview&&drag?.marquee){const b=drag.marquee;context.save();context.fillStyle='#bda56620';context.strokeStyle='#ebcc8b';context.lineWidth=1/zoom;context.fillRect(b.x,b.y,b.w,b.h);context.strokeRect(b.x,b.y,b.w,b.h);context.restore();}
 context.save();context.strokeStyle='#f0ce82';context.lineWidth=1/zoom;const extent=contentBounds(doc,80);for(const guide of guides){context.beginPath();if(guide.axis==='x'){context.moveTo(guide.value,extent.y);context.lineTo(guide.value,extent.y+extent.h);}else{context.moveTo(extent.x,guide.value);context.lineTo(extent.x+extent.w,guide.value);}context.stroke();}context.restore();
}
function layout(){const host=$('viewport'),ratio=devicePixelRatio||1;canvas.width=Math.max(1,Math.round(host.clientWidth*ratio));canvas.height=Math.max(1,Math.round(host.clientHeight*ratio));$('zoom').value=Math.round(zoom*100);$('zoom-value').textContent=Math.round(zoom*100)+'%';const b=contentBounds(doc);$('canvas-caption').textContent=`Export ${Math.ceil(b.w)} × ${Math.ceil(b.h)} · Includes overhanging pieces`;draw();}
function fit(){const size=$('preview-size').value,n=current(),a=n&&source(n),b=cropMode&&a?bounds([contentBounds(doc),fullImageBounds(n,a.img.width,a.img.height)]):contentBounds(doc),host=$('viewport');zoom=size==='desktop'?260/b.w:size==='mobile'?170/b.w:clamp(Math.min((host.clientWidth-64)/b.w,(host.clientHeight-56)/b.h),.08,4);camera={x:(host.clientWidth-b.w*zoom)/2-b.x*zoom,y:(host.clientHeight-b.h*zoom)/2-b.y*zoom};autoFit=true;layout();}
function zoomAt(next,x=$('viewport').clientWidth/2,y=$('viewport').clientHeight/2){const wx=(x-camera.x)/zoom,wy=(y-camera.y)/zoom;zoom=clamp(next,.08,4);camera={x:x-wx*zoom,y:y-wy*zoom};autoFit=false;layout();}
function setTab(next){tab=next;for(const button of document.querySelectorAll('[data-tab]'))button.setAttribute('aria-pressed',String(button.dataset.tab===tab));for(const name of ['parts','text','layers','presets'])$(name+'-panel').hidden=name!==tab;if(tab==='parts'&&current()?.asset==='text')selected=doc.items.find(n=>n.role==='outer-frame')?.id||doc.items.find(n=>n.asset!=='text')?.id;refresh();}
function choose(id,add=false){cropMode=null;if(!add)extraSelection.clear();else if(selected&&selected!==id)activeIds().forEach(q=>extraSelection.add(q));selected=id;controls();renderLayers();renderParts();draw();}
function renderParts(){const slot=$('slot');slot.replaceChildren();for(const n of doc.items.filter(n=>n.asset!=='text')){const o=document.createElement('option');o.value=n.id;o.textContent=nice(n)+(n.visible?'':' · hidden');slot.append(o);}const n=current();if(n&&n.asset!=='text')slot.value=n.id;else slot.selectedIndex=-1;
 const host=$('choices');host.replaceChildren();const a=n&&assetInfo(n.asset);$('part-label').textContent=a?`${(a.category||'imported').replaceAll('-',' ')} · click to replace`:'Select an image layer';$('reset-part').disabled=!n;
 if(!a)return;for(const asset of allAssets().filter(q=>q.category===(a.category||'imported'))){
  const button=document.createElement('button');button.className='choice'+(n.asset===asset.id?' selected':'');button.title=asset.id;button.setAttribute('aria-label','Use '+asset.name);button.setAttribute('aria-pressed',String(n.asset===asset.id));
  const image=document.createElement('img');image.src=source({asset:asset.id})?.img.src||asset.src;image.alt='';const name=document.createElement('span');name.textContent=asset.name;button.append(image,name);
  button.onclick=()=>update(()=>{const target=current();target.asset=asset.id;if(asset.id.startsWith('as.card.artwork.extended-'))Object.assign(target,{fit:'cover',cropX:.5,cropY:.65});delete target.sourceRect;if(assetRects.has(asset.id))target.sourceRect=[...assetRects.get(asset.id)];target.visible=true;},`Applied ${asset.name} to ${nice(n)}`);host.append(button);
 }
}
function syncCopy(){for(const input of document.querySelectorAll('[data-copy-layer]')){if(document.activeElement===input)continue;const n=doc.items.find(q=>q.id===input.dataset.copyLayer);if(n)input.value=n.text;}}
function renderCopy(){const host=$('copy-fields');host.replaceChildren();for(const n of doc.items.filter(n=>n.asset==='text')){const label=document.createElement('label');label.className='copy-field';label.textContent=nice(n);const input=document.createElement(n.role==='rules'||n.role==='flavor'?'textarea':'input');input.dataset.copyLayer=n.id;input.value=n.text;input.maxLength=2000;input.setAttribute('aria-label',nice(n));input.onfocus=()=>{extraSelection.clear();selected=n.id;controls();draw();};input.oninput=()=>update(()=>{doc.items.find(q=>q.id===n.id).text=input.value;},'Wording updated',true);label.append(input);host.append(label);}}
function renderLayers(){const host=$('layers');host.replaceChildren();for(const n of [...doc.items].reverse()){const b=document.createElement('button');b.className='layer'+(activeIds().includes(n.id)?' selected':'');b.setAttribute('aria-pressed',String(activeIds().includes(n.id)));const mark=document.createElement('span');mark.textContent=n.locked?'▣':n.visible?'◉':'○';const name=document.createElement('span');name.textContent=nice(n);const id=document.createElement('small');id.textContent=n.id+(n.group?' · grouped':'');b.append(mark,name,id);b.onclick=e=>choose(n.id,e.shiftKey);host.append(b);}$('layer-count').textContent=doc.items.length+' layers';}
function controls(){const n=current(),ids=activeIds(),box=selectedBox();$('properties').hidden=!n;$('selection-name').textContent=n?nice(n):'Choose a part';$('component-id').textContent=n?(n.asset==='text'?n.id:n.asset):'';$('copy-id').disabled=!n;$('kind').textContent=ids.length>1?ids.length+' linked layers':n?(n.asset==='text'?'Editable text':'Component'):'';
 if(cropMode&&(!n||n.id!==cropMode||n.asset==='text'||n.locked))cropMode=null;
 const canCrop=!!n&&n.asset!=='text'&&n.visible&&!n.locked;
 const extended=extraBackgroundFor.get(n?.asset);$('extra-background').hidden=!extended||!byId.has(extended);$('extra-background').disabled=!canCrop;
 $('crop-tool').disabled=!canCrop;$('crop-tool').setAttribute('aria-pressed',String(!!cropMode));$('crop-toolbar').hidden=!cropMode;$('reset-crop').disabled=!canCrop;document.body.classList.toggle('cropping',!!cropMode);
 arrangeControls();$('undo').disabled=!past.length;$('redo').disabled=!future.length;setValue('design-name',doc.name);
 $('appearance-details').hidden=!n||n.asset==='text';$('image-compose').hidden=!n||n.asset==='text';if(n&&n.asset!=='text'){setValue('crop-x',(n.cropX??.5)*100);setValue('crop-y',(n.cropY??.5)*100);$('clip-card').checked=!!n.clipToCard;$('crop-x').disabled=$('crop-y').disabled=n.fit==='stretch';}if(n&&n.asset!=='text')appearanceControls(n);
 if(!n)return;for(const k of ['x','y','w','h'])setValue(k,Math.round(box[k]*10)/10);setValue('opacity',n.opacity*100);$('visible').checked=n.visible;$('locked').checked=doc.items.some(n=>ids.includes(n.id)&&n.locked);setValue('image-fit',n.fit);$('image-fit').disabled=n.asset==='text';$('type-details').hidden=n.asset!=='text';
 if(n.asset==='text'){for(const k of ['text','fontSize','color','align','stroke','strokeWidth'])setValue(k,n[k]);$('bold').checked=n.fontWeight==='bold';$('italic').checked=n.italic;}
 for(const id of ['x','y','w','h','center-x','center-y','forward','backward','remove','fill-card','send-bottom'])$(id).disabled=doc.items.some(n=>ids.includes(n.id)&&n.locked);
}
function appearanceControls(n){
 $('mana-trim-controls').hidden=!isManaAsset(n.asset);
 for(const kind of ['tint','trim']){const color=n[kind+'Color']||'#d6af5e',amount=n[kind+'Amount']||0;setValue(kind+'-color',color);setValue(kind+'-hex',color);setValue(kind+'-amount',amount*100);$(kind+'-value').textContent=Math.round(amount*100)+'%';const options=[...$(kind+'-preset').options].map(o=>o.value);setValue(kind+'-preset',!amount?'original':options.includes(color)?color:'custom');}
}
for(const kind of ['tint','trim']){
 const apply=(color,amount)=>update(()=>{const n=current();if(!n||n.asset==='text')return;if(!/^#[0-9a-f]{6}$/i.test(color))throw Error('Use a six-digit hex color, such as #d6af5e.');n[kind+'Color']=color;n[kind+'Amount']=amount;},kind==='trim'?'Mana trim updated':'Component color updated',true);
 $(kind+'-preset').onchange=()=>{const value=$(kind+'-preset').value;if(value==='custom'){$(kind+'-hex').focus();return;}apply(value==='original'?'#d6af5e':value,value==='original'?0:1);};
 $(kind+'-color').oninput=()=>apply($(kind+'-color').value,current()?.[kind+'Amount']||1);
 $(kind+'-hex').onchange=()=>{apply($(kind+'-hex').value.trim(),current()?.[kind+'Amount']||1);$(kind+'-hex').value=current()?.[kind+'Color']||'#d6af5e';};
 $(kind+'-amount').oninput=()=>apply(current()?.[kind+'Color']||'#d6af5e',Number($(kind+'-amount').value)/100);
 $('reset-'+kind).onclick=()=>update(()=>{if(current()){delete current()[kind+'Color'];delete current()[kind+'Amount'];}},kind==='trim'?'Original mana trim restored':'Original component color restored');
}
function arrangeControls(){
 const ids=activeIds(),nodes=doc.items.filter(n=>ids.includes(n.id)),units=selectionUnits(doc,ids,{linked:$('linked').checked}),locked=nodes.some(n=>n.locked),target=$('align-target').value;
 for(const b of document.querySelectorAll('[data-align]'))b.disabled=locked||!nodes.length||(target==='selection'&&units.length<2);
 $('distribute-x').disabled=$('distribute-y').disabled=locked||units.length<3;
 $('group').disabled=locked||nodes.length<2||nodes.every(n=>n.group&&n.group===nodes[0].group);
 $('ungroup').disabled=locked||!nodes.some(n=>n.group);
 $('arrange-hint').textContent=units.length+' separate pieces / groups selected. Equal gaps need at least 3.';
 for(const b of document.querySelectorAll('[data-command="group"],[data-command="ungroup"]'))b.disabled=$(b.dataset.command).disabled;
}
function refresh(){extraSelection=new Set([...extraSelection].filter(id=>doc.items.some(n=>n.id===id)));if(selected&&!doc.items.some(n=>n.id===selected))selected=doc.items.at(-1)?.id||null;controls();renderParts();renderCopy();renderLayers();renderAddLibrary();layout();}
function loadPreset(id){update(()=>{const next=clone(ALL_PRESETS.find(p=>p.id===id).doc);if($('keep-copy').checked){for(const n of next.items.filter(n=>n.asset==='text')){const prior=doc.items.find(q=>q.role===n.role&&q.asset==='text');if(prior)n.text=prior.text;}}doc=next;selected='layer.outer-frame';extraSelection.clear();},'Preset applied · Undo restores your previous arrangement.');fit();}
function makePresets(){for(const p of ALL_PRESETS){const b=document.createElement('button');b.className='preset-card';b.setAttribute('aria-label','Load '+p.name);const c=document.createElement('canvas');c.width=160;c.height=240;const g=c.getContext('2d'),ext=contentBounds(p.doc),z=Math.min(156/ext.w,236/ext.h);g.translate((160-ext.w*z)/2-ext.x*z,(240-ext.h*z)/2-ext.y*z);g.scale(z,z);renderDoc(g,p.doc);const label=document.createElement('span');label.textContent=p.name;b.append(c,label);b.onclick=()=>loadPreset(p.id);$('presets').append(b);}}
function undo(){if(drag)finishDrag(true);cropMode=null;if(!past.length){controls();draw();return;}future.push(clone(doc));doc=past.pop();persist();refresh();layout();status('Undone');}
function redo(){if(drag)finishDrag(true);cropMode=null;if(!future.length){controls();draw();return;}past.push(clone(doc));doc=future.pop();persist();refresh();layout();status('Redone');}
function uniqueId(){return 'layer.custom-'+crypto.randomUUID();}
function addText(){update(()=>{const id=uniqueId();doc.items.push({id,asset:'text',role:'custom',name:'Custom text',text:'New text',fontSize:48,fontFamily:'Georgia',color:'#f1e7cf',align:'middle',italic:false,fontWeight:'normal',stroke:'#000000',strokeWidth:0,x:112,y:1050,w:800,h:120,visible:true,locked:false,opacity:1,fit:'stretch',group:''});selected=id;},'Text layer added');setTab('layers');}
const point=e=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left-camera.x)/zoom,y:(e.clientY-r.top-camera.y)/zoom};};
function hit(n,p){if(n.clipToCard&&!context.isPointInPath(new Path2D(cardClipPath(doc.width,doc.height)),(p.x*zoom+camera.x)*(devicePixelRatio||1),(p.y*zoom+camera.y)*(devicePixelRatio||1)))return false;if(!n.visible||p.x<n.x||p.y<n.y||p.x>n.x+n.w||p.y>n.y+n.h)return false;if(n.asset==='text')return true;const a=source(n);if(!a)return false;const rect=n.sourceRect||[0,0,a.img.width,a.img.height],{x,y,w,h}=imagePlacement(n,rect[2],rect[3]);const ax=Math.floor((rect[0]+(p.x-x)/w*rect[2])/a.img.width*a.hitW),ay=Math.floor((rect[1]+(p.y-y)/h*rect[3])/a.img.height*a.hitH);return ax>=0&&ay>=0&&ax<a.hitW&&ay<a.hitH&&a.alpha[(ay*a.hitW+ax)*4+3]>20;}
const cursorFor={nw:'nwse-resize',se:'nwse-resize',ne:'nesw-resize',sw:'nesw-resize',n:'ns-resize',s:'ns-resize',e:'ew-resize',w:'ew-resize'};
canvas.addEventListener('pointerdown',e=>{if(!ready||e.button===2)return;$('context-menu').hidden=true;const p=point(e);canvas.focus();if(e.button===1||spaceDown||handMode){drag={pan:true,start:{x:e.clientX,y:e.clientY},camera:{...camera},pointer:e.pointerId};autoFit=false;canvas.style.cursor='grabbing';canvas.setPointerCapture(e.pointerId);e.preventDefault();return;}if(preview)return;
 if(cropMode){const n=current(),a=source(n);if(!n||n.locked||!a)return;const box=normalizedCrop(n,a.img.width,a.img.height),handle=hitHandles(box,p,10/zoom);if(!handle&&(p.x<box.x||p.y<box.y||p.x>box.x+box.w||p.y>box.y+box.h)){status('Drag the picture inside the crop, or drag a gold trim handle.');return;}drag={crop:true,before:clone(doc),node:clone(n),start:p,handle,pointer:e.pointerId};autoFit=false;canvas.setPointerCapture(e.pointerId);e.preventDefault();return;}
 const handle=current()?hitHandles(selectedBox(),p,8/zoom):null,hits=[...doc.items].reverse().filter(n=>hit(n,p));let target=handle?current():hits[0];
 if(e.altKey&&!handle&&hits.length){const index=hits.findIndex(n=>n.id===selected);target=hits[(index+1)%hits.length];}
 if(!target){if(!e.shiftKey){selected=null;extraSelection.clear();}drag={start:p,before:clone(doc),marquee:{x:p.x,y:p.y,w:0,h:0},pointer:e.pointerId};canvas.setPointerCapture(e.pointerId);refresh();return;}
 if(!handle&&!activeIds().includes(target.id))choose(target.id,e.shiftKey);else if(!handle&&e.shiftKey){if(extraSelection.has(target.id)){extraSelection.delete(target.id);controls();draw();return;}choose(target.id,true);}
 const ids=e.altKey&&!handle?[target.id]:activeIds();if(doc.items.some(n=>ids.includes(n.id)&&n.locked)){status('Selection is locked. Unlock it to move or resize.');return;}
 drag={before:clone(doc),start:p,ids,box:bounds(doc.items.filter(n=>ids.includes(n.id))),handle,pointer:e.pointerId};canvas.setPointerCapture(e.pointerId);e.preventDefault();
});
canvas.addEventListener('pointermove',e=>{const p=point(e);if(!drag){const n=current(),a=n&&source(n),box=cropMode&&a?normalizedCrop(n,a.img.width,a.img.height):selectedBox();const handle=n&&!preview?hitHandles(box,p,8/zoom):null;canvas.style.cursor=spaceDown||handMode?'grab':handle?cursorFor[handle]:preview?'default':[...doc.items].reverse().some(n=>hit(n,p))?'move':'crosshair';return;}
 if(drag.pan){camera={x:drag.camera.x+e.clientX-drag.start.x,y:drag.camera.y+e.clientY-drag.start.y};draw();return;}
 let dx=p.x-drag.start.x,dy=p.y-drag.start.y;if(drag.crop){const a=source(drag.node),width=a.img.width,height=a.img.height;const next=drag.handle?trimCrop(drag.node,width,height,drag.handle,dx,dy):panCrop(drag.node,width,height,dx,dy);doc.items[doc.items.findIndex(n=>n.id===drag.node.id)]=next;controls();draw();return;}if(drag.marquee){drag.marquee={x:Math.min(p.x,drag.start.x),y:Math.min(p.y,drag.start.y),w:Math.abs(dx),h:Math.abs(dy)};draw();return;}
 if(drag.handle){doc=resizeSelection(drag.before,drag.ids,drag.handle,dx,dy,{aspect:$('aspect').checked||e.shiftKey,center:e.altKey});guides=[];}else{let fixedAxis=null;if(e.shiftKey){if(Math.abs(dx)>Math.abs(dy)){dy=0;fixedAxis='y';}else{dx=0;fixedAxis='x';}}const result=snapTranslation(drag.before,drag.ids,dx,dy,{threshold:7/zoom,grid:$('snap-grid').checked?Number($('grid-size').value):0,edges:$('snap').checked,enabled:($('snap').checked||$('snap-grid').checked)&&!e.ctrlKey&&!e.metaKey});doc=result.doc;guides=result.guides;if(fixedAxis){const after=bounds(doc.items.filter(n=>drag.ids.includes(n.id)));doc=move(doc,drag.ids,fixedAxis==='x'?drag.box.x-after.x:0,fixedAxis==='y'?drag.box.y-after.y:0);guides=guides.filter(g=>g.axis!==fixedAxis);}}controls();draw();
});
function finishDrag(cancel=false){if(!drag)return;const old=drag;drag=null;if(old.pan){if(cancel)camera=old.camera;canvas.style.cursor=spaceDown||handMode?'grab':'default';draw();return;}
 if(old.marquee){if(!cancel){const b=old.marquee,found=doc.items.filter(n=>n.visible&&!n.locked&&n.x>=b.x&&n.y>=b.y&&n.x+n.w<=b.x+b.w&&n.y+n.h<=b.y+b.h);found.forEach(n=>extraSelection.add(n.id));selected=found.at(-1)?.id||selected;status(`${activeIds().length} layers selected`);}refresh();return;}
 if(cancel){doc=old.before;status('Transform cancelled');}else{try{doc=validate(doc);remember(old.before);status(old.crop?(old.handle?'Artwork trimmed · hidden pixels kept':'Artwork repositioned inside crop'):old.handle?'Selection scaled':'Position saved');}catch(error){doc=old.before;status(error.message,true);}}guides=[];refresh();
}
canvas.addEventListener('pointerup',()=>finishDrag());canvas.addEventListener('pointercancel',()=>finishDrag(true));canvas.addEventListener('lostpointercapture',()=>{if(drag)finishDrag(true);});
canvas.addEventListener('wheel',e=>{e.preventDefault();const rect=canvas.getBoundingClientRect();if(e.ctrlKey||e.metaKey||$('wheel-zoom').checked)zoomAt(zoom*Math.exp(-e.deltaY*.0015),e.clientX-rect.left,e.clientY-rect.top);else{camera.x-=e.shiftKey?e.deltaY:e.deltaX;camera.y-=e.shiftKey?0:e.deltaY;autoFit=false;draw();}},{passive:false});
canvas.addEventListener('dblclick',()=>{const n=current();if(n?.asset==='text'){setTab('text');document.querySelector(`[data-copy-layer="${n.id}"]`)?.focus();}else if(n){startCrop();}});
canvas.addEventListener('contextmenu',e=>{e.preventDefault();if(cropMode)return;const p=point(e),target=[...doc.items].reverse().find(n=>hit(n,p));if(target&&!activeIds().includes(target.id))choose(target.id);contextPoint=p;const menu=$('context-menu');menu.hidden=false;menu.style.left=Math.min(e.clientX,innerWidth-200)+'px';menu.style.top=Math.min(e.clientY,innerHeight-menu.offsetHeight-8)+'px';menu.querySelector('button').focus();});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#context-menu'))$('context-menu').hidden=true;if(!e.target.closest('.canvas-options'))for(const menu of document.querySelectorAll('.canvas-options'))menu.open=false;});
for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>setTab(b.dataset.tab);
for(const b of document.querySelectorAll('[data-align]'))b.onclick=()=>update(()=>{doc=alignSelection(doc,activeIds(),b.dataset.align,{target:$('align-target').value,linked:$('linked').checked});},'Aligned to '+$('align-target').value);
for(const axis of ['x','y'])$('distribute-'+axis).onclick=()=>update(()=>{doc=distributeSelection(doc,activeIds(),axis,{linked:$('linked').checked});},'Equal spacing applied');
$('group').onclick=()=>update(()=>{doc=groupSelection(doc,activeIds(),'group-'+crypto.randomUUID());},'Selection grouped');
$('ungroup').onclick=()=>update(()=>{const ids=activeIds();doc=ungroupSelection(doc,ids);extraSelection=new Set(ids);},'Custom group removed');
$('align-target').onchange=arrangeControls;
const VIEW_KEY=KEY+'.view',viewKeys=['show-grid','snap-grid','center-guides','snap','linked','grid-size'];
try{const prefs=JSON.parse(localStorage.getItem(VIEW_KEY)||'{}');for(const id of viewKeys){if($(id).type==='checkbox'&&typeof prefs[id]==='boolean')$(id).checked=prefs[id];else if(id==='grid-size'&&[4,8,16,32,64,128].includes(Number(prefs[id])))$(id).value=prefs[id];}}catch{}
for(const id of viewKeys)$(id).addEventListener('change',()=>{try{localStorage.setItem(VIEW_KEY,JSON.stringify(Object.fromEntries(viewKeys.map(key=>[key,$(key).type==='checkbox'?$(key).checked:$(key).value]))));}catch{}draw();});
for(const menu of document.querySelectorAll('.canvas-options'))menu.addEventListener('toggle',()=>{if(menu.open)for(const other of document.querySelectorAll('.canvas-options'))if(other!==menu)other.open=false;});
let importMode='new',replaceTarget=null;
function renderAddLibrary(){
 const old=$('add-asset').value;for(const id of ['add-asset','cost-symbol']){const select=$(id),value=select.value;select.replaceChildren();for(const a of allAssets().filter(a=>id==='add-asset'||a.category==='icon')){const o=document.createElement('option');o.value=a.id;o.textContent=a.name;select.append(o);}if([...select.options].some(o=>o.value===value))select.value=value;}
}
function addAssetLayer(assetId){const a=assetInfo(assetId);if(!a)return;update(()=>{const rect=assetRects.get(a.id),iw=rect?.[2]||a.width,ih=rect?.[3]||a.height,w=a.category==='icon'?180:Math.min(800,iw),h=Math.min(1400,w*ih/iw),id=uniqueId();doc.items.push({id,asset:a.id,name:a.name,role:'custom',x:(doc.width-w)/2,y:(doc.height-h)/2,w,h,visible:true,locked:false,opacity:1,fit:'contain',group:'',...(rect?{sourceRect:[...rect]}:{})});selected=id;extraSelection.clear();},'Component added');}
$('insert-asset').onclick=()=>addAssetLayer($('add-asset').value);
$('add-text-quick').onclick=addText;
$('insert-cost').onclick=()=>update(()=>{const asset=$('cost-symbol').value,id=uniqueId(),group='cost-'+crypto.randomUUID();doc.items.push({id,asset,...(assetRects.has(asset)?{sourceRect:[...assetRects.get(asset)]}:{}),name:'Custom cost symbol',role:'custom-cost',x:80,y:200,w:180,h:180,visible:true,locked:false,opacity:1,fit:'contain',group},{id:uniqueId(),asset:'text',name:'Custom cost value',role:'custom-value',x:100,y:236,w:140,h:105,visible:true,locked:false,opacity:1,fit:'stretch',group,text:$('cost-value').value||'1',fontSize:76,color:'#f1e7cf',fontFamily:'Georgia',align:'middle',italic:false,fontWeight:'bold',stroke:'#090c09',strokeWidth:6});selected=id;extraSelection.clear();},'Linked cost badge added');
$('full-art-starter').onclick=()=>loadPreset('as.card.preset.full-art.v1');
$('import-image').onclick=()=>{importMode='new';replaceTarget=null;$('image-file').click();};
$('replace-image').onclick=()=>{importMode='replace';replaceTarget=current()?.id;$('image-file').click();};
async function importImage(file,mode='new',targetId=null,options={}){
 if(!file)return;const before=doc;
 try{if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Choose a PNG, JPEG or WebP image.');if(4*Math.ceil(file.size/3)>12*1024*1024)throw Error('Image is too large. Use an image smaller than 9 MB.');
 const src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);});const image=new Image();image.src=src;await image.decode();if(image.width>4096||image.height>4096)throw Error('Use artwork no larger than 4096 pixels per side.');
 if(options.width&&(image.width!==options.width||image.height!==options.height))throw Error('Artwork dimensions differ from the library catalog.');
 const a={id:'custom.'+crypto.randomUUID(),name:file.name.slice(0,120),width:image.width,height:image.height,src};const keptAssets=options.artwork?(doc.customAssets||[]).filter(asset=>doc.items.some(n=>n.asset===asset.id&&n.id!==targetId)):(doc.customAssets||[]);const next=clone(doc);next.customAssets=[...keptAssets,a];if(options.artwork&&mode==='replace'&&next.items.some(n=>n.id===targetId)){const replacement=next.items.find(n=>n.id===targetId);replacement.asset=a.id;delete replacement.sourceRect;}validate(next);await loadImageAsset(a,true);if(doc!==before)throw Error('The design changed while loading. Import the image again.');
 update(()=>{doc.customAssets=[...keptAssets,a];const target=mode==='replace'?doc.items.find(n=>n.id===targetId):null;if(mode==='replace'&&!target)throw Error('Select the layer to replace again.');if(options.artwork&&target?.locked)throw Error('Unlock the artwork layer before replacing it.');if(target){target.asset=a.id;target.visible=true;if(options.artwork){target.fit='cover';target.cropX=.5;target.cropY=.5;}delete target.sourceRect;delete target.tintColor;delete target.tintAmount;delete target.trimColor;delete target.trimAmount;selected=target.id;}else{const id=uniqueId(),w=Math.min(800,a.width),h=Math.min(1400,w*a.height/a.width);doc.items.push({id,asset:a.id,name:a.name,role:options.artwork?'artwork':'custom',x:(doc.width-w)/2,y:(doc.height-h)/2,w,h,visible:true,locked:false,opacity:1,fit:'contain',group:''});if(options.artwork){const added=doc.items.pop(),existing=doc.items.findLast(n=>n.role==='artwork');if(existing){Object.assign(added,{x:existing.x,y:existing.y,w:existing.w,h:existing.h,fit:'cover',clipToCard:!!existing.clipToCard});doc.items.splice(doc.items.indexOf(existing)+1,0,added);}else{Object.assign(added,{x:0,y:0,w:doc.width,h:doc.height,fit:'cover',clipToCard:true});const insertion=doc.items.findIndex(n=>n.asset==='text'||['rules-container','cost-banner','title-container','type-strip'].includes(n.role));doc.items.splice(insertion<0?doc.items.length:insertion,0,added);}}selected=id;}extraSelection.clear();},'Image imported · included in Save design');
 if(options.artwork&&!doc.items.some(n=>n.asset===a.id))throw Error('Artwork could not be added. Check the design status.');
 }catch(error){status(error.message,true);if(options.artwork)throw error;}
}
const workspaceLink=document.querySelector('a[href="card-assembler.html"]');if(workspaceLink&&location.pathname.endsWith('/parts/card-assembler/index.html'))workspaceLink.href='../../card-assembler.html';
mountCardArtLibrary({panel:$('card-art-panel'),search:$('card-art-search'),classSelect:$('card-art-class'),results:$('card-art-results'),message:$('card-art-message'),retry:$('card-art-retry'),onUse:async card=>{
 if(!ready)throw Error('Wait for the component library to finish loading.');
 const before=doc,n=current(),target=n?.asset!=='text'&&n?.role==='artwork'?n:null;
 if(target?.locked)throw Error('Unlock the artwork layer before replacing it.');
 const file=await fetchCardArtwork(card);if(doc!==before)throw Error('The design changed while loading. Choose the artwork again.');
 await importImage(file,target?'replace':'new',target?.id,{artwork:true,width:card.width,height:card.height});
}});
$('image-file').onchange=async e=>{await importImage(e.target.files[0],importMode,replaceTarget);e.target.value='';};
$('viewport').addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
$('viewport').addEventListener('drop',async e=>{e.preventDefault();await importImage(e.dataTransfer.files[0]);});
$('fill-card').onclick=()=>update(()=>{const n=current();if(n&&n.asset!=='text'&&!doc.items.some(q=>activeIds().includes(q.id)&&q.locked)){Object.assign(n,{x:0,y:0,w:doc.width,h:doc.height,fit:'cover',clipToCard:true});}},'Image fills the card · use crop controls to position it');
$('send-bottom').onclick=()=>update(()=>{const ids=activeIds();if(!doc.items.some(n=>ids.includes(n.id)&&n.locked)){doc.items=[...doc.items.filter(n=>ids.includes(n.id)),...doc.items.filter(n=>!ids.includes(n.id))];}},'Layer sent to back');
$('clip-card').onchange=()=>update(()=>{if(current())current().clipToCard=$('clip-card').checked;},'Card clipping updated');
for(const axis of ['x','y'])$('crop-'+axis).oninput=()=>update(()=>{if(current())current()[axis==='x'?'cropX':'cropY']=Number($('crop-'+axis).value)/100;},'Image crop updated',true);
$('slot').onchange=()=>choose($('slot').value);$('undo').onclick=undo;$('redo').onclick=redo;
$('design-name').oninput=()=>update(()=>doc.name=$('design-name').value.trim()||'Untitled card','Design renamed',true);
$('reset-part').onclick=()=>update(()=>{const n=current(),base=ALL_PRESETS.find(p=>p.id===doc.presetId)?.doc.items.find(q=>q.id===n?.id);if(!base)throw Error('This added layer has no original preset part.');doc.items[doc.items.indexOf(n)]=clone(base);},'Original part restored');
for(const key of ['x','y','w','h'])$(key).onchange=()=>update(()=>{const n=current(),v=Number($(key).value),b=selectedBox();if(!n)return;if(!Number.isFinite(v))throw Error('Enter a finite number.');if(key==='x'||key==='y')doc=move(doc,activeIds(),key==='x'?v-b.x:0,key==='y'?v-b.y:0);else{let w=key==='w'?v:b.w,h=key==='h'?v:b.h;if($('aspect').checked){if(key==='w')h=v*b.h/b.w;else w=v*b.w/b.h;}doc=resizeSelection(doc,activeIds(),'se',w-b.w,h-b.h,{aspect:false});}});
for(const key of ['visible','locked'])$(key).onchange=()=>update(()=>{for(const n of doc.items.filter(n=>activeIds().includes(n.id)))n[key]=$(key).checked;});
$('opacity').onchange=()=>update(()=>{if(current())current().opacity=Number($('opacity').value)/100;});
$('image-fit').onchange=()=>update(()=>{if(current())current().fit=$('image-fit').value;});
for(const key of ['text','fontSize','color','align','stroke','strokeWidth'])$(key).oninput=()=>update(()=>{if(current())current()[key]=['fontSize','strokeWidth'].includes(key)?Number($(key).value):$(key).value;},'Text styling updated',true);
$('outline-all').onclick=()=>update(()=>{for(const n of doc.items.filter(n=>n.asset==='text')){n.stroke='#090c09';n.strokeWidth=Math.round(clamp(n.fontSize*.11,3,12)*2)/2;}},'Dark outlines applied to all card text');
$('bold').onchange=()=>update(()=>current().fontWeight=$('bold').checked?'bold':'normal');$('italic').onchange=()=>update(()=>current().italic=$('italic').checked);
for(const [id,axis,size] of [['center-x','x','w'],['center-y','y','h']])$(id).onclick=()=>update(()=>{const b=selectedBox(),delta=((axis==='x'?doc.width:doc.height)-b[size])/2-b[axis];doc=move(doc,activeIds(),axis==='x'?delta:0,axis==='y'?delta:0);});
for(const [id,delta] of [['forward',1],['backward',-1]])$(id).onclick=()=>update(()=>{const ids=new Set(activeIds());if(doc.items.some(n=>ids.has(n.id)&&n.locked))return;if(delta>0){for(let i=doc.items.length-2;i>=0;i--)if(ids.has(doc.items[i].id)&&!ids.has(doc.items[i+1].id))[doc.items[i],doc.items[i+1]]=[doc.items[i+1],doc.items[i]];}else{for(let i=1;i<doc.items.length;i++)if(ids.has(doc.items[i].id)&&!ids.has(doc.items[i-1].id))[doc.items[i],doc.items[i-1]]=[doc.items[i-1],doc.items[i]];}},'Selection reordered');
function copySelection(){clipboard=clone(doc.items.filter(n=>activeIds().includes(n.id)));clipboardAssets=(doc.customAssets||[]).filter(a=>clipboard.some(n=>n.asset===a.id));status(`${clipboard.length} layers copied`);}
function pasteSelection(){if(!clipboard?.length)return;update(()=>{const remap=new Map();for(const a of clipboardAssets){let id=a.id;const existing=doc.customAssets?.find(q=>q.id===id);if(existing&&existing.src!==a.src)id='custom.'+crypto.randomUUID();remap.set(a.id,id);if(!existing||id!==a.id){doc.customAssets=[...(doc.customAssets||[]),{...a,id}];if(id!==a.id)customImages.set(id,new Map([[a.src,customImages.get(a.id).get(a.src)]]));}}const group=uniqueId(),copies=clipboard.map(n=>({...n,asset:remap.get(n.asset)||n.asset,id:uniqueId(),group,name:nice(n)+' copy',role:'copy-'+n.role,x:n.x+24,y:n.y+24,locked:false}));doc.items.push(...copies);selected=copies.at(-1).id;extraSelection=new Set(copies.map(n=>n.id));},'Selection pasted');}
$('duplicate').onclick=()=>{copySelection();pasteSelection();};
$('add-text').onclick=addText;$('remove').onclick=()=>update(()=>{const ids=activeIds();if(doc.items.some(n=>ids.includes(n.id)&&n.locked))return;doc.items=doc.items.filter(q=>!ids.includes(q.id));selected=null;extraSelection.clear();},'Selection removed · Undo restores it');
$('copy-id').onclick=async()=>{const n=current();if(!n)return;const value=n.asset==='text'?n.id:n.asset;try{await navigator.clipboard.writeText(value);status('Copied '+value);}catch{const range=document.createRange();range.selectNodeContents($('component-id'));const selection=getSelection();selection.removeAllRanges();selection.addRange(range);status('ID selected · Press Ctrl+C to copy');}};
function setPreview(value){if(value)cropMode=null;preview=value;controls();document.body.classList.toggle('preview',value);$('edit').setAttribute('aria-pressed',String(!value));$('clean').setAttribute('aria-pressed',String(value));draw();}
$('edit').onclick=()=>{cropMode=null;handMode=false;$('pan').setAttribute('aria-pressed','false');setPreview(false);};$('pan').onclick=()=>{handMode=!handMode;$('pan').setAttribute('aria-pressed',String(handMode));canvas.style.cursor=handMode?'grab':'default';};$('clean').onclick=()=>setPreview(true);$('fit').onclick=()=>{$('preview-size').value='fit';fit();};$('preview-size').onchange=fit;$('zoom').oninput=()=>zoomAt(Number($('zoom').value)/100);
$('linked').onchange=()=>{extraSelection.clear();refresh();};$('focus').onclick=()=>{document.body.classList.toggle('focus-canvas');$('focus').setAttribute('aria-pressed',String(document.body.classList.contains('focus-canvas')));fit();};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{status('Use Open full workspace for a larger editor window.');}};
$('reference').onclick=()=>loadPreset(REFERENCE.presetId);
$('context-menu').addEventListener('keydown',e=>{const buttons=[...$('context-menu').querySelectorAll('button')],i=buttons.indexOf(document.activeElement);if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();buttons[(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length].focus();}if(e.key==='Escape'){$('context-menu').hidden=true;canvas.focus();}});
for(const b of document.querySelectorAll('[data-command]'))b.onclick=()=>{const command=b.dataset.command;$('context-menu').hidden=true;if(command==='copy')copySelection();else if(command==='paste')pasteSelection();else $(command).click();};
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);status('Exported '+name);}
function filename(ext){return (doc.name||'ashenspire-card').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-|-$/g,'').slice(0,80)+ext;}
$('save').onclick=()=>download(new Blob([JSON.stringify(validate(doc),null,2)],{type:'application/json'}),filename('.card.json'));
window.addEventListener('message',e=>{if(e.source===parent&&footerMessageOrigin(e.origin,location)&&e.data?.type==='card-assembler:export')$('save').click();});
$('open').onclick=()=>$('file').click();$('file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>60*1024*1024)throw Error('Design exceeds the 60 MB import limit.');const raw=JSON.parse(await file.text());const next=isLegacyCard(raw)?await fromLegacyCard(raw):fromRecipe(raw);await loadCustomAssets(next);update(()=>{doc=next;selected=doc.items.find(n=>n.role==='artwork')?.id||doc.items.at(-1)?.id;extraSelection.clear();},'Design opened');fit();}catch(error){status(error.message,true);}e.target.value='';};
$('png').onclick=()=>{if(!ready)return;const out=document.createElement('canvas');const b=exportBounds();out.width=b.w;out.height=b.h;const g=out.getContext('2d');g.translate(-b.x,-b.y);renderDoc(g,doc);out.toBlob(blob=>{if(blob)download(blob,filename('.png'));else status('PNG export failed',true);},'image/png');};
const xml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
function rasterData(n){const img=styledImage(n);if(img instanceof HTMLCanvasElement)return img.toDataURL('image/png');const a=source(n);if(a.data)return a.data;if(img.src.startsWith('data:'))return a.data=img.src;const c=document.createElement('canvas');c.width=img.width;c.height=img.height;c.getContext('2d').drawImage(img,0,0);return a.data=c.toDataURL('image/png');}
function exportBounds(){const b=contentBounds(doc);return{x:Math.floor(b.x),y:Math.floor(b.y),w:Math.ceil(b.x+b.w)-Math.floor(b.x),h:Math.ceil(b.y+b.h)-Math.floor(b.y)};}
function svgSource(){const ext=exportBounds();let defs='<clipPath id="card-shape"><path d="'+cardClipPath(doc.width,doc.height)+'"/></clipPath>',body='';for(const [i,n] of doc.items.entries()){if(!n.visible)continue;if(n.asset==='text'){const lines=n.text.split('\n'),x=n.align==='start'?n.x:n.align==='end'?n.x+n.w:n.x+n.w/2;body+=`<g opacity="${n.opacity}"><text font-family="${xml(n.fontFamily)}" font-size="${n.fontSize}" font-weight="${n.fontWeight}" font-style="${n.italic?'italic':'normal'}" text-anchor="${n.align}" fill="${n.color}" stroke="${n.stroke}" stroke-width="${n.strokeWidth}" paint-order="stroke fill" stroke-linejoin="round">${lines.map((s,j)=>`<tspan x="${x}" y="${n.y+n.h/2+(j-(lines.length-1)/2)*n.fontSize*1.2+n.fontSize*.35}">${xml(s)}</tspan>`).join('')}</text></g>`;}else{const raw={...n,sourceRect:undefined},img=styledImage(raw),crop=normalizedCrop(n,img.width,img.height),p=fullImageBounds(n,img.width,img.height);defs+=`<clipPath id="clip-${i}"><rect x="${crop.x}" y="${crop.y}" width="${crop.w}" height="${crop.h}"/></clipPath>`;body+=`${n.clipToCard?'<g clip-path="url(#card-shape)">':''}<image x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" opacity="${n.opacity}" clip-path="url(#clip-${i})" preserveAspectRatio="none" href="${rasterData(raw)}"/>${n.clipToCard?'</g>':''}`;}}return `<svg xmlns="http://www.w3.org/2000/svg" width="${ext.w}" height="${ext.h}" viewBox="${ext.x} ${ext.y} ${ext.w} ${ext.h}"><title>${xml(doc.name)}</title><defs>${defs}</defs>${body}</svg>`;}
$('svg').onclick=()=>{try{download(new Blob([svgSource()],{type:'image/svg+xml'}),filename('.svg'));}catch(error){status(error.message,true);}};
document.addEventListener('keydown',e=>{
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();$('save').click();return;}
 if(e.target.closest('input,textarea,select'))return;
 if(e.key==='Escape'){for(const menu of document.querySelectorAll('.canvas-options'))menu.open=false;if(drag)finishDrag(true);else if(cropMode){cropMode=null;controls();draw();status('Crop mode closed');}$('context-menu').hidden=true;return;}
 if(e.code==='Space'){e.preventDefault();spaceDown=true;canvas.style.cursor='grab';return;}
 const cmd=e.ctrlKey||e.metaKey,key=e.key.toLowerCase();
 if(cmd&&key==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}
 if(cmd&&key==='y'){e.preventDefault();redo();return;}
 if(cropMode&&e.key==='Enter'){e.preventDefault();$('crop-done').click();return;}
 if(cropMode&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const id=cropMode,n=current(),a=source(n),step=e.shiftKey?10:1;update(()=>{doc.items[doc.items.indexOf(n)]=panCrop(n,a.img.width,a.img.height,e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0);},'Artwork nudged inside crop');cropMode=id;controls();draw();return;}
 if(key==='c'&&!cmd){e.preventDefault();startCrop();return;}
 if(cmd&&key==='a'){e.preventDefault();extraSelection=new Set(doc.items.filter(n=>n.visible&&!n.locked).map(n=>n.id));selected=[...extraSelection].at(-1);refresh();return;}
 if(cmd&&key==='c'){e.preventDefault();copySelection();return;}
 if(cmd&&key==='v'){e.preventDefault();pasteSelection();return;}
 if(cmd&&key==='g'){e.preventDefault();$(e.shiftKey?'ungroup':'group').click();return;}
 if(cmd&&key==='d'){e.preventDefault();$('duplicate').click();return;}
 if(key==='h'&&!cmd){$('pan').click();return;}if(key==='v'&&!cmd){$('edit').click();return;}if(key==='f'&&!cmd){$('focus').click();return;}
 if(key==='0'){e.preventDefault();$('fit').click();return;}
 if(key==='+'||key==='='){e.preventDefault();zoomAt(zoom*1.15);return;}
 if(key==='-'){e.preventDefault();zoomAt(zoom/1.15);return;}
 if(preview)return;
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&current()){e.preventDefault();const step=e.shiftKey?10:1;update(()=>doc=move(doc,activeIds(),e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0));}
 if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();$('remove').click();}
 if(key==='[')$('backward').click();if(key===']')$('forward').click();
});
document.addEventListener('keyup',e=>{if(e.code==='Space'){spaceDown=false;canvas.style.cursor='default';}});
window.addEventListener('blur',()=>{spaceDown=false;if(drag)finishDrag(true);});
new ResizeObserver(()=>{if(drag)return;autoFit?fit():layout();}).observe($('viewport'));
for(const id of ['png','svg','save','open'])$(id).disabled=true;
async function loadImageAsset(a,custom=false){if(custom?customImages.get(a.id)?.has(a.src):images.has(a.id))return;const img=new Image();img.src=custom?a.src:globalThis.CARD_ASSEMBLER_ASSETS?.[a.id]||a.src;await img.decode();if(img.width>4096||img.height>4096||img.width!==a.width||img.height!==a.height)throw Error('Image dimensions do not match '+a.name);const mask=document.createElement('canvas'),max=Math.max(img.width,img.height);mask.width=Math.max(1,Math.round(128*img.width/max));mask.height=Math.max(1,Math.round(128*img.height/max));const g=mask.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0,mask.width,mask.height);const entry={img,src:a.src,version:crypto.randomUUID(),hitW:mask.width,hitH:mask.height,alpha:g.getImageData(0,0,mask.width,mask.height).data};if(custom){if(!customImages.has(a.id))customImages.set(a.id,new Map());customImages.get(a.id).set(a.src,entry);}else images.set(a.id,entry);}
async function loadCustomAssets(next){for(const a of next.customAssets||[])await loadImageAsset(a,true);}
try{await Promise.all(ASSETS.map(a=>loadImageAsset(a)));await loadCustomAssets(doc);ready=true;for(const id of ['png','svg','save','open'])$(id).disabled=false;makePresets();refresh();fit();status(recoveryMessage);}catch(error){status('Artwork could not load: '+error.message,true);}
