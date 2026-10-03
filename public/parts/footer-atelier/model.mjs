export const clone = value => JSON.parse(JSON.stringify(value));
export const ASSETS = ['frame','orb','sigil','diamond','spent','plate','draw','spent-cards','potions','connector'];
export const NAMES = {frame:'Circular harness',orb:'Stamina inner orb',sigil:'Action sigil',diamond:'Sapphire mana',spent:'Spent mana',plate:'Button plate',draw:'Draw cradle','spent-cards':'Discard / exhaust cradle',potions:'Potion tray',connector:'Joining rail',text:'Editable label'};
export const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
export const FONTS = {serif:'Georgia, serif',sans:'Arial, sans-serif',mono:'monospace'};
export const BINDINGS = ['static','sp','spLabel','draw','drawLabel','discard','exhaust','endTurn','endTurnKey','potions'];
export const TEXT_DEFAULTS = {fontFamily:'serif',fontWeight:400,fontStyle:'normal',textAlign:'center',binding:'static'};
export const PREVIEW_VALUES = {sp:3,spLabel:'SP',draw:18,drawLabel:'DRAW',discard:4,discardLabel:'DISCARD',exhaust:0,exhaustLabel:'EXHAUST',endTurn:'END TURN',endTurnKey:'SPACE',potions:'POTIONS'};
export function textContent(node,values=PREVIEW_VALUES) {return node.binding && node.binding!=='static' ? node.text.replaceAll('{value}',String(values[node.binding]??'')).replaceAll('{label}',String(values[node.binding+'Label']??'')) : node.text;}
const item=(id,asset,x,y,w,h,group,extra={})=>({id,asset,name:NAMES[asset],x,y,w,h,group,visible:true,locked:false,opacity:1,...extra});
const label=(id,text,x,y,w,h,group,size=22)=>item(id,'text',x,y,w,h,group,{name:text,text,fontSize:size,color:'#e7dcc0',...TEXT_DEFAULTS});
export function preset(kind='desktop') {
 const items=[
  item('rail-a','connector',184,191,116,14,''),item('rail-b','connector',390,191,88,14,''),item('rail-c','connector',722,191,88,14,''),item('rail-d','connector',900,191,88,14,''),
  item('sp-orb','orb',56,133,128,128,'sp'),item('sp-frame','frame',24,101,192,192,'sp'),item('sp-sigil','sigil',102,151,36,28,'sp',{visible:false}),
  label('sp-number','3',64,151,112,92,'sp',72),label('sp-label','SP',92,228,56,22,'sp',18),
  item('draw-art','draw',293,120,112,145,'draw'),label('draw-count','18',309,266,80,26,'draw',26),label('draw-label','DRAW',289,300,120,22,'draw',17),
  item('end-plate','plate',460,154,280,87,'end'),label('end-label','END TURN',490,173,220,35,'end',27),label('end-key','SPACE',530,212,140,16,'end',12),
  item('discard-art','spent-cards',798,126,116,140,'discard'),label('discard-count','DISCARD  4',776,278,160,24,'discard',18),label('exhaust-count','EXHAUST  0',776,307,160,20,'discard',14),
  item('potion-art','potions',973,140,192,127,'potions'),label('potion-label','POTIONS',991,290,156,26,'potions',18)
 ];
 const bindings={'sp-number':['sp','{value}'],'sp-label':['spLabel','{value}'],'draw-count':['draw','{value}'],'draw-label':['drawLabel','{value}'],'end-label':['endTurn','{value}'],'end-key':['endTurnKey','{value}'],'discard-count':['discard','{label}  {value}'],'exhaust-count':['exhaust','{label}  {value}'],'potion-label':['potions','{value}']};
 for(const n of items)if(bindings[n.id]){[n.binding,n.text]=bindings[n.id];}
 for(let i=0;i<12;i++){const a=(-90-i*30)*Math.PI/180;items.push(item('mana-'+i,i<8?'diamond':'spent',120+Math.cos(a)*88-11,197+Math.sin(a)*88-16,22,32,'sp',{name:`Mana ${i+1}`}));}
 let doc={schema:'ashenspire.footer',version:1,width:1200,height:420,items};
 if(kind==='compact'){
  doc.width=640;doc.height=520;
  const offsets={sp:[12,-30],draw:[-43,-35],end:[-44,167],discard:[-762,181],potions:[-765,168]};
  doc.items=items.filter(n=>n.asset!=='connector').map(n=>({...n,x:n.x+offsets[n.group][0],y:n.y+offsets[n.group][1]}));
  doc=resize(doc,selectedIds(doc,'end-plate'),208,87*208/280);
 }
 return doc;
}
export function validate(raw) {
 if(!raw||raw.schema!=='ashenspire.footer'||raw.version!==1) throw Error('Choose a Footer Atelier version 1 JSON layout.');
 if(!Number.isFinite(raw.width)||raw.width<200||raw.width>4096||!Number.isFinite(raw.height)||raw.height<100||raw.height>4096) throw Error('Canvas dimensions must be between 200 × 100 and 4096 × 4096.');
 if(!Array.isArray(raw.items)||raw.items.length>300)throw Error('A layout can contain up to 300 components.');
 const ids=new Set();
 const items=raw.items.map(n=>{
  if(!n||typeof n.id!=='string'||n.id.length>100||ids.has(n.id))throw Error('Each component needs a unique ID.');ids.add(n.id);
  if(![...ASSETS,'text'].includes(n.asset))throw Error('Unknown component asset.');
  for(const k of ['x','y','w','h','opacity'])if(!Number.isFinite(n[k]))throw Error('Component dimensions must be finite numbers.');
  if(n.w<4||n.h<4||n.w>4096||n.h>4096||Math.abs(n.x)>8192||Math.abs(n.y)>8192||n.opacity<0||n.opacity>1)throw Error('Component geometry is out of range.');
  if(n.asset==='text'&&(!Number.isFinite(n.fontSize)||n.fontSize<6||n.fontSize>200||typeof n.text!=='string'||n.text.length>160||!/^#[0-9a-f]{6}$/i.test(n.color)))throw Error('Invalid text component.');
  const type={...TEXT_DEFAULTS,...Object.fromEntries(Object.keys(TEXT_DEFAULTS).filter(k=>n[k]!==undefined).map(k=>[k,n[k]]))};
  if(n.asset==='text'&&(!Object.hasOwn(FONTS,type.fontFamily)||![400,600,700].includes(type.fontWeight)||!['normal','italic'].includes(type.fontStyle)||!['left','center','right'].includes(type.textAlign)||!BINDINGS.includes(type.binding)))throw Error('Invalid text font, alignment or game binding.');
  return {id:n.id,asset:n.asset,name:String(n.name||NAMES[n.asset]).slice(0,100),x:n.x,y:n.y,w:n.w,h:n.h,group:typeof n.group==='string'?n.group.slice(0,100):'',visible:n.visible!==false,locked:!!n.locked,opacity:n.opacity,...(n.asset==='text'?{text:n.text,fontSize:n.fontSize,color:n.color,...type}:{})};
 });
 return {schema:raw.schema,version:1,width:raw.width,height:raw.height,items};
}
export function bounds(items){if(!items.length)return {x:0,y:0,w:0,h:0};const x=Math.min(...items.map(n=>n.x)),y=Math.min(...items.map(n=>n.y));return {x,y,w:Math.max(...items.map(n=>n.x+n.w))-x,h:Math.max(...items.map(n=>n.y+n.h))-y};}
export function selectedIds(doc,id,grouped=true){const n=doc.items.find(q=>q.id===id);return n?doc.items.filter(q=>q.id===id||(grouped&&n.group&&q.group===n.group)).map(q=>q.id):[];}
export function move(doc,ids,dx,dy){const out=clone(doc);if(out.items.some(n=>ids.includes(n.id)&&n.locked))return out;for(const n of out.items)if(ids.includes(n.id)){n.x+=dx;n.y+=dy;}return out;}
// Snap against edges AND centres. The threshold is in document units; callers
// convert the fixed screen tolerance by the current zoom. A dock requires overlap
// on the other axis, so remote rows cannot accidentally join.
export function snap(box,others,{grid=0,threshold=8,edges=true}={}){
 let x=grid?Math.round(box.x/grid)*grid:box.x,y=grid?Math.round(box.y/grid)*grid:box.y;
 const guides=[];let dock=null;
 if(!edges)return {x,y,guides,dock};
 for(const axis of ['x','y']){
  const size=axis==='x'?'w':'h';let best=null;
  for(const n of others)for(const a of [0,.5,1])for(const b of [0,.5,1]){
   const delta=n[axis]+n[size]*b-(box[axis]+box[size]*a);
   if(Math.abs(delta)<=threshold&&(!best||Math.abs(delta)<Math.abs(best.delta)))best={delta,n,a,b};
  }
  if(best){const v=box[axis]+best.delta;if(axis==='x')x=v;else y=v;guides.push({axis,value:best.n[axis]+best.n[size]*best.b});
   const other=axis==='x'?'y':'x',os=axis==='x'?'h':'w';
   if((best.a===0&&best.b===1||best.a===1&&best.b===0)&&box[other]<best.n[other]+best.n[os]&&box[other]+box[os]>best.n[other])dock=best.n.id;
  }
 }
 return {x,y,guides,dock};
}
export function attach(doc,ids,targetId){const out=clone(doc),target=out.items.find(n=>n.id===targetId);if(!target||ids.includes(targetId))return out;const targetIds=selectedIds(out,targetId),all=new Set([...ids,...targetIds]);if(out.items.some(n=>all.has(n.id)&&n.locked))return out;const group=target.group||'joined-'+target.id;for(const n of out.items)if(all.has(n.id))n.group=group;return out;}
export function resize(doc,ids,w,h){const out=clone(doc),nodes=out.items.filter(n=>ids.includes(n.id));if(!nodes.length||nodes.some(n=>n.locked))return out;const b=bounds(nodes),sx=Math.max(8,w)/b.w,sy=Math.max(8,h)/b.h;for(const n of nodes){n.x=b.x+(n.x-b.x)*sx;n.y=b.y+(n.y-b.y)*sy;n.w*=sx;n.h*=sy;if(n.asset==='text')n.fontSize=clamp(n.fontSize*Math.min(sx,sy),6,200);}return out;}
