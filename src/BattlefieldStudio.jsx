import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowClockwise} from '@phosphor-icons/react';
import {NativePreviewFrame} from './NativePreviewFrame.jsx';
import {runtimeBoot} from './GameRuntimePreview.jsx';
import {combatPreviewSnapshot} from './game-runtime-preview.mjs';
import {assignments,baseline} from './data.js';
import {emptyGameSettings} from './game-settings.mjs';
import {Notice,NumberControl,JsonEditor} from './Controls.jsx';
import {battlefieldView,useBattlefieldView} from './battlefield-view.js';
import {measuredRows,shiftRows,ROW_FIELDS,NATIVE_ROWS,BATTLEFIELD_DEVICES,deviceById,STAGE_FIELDS,STAGE_DEFAULTS,FIT_FIELDS,PRESENTATION_FIELDS,SETTING_PREFIX,presentationField,presentationValue,normalizeLab,getPath,setPath,diagnose,battlefieldDocument,battlefieldDocumentProblems,applyBattlefieldDocument} from './battlefield-lab.mjs';
import './battlefield-studio.css';

const CLASSES=['rogue','reaver','herald','starseer'];
const POOLS=[['normal','Normal'],['elite','Elite'],['boss','Boss']];
const STATURE_RATIO={normal:1,large:1.75,huge:2};
const round=(value,step)=>{const digits=Math.max(0,-Math.floor(Math.log10(step)));return Number((Math.round(value/step)*step).toFixed(digits));};
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const pct=(part,whole)=>whole?Math.round(part/whole*100):0;

/** Editing helpers shared by the canvas overlay and inspector. Each writes one native store. */
export function battlefieldEdits(ctx){
 const {update}=ctx;
 return {
  presentation(key,value,label){const field=presentationField(key);update(n=>{n.gameSettings??=emptyGameSettings();n.gameSettings.overrides[SETTING_PREFIX+key]=value;},label||`${field.label} set to ${value}`);},
  resetPresentation(key){update(n=>{if(n.gameSettings)delete n.gameSettings.overrides[SETTING_PREFIX+key];},`${presentationField(key).label} reset to native default`);},
  fit(path,value,label){update(n=>setPath(n.ui,path,value),label||'Formation fit updated');},
  resetFit(path){update(n=>setPath(n.ui,path,getPath(baseline.ui,path)),'Formation fit reset to source value');},
  stage(key,value){update(n=>{n.lab=normalizeLab(n.lab);n.lab.stage[key]=value;},'Stage token updated');},
  resetStage(key){update(n=>{n.lab=normalizeLab(n.lab);delete n.lab.stage[key];},'Stage token reset to native default');},
  rows(rows){update(n=>{n.lab=normalizeLab(n.lab);n.lab.rows=rows;},`Screen rows ${rows.hud} / ${rows.field} / ${rows.hand}%`);},
  resetRows(){update(n=>{n.lab=normalizeLab(n.lab);delete n.lab.rows;},'Screen rows reset to native CSS');},
 };
}

function useFrameSnapshot(p,view,fill=true){
 const draft=useMemo(()=>combatPreviewSnapshot(p,'battlefield',view.testClass,assignments,{encounter:view.encounter,grid:view.grid,fill}),[p.cards,p.nodes,p.tagging,p.styles,p.deck,p.scenario,p.ui,p.gameSettings,p.lab,view.testClass,view.encounter,view.grid,fill]);
 const [snapshot,setSnapshot]=useState(draft);
 useEffect(()=>{const timer=setTimeout(()=>setSnapshot(draft),200);return()=>clearTimeout(timer);},[draft]);
 return snapshot;
}

function useWidth(ref){
 const [width,setWidth]=useState(0);
 useEffect(()=>{if(!ref.current)return;const observer=new ResizeObserver(([entry])=>setWidth(entry.contentRect.width));observer.observe(ref.current);return()=>observer.disconnect();},[ref]);
 return width;
}

