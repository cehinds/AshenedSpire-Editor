import {inverse,multiply,point} from './core.mjs';

export const defaultControls={freeScale:false,moveSnap:true,rotateSnap:true,scaleSnap:true,scaleStep:5,bypassKey:'alt',constrainKey:'shift',centerKey:'control',wheel:'page',middlePan:true,spacePan:true,nudge:1,fastNudge:10,moveKey:'v',rotateKey:'r',fitKey:'f'};
export function readControls(value={}){
 if(!value||typeof value!=='object')value={};const out={...defaultControls};
 for(const key of ['freeScale','moveSnap','rotateSnap','scaleSnap','middlePan','spacePan'])if(typeof value[key]==='boolean')out[key]=value[key];
 for(const key of ['scaleStep','nudge','fastNudge'])if(Number.isFinite(value[key])&&value[key]>=.1&&value[key]<=100)out[key]=value[key];
 for(const key of ['bypassKey','constrainKey','centerKey'])if(['alt','shift','control','none'].includes(value[key]))out[key]=value[key];
 if(['page','zoom'].includes(value.wheel))out.wheel=value.wheel;
 for(const key of ['moveKey','rotateKey','fitKey'])if(typeof value[key]==='string'&&/^[a-z]$/.test(value[key]))out[key]=value[key];
 return out;
}
export function modifier(e,key){return key==='alt'?e.altKey:key==='shift'?e.shiftKey:key==='control'?e.ctrlKey||e.metaKey:false;}
export function handlePoints(box){const [x0,y0,x1,y1]=box,mx=(x0+x1)/2,my=(y0+y1)/2;return {nw:[x0,y0],n:[mx,y0],ne:[x1,y0],e:[x1,my],se:[x1,y1],s:[mx,y1],sw:[x0,y1],w:[x0,my]};}
const opposite={nw:'se',n:'s',ne:'sw',e:'w',se:'nw',s:'n',sw:'ne',w:'e'};
export function resizeMatrix(matrix,box,handle,target,{uniform=true,center=null,step=0}={}){
 const points=handlePoints(box),origin=center||points[opposite[handle]],start=points[handle],end=point(inverse(matrix),target);
 const dx=start[0]-origin[0],dy=start[1]-origin[1],ex=end[0]-origin[0],ey=end[1]-origin[1];
 let sx=Math.abs(dx)>1e-6?ex/dx:1,sy=Math.abs(dy)>1e-6?ey/dy:1;
 if(uniform){const d=dx*dx+dy*dy,r=d?(ex*dx+ey*dy)/d:1;sx=sy=r;}
 if(step){if(uniform)sx=sy=Math.round(sx/step)*step;else{if(Math.abs(dx)>1e-6)sx=Math.round(sx/step)*step;if(Math.abs(dy)>1e-6)sy=Math.round(sy/step)*step;}}
 sx=Math.max(.02,Math.min(50,sx));sy=Math.max(.02,Math.min(50,sy));
 return multiply(matrix,[sx,0,0,sy,origin[0]*(1-sx),origin[1]*(1-sy)]);
}

export function installControlSettings({draw,onChange,download}){
 const $=id=>document.getElementById(id);let prefs;
 try{prefs=readControls(JSON.parse(localStorage.getItem('sprite-workshop-controls')||'{}'));}catch{prefs=readControls();}
 function sync(){
  for(const k of Object.keys(defaultControls)){const el=$('control-'+k);if(el)el.type==='checkbox'?el.checked=prefs[k]:el.value=prefs[k];}
  for(const [id,k] of [['freeScale','freeScale'],['snapMove','moveSnap'],['snapAngle','rotateSnap'],['snapScale','scaleSnap']])$(id).checked=prefs[k];
  const label=k=>({alt:'Alt',shift:'Shift',control:'Ctrl/Cmd'})[k];
  const hints=[prefs.freeScale?'Side and corner handles stretch freely.':'Corner handles resize uniformly.'];
  if(prefs.bypassKey!=='none')hints.push(label(prefs.bypassKey)+' bypasses snapping.');
  if(prefs.constrainKey!=='none')hints.push(label(prefs.constrainKey)+' constrains movement'+(prefs.freeScale?' and keeps proportions.':'.'));
  if(prefs.centerKey!=='none')hints.push(label(prefs.centerKey)+' resizes from pivot.');
  hints.push((prefs.wheel==='page'?'Ctrl/Cmd+wheel':'Wheel')+' zooms'+(prefs.spacePan?'; Space+drag pans.':'.'));
  $('controlHint').textContent=hints.join(' ');
  $('snapHint').textContent=prefs.bypassKey==='none'?'Use toolbar toggles to disable snapping.':'Hold '+label(prefs.bypassKey)+' to bypass snapping.';
 }
 function save(){try{localStorage.setItem('sprite-workshop-controls',JSON.stringify(prefs));}catch{}sync();onChange({...prefs});draw();}
 for(const k of Object.keys(defaultControls)){const el=$('control-'+k);if(!el)continue;el.onchange=()=>{const value=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value.toLowerCase();prefs=readControls({...prefs,[k]:value});save();};}
 for(const [id,k] of [['freeScale','freeScale'],['snapMove','moveSnap'],['snapAngle','rotateSnap'],['snapScale','scaleSnap']])$(id).addEventListener('change',()=>{prefs[k]=$(id).checked;save();});
 $('controlSettings').onclick=()=>{sync();$('settingsDialog').showModal();};$('closeSettings').onclick=()=>$('settingsDialog').close();
 $('resetControls').onclick=()=>{prefs=readControls();save();};
 $('exportControls').onclick=()=>download(new Blob([JSON.stringify(prefs,null,2)],{type:'application/json'}),'sprite-editor-controls.json');
 sync();return {get:()=>prefs,set(value){prefs=readControls(value);save();}};
}
