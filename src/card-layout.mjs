export const CARD_LAYOUT_PARTS = Object.freeze([
  {id:'identity',label:'Name',selector:'.cname'},
  {id:'costs',label:'Costs',selector:'.card-cost-rail'},
  {id:'art',label:'Artwork',selector:'.art'},
  {id:'tags',label:'Tags',selector:'.ctags'},
  {id:'type',label:'Type',selector:'.ctype'},
  {id:'rules',label:'Rules',selector:'.ctext'},
  {id:'footer',label:'Footer',selector:'.card-metadata'},
].map(Object.freeze));
export const CARD_LAYOUT_ORDER = Object.freeze(['art','identity','type','rules','footer','tags','costs']);

const ids = CARD_LAYOUT_PARTS.map(part=>part.id);
const own = (object,key) => Object.hasOwn(object,key);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const imagePattern = /^data:image\/(?:png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const customIdPattern = /^component-[1-9][0-9]*$/;
const ranges = {x:[-4096,4096],y:[-4096,4096],width:[1,4096],height:[1,4096],rotation:[-360,360],opacity:[0,1],zIndex:[-100,100]};
const flags = ['visible','backgroundVisible','locked','enabled','removed'];
const fields = new Set([...Object.keys(ranges),...flags,'backgroundArt','groupId','textAlign','textRotation']);

export function getCardLayoutParts(layout) {
  const custom=record(layout?.custom)?layout.custom:{};
  return [...CARD_LAYOUT_PARTS,...Object.entries(custom).filter(([id])=>customIdPattern.test(id)).map(([id,definition])=>({id,label:definition.label,kind:definition.kind,selector:`[data-card-component="${id}"]`}))];
}

/** Sparse overrides are portable sidecars, never executable styles or selectors. */
export function validateCardLayout(layout) {
  if (layout === undefined) return [];
  if (!record(layout)) return ['Card layout must be an object'];
  const errors=[];
  for (const key of Object.keys(layout)) if (!['parts','order','custom'].includes(key)) errors.push(`Unknown card layout field: ${key}`);
  const custom=record(layout.custom)?layout.custom:{};
  if (layout.custom!==undefined&&!record(layout.custom)) errors.push('Custom card components must be an object');
  if (Object.keys(custom).length>32) errors.push('At most 32 custom card components are supported');
  for(const [id,definition] of Object.entries(custom)) {
    if(!customIdPattern.test(id)||id.length>64) errors.push(`Invalid custom card component ID: ${id}`);
    if(!record(definition)){errors.push(`Custom card component ${id} must be an object`);continue;}
    for(const key of Object.keys(definition)) if(!['kind','label','text','image'].includes(key)) errors.push(`Unknown custom component ${id}.${key}`);
    if(!['text','image'].includes(definition.kind)) errors.push(`Custom component ${id} must be text or image`);
    if(typeof definition.label!=='string'||!definition.label.trim()||definition.label.length>80) errors.push(`Custom component ${id} label must contain 1 to 80 characters`);
    if(definition.text!==undefined&&(definition.kind!=='text'||typeof definition.text!=='string'||definition.text.length>10000)) errors.push(`Custom component ${id} text must contain at most 10000 characters on a text component`);
    if(definition.image!==undefined&&(definition.kind!=='image'||typeof definition.image!=='string'||definition.image.length>3_000_000||!imagePattern.test(definition.image))) errors.push(`Custom component ${id} image must be a PNG or WebP data image below 3 MB on an image component`);
  }
  const allIds=[...ids,...Object.keys(custom).filter(id=>customIdPattern.test(id))];
  if (layout.parts !== undefined && !record(layout.parts)) errors.push('Card layout parts must be an object');
  else for (const [id,part] of Object.entries(layout.parts || {})) {
    if (!allIds.includes(id)) {errors.push(`Unknown card layout part: ${id}`);continue;}
    if (!record(part)) {errors.push(`Card layout ${id} must be an object`);continue;}
    for (const [key,value] of Object.entries(part)) {
      const label=`Card layout ${id}.${key}`;
      if (!fields.has(key)) {errors.push(`Unknown ${label}`);continue;}
      if (own(ranges,key)) {
        const [min,max]=ranges[key];
        if (!Number.isFinite(value) || value<min || value>max || key==='zIndex'&&!Number.isInteger(value)) errors.push(`${label} must be ${key==='zIndex'?'an integer':'a number'} from ${min} to ${max}`);
      } else if (flags.includes(key) && typeof value!=='boolean') errors.push(`${label} must be boolean`);
      else if (key==='groupId' && (typeof value!=='string' || value!==''&&!/^[A-Za-z][A-Za-z0-9_-]{0,47}$/.test(value))) errors.push(`${label} must be an empty string or a stable group ID`);
      else if (key==='textAlign' && !['left','center','right'].includes(value)) errors.push(`${label} must be left, center or right`);
      else if (key==='textRotation' && !['upright','follow'].includes(value)) errors.push(`${label} must be upright or follow`);
      else if (key==='backgroundArt' && (typeof value!=='string' || value.length>3_000_000 || !imagePattern.test(value))) errors.push(`${label} must be a PNG or WebP data image below 3 MB`);
    }
  }
  if (layout.order !== undefined && (!Array.isArray(layout.order) || layout.order.length>allIds.length || new Set(layout.order).size!==layout.order.length || layout.order.some(id=>!allIds.includes(id)))) errors.push('Card layout order must contain unique known part IDs');
  return errors;
}

/** Omitted dimensions/alignment retain the measured native renderer values. */
export function normalizeCardLayout(layout) {
  const errors=validateCardLayout(layout);
  if (errors.length) throw new Error(errors.join('; '));
  const order=[...(layout?.order || [])];
  const custom=Object.fromEntries(Object.entries(layout?.custom||{}).map(([id,definition])=>[id,{...definition}]));
  for (const id of [...CARD_LAYOUT_ORDER,...Object.keys(custom)]) if (!order.includes(id)) order.push(id);
  return {custom,parts:Object.fromEntries([...ids,...Object.keys(custom)].map(id=>[id,{x:0,y:0,rotation:0,opacity:1,visible:true,backgroundVisible:true,locked:false,enabled:true,removed:false,textRotation:'upright',groupId:'',zIndex:0,...(own(custom,id)?{x:20,y:20,width:160,height:60}:{}),...layout?.parts?.[id]}])),order};
}

/** State commands include inactive peers; editable commands never split a group. */
export function getCardLayoutGroupMembers(layout,partIds,{editableOnly=false}={}) {
  const next=normalizeCardLayout(layout),requested=Array.isArray(partIds)?partIds:[partIds];
  const result=new Set();
  for(const id of requested) {
    if(!own(next.parts,id)) continue;
    const group=next.parts[id].groupId;
    const members=group?Object.keys(next.parts).filter(key=>next.parts[key].groupId===group):[id];
    if(editableOnly&&members.some(key=>next.parts[key].locked||!next.parts[key].enabled||next.parts[key].removed)) continue;
    for(const member of members) result.add(member);
  }
  return [...result];
}

export function isCardLayoutEditable(layout,partIds) {
  const next=normalizeCardLayout(layout),requested=Array.isArray(partIds)?partIds:[partIds];
  return requested.length>0&&requested.every(id=>own(next.parts,id))&&getCardLayoutGroupMembers(next,requested).every(id=>!next.parts[id].locked&&next.parts[id].enabled&&!next.parts[id].removed);
}

export function setCardLayoutPartState(layout,partIds,patch) {
  if(!record(patch)||Object.entries(patch).some(([key,value])=>!['locked','enabled','removed','visible'].includes(key)||typeof value!=='boolean')) throw new Error('Component state requires boolean locked, enabled, removed or visible values');
  const next=normalizeCardLayout(layout),members=getCardLayoutGroupMembers(next,partIds);
  if(!members.length) throw new Error('Choose at least one known component');
  for(const id of members) Object.assign(next.parts[id],patch);
  return next;
}

export function addCardLayoutComponent(layout,definition) {
  const next=normalizeCardLayout(layout);
  if(Object.keys(next.custom).length>=32) throw new Error('At most 32 custom card components are supported');
  let index=1;while(own(next.custom,`component-${index}`))index++;
  const id=`component-${index}`;
  next.custom[id]={...definition};
  return {id,layout:normalizeCardLayout(next)};
}

export function snapCardValue(value,interval) {
  if (!Number.isFinite(value) || !Number.isFinite(interval) || interval<=0) throw new Error('Snap requires a finite value and positive interval');
  return Number((Math.round(value/interval)*interval).toFixed(8));
}

/** Snap the selected anchor once; preserve spacing within its named group. */
export function translateCardLayout(layout,partId,dx,dy,{gridSize=10,snap=false}={}) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !isCardLayoutEditable(layout,[partId])) throw new Error('Choose an enabled, unlocked component and finite translation');
  const next=normalizeCardLayout(layout),anchor=next.parts[partId];
  const selected=getCardLayoutGroupMembers(next,[partId]);
  if (snap) {dx=snapCardValue(anchor.x+dx,gridSize)-anchor.x;dy=snapCardValue(anchor.y+dy,gridSize)-anchor.y;}
  // Clamp the whole group together rather than distorting its spacing at bounds.
  dx=Math.max(...selected.map(id=>-4096-next.parts[id].x),Math.min(dx,...selected.map(id=>4096-next.parts[id].x)));
  dy=Math.max(...selected.map(id=>-4096-next.parts[id].y),Math.min(dy,...selected.map(id=>4096-next.parts[id].y)));
  for (const id of selected) {next.parts[id].x+=dx;next.parts[id].y+=dy;}
  return next;
}

