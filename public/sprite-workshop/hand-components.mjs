import {clone,point,inverse,multiply,worldMatrix,setWorldMatrix,effectivePose} from './core.mjs';
import {createLayerGroup} from './parts.mjs';

// Traced visible artwork, independent of the old weapon grip-marker coordinates.
// Hidden surfaces are deliberately not invented; these are editable cutout boundaries.
export const handRegions={
 'ATK-01':[
  {poly:[[191,181],[199,170],[209,164],[221,171],[228,181],[223,193],[208,199],[196,192]],palm:[209,183]},
  {poly:[[281,285],[289,278],[300,280],[313,291],[314,302],[306,309],[294,302]],palm:[299,292]}],
 'ATK-03':[
  {poly:[[260,153],[267,137],[278,127],[291,130],[301,145],[297,158],[281,169]],palm:[283,148]},
  {poly:[[307,171],[311,157],[324,147],[338,155],[348,172],[346,185],[332,192],[317,185]],palm:[328,170]}],
 'ATK-04':[
  {poly:[[302,294],[310,283],[324,280],[336,289],[340,302],[333,315],[320,321],[305,312]],palm:[322,300]},
  {poly:[[305,314],[319,321],[333,315],[332,327],[323,338],[310,335],[300,326]],palm:[319,328],partial:true}],
 'ATK-05':[
  {poly:[[319,320],[328,311],[342,314],[353,326],[352,340],[340,351],[325,345],[316,335]],palm:[335,332]},
  {poly:[[330,307],[342,305],[357,312],[365,323],[362,334],[352,340],[353,326],[342,314],[328,311]],palm:[352,320],partial:true}],
 'ATK-06':[
  {poly:[[341,361],[350,353],[363,353],[380,363],[389,377],[384,389],[372,397],[354,390],[340,380]],palm:[367,375]},
  {poly:[[327,346],[337,340],[349,344],[356,351],[350,353],[341,361],[340,374],[330,369],[323,358]],palm:[336,354],partial:true}],
 'ATK-07':[
  {poly:[[279,296],[287,287],[298,286],[311,294],[319,305],[316,317],[304,325],[288,319],[278,308]],palm:[297,305]},
  {poly:[[292,279],[306,279],[319,287],[322,299],[316,303],[307,291],[298,286],[287,287]],palm:[307,288],partial:true}]
};

function clipPolygon(subject,clip){
 const orientation=Math.sign(clip.reduce((s,a,i)=>{const b=clip[(i+1)%clip.length];return s+a[0]*b[1]-b[0]*a[1];},0))||1;
 let out=subject;
 for(let i=0;i<clip.length;i++){const a=clip[i],b=clip[(i+1)%clip.length],dist=v=>orientation*((b[0]-a[0])*(v[1]-a[1])-(b[1]-a[1])*(v[0]-a[0])),input=out;out=[];for(let j=0;j<input.length;j++){const s=input[j],e=input[(j+1)%input.length],ds=dist(s),de=dist(e);if(ds>=0)out.push(s);if((ds<0&&de>0)||(ds>0&&de<0)){const t=ds/(ds-de);out.push([s[0]+t*(e[0]-s[0]),s[1]+t*(e[1]-s[1])]);}}}
 return out.length>=3?out:[[0,0],[0,0],[0,0]];
}

function refineEarlyOverlaySplit(project,p){
 // Preserve edits made with the first hand-group preview while removing non-hand
 // pixels from its portable components. Residual artwork stays as a separate layer.
 if(p.layers.some(l=>l.id==='foreground'))return false;
 let changed=false;
 for(const handId of ['hand-L','hand-R']){
  const h=p.layers.find(l=>l.id===handId),fg=p.layers.find(l=>l.id===handId+'-fingers');if(!h||!fg||!h.masks?.[0]||!fg.masks?.[0])continue;
  const residual=clone(fg),world=worldMatrix(p,fg),poly=h.masks[0].map(v=>point(multiply(inverse(world),worldMatrix(p,h)),v));
  residual.id=handId+'-legacy-overlay';residual.name='Legacy grip overlay · review';residual.parentId=null;residual.erase=[...(residual.erase||[]),poly];
  p.layers.splice(p.layers.indexOf(fg)+1,0,residual);setWorldMatrix(p,residual,world);fg.masks=[clipPolygon(poly,fg.masks[0])];
  for(const a of Object.values(project.animations))for(const f of a.frames)if(f.poseId===p.id&&Object.keys(f.overrides||{}).length){const pp=effectivePose(project,f),r=pp.layers.find(l=>l.id===residual.id);setWorldMatrix(pp,r,worldMatrix(pp,pp.layers.find(l=>l.id===fg.id)));f.overrides[residual.id]=Object.fromEntries(['x','y','rotation','scale','scaleY','skew','pivot','visible','opacity'].filter(k=>r[k]!==undefined).map(k=>[k,clone(r[k])]));}
  changed=true;
 }
 return changed;
}