/** Native renderer at the target device size, scaled to fit, with measured guides and handles. */
function NativeStage({ctx,view,device,restart,guides,interactive,maxHeight,onMetrics,onStatus}){
 const outer=useRef(null),width=useWidth(outer);
 const snapshot=useFrameSnapshot(ctx.p,view);
 const [metrics,setMetrics]=useState(null);
 const initialGlobals=useMemo(()=>({__ASHEN_PREVIEW_UI__:snapshot.project.ui}),[snapshot.project.ui]);
 const scale=width?Math.min(1,width/device.width,(maxHeight||Infinity)/device.height):0;
 const key=JSON.stringify(snapshot)+restart+device.id;
 useEffect(()=>{setMetrics(null);onMetrics?.(null);},[key]);
 const status=message=>{
  if(message.type==='battlefield-metrics'){setMetrics(message);onMetrics?.(message);}
  else if(message.type==='battlefield-catalog')battlefieldView.setCatalog(message);
  onStatus?.(message);
 };
 return <div ref={outer} className="bf-stage-outer">
  {scale?<div className="bf-stage" style={{width:device.width*scale,height:device.height*scale}}>
   <div className="bf-stage-scaler" style={{width:device.width,height:device.height,transform:`scale(${scale})`}}>
    <NativePreviewFrame key={key} bare title={`Native battlefield ${device.label}`} boot={runtimeBoot} snapshot={snapshot} height={device.height} width={device.width} initialGlobals={initialGlobals} onStatus={status}/>
   </div>
   {guides&&metrics?<StageOverlay ctx={ctx} metrics={metrics} scale={scale} interactive={interactive}/>:null}
  </div>:null}
 </div>;
}

const scaleKey=actor=>actor.role==='player'?'playerSpriteScale':'enemySpriteScale';