export function reorderCardLayout(layout,partId,index) {
  const next=normalizeCardLayout(layout);
  if (!isCardLayoutEditable(next,[partId]) || !Number.isInteger(index) || index<0 || index>=next.order.length) throw new Error('Choose an enabled, unlocked component and an in-range order index');
  const members=getCardLayoutGroupMembers(next,[partId]),block=next.order.filter(id=>members.includes(id));
  const oldIndex=Math.min(...members.map(id=>next.order.indexOf(id)));
  const direction=Math.sign(index-oldIndex);
  if(!direction)return next;
  next.order=next.order.filter(id=>!members.includes(id));
  // The public index is an insertion slot AFTER removing the moving block.
  // If it bisects another group, move to that whole group's directional edge.
  let insertion=Math.min(index,next.order.length);
  const before=next.order[insertion-1],after=next.order[insertion];
  const group=before&&next.parts[before].groupId;
  if(group&&after&&next.parts[after].groupId===group){
    const neighborIndices=next.order.map((id,position)=>next.parts[id].groupId===group?position:-1).filter(position=>position>=0);
    insertion=direction>0?Math.max(...neighborIndices)+1:Math.min(...neighborIndices);
  }
  next.order.splice(insertion,0,...block);
  return next;
}

/**
 * Serialize this function directly into the script-only preview sandbox.
 * Uses no imported helpers. Native elements and boxes remain authoritative.
 * Call after attaching the face and applying native size/font overrides.
 * Offsets/dimensions use a canonical 280px card width and scale with native cards.
 * Returns actual card-local boxes for handles; absent native parts stay absent.
 */
