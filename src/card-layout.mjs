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
const ranges = {x:[-4096,4096],y:[-4096,4096],width:[1,4096],height:[1,4096],rotation:[-360,360],opacity:[0,1],zIndex:[-100,100]};
const fields = new Set([...Object.keys(ranges),'visible','backgroundVisible','backgroundArt','groupId','textAlign']);

/** Sparse overrides are portable sidecars, never executable styles or selectors. */
export function validateCardLayout(layout) {
  if (layout === undefined) return [];
  if (!record(layout)) return ['Card layout must be an object'];
  const errors=[];
  for (const key of Object.keys(layout)) if (!['parts','order'].includes(key)) errors.push(`Unknown card layout field: ${key}`);
  if (layout.parts !== undefined && !record(layout.parts)) errors.push('Card layout parts must be an object');
  else for (const [id,part] of Object.entries(layout.parts || {})) {
    if (!ids.includes(id)) {errors.push(`Unknown card layout part: ${id}`);continue;}
    if (!record(part)) {errors.push(`Card layout ${id} must be an object`);continue;}
    for (const [key,value] of Object.entries(part)) {
      const label=`Card layout ${id}.${key}`;
      if (!fields.has(key)) {errors.push(`Unknown ${label}`);continue;}
      if (own(ranges,key)) {
        const [min,max]=ranges[key];
        if (!Number.isFinite(value) || value<min || value>max || key==='zIndex'&&!Number.isInteger(value)) errors.push(`${label} must be ${key==='zIndex'?'an integer':'a number'} from ${min} to ${max}`);
      } else if (['visible','backgroundVisible'].includes(key) && typeof value!=='boolean') errors.push(`${label} must be boolean`);
      else if (key==='groupId' && (typeof value!=='string' || value!==''&&!/^[A-Za-z][A-Za-z0-9_-]{0,47}$/.test(value))) errors.push(`${label} must be an empty string or a stable group ID`);
      else if (key==='textAlign' && !['left','center','right'].includes(value)) errors.push(`${label} must be left, center or right`);
      else if (key==='backgroundArt' && (typeof value!=='string' || value.length>3_000_000 || !imagePattern.test(value))) errors.push(`${label} must be a PNG or WebP data image below 3 MB`);
    }
  }
  if (layout.order !== undefined && (!Array.isArray(layout.order) || layout.order.length>ids.length || new Set(layout.order).size!==layout.order.length || layout.order.some(id=>!ids.includes(id)))) errors.push('Card layout order must contain unique known part IDs');
  return errors;
}

/** Omitted dimensions/alignment retain the measured native renderer values. */
export function normalizeCardLayout(layout) {
  const errors=validateCardLayout(layout);
  if (errors.length) throw new Error(errors.join('; '));
  const order=[...(layout?.order || [])];
  for (const id of CARD_LAYOUT_ORDER) if (!order.includes(id)) order.push(id);
  return {parts:Object.fromEntries(ids.map(id=>[id,{x:0,y:0,rotation:0,opacity:1,visible:true,backgroundVisible:true,groupId:'',zIndex:0,...layout?.parts?.[id]}])),order};
}

export function snapCardValue(value,interval) {
  if (!Number.isFinite(value) || !Number.isFinite(interval) || interval<=0) throw new Error('Snap requires a finite value and positive interval');
  return Number((Math.round(value/interval)*interval).toFixed(8));
}

/** Snap the selected anchor once; preserve spacing within its named group. */
export function translateCardLayout(layout,partId,dx,dy,{gridSize=10,snap=false}={}) {
  if (!ids.includes(partId) || !Number.isFinite(dx) || !Number.isFinite(dy)) throw new Error('Choose a known part and finite translation');
  const next=normalizeCardLayout(layout),anchor=next.parts[partId];
  const selected=ids.filter(id=>id===partId || anchor.groupId&&next.parts[id].groupId===anchor.groupId);
  if (snap) {dx=snapCardValue(anchor.x+dx,gridSize)-anchor.x;dy=snapCardValue(anchor.y+dy,gridSize)-anchor.y;}
  // Clamp the whole group together rather than distorting its spacing at bounds.
  dx=Math.max(...selected.map(id=>-4096-next.parts[id].x),Math.min(dx,...selected.map(id=>4096-next.parts[id].x)));
  dy=Math.max(...selected.map(id=>-4096-next.parts[id].y),Math.min(dy,...selected.map(id=>4096-next.parts[id].y)));
  for (const id of selected) {next.parts[id].x+=dx;next.parts[id].y+=dy;}
  return next;
}

export function reorderCardLayout(layout,partId,index) {
  if (!ids.includes(partId) || !Number.isInteger(index) || index<0 || index>=ids.length) throw new Error('Choose a known part and an order index from 0 to 6');
  const next=normalizeCardLayout(layout);
  next.order.splice(next.order.indexOf(partId),1);next.order.splice(index,0,partId);
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
  if (previous) {
    for (const entry of previous.parts) {
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
  const changed=parts.some(({id})=>Object.entries(overrides[id]||{}).some(([key,value])=>
    ['width','height','backgroundArt','textAlign'].includes(key) || ['x','y','rotation','zIndex'].includes(key)&&value!==0 || key==='opacity'&&value!==1 || ['visible','backgroundVisible'].includes(key)&&value===false));
  const ordered=Array.isArray(layout?.order) && layout.order.some((id,index)=>id!==nativeOrder[index]);
  if (!changed&&!ordered) return boxes;
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
  const order=[...new Set((Array.isArray(layout?.order)?layout.order:[]).filter(id=>ids.includes(id)))];
  for (const id of nativeOrder) if (!order.includes(id)) order.push(id);
  const finite=(value,fallback,min,max)=>Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
  for (const part of parts) {
    const {id,element}=part,p=overrides[id]||{},style=element.style;
    face.append(element);
    const x=finite(p.x,0,-4096,4096)*unitScale,y=finite(p.y,0,-4096,4096)*unitScale;
    const width=finite(p.width,part.width/unitScale,1,4096)*unitScale,height=finite(p.height,part.height/unitScale,1,4096)*unitScale;
    Object.assign(style,{position:'absolute',left:part.x+'px',top:part.y+'px',right:'auto',bottom:'auto',margin:'0',boxSizing:'border-box',width:width+'px',height:height+'px',minWidth:'0',minHeight:'0',maxWidth:'none',maxHeight:'none',flex:'none',transform:`translate(${x}px, ${y}px) rotate(${finite(p.rotation,0,-360,360)}deg)`,transformOrigin:'center',opacity:String(finite(p.opacity,1,0,1)),visibility:p.visible===false?'hidden':'visible',zIndex:String(Math.round(finite(p.zIndex,0,-100,100))*10+order.indexOf(id)+1000)});
    if (['left','center','right'].includes(p.textAlign)) style.textAlign=p.textAlign;
    if (p.backgroundVisible===false) {style.background='transparent';style.borderColor='transparent';style.boxShadow='none';}
    else if (typeof p.backgroundArt==='string' && p.backgroundArt.length<=3_000_000 && /^data:image\/(?:png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(p.backgroundArt)) {
      style.backgroundImage=`url("${p.backgroundArt}")`;style.backgroundSize='cover';style.backgroundPosition='center';style.backgroundRepeat='no-repeat';
    }
    boxes[id]={x:part.x+x,y:part.y+y,width,height,rotation:finite(p.rotation,0,-360,360)};
  }
  return boxes;
}