function StageOverlay({ctx,metrics,scale,interactive}){
 const {selected}=useBattlefieldView();
 const edits=battlefieldEdits(ctx),overrides=ctx.p.gameSettings?.overrides;
 const [drag,setDrag]=useState(null),[nudge,setNudge]=useState(null);
 const box=(r,extra={})=>({left:r.x*scale,top:r.y*scale,width:r.width*scale,height:r.height*scale,...extra});
 const field=metrics.regions.field,viewport=metrics.viewport.height;
 function begin(event,actor,kind){
  if(!interactive||event.button!==0)return;
  event.preventDefault();event.stopPropagation();
  if(actor)battlefieldView.select(actor.eid);
  setDrag({actor,kind,x:event.clientX,y:event.clientY,dx:0,dy:0});
 }
 // Scale and offsets are native presentation settings; the row split is the preview-only proposal.
 function applyScale(actor,grow){
  const key=scaleKey(actor),spec=presentationField(key),current=presentationValue(overrides,spec);
  const next=clamp(round(current*(actor.art.height+grow)/actor.art.height,spec.step),spec.min,spec.max);
  if(next!==current)edits.presentation(key,next,`${spec.label} ${current} → ${next}`);
 }
 function applyMove(actor,dx,dy){
  const column=actor.formationRow==='back-row'?'back':'front',inward=actor.role==='player'?dx:-dx;
  const fx=presentationField(column+'OffsetX'),fy=presentationField(column+'OffsetY');
  const x=clamp(Math.round(presentationValue(overrides,fx)+inward),fx.min,fx.max),y=clamp(Math.round(presentationValue(overrides,fy)+dy),fy.min,fy.max);
  ctx.update(n=>{n.gameSettings??=emptyGameSettings();n.gameSettings.overrides[SETTING_PREFIX+fx.key]=x;n.gameSettings.overrides[SETTING_PREFIX+fy.key]=y;},`${column==='front'?'Front':'Back'} column offset ${x}, ${y} px`);
 }
 function applyRows(dy){
  const rows=measuredRows(ctx.p.lab,metrics),delta=Math.round(dy/viewport*100);
  if(delta)edits.rows(shiftRows(rows,'field',rows.field+delta));
 }
 const latest=useRef();latest.current={drag,commit};
 const active=Boolean(drag);
 useEffect(()=>{
  if(!active)return;
  const move=event=>{const current=latest.current.drag;if(current)setDrag({...current,dx:event.clientX-current.x,dy:event.clientY-current.y});};
  const up=()=>{const current=latest.current.drag;setDrag(null);if(current)latest.current.commit(current);};
  const cancel=event=>{if(event.key==='Escape')setDrag(null);};
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('keydown',cancel);
  return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('keydown',cancel);};
 },[active]);
 function commit({actor,kind,dx,dy}){
  dx/=scale;dy/=scale;
  if(Math.abs(dx)<2&&Math.abs(dy)<2)return;
  if(kind==='scale')applyScale(actor,-dy);else if(kind==='rows')applyRows(dy);else applyMove(actor,dx,dy);
 }
 // Keyboard: arrows move the column (Shift ×10), +/- resize. Bursts commit as one edit after a pause.
 const pending=useRef(null);latest.current.flush=()=>{const p=pending.current;pending.current=null;setNudge(null);if(!p)return;
  const column=p.actor.formationRow==='back-row'?'back':'front',inward=p.actor.role==='player'?p.dx:-p.dx,writes=[];
  if(p.steps){const spec=presentationField(scaleKey(p.actor));writes.push([spec,clamp(round(presentationValue(overrides,spec)+p.steps*spec.step,spec.step),spec.min,spec.max)]);}
  if(p.dx||p.dy)for(const [axis,delta] of [['X',inward],['Y',p.dy]]){const spec=presentationField(column+'Offset'+axis);writes.push([spec,clamp(Math.round(presentationValue(overrides,spec)+delta),spec.min,spec.max)]);}
  ctx.update(n=>{n.gameSettings??=emptyGameSettings();for(const [spec,value] of writes)n.gameSettings.overrides[SETTING_PREFIX+spec.key]=value;},writes.map(([spec,value])=>`${spec.label} ${value}`).join(', '));};
 useEffect(()=>()=>{clearTimeout(pending.current?.timer);},[]);
 function key(event,actor){
  if(!interactive)return;
  const step=event.shiftKey?10:1,moves={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};
  const steps={'+':1,'=':1,'-':-1,'_':-1}[event.key];
  if(!moves[event.key]&&!steps)return;
  event.preventDefault();
  const p=pending.current?.actor.eid===actor.eid?pending.current:(latest.current.flush(),{actor,dx:0,dy:0,steps:0});
  clearTimeout(p.timer);
  if(moves[event.key]){p.dx+=moves[event.key][0];p.dy+=moves[event.key][1];}else p.steps+=steps;
  p.timer=setTimeout(()=>latest.current.flush(),600);
  pending.current=p;setNudge({eid:actor.eid,dx:p.dx,dy:p.dy,steps:p.steps,grow:Math.round(actor.art.height*p.steps*presentationField(scaleKey(actor)).step/presentationValue(overrides,presentationField(scaleKey(actor))))});
 }
 const regions=[['hud','HUD'],['field','Battlefield'],['hand','Hand'],['footer','Action rail']].filter(([id])=>metrics.regions[id]);
 const rowsDrag=drag?.kind==='rows'?drag.dy:0;
 return <div className={'bf-overlay'+(drag?' dragging':'')+(scale<.5?' compact':'')}>
  {regions.map(([id,label])=>{const r=metrics.regions[id];return <div key={id} className={'bf-region bf-region-'+id} style={box(r)}><span>{label} {Math.round(r.height)} px · {pct(r.height,viewport)}%</span></div>;})}
  {interactive?<div className="bf-row-handle" role="presentation" title="Drag to change the battlefield / hand split (preview proposal)" style={{top:(field.y+field.height)*scale-4+rowsDrag,left:field.x*scale,width:field.width*scale}} onPointerDown={event=>begin(event,null,'rows')}><span>{drag?.kind==='rows'?`Battlefield ${pct(field.height+drag.dy/scale,viewport)}%`:'Battlefield / hand'}</span></div>:null}
  {metrics.combatants.map(actor=>{
   const dragging=drag?.actor?.eid===actor.eid,keyed=nudge?.eid===actor.eid?nudge:null;
   const dx=(dragging&&drag.kind==='move'?drag.dx:0)+(keyed?keyed.dx*scale:0),dy=(dragging&&drag.kind==='move'?drag.dy:0)+(keyed?keyed.dy*scale:0);
   const grow=(dragging&&drag.kind==='scale'?-drag.dy:0)+(keyed?keyed.grow*scale:0);
   const style=box(actor.art,{transform:`translate(${dx}px,${dy-grow}px)`,height:Math.max(8,actor.art.height*scale+grow)});
   const label=`${actor.name}${actor.cell?' · '+actor.cell:''} · ${Math.round(actor.art.height)} px · ${pct(actor.art.height,field.height)}% of field`;
   return <div key={actor.eid} className={'bf-actor'+(selected===actor.eid?' selected':'')+(interactive?' interactive':'')} style={style}>
    <button type="button" className="bf-actor-body" aria-label={`Select ${label}`} title={interactive?`${label}. Drag or use arrow keys to move its ${actor.formationRow==='back-row'?'back':'front'} column; drag the top handle or press + / − to resize.`:label} onClick={()=>battlefieldView.select(actor.eid)} onKeyDown={event=>key(event,actor)} onPointerDown={event=>begin(event,actor,'move')}/>
    {interactive?<span className="bf-handle" role="presentation" title={`Drag to change ${actor.role} sprite scale`} onPointerDown={event=>begin(event,actor,'scale')}/>:null}
    <span className="bf-actor-label">{label}</span>
   </div>;
  })}
  {drag?.actor?<div className="bf-drag-readout" style={{left:drag.actor.art.x*scale,top:Math.max(0,drag.actor.art.y*scale-28)}}>{drag.kind==='scale'?`Height ${Math.round(drag.actor.art.height-drag.dy/scale)} px`:`Δ ${Math.round(drag.dx/scale)}, ${Math.round(drag.dy/scale)} px`}</div>:null}
  {nudge?<div className="bf-drag-readout" style={{left:(metrics.combatants.find(a=>a.eid===nudge.eid)?.art.x||0)*scale,top:0}}>{`Δ ${nudge.dx}, ${nudge.dy} px${nudge.steps?` · scale ${nudge.steps>0?'+':''}${(nudge.steps*0.05).toFixed(2)}`:''} — applies after pause`}</div>:null}
 </div>;
}