export function upgradeHandComponents(project){
 let upgraded=0;
 for(const p of Object.values(project.poses)){
  if(p.handComponentsVersion===2)continue;
  if(p.handComponentsVersion===1){refineEarlyOverlaySplit(project,p);p.handComponentsVersion=2;upgraded++;continue;}
  const body=p.layers.find(l=>l.id==='body'&&l.role==='body');if(!body)continue;
  if(p.layers.some(l=>l.id==='hands'))continue;
  const before=clone(p),origins=new Map(p.layers.map(l=>[l.id,l.id]));
  const key=Object.keys(handRegions).find(id=>body.assetId===id+'-body');
  let hands=p.layers.filter(l=>['hand-L','hand-R'].includes(l.id));
  if(hands.length!==2&&key){
   const regions=handRegions[key],bodyMatrix=worldMatrix(p,body),foreground=p.layers.find(l=>l.id==='foreground');
   if(foreground?.masks?.length)continue;
   hands=[];
   for(const [i,region] of regions.entries()){
    const id=i?'hand-R':'hand-L',h=clone(body);h.id=id;h.name=i?'Right hand':'Left hand';h.role='part';h.parentId=null;h.pivot=region.palm;h.masks=[region.poly];h.erase=clone(body.erase||[]);h.views=undefined;
    // Keep hand cutouts behind the weapon, and their separate finger overlay above it.
    h.anchors=[{id:i?'H2':'H1',name:i?'H2':'H1',x:region.palm[0],y:region.palm[1],kind:'grip',pinned:false}];
    h.notes=region.partial?'Visible hand fragment; other pixels are occluded in the source. Repaint hidden anatomy before separating hands widely.':'Visible hand cutout. Inspect the wrist seam after moving.';
    p.layers.splice(p.layers.indexOf(body)+1+i,0,h);setWorldMatrix(p,h,bodyMatrix);hands.push(h);
    origins.set(id,body.id);
   }
   body.erase=[...(body.erase||[]),...regions.map(r=>r.poly)];
   body.anchors=body.anchors.filter(a=>!['H1','H2'].includes(a.id));
   for(const b of p.bones||[])for(const end of ['from','to'])if(b[end][0]===body.id&&['H1','H2'].includes(b[end][1]))b[end][0]=b[end][1]==='H1'?'hand-L':'hand-R';
   if(foreground){
    const m=worldMatrix(p,foreground),index=p.layers.indexOf(foreground),fragments=[],toForeground=multiply(inverse(m),bodyMatrix),polygons=regions.map(r=>r.poly.map(v=>point(toForeground,v)));
    for(let i=0;i<2;i++){
     const l=clone(foreground);l.id=hands[i].id+'-fingers';l.name=(i?'Right':'Left')+' hand · grip overlay';l.handFragment=true;l.parentId=hands[i].id;l.anchors=[];
     // Only painted pixels inside this hand belong to its finger overlay.
     l.masks=[polygons[i]];fragments.push(l);p.layers.push(l);setWorldMatrix(p,l,m);
     origins.set(l.id,foreground.id);
    }
    foreground.erase=[...(foreground.erase||[]),...polygons];foreground.name='Legacy grip overlay · review';foreground.handFragment=true;
    p.layers=p.layers.filter(l=>!fragments.includes(l));p.layers.splice(index+1,0,...fragments);
   }
  }
  if(hands.length!==2)continue;
  // Retain the two already-authored ATK-02 hand cutouts and their anchors.
  for(const h of hands)h.name=h.id==='hand-L'?'Left hand':'Right hand';
  const locks=hands.map(h=>h.locked);hands.forEach(h=>h.locked=false);
  const group=createLayerGroup(p,hands.map(h=>h.id),'Hands','hands');group.handGroup=true;hands.forEach((h,i)=>h.locked=locks[i]);
  // Re-bake existing frame overrides under the new parents, preserving world placement.
  for(const a of Object.values(project.animations))for(const f of a.frames)if(f.poseId===p.id&&Object.keys(f.overrides||{}).length){
   const old=effectivePose({poses:{[p.id]:before}},f),next=clone(p),done=new Set();
   function apply(l){if(done.has(l.id))return;const parent=next.layers.find(x=>x.id===l.parentId);if(parent)apply(parent);const source=old.layers.find(x=>x.id===origins.get(l.id));if(source){setWorldMatrix(next,l,worldMatrix(old,source));l.visible=source.visible;l.opacity=source.opacity;}done.add(l.id);}
   next.layers.forEach(apply);f.overrides={};
   for(const l of next.layers){const base=p.layers.find(x=>x.id===l.id),delta={};for(const k of ['x','y','rotation','scale','scaleY','skew','pivot','visible','opacity'])if(l[k]!==undefined&&JSON.stringify(l[k])!==JSON.stringify(base[k]))delta[k]=clone(l[k]);if(Object.keys(delta).length)f.overrides[l.id]=delta;}
  }
  p.handComponentsVersion=2;upgraded++;
 }
 return upgraded;
}