export function applyCardLayout(face,layout) {
  const selectors={identity:'.cname',costs:'.card-cost-rail',art:'.art',tags:'.ctags',type:'.ctype',rules:'.ctext',footer:'.card-metadata'};
  const ids=Object.keys(selectors),cacheKey='__ashenCardLayoutRestore';
  const nativeOrder=['art','identity','type','rules','footer','tags','costs'];
  const previous=face[cacheKey];
  const reusableCustom=new Map();
  if (previous) {
    for (const entry of previous.parts) {
      if(entry.wrapper){
        while(entry.wrapper.firstChild) entry.element.insertBefore(entry.wrapper.firstChild,entry.wrapper);
        entry.wrapper.remove();
      }
      if(entry.custom){entry.element.remove();reusableCustom.set(entry.id,entry.element);continue;}
      if (entry.marker.parentNode) entry.marker.replaceWith(entry.element);
      if (entry.style===null) entry.element.removeAttribute('style');else entry.element.setAttribute('style',entry.style);
    }
    if (previous.style===null) face.removeAttribute('style');else face.setAttribute('style',previous.style);
    delete face[cacheKey];
  }
  const bounds=face.getBoundingClientRect();
  const scaleX=bounds.width/(face.offsetWidth||bounds.width||1),scaleY=bounds.height/(face.offsetHeight||bounds.height||1);
  const parts=ids.map(id=>({id,element:face.querySelector(selectors[id])})).filter(part=>part.element).map(part=>{
    const rect=part.element.getBoundingClientRect();
    return {...part,x:(rect.left-bounds.left)/scaleX-(face.clientLeft||0),y:(rect.top-bounds.top)/scaleY-(face.clientTop||0),width:rect.width/scaleX,height:rect.height/scaleY};
  });
  const boxes=Object.fromEntries(parts.map(({id,x,y,width,height})=>[id,{x,y,width,height}]));
  const overrides=layout?.parts || {};
  const custom=layout?.custom&&typeof layout.custom==='object'&&!Array.isArray(layout.custom)?Object.entries(layout.custom).filter(([id,definition])=>/^component-[1-9][0-9]*$/.test(id)&&id.length<=64&&definition&&['text','image'].includes(definition.kind)).slice(0,32):[];
  const changed=parts.some(({id})=>Object.entries(overrides[id]||{}).some(([key,value])=>
    ['width','height','backgroundArt','textAlign'].includes(key) || ['x','y','rotation','zIndex'].includes(key)&&value!==0 || key==='opacity'&&value!==1 || ['visible','backgroundVisible','enabled'].includes(key)&&value===false || key==='removed'&&value===true));
  const ordered=Array.isArray(layout?.order) && layout.order.some((id,index)=>id!==nativeOrder[index]);
  if (!changed&&!ordered&&!custom.length) return boxes;
  // Detach nested native parts only when an override actually needs independent layers.
  // Markers retain exact native nesting/order for reset or subsequent measurements.
  const saved={style:face.getAttribute('style'),parts:[]};
  face[cacheKey]=saved;
  const doc=face.ownerDocument;
  for (const part of parts) {
    const marker=doc.createComment('card-layout:'+part.id);
    part.element.before(marker);
    saved.parts.push({element:part.element,marker,style:part.element.getAttribute('style')});
  }
  const computed=doc.defaultView.getComputedStyle(face);
  if (computed.position==='static') face.style.position='relative';
  face.style.isolation='isolate';
  // Preserve the native grid's measured outer size after its content becomes layers.
  const faceWidth=face.offsetWidth,faceHeight=face.offsetHeight,unitScale=(faceWidth||280)/280;
  face.style.boxSizing='border-box';face.style.width=faceWidth+'px';face.style.height=faceHeight+'px';
  const imageAllowed=value=>typeof value==='string'&&value.length<=3_000_000&&/^data:image\/(?:png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
  for(const [id,definition] of custom){
    const element=reusableCustom.get(id)||doc.createElement('div');
    element.removeAttribute('style');element.textContent='';
    element.setAttribute('data-card-component',id);
    if(!element.getAttribute('data-editor-part'))element.setAttribute('aria-label',String(definition.label||id).slice(0,80));
    if(definition.kind==='text'){
      element.textContent=typeof definition.text==='string'?definition.text.slice(0,10000):'';
      Object.assign(element.style,{whiteSpace:'pre-wrap',overflowWrap:'anywhere'});
    }else if(imageAllowed(definition.image)){
      const image=doc.createElement('img');image.src=definition.image;image.alt=String(definition.label||'Artwork').slice(0,80);
      Object.assign(image.style,{display:'block',width:'100%',height:'100%',objectFit:'contain'});element.append(image);
    }
    face.append(element);
    parts.push({id,element,x:0,y:0,width:160*unitScale,height:60*unitScale,custom:true,textBearing:definition.kind==='text'});
    saved.parts.push({id,element,custom:true});
  }
  const allIds=[...ids,...custom.map(([id])=>id)];
  const order=[...new Set((Array.isArray(layout?.order)?layout.order:[]).filter(id=>allIds.includes(id)))];
  for (const id of [...nativeOrder,...custom.map(([id])=>id)]) if (!order.includes(id)) order.push(id);
  const finite=(value,fallback,min,max)=>Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
  for (const part of parts) {
    const {id,element}=part,p=overrides[id]||{},style=element.style;
    face.append(element);
    const x=finite(p.x,part.custom?20:0,-4096,4096)*unitScale,y=finite(p.y,part.custom?20:0,-4096,4096)*unitScale;
    const width=finite(p.width,part.width/unitScale,1,4096)*unitScale,height=finite(p.height,part.height/unitScale,1,4096)*unitScale;
    const rotation=finite(p.rotation,0,-360,360),hidden=p.visible===false||p.enabled===false||p.removed===true;
    Object.assign(style,{position:'absolute',left:part.x+'px',top:part.y+'px',right:'auto',bottom:'auto',margin:'0',boxSizing:'border-box',width:width+'px',height:height+'px',minWidth:'0',minHeight:'0',maxWidth:'none',maxHeight:'none',flex:'none',transform:`translate(${x}px, ${y}px) rotate(${rotation}deg)`,transformOrigin:'center',opacity:String(finite(p.opacity,1,0,1)),visibility:hidden?'hidden':'visible',zIndex:String(Math.round(finite(p.zIndex,0,-100,100))*40+order.indexOf(id)+4000)});
    if(hidden)style.pointerEvents='none';
    if (['left','center','right'].includes(p.textAlign)) style.textAlign=p.textAlign;
    if (p.backgroundVisible===false) {style.background='transparent';style.borderColor='transparent';style.boxShadow='none';}
    else if (imageAllowed(p.backgroundArt)) {
      style.backgroundImage=`url("${p.backgroundArt}")`;style.backgroundSize='cover';style.backgroundPosition='center';style.backgroundRepeat='no-repeat';
    }
    if(rotation!==0&&p.textRotation!=='follow'&&(part.textBearing||!part.custom&&id!=='art')){
      const wrapper=doc.createElement('span'),computedText=doc.defaultView.getComputedStyle(element);
      wrapper.setAttribute('data-card-upright','');
      // Native classes preserve direct-child paint rules (cost medallions, metadata).
      // Inline geometry keeps this inner text layer from becoming another card part.
      wrapper.className=(element.className||'').split(/\s+/).filter(name=>name&&name!=='native-card-part-editable').join(' ');
      for(const key of ['display','flexDirection','flexWrap','justifyContent','alignItems','alignContent','gap','gridTemplateColumns','gridTemplateRows','font','lineHeight','whiteSpace','textAlign','overflowWrap','textOverflow','WebkitBoxOrient','WebkitLineClamp']) if(computedText[key])wrapper.style[key]=computedText[key];
      Object.assign(wrapper.style,{position:'absolute',left:'0',top:'0',right:'auto',bottom:'auto',width:'100%',height:'100%',minWidth:'0',minHeight:'0',maxWidth:'none',maxHeight:'none',padding:'0',margin:'0',border:'0',borderRadius:'0',background:'transparent',boxShadow:'none',boxSizing:'border-box',flex:'none',transform:`rotate(${-rotation}deg)`,transformOrigin:'center',opacity:'1',visibility:'inherit',zIndex:'auto',pointerEvents:'inherit'});
      while(element.firstChild)wrapper.append(element.firstChild);
      element.append(wrapper);
      saved.parts.find(entry=>entry.element===element).wrapper=wrapper;
    }
    boxes[id]={x:part.x+x,y:part.y+y,width,height,rotation};
  }
  return boxes;
}