function encounterLabel(item){return `${item.enemies.join(' + ')}`;}

function StudioToolbar({view,catalog,onRestart,status,children,deviceChoice=true}){
 const encounters=catalog?.encounters||[];
 return <div className="bf-toolbar">
  {deviceChoice?<label>Device<select value={view.device} onChange={e=>battlefieldView.setView({device:e.target.value})}>{BATTLEFIELD_DEVICES.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}</select></label>:null}
  <label>Encounter<select value={view.encounter} onChange={e=>battlefieldView.setView({encounter:e.target.value})}>{encounters.length?POOLS.map(([pool,label])=><optgroup key={pool} label={label}>{encounters.filter(e=>e.pool===pool).map(e=><option key={e.id} value={e.id}>{encounterLabel(e)}</option>)}</optgroup>):<option value={view.encounter}>{view.encounter}</option>}</select></label>
  <label>Class<select value={view.testClass} onChange={e=>battlefieldView.setView({testClass:e.target.value})}>{CLASSES.map(id=><option key={id}>{id}</option>)}</select></label>
  {children}
  <button type="button" className="icon-button" aria-label="Restart encounter" title="Restart encounter" onClick={onRestart}><ArrowClockwise size={16} aria-hidden="true"/></button>
  <span className="bf-status" role="status">{status}</span>
 </div>;
}

function DiagnosticList({metrics,ui}){
 const issues=diagnose(metrics,ui);
 if(!metrics)return <p className="bf-muted">Measuring native layout…</p>;
 return issues.length?<ul className="bf-issues">{issues.map((issue,i)=><li key={i} className={issue.tone}><button type="button" className="text-button" onClick={()=>battlefieldView.select(issue.eid)}>{issue.text}</button></li>)}</ul>:<p className="bf-ok">No clipping, edge crossing or overlap measured at this size.</p>;
}

function SizingTable({metrics,ctx}){
 if(!metrics)return null;
 const overrides=ctx.p.gameSettings?.overrides,display=ctx.p.ui.sizing.formation.displayScale,field=metrics.regions.field;
 return <table className="bf-table"><thead><tr><th>Figure</th><th>Stature</th><th>Cell</th><th>Visible height</th><th>Field</th><th>Native zoom</th><th>Chain</th></tr></thead><tbody>
  {metrics.combatants.map(actor=>{const spriteScale=presentationValue(overrides,presentationField(actor.role==='player'?'playerSpriteScale':'enemySpriteScale'));return <tr key={actor.eid} className={actor.eid===battlefieldView.get().selected?'selected':''} onClick={()=>battlefieldView.select(actor.eid)}>
   <td>{actor.name}</td><td>{actor.stature} ×{STATURE_RATIO[actor.stature]??1}</td><td>{actor.cell||'—'} {actor.formationRow?`(${actor.formationRow.replace('-row','')})`:''}</td><td>{Math.round(actor.art.height)} px</td><td>{pct(actor.art.height,field.height)}%</td><td>{actor.zoom.toFixed(3)}</td><td>fit {actor.fitScale?.toFixed(3)??'—'} × display {display} × {actor.role} {spriteScale}{actor.cell?` × row ${actor.cell[0]} ${presentationValue(overrides,presentationField(`row${actor.cell[0]}Scale`))}`:''}</td>
  </tr>;})}
 </tbody></table>;
}

export function BattlefieldStudio({ctx}){
 const {p,mode,update}=ctx;
 const {view,catalog,metrics}=useBattlefieldView();
 const [restart,setRestart]=useState(0),[status,setStatus]=useState('Loading native encounter…');
 const device=deviceById(view.device);
 const onStatus=message=>{if(message.type==='error')setStatus('Native preview: '+message.message);else if(message.type==='applied')setStatus('Draft applied to native renderer');};
 if(mode==='JSON')return <JsonEditor live={ctx.inspectorMode==='JSON'} showReset value={battlefieldDocument(p)} validate={battlefieldDocumentProblems} onApply={doc=>update(n=>applyBattlefieldDocument(n,doc),'Battlefield document applied')}/>;
 if(mode==='Compare')return <div className="bf-studio">
  <StudioToolbar view={view} catalog={catalog} onRestart={()=>setRestart(v=>v+1)} status="Same draft, three native viewports" deviceChoice={false}/>
  <div className="bf-compare">{BATTLEFIELD_DEVICES.filter(d=>d.id!=='laptop').map(d=><CompareCell key={d.id} ctx={ctx} view={view} device={d} restart={restart}/>)}</div>
 </div>;
 const diagnostics=mode==='Sizing diagnostics';
 return <div className="bf-studio">
  <StudioToolbar view={view} catalog={catalog} onRestart={()=>{setStatus('Restarting native encounter…');setRestart(v=>v+1);}} status={status}>
   <label className="check"><input type="checkbox" checked={view.guides} onChange={e=>battlefieldView.setView({guides:e.target.checked})}/>Guides</label>
   <label className="check" title="Preview-only: shows the native formation grid without changing the showFormationGrid setting"><input type="checkbox" checked={view.grid} onChange={e=>battlefieldView.setView({grid:e.target.checked})}/>Grid</label>
  </StudioToolbar>
  <NativeStage ctx={ctx} view={view} device={device} restart={restart} guides={view.guides} interactive={!diagnostics} maxHeight={diagnostics?420:undefined} onMetrics={battlefieldView.setMetrics} onStatus={onStatus}/>
  {diagnostics?<SizingTable metrics={metrics} ctx={ctx}/>:<p className="bf-hint">Click a figure to inspect it. Drag it (or arrow keys, Shift ×10) to move its formation column; drag its top handle (or + / −) to resize every player or enemy figure. Drag the gold Battlefield / hand bar to change the screen split. Each release or key burst is one undoable edit. Turn Guides off to play.</p>}
  <DiagnosticList metrics={metrics} ui={p.ui}/>
 </div>;
}

function CompareCell({ctx,view,device,restart}){
 const [metrics,setMetrics]=useState(null);
 const issues=diagnose(metrics,ctx.p.ui);
 return <div className="bf-compare-cell"><h3>{device.label}</h3>
  <NativeStage ctx={ctx} view={view} device={device} restart={restart} guides interactive={false} onMetrics={setMetrics}/>
  {metrics?<p className="bf-muted">Field {Math.round(metrics.regions.field.height)} px · {metrics.combatants.map(a=>`${a.name} ${Math.round(a.art.height)} px`).join(' · ')}</p>:<p className="bf-muted">Measuring…</p>}
  {issues.length?<ul className="bf-issues">{issues.map((issue,i)=><li key={i} className={issue.tone}>{issue.text}</li>)}</ul>:metrics?<p className="bf-ok">Fits.</p>:null}
 </div>;
}

const SECTIONS=[['selected','Selected figure'],['figures','Figures & rows'],['formation','Formation'],['fit','Fit & spacing'],['rows','Screen rows'],['stage','Stage tokens'],['grid','Grid & layers'],['spawn','Spawn']];
const SECTION_GROUPS={figures:['Figures','Rows'],formation:['Formation','Columns'],grid:['Grid','Layers'],spawn:['Spawn']};

function PresentationControl({ctx,field}){
 const edits=battlefieldEdits(ctx),overrides=ctx.p.gameSettings?.overrides,value=presentationValue(overrides,field),authored=(SETTING_PREFIX+field.key) in (overrides||{});
 const reset=authored?<button type="button" className="text-button" onClick={()=>edits.resetPresentation(field.key)}>Reset to native {String(field.def)}</button>:null;
 if(field.type==='number')return <NumberControl label={field.label} value={value} min={field.min} max={field.max} step={field.step} unit={field.unit} onChange={v=>edits.presentation(field.key,v)} onReset={authored?()=>edits.resetPresentation(field.key):undefined}/>;
 if(field.type==='boolean')return <div className="bf-field"><label className="check"><input type="checkbox" checked={value} onChange={e=>edits.presentation(field.key,e.target.checked)}/>{field.label}</label>{reset}</div>;
 if(field.type==='color')return <div className="bf-field"><label className="bf-inline">{field.label}<input type="color" value={value} onChange={e=>edits.presentation(field.key,e.target.value)}/></label>{reset}</div>;
 return <div className="bf-field"><label className="field">{field.label}<select value={value} onChange={e=>edits.presentation(field.key,e.target.value)}>{field.choices.map(c=><option key={c} value={c}>{field.labels?.[c]||c}</option>)}</select></label>{reset}</div>;
}

export function BattlefieldInspector({ctx}){
 const {p}=ctx;
 const {selected,metrics}=useBattlefieldView();
 const [section,setSection]=useState(selected?'selected':'figures');
 useEffect(()=>{if(selected)setSection('selected');},[selected]);
 const edits=battlefieldEdits(ctx),lab=normalizeLab(p.lab),actor=metrics?.combatants.find(a=>a.eid===selected);
 let body;
 if(section==='selected'){
  if(!actor)body=<p className="bf-muted">Select a figure on the Layout canvas.</p>;
  else{const column=actor.formationRow==='back-row'?'back':'front',field=metrics.regions.field;body=<>
   <h3>{actor.name}</h3>
   <dl className="bf-facts"><dt>Role</dt><dd>{actor.role}</dd><dt>Stature</dt><dd>{actor.stature} (×{STATURE_RATIO[actor.stature]??1}, from encounter pool)</dd><dt>Cell</dt><dd>{actor.cell||'—'} ({column} column)</dd><dt>Visible art</dt><dd>{Math.round(actor.art.width)}×{Math.round(actor.art.height)} px · {pct(actor.art.height,field.height)}% of field</dd><dt>Native fit</dt><dd>{actor.fitScale?.toFixed(3)??'—'}</dd><dt>Native zoom</dt><dd>{actor.zoom.toFixed(3)}</dd></dl>
   <PresentationControl ctx={ctx} field={presentationField(actor.role==='player'?'playerSpriteScale':'enemySpriteScale')}/>
   {actor.cell?<PresentationControl ctx={ctx} field={presentationField(`row${actor.cell[0]}Scale`)}/>:null}
   <PresentationControl ctx={ctx} field={presentationField(column+'OffsetX')}/>
   <PresentationControl ctx={ctx} field={presentationField(column+'OffsetY')}/>
   <small>Native rules: sprite scale applies to every {actor.role} figure; column offsets move both teams' {column} column, mirrored inward.</small>
  </>;}
 }else if(section==='fit')body=<>{['Fit','Depth','Spacing'].map(group=><div key={group}><h3>{group}</h3>{FIT_FIELDS.filter(f=>f.group===group).map(f=>{const value=getPath(p.ui,f.path),source=getPath(baseline.ui,f.path);return <NumberControl key={f.path.join('.')} label={f.label} value={value} min={f.min} max={f.max} step={f.step} unit={f.unit} onChange={v=>edits.fit(f.path,v,`${f.label} set to ${v}`)} onReset={value!==source?()=>edits.resetFit(f.path):undefined}/>;})}</div>)}<small>Native file: ui/scenes/w4a-combat.json. Shared with UI settings.</small></>;
 else if(section==='rows'){const rows=measuredRows(p.lab,metrics),authored=Boolean(lab.rows);body=<>{ROW_FIELDS.map(f=><NumberControl key={f.key} label={f.label} value={rows[f.key]} min={f.min} max={f.max} step={1} unit="%" onChange={v=>{const next=shiftRows(rows,f.key,v);if(next!==rows)edits.rows(next);else ctx.tell(`${f.label} ${v}% leaves no valid split`);}}/>)}{authored?<button type="button" className="text-button" onClick={edits.resetRows}>Reset to native CSS rows</button>:null}<Notice tone="warning">The game's combat CSS fixes rows at {NATIVE_ROWS.tall.hud} / {NATIVE_ROWS.tall.field} / {NATIVE_ROWS.tall.hand}% ({NATIVE_ROWS.short.hud} / {NATIVE_ROWS.short.field} / {NATIVE_ROWS.short.hand}% below 700 px height) and overrides the UI band adapter. Authored rows are a preview and export proposal; no checkout adapter changes that CSS.</Notice><small>Drag the Battlefield / hand bar on the Layout canvas to change the split.</small></>;}
 else if(section==='stage')body=<>{STAGE_FIELDS.map(f=><NumberControl key={f.key} label={f.label} value={lab.stage[f.key]??STAGE_DEFAULTS[f.key]} min={f.min} max={f.max} step={f.step} unit={f.unit} onChange={v=>edits.stage(f.key,v)} onReset={f.key in lab.stage?()=>edits.resetStage(f.key):undefined}/>)}<Notice>Native store: balance.ui.combatantStage in src/content/balance.js. Overrides preview here and export with the project; <button type="button" className="text-button" onClick={()=>ctx.openNative?.()}>save to game…</button> reviews a literal-only change, verifies it by evaluating balance.js on the local host, then writes with a revision check. The game validator accepts center 25–75%, clearances 0–25 vh and intent gap 0–24 px.</Notice></>;
 else body=<>{SECTION_GROUPS[section].map(group=><div key={group}>{SECTION_GROUPS[section].length>1?<h3>{group}</h3>:null}{PRESENTATION_FIELDS.filter(f=>f.group===group).map(f=><PresentationControl key={f.key} ctx={ctx} field={f}/>)}</div>)}<small>Native settings: gameConfig.presentation.*. Saved in the Game settings profile; promote to checkout defaults from Project tools.</small></>;
 return <div className="bf-inspector">
  <div className="bf-inspector-head"><h2>Battlefield</h2><select aria-label="Battlefield inspector section" value={section} onChange={e=>setSection(e.target.value)}>{SECTIONS.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></div>
  {body}
 </div>;
}
