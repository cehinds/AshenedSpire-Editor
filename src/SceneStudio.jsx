import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ArrowCounterClockwise} from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise';
import {ArrowClockwise} from '@phosphor-icons/react/dist/csr/ArrowClockwise';
import {ArrowDown} from '@phosphor-icons/react/dist/csr/ArrowDown';
import {ArrowUp} from '@phosphor-icons/react/dist/csr/ArrowUp';
import {ArrowsOut} from '@phosphor-icons/react/dist/csr/ArrowsOut';
import {Cursor} from '@phosphor-icons/react/dist/csr/Cursor';
import {EyeSlash} from '@phosphor-icons/react/dist/csr/EyeSlash';
import {GridFour} from '@phosphor-icons/react/dist/csr/GridFour';
import {Hand} from '@phosphor-icons/react/dist/csr/Hand';
import {Image} from '@phosphor-icons/react/dist/csr/Image';
import {LockSimple} from '@phosphor-icons/react/dist/csr/LockSimple';
import {Magnet} from '@phosphor-icons/react/dist/csr/Magnet';
import {Minus} from '@phosphor-icons/react/dist/csr/Minus';
import {Pause} from '@phosphor-icons/react/dist/csr/Pause';
import {Play} from '@phosphor-icons/react/dist/csr/Play';
import {Plus} from '@phosphor-icons/react/dist/csr/Plus';
import {SkipBack} from '@phosphor-icons/react/dist/csr/SkipBack';
import {Square} from '@phosphor-icons/react/dist/csr/Square';
import {SpeakerHigh} from '@phosphor-icons/react/dist/csr/SpeakerHigh';
import {TextT} from '@phosphor-icons/react/dist/csr/TextT';
import {User} from '@phosphor-icons/react/dist/csr/User';
import {X} from '@phosphor-icons/react/dist/csr/X';
import {undo, redo} from './core.mjs';
import {publicFrameUrl as publicUrl} from './paths.js';
import {sceneFramePayload} from './scene-playback.mjs';
import {studioFrameDocument} from './scene-studio-frame.mjs';
import {getActor, getStage, patchActor, patchStage, sceneArtUrl, reorderScene, addScene, sceneDuration} from './scene-studio-model.mjs';
import {auditionSceneAudio, stopSceneAudio} from './scene-studio-audio.mjs';
import {SceneStudioInspector} from './SceneStudioInspector.jsx';
import {SceneDefaultsInspector} from './SceneDefaultsInspector.jsx';
import {useMovablePanel} from './useMovablePanel.js';
import runtime from './native/game-preview/runtime.js?raw';
import nativeStyles from './native/game-preview/styles.css?raw';
import {nativeAssetPaths} from './native/game-preview/assets.js';
import './scene-studio.css';

const WORKSPACES = [['cards','Cards'],['decks','Decks'],['tags','Tags / ERD'],['scenes','Scenes'],['battlefield','Battlefield'],['ui','UI settings'],['poses','Poses & effects'],['combat','Combat workshop'],['project','Project tools']];
const assets = Object.entries(nativeAssetPaths).filter(([key])=>key.startsWith('assets/prologue/') || nativeStyles.includes(key));
const number = n=>Math.round(n*100)/100;
const clamp = (n,a,b)=>Math.min(b,Math.max(a,n));
const stamp = n=>`${Math.floor(n/60).toString().padStart(2,'0')}:${(n%60).toFixed(2).padStart(5,'0')}`;
const LAYOUT_KEY='ashenedspire.studio.layout.v1';
const DEFAULT_LAYOUT={grid:false,snap:true,safe:true,phone:true,device:'desktop',timelineHeight:190,railWidth:186,inspectorWidth:248,inspectorFloating:false,inspectorVisible:true};
const INSPECTOR_SIZE={width:300,height:560};
const inspectorPosition=()=>({x:Math.max(8,window.innerWidth-332),y:96});
function readStudioLayout(){
  try{
    const saved=JSON.parse(localStorage.getItem(LAYOUT_KEY)||'null'),layout={...DEFAULT_LAYOUT};
    if(!saved||typeof saved!=='object')return layout;
    for(const key of ['grid','snap','safe','phone','inspectorFloating','inspectorVisible'])if(typeof saved[key]==='boolean')layout[key]=saved[key];
    if(['desktop','mobile'].includes(saved.device))layout.device=saved.device;
    for(const [key,min,max] of [['timelineHeight',140,320],['railWidth',124,300],['inspectorWidth',220,420]])if(Number.isFinite(saved[key]))layout[key]=clamp(saved[key],min,max);
    return layout;
  }catch{return {...DEFAULT_LAYOUT};}
}
function IconButton({icon:Icon,label,active,...props}){return <button type="button" title={label} aria-label={label} aria-pressed={active===undefined?undefined:active} className={'studio-icon '+(active?'active':'')} {...props}><Icon size={15}/></button>;}

function WidthResize({label,value,onChange,min,max,initial,direction=1}){
  const active=useRef(null);
  const finish=event=>{if(active.current?.pointerId!==event.pointerId)return;active.current=null;};
  return <div className={'studio-width-resize '+(direction===1?'rail':'inspector')} role="separator" aria-label={label} aria-orientation="vertical" aria-valuemin={min} aria-valuemax={max} aria-valuenow={Math.round(value)} tabIndex={0} title={`${label} · drag or arrow keys · double-click to reset`}
    onDoubleClick={()=>onChange(initial)} onKeyDown={event=>{if(['ArrowLeft','ArrowRight','Home'].includes(event.key)){event.preventDefault();event.stopPropagation();onChange(event.key==='Home'?initial:clamp(value+(event.key==='ArrowRight'?1:-1)*direction*(event.shiftKey?40:10),min,max));}}}
    onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();active.current={x:event.clientX,value,pointerId:event.pointerId};event.currentTarget.setPointerCapture(event.pointerId);}}
    onPointerMove={event=>{if(active.current?.pointerId===event.pointerId)onChange(clamp(active.current.value+(event.clientX-active.current.x)*direction,min,max));}}
    onPointerUp={finish} onPointerCancel={event=>{if(active.current?.pointerId===event.pointerId){onChange(active.current.value);active.current=null;}}} onLostPointerCapture={finish}/>;
}

function NativeStage({project,scene,dimensions,channel,frameRef,onMessage,timeRef}) {
  const previousScene=useRef(scene.id);
  const payload = useMemo(()=>{const start=previousScene.current===scene.id?timeRef.current:1;previousScene.current=scene.id;return {...sceneFramePayload(project,scene.id,{},false),studio:{time:start}};},[project.scenes,project.gameSettings,scene.id,dimensions[0]]);
  const result = useMemo(()=>{try{return {document:studioFrameDocument({runtime,styles:nativeStyles,assets:Object.fromEntries(assets.map(([key,path])=>[key,new URL(publicUrl(path),window.location.href).href])),payload,channel})};}catch(error){return {document:'',error:error.message};}},[payload,channel]);
  useEffect(()=>{onMessage(result.error?{type:'error',message:result.error}:{type:'loading'});},[result,onMessage]);
  useEffect(()=>{const receive=event=>{if(event.source===frameRef.current?.contentWindow&&event.data?.channel===channel)onMessage(event.data);};window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);},[channel,onMessage]);
  return <iframe ref={frameRef} title={dimensions[0]>760?'Native scene canvas':'Native mobile scene preview'} sandbox="allow-scripts" srcDoc={result.document} width={dimensions[0]} height={dimensions[1]} tabIndex={-1}/>;
}

export function SceneStudio({ctx,saveDraft,exportCurrent,openNative,conflict,issue}) {
  const {p,scene,update,choose,h,setH}=ctx;
  const sequence=p.scenes.components.sequence;
  const [audioStatus,setAudioStatus]=useState('Native cues ready'),[audioError,setAudioError]=useState('');
  const stopAudio=()=>{setAudioStatus(stopSceneAudio().message);setAudioError('');};
  const auditionAudio=async()=>{setAudioError('');try{const result=await auditionSceneAudio(scene,p.gameSettings?.overrides||{});setAudioStatus(result.message);}catch(error){setAudioError(error.message);}};
  useEffect(()=>{setAudioStatus('Native cues ready');setAudioError('');return()=>{stopSceneAudio();};},[scene.id,scene.music,scene.stinger]);
  const [layout,setLayout]=useState(readStudioLayout);
  const {grid,snap,safe,phone,device,timelineHeight,railWidth,inspectorWidth,inspectorFloating,inspectorVisible}=layout;
  const preference=(key,value)=>setLayout(current=>({...current,[key]:typeof value==='function'?value(current[key]):value}));
  const setGrid=value=>preference('grid',value),setSnap=value=>preference('snap',value),setSafe=value=>preference('safe',value),setPhone=value=>preference('phone',value),setDevice=value=>preference('device',value),setTimelineHeight=value=>preference('timelineHeight',value);
  const [narrow,setNarrow]=useState(()=>window.matchMedia('(max-width: 960px)').matches),[mobileInspectorOpen,setMobileInspectorOpen]=useState(false);
  const inspectorOpen=narrow?mobileInspectorOpen:inspectorVisible, floating=inspectorOpen&&(narrow||inspectorFloating);
  const setInspectorOpen=value=>narrow?setMobileInspectorOpen(value):preference('inspectorVisible',value);
  const movableInspector=useMovablePanel({storageKey:'ashenedspire.studio.inspector.position.v1',initialSize:INSPECTOR_SIZE,defaultPosition:inspectorPosition,enabled:floating});
  useEffect(()=>{const query=window.matchMedia('(max-width: 960px)');const change=()=>{setNarrow(query.matches);setMobileInspectorOpen(false);};query.addEventListener('change',change);return()=>query.removeEventListener('change',change);},[]);
  useEffect(()=>{const timeout=setTimeout(()=>{try{if(JSON.stringify(layout)===JSON.stringify(DEFAULT_LAYOUT))localStorage.removeItem(LAYOUT_KEY);else localStorage.setItem(LAYOUT_KEY,JSON.stringify(layout));}catch{}},120);return()=>clearTimeout(timeout);},[layout]);
  const [editingMaster,setEditingMaster]=useState(false),[masterComponent,setMasterComponent]=useState('text'),[masterActivation,setMasterActivation]=useState(0);
  const [selection,setSelection]=useState('background'),[locks,setLocks]=useState({}),[tool,setTool]=useState('select');
  const [zoom,setZoom]=useState(1),[pan,setPan]=useState({x:0,y:0}),[query,setQuery]=useState(''),[metrics,setMetrics]=useState({}),[ready,setReady]=useState(false),[playing,setPlaying]=useState(false),[hasPlayed,setHasPlayed]=useState(false),[time,setTime]=useState(1),[error,setError]=useState('');
  const [size,setSize]=useState({width:800,height:440}),[phoneSize,setPhoneSize]=useState({width:150,height:350}),[focusTarget,setFocusTarget]=useState(null);
  const viewport=useRef(null),library=useRef(null),phoneViewport=useRef(null),frame=useRef(null),mobile=useRef(null),drag=useRef(null),timelineDrag=useRef(null),timeRef=useRef(1),playingRef=useRef(false);
  const channels=useRef({main:`studio-${crypto.randomUUID()}`,mobile:`studio-mobile-${crypto.randomUUID()}`});
  const dimensions=device==='mobile'?[390,844]:[1920,1080];
  const duration=sceneDuration(scene), stage=getStage(sequence,scene), actor=getActor(scene,device),locked=selection==='actor'?!!actor.locked:!!locks[scene.id+selection];
  const setLocked=value=>{if(selection==='actor')update(project=>patchActor(project,scene.id,device,{locked:value}),'Canvas lock updated');else setLocks({...locks,[scene.id+selection]:value});};
  const scale=Math.max(.05,Math.min((size.width-48)/dimensions[0],(size.height-44)/dimensions[1]))*zoom;
  const mobileScale=Math.max(.02,Math.min((phoneSize.width-18)/390,(phoneSize.height-48)/844));
  const command=useCallback((command,extra={},both=true)=>{frame.current?.contentWindow?.postMessage({channel:channels.current.main,type:'studio-command',command,...extra},'*');if(both)mobile.current?.contentWindow?.postMessage({channel:channels.current.mobile,type:'studio-command',command,...extra},'*');},[]);
  const receive=useCallback(value=>{if(value.type==='loading'){setError('');setReady(false);}if(value.type==='metrics')setMetrics(value);if(value.type==='error'||value.type==='warning'){setError(value.message);if(value.type==='error')setReady(false);}if(value.type==='ready'){setReady(true);setPlaying(value.playing);playingRef.current=value.playing;mobile.current?.contentWindow?.postMessage({channel:channels.current.mobile,type:'studio-command',command:'seek',time:value.time},'*');}if(value.type==='time'){setTime(value.time);timeRef.current=value.time;playingRef.current=value.playing;setPlaying(value.playing);}},[]);
  const receiveMobile=useCallback(value=>{if(value.type==='error')setError(value.message);if(value.type==='ready'){const target=mobile.current?.contentWindow;target?.postMessage({channel:channels.current.mobile,type:'studio-command',command:'seek',time:timeRef.current},'*');if(playingRef.current)target?.postMessage({channel:channels.current.mobile,type:'studio-command',command:'play'},'*');}},[]);
  useEffect(()=>{const observer=new ResizeObserver(entries=>{for(const entry of entries){const size={width:entry.contentRect.width,height:entry.contentRect.height};if(entry.target===viewport.current)setSize(size);else setPhoneSize(size);}});if(viewport.current)observer.observe(viewport.current);if(phoneViewport.current)observer.observe(phoneViewport.current);return()=>observer.disconnect();},[phone]);
  useEffect(()=>{setTime(1);timeRef.current=1;setPlaying(false);playingRef.current=false;setHasPlayed(false);setMetrics({});drag.current=null;setPan({x:0,y:0});setError('');},[scene.id]);
  const seek=value=>{if(!ready)return;const next=clamp(value,0,duration);setTime(next);timeRef.current=next;setPlaying(false);playingRef.current=false;command('seek',{time:next});};
  const togglePlay=()=>{if(!ready)return;if(playing)command('pause');else {if(time>=duration)command('seek',{time:0});command('play');setHasPlayed(true);}playingRef.current=!playing;setPlaying(!playing);};
  const restartPreview=()=>{if(!ready)return;seek(0);command('play');playingRef.current=true;setPlaying(true);setHasPlayed(true);};
  const stopPreview=()=>{if(!ready)return;seek(0);stopAudio();setHasPlayed(false);};
  const patchScene=(key,value)=>update(project=>{project.scenes.components.sequence.scenes.find(row=>row.id===scene.id)[key]=value;});
  const changeSelection=value=>{setEditingMaster(false);setSelection(value);setTool('select');};
  function startDrag(event,kind='move',target=selection) {
    if(event.button!==0||!ready||editingMaster)return;
    if(tool==='hand'){drag.current={kind:'pan',x:event.clientX,y:event.clientY,pan};event.currentTarget.setPointerCapture(event.pointerId);return;}
    const targetLocked=target==='actor'?!!actor.locked:!!locks[scene.id+target];
    if(!['actor','text','background'].includes(target)||targetLocked||(target==='actor'&&!scene.character))return;
    event.preventDefault();event.stopPropagation();command('pause');setPlaying(false);
    drag.current={kind,target,x:event.clientX,y:event.clientY,actor:{...actor},stage:{...stage},rect:metrics[target],plate:metrics.plate||metrics.stage||{width:100,height:100},values:null};event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDrag(event){const value=drag.current;if(!value)return;if(value.kind==='pan'){setPan({x:value.pan.x+event.clientX-value.x,y:value.pan.y+event.clientY-value.y});return;}
    const dx=(event.clientX-value.x)/(dimensions[0]*scale)*100,dy=(event.clientY-value.y)/(dimensions[1]*scale)*100;
    const round=n=>snap?Math.round(n):number(n);
    if(value.target==='actor'){
      const actorDx=dx*100/value.plate.width,actorDy=dy*100/value.plate.height;
      value.values=value.kind==='resize'?{height:clamp(round(value.actor.height-actorDy),10,100)}:{x:clamp(round(value.actor.x+actorDx),0,100),y:clamp(round(value.actor.y+actorDy),0,100)};
      command('actor-preview',{values:{...value.actor,...value.values}},false);
    } else if(value.target==='text') {
      const box=value.rect||{x:4,y:4,width:40,height:15};
      const x=box.x+dx,y=box.y+dy,right=100-x-box.width,bottom=100-y-box.height;
      const horizontal=x<=right?'left':'right',vertical=y<=bottom?'top':'bottom';
      value.values={layout:'overlay',textPosition:vertical+'-'+horizontal,textInsetX:clamp(round(horizontal==='left'?x:right),0,40),textInsetY:clamp(round(vertical==='top'?y:bottom),0,40)};
      command('text-preview',{values:value.values},false);
    } else if(value.target==='background'){
      value.values={imageFocusX:clamp(round(value.stage.imageFocusX-dx),0,100),imageFocusY:clamp(round(value.stage.imageFocusY-dy),0,100)};command('background-preview',{values:value.values},false);
    }
  }
  function endDrag(){const value=drag.current;drag.current=null;if(value?.values)update(project=>value.target==='actor'?patchActor(project,scene.id,device,value.values):patchStage(project,scene.id,value.values),'Scene object transformed');}
  function cancelDrag(){drag.current=null;command('update',{payload:{...sceneFramePayload(p,scene.id,{},false),studio:{time:timeRef.current}}},false);}
  function keyDown(event){if(event.target.closest?.('button,a')&&!event.target.closest?.('.studio-viewport'))return;if(event.defaultPrevented||event.target.closest?.('.studio-inspector,.studio-layout-header,.studio-layout-inspector'))return;if(/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)||event.ctrlKey||event.metaKey||event.altKey)return;
    if(event.code==='Space'){event.preventDefault();togglePlay();return;}
    if(editingMaster)return;if(event.key==='v')setTool('select');if(event.key==='h')setTool('hand');if(event.key==='Escape'){drag.current=null;command('update',{payload:{...sceneFramePayload(p,scene.id,{},false),studio:{time:timeRef.current}}},false);}
    if(selection==='actor'&&!locked&&scene.character&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();const amount=event.shiftKey?5:1;update(project=>patchActor(project,scene.id,device,{x:clamp(actor.x+(event.key==='ArrowLeft'?-amount:event.key==='ArrowRight'?amount:0),0,100),y:clamp(actor.y+(event.key==='ArrowUp'?-amount:event.key==='ArrowDown'?amount:0),0,100)}),'Traveller nudged');}
  }
  const ordered=[...sequence.scenes].sort((a,b)=>(a.order||0)-(b.order||0));
  const fit=()=>{setZoom(1);setPan({x:0,y:0});};
  const resetInspectorPosition=movableInspector.reset;
  const resetLayout=useCallback(()=>{try{localStorage.removeItem(LAYOUT_KEY);}catch{}setLayout({...DEFAULT_LAYOUT});setMobileInspectorOpen(false);resetInspectorPosition();setZoom(1);setPan({x:0,y:0});setTool('select');},[resetInspectorPosition]);
  useEffect(()=>{
    const receive=event=>{
      const detail=event.detail;
      if(detail?.action==='reset'){resetLayout();setFocusTarget('editor');return;}
      if(detail?.action!=='focus'||!['editor','library','inspector'].includes(detail.panel))return;
      if(detail.panel==='inspector'){if(narrow)setMobileInspectorOpen(true);else setLayout(current=>({...current,inspectorVisible:true}));}
      setFocusTarget(detail.panel);
    };
    window.addEventListener('ashenedspire:studio-command',receive);
    return()=>window.removeEventListener('ashenedspire:studio-command',receive);
  },[narrow,resetLayout]);
  useEffect(()=>{
    if(!focusTarget||(focusTarget==='inspector'&&!inspectorOpen))return;
    const element=focusTarget==='inspector'?movableInspector.ref.current:focusTarget==='library'?library.current:viewport.current;
    element?.focus({preventScroll:true});setFocusTarget(null);
  },[focusTarget,inspectorOpen,movableInspector.ref]);
  const rect=metrics[selection];
  const tracks=[{id:'text',label:'Dialogue',icon:TextT,start:Math.min(duration,stage.textDelaySeconds||0),color:'violet',detail:scene.text||'No dialogue'},{id:'actor',label:'Traveller',icon:User,start:0,color:'blue',detail:scene.character?'Native actor':'Hidden',muted:!scene.character},{id:'background',label:'Background',icon:Image,start:0,color:'green',detail:scene.art||'none'},{id:'audio',label:'Audio cues',icon:SpeakerHigh,start:0,color:'gray',detail:`${scene.music||'keep'} / ${scene.stinger||'none'} · native cues`,muted:scene.music==='keep'&&scene.stinger==='none'}];
  return <div className={'scene-studio studio-layout '+(!inspectorOpen||floating?'inspector-undocked':'')} onKeyDown={keyDown} style={{'--timeline-height':timelineHeight+'px','--scene-rail-width':railWidth+'px','--scene-inspector-width':inspectorWidth+'px'}}>
    <div className="studio-documentbar"><label className="studio-workspace-switch"><select aria-label="Workspace" value="scenes" onChange={e=>ctx.switchWs(e.target.value)}>{WORKSPACES.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><button className="studio-document-title" title="Edit scene properties" onClick={()=>{setEditingMaster(false);setSelection('scene');}}>{String(ordered.findIndex(q=>q.id===scene.id)+1).padStart(2,'0')} / {scene.name}<i title="Browser draft"/></button><div className="studio-modes" role="tablist" aria-label="Scene modes">{['Compose','In game','Words & sound','JSON'].map(mode=><button key={mode} role="tab" aria-selected={mode==='Compose'} onClick={()=>ctx.setMode(mode)}>{mode}</button>)}</div><button onClick={saveDraft}>Save draft</button><button onClick={openNative} title="Review and save to a local checkout">Checkout…</button><IconButton icon={ArrowCounterClockwise} label="Reset studio layout" onClick={resetLayout}/><IconButton icon={User} label="Toggle inspector" active={inspectorOpen} onClick={()=>setInspectorOpen(!inspectorOpen)}/></div>
    <aside ref={library} tabIndex={-1} className="studio-scenes" aria-label="Scene library"><div className="studio-panel-head"><div className="studio-library-tabs" role="tablist" aria-label="Scene library scope"><button role="tab" aria-selected={!editingMaster} onClick={()=>setEditingMaster(false)}>Scenes</button><button role="tab" aria-selected={editingMaster} onClick={()=>{setEditingMaster(true);setInspectorOpen(true);}}>Master default</button></div>{!editingMaster&&<IconButton icon={Plus} label="Add scene" disabled={!ordered.some(row=>row.enabled===false)} onClick={()=>{let id;update(project=>{id=addScene(project);},'Scene slot enabled');if(id)choose(id);}}/>}</div>{editingMaster?<div className="studio-master-components" role="group" aria-label="Master scene components">{[['text','Text box',TextT],['background','Background',Image],['effects','Effects',GridFour],['playback','Playback & controls',Play]].map(([id,label,Icon])=><button key={id} aria-pressed={masterComponent===id} onClick={()=>{setMasterComponent(id);setMasterActivation(count=>count+1);setInspectorOpen(true);}}><Icon size={16}/><span>{label}</span></button>)}<p>Shared defaults for every scene.<br/>Preview: {scene.name}</p></div>:<><input aria-label="Find scene" placeholder="Find scene…" value={query} onChange={e=>setQuery(e.target.value)}/><div className="studio-scene-list">{ordered.filter(row=>(row.name+' '+row.id).toLowerCase().includes(query.toLowerCase())).map((row,index)=><button key={row.id} className={'studio-scene-item '+(row.id===scene.id?'selected':'')+(row.enabled===false?' disabled-scene':'')} onClick={()=>choose(row.id)}><span className="studio-scene-number">{String(index+1).padStart(2,'0')}</span>{sceneArtUrl(row,sequence.presentation?.previewClass)?<img src={sceneArtUrl(row,sequence.presentation?.previewClass)} alt=""/>:<span className="studio-empty-art">No art</span>}<span className="studio-scene-copy">{row.name}<small>{stamp(row.seconds||5)}{row.enabled===false?' · disabled':''}</small></span></button>)}</div><div className="studio-scene-actions"><IconButton icon={ArrowUp} label="Move scene earlier" disabled={ordered[0]?.id===scene.id} onClick={()=>update(project=>reorderScene(project,scene.id,-1))}/><IconButton icon={ArrowDown} label="Move scene later" disabled={ordered.at(-1)?.id===scene.id} onClick={()=>update(project=>reorderScene(project,scene.id,1))}/><span>{ordered.filter(row=>row.enabled!==false).length} active scenes</span></div></>}<WidthResize label="Resize scene library" value={railWidth} onChange={value=>preference('railWidth',value)} min={124} max={300} initial={DEFAULT_LAYOUT.railWidth}/></aside>
    <main className="studio-main" aria-label="Scene composition">
      <div className="studio-toolbar"><div className="studio-playback-controls" role="group" aria-label="Scene playback"><IconButton icon={ArrowCounterClockwise} label="Restart preview" disabled={!ready} onClick={restartPreview}/><IconButton icon={playing?Pause:Play} label={!ready?(error?'Preview unavailable':'Loading preview…'):playing?'Pause preview':hasPlayed&&time<duration?'Resume preview':'Play preview'} disabled={!ready} onClick={togglePlay}/><IconButton icon={Square} label="Stop preview" disabled={!ready} onClick={stopPreview}/></div><div className="studio-toolbar-divider"/><IconButton icon={Minus} label="Zoom out" onClick={()=>setZoom(z=>clamp(z-.25,.25,3))}/><span className="studio-zoom">{Math.round(scale*100)}%</span><IconButton icon={Plus} label="Zoom in" onClick={()=>setZoom(z=>clamp(z+.25,.25,3))}/><IconButton icon={ArrowsOut} label="Fit canvas" onClick={fit}/><div className="studio-toolbar-divider"/><IconButton icon={GridFour} label="Toggle grid" active={grid} onClick={()=>setGrid(!grid)}/><IconButton icon={Magnet} label="Snap to one percent" active={snap} onClick={()=>setSnap(!snap)}/><button aria-pressed={safe} onClick={()=>setSafe(!safe)}>Safe area</button><button className="studio-mobile-toggle" aria-pressed={phone} onClick={()=>setPhone(!phone)}>Mobile</button><span className="studio-toolbar-fill"/><IconButton icon={ArrowCounterClockwise} label="Undo draft change" disabled={!h.past.length} onClick={()=>setH(undo)}/><IconButton icon={ArrowClockwise} label="Redo draft change" disabled={!h.future.length} onClick={()=>setH(redo)}/><div className="studio-toolbar-divider"/><select aria-label="Canvas device" value={device} onChange={e=>{setDevice(e.target.value);fit();}}><option value="desktop">Desktop · 1920 × 1080</option><option value="mobile">Phone · 390 × 844</option></select></div>
      {(error||issue||conflict)?<div className="studio-alert" role="alert">{error||issue||(<>Another tab changed recovery. <button onClick={()=>ctx.setDialog('conflict')}>Resolve conflict</button></>)}</div>:null}
      <div className={'studio-composition '+(!phone?'no-phone':'')}>
        <div className="studio-tools"><IconButton icon={Cursor} label="Select tool (V)" active={tool==='select'} onClick={()=>setTool('select')}/><IconButton icon={Hand} label="Pan tool (H)" active={tool==='hand'} onClick={()=>setTool('hand')}/><div className="studio-tool-separator"/><IconButton icon={User} label="Select traveller" active={selection==='actor'} onClick={()=>changeSelection('actor')}/><IconButton icon={TextT} label="Select dialogue" active={selection==='text'} onClick={()=>changeSelection('text')}/><IconButton icon={Image} label="Select background" active={selection==='background'} onClick={()=>changeSelection('background')}/><IconButton icon={SpeakerHigh} label="Select audio cues" active={selection==='audio'} onClick={()=>changeSelection('audio')}/><div className="studio-tool-separator"/><IconButton icon={LockSimple} label="Lock selected object" active={locked} disabled={editingMaster} onClick={()=>setLocked(!locked)}/></div>
        <div ref={viewport} className={'studio-viewport '+(tool==='hand'?'pan-tool':'')} tabIndex={0} aria-label="Editing canvas. Select traveller, then use arrow keys to move." onPointerDown={e=>{if(e.target===e.currentTarget&&tool==='hand')startDrag(e);}} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={cancelDrag}>
          <div className="studio-ruler horizontal">{Array.from({length:13},(_,i)=><span key={i} style={{position:'absolute',left:(size.width+12-dimensions[0]*scale)/2+pan.x-18+i*dimensions[0]*scale/12}}>{Math.round(i*dimensions[0]/12)}</span>)}</div><div className="studio-ruler vertical">{Array.from({length:8},(_,i)=><span key={i} style={{position:'absolute',top:(size.height+12-dimensions[1]*scale)/2+pan.y-17+i*dimensions[1]*scale/7}}>{Math.round(i*dimensions[1]/7)}</span>)}</div>
          <div className="studio-artboard" style={{width:dimensions[0]*scale,height:dimensions[1]*scale,transform:`translate(${pan.x}px,${pan.y}px)`}}>
            <div className="studio-frame-transform" style={{width:dimensions[0],height:dimensions[1],transform:`scale(${scale})`}}><NativeStage project={p} scene={scene} dimensions={dimensions} channel={channels.current.main} frameRef={frame} onMessage={receive} timeRef={timeRef}/></div>
            <div className="studio-edit-overlay" onPointerDown={e=>{if(tool==='hand')startDrag(e);else {changeSelection('background');startDrag(e,'move','background');}}}>
              {grid?<div className="studio-grid" aria-hidden="true">{Array.from({length:19},(_,i)=><i key={i} style={{left:(i+1)*5+'%'}}/>)}{Array.from({length:19},(_,i)=><b key={i} style={{top:(i+1)*5+'%'}}/>)}</div>:null}
              {safe?<div className="studio-safe-area"><span>Action safe · 90%</span></div>:null}
              {['actor','text'].map(id=>metrics[id]&&(id!=='actor'||scene.character)?<button key={id} className="studio-hit-area" title={id==='actor'?'Select traveller':'Select dialogue'} aria-label={id==='actor'?'Traveller on canvas':'Dialogue on canvas'} style={{left:metrics[id].x+'%',top:metrics[id].y+'%',width:metrics[id].width+'%',height:metrics[id].height+'%'}} onPointerDown={e=>{e.stopPropagation();changeSelection(id);if(id==='actor'||id==='text')startDrag(e,'move',id);}}/>:null)}
              {rect&&['actor','text','background'].includes(selection)?<div className={'studio-selection '+selection+' '+(locked?'locked':'')} style={{left:rect.x+'%',top:rect.y+'%',width:rect.width+'%',height:rect.height+'%'}} onPointerDown={e=>startDrag(e)}><span>{selection==='actor'?'Traveller':selection==='text'?'Dialogue':'Background'}{locked?' · locked':''}</span>{selection==='actor'&&!locked?['n'].map(corner=><button key={corner} aria-label={'Resize traveller '+corner} className={'studio-handle '+corner} onPointerDown={e=>startDrag(e,'resize')}/>):null}</div>:null}
            </div>
            <span className="studio-artboard-label">{dimensions[0]} × {dimensions[1]} · Native renderer</span>
          </div>
        </div>
        {phone?<aside className="studio-phone" ref={phoneViewport}><div>Mobile preview <small>390 × 844</small></div><div className="studio-phone-frame" style={{width:390*mobileScale,height:844*mobileScale}}><div style={{width:390,height:844,transform:`scale(${mobileScale})`,transformOrigin:'top left'}}><NativeStage project={p} scene={scene} dimensions={[390,844]} channel={channels.current.mobile} frameRef={mobile} onMessage={receiveMobile} timeRef={timeRef}/></div></div><button onClick={()=>{setDevice(device==='mobile'?'desktop':'mobile');fit();}}>{device==='mobile'?'Edit desktop':'Edit mobile'}</button></aside>:null}
      </div>
      <div className="studio-timeline-resize" role="separator" aria-label="Resize timeline" aria-orientation="horizontal" tabIndex={0} aria-valuemin={140} aria-valuemax={320} aria-valuenow={timelineHeight} onDoubleClick={()=>setTimelineHeight(190)} onKeyDown={e=>{if(['ArrowUp','ArrowDown','Home'].includes(e.key)){e.preventDefault();e.stopPropagation();setTimelineHeight(v=>e.key==='Home'?190:clamp(v+(e.key==='ArrowUp'?1:-1)*(e.shiftKey?40:10),140,320));}}} onPointerDown={e=>{timelineDrag.current={y:e.clientY,height:timelineHeight};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(timelineDrag.current)setTimelineHeight(clamp(timelineDrag.current.height+timelineDrag.current.y-e.clientY,140,320));}} onPointerUp={()=>{timelineDrag.current=null;}} onPointerCancel={()=>{timelineDrag.current=null;}} onLostPointerCapture={()=>{timelineDrag.current=null;}}/>
      <section className="studio-timeline" aria-label="Scene timeline"><div className="studio-timeline-head"><strong>Timeline</strong><span>Native scene tracks</span><span className="studio-toolbar-fill"/><label>Duration <input aria-label="Timeline duration" disabled={editingMaster} type="number" min="1" max="180" step="0.1" value={duration} onChange={e=>{const n=Number(e.target.value);if(n>=1&&n<=180)patchScene('seconds',n);}}/>s</label></div><div className="studio-timeline-transport"><div><IconButton icon={SkipBack} label="Rewind scene" disabled={!ready} onClick={()=>seek(0)}/><IconButton icon={playing?Pause:Play} label={playing?'Pause timeline':'Play timeline'} disabled={!ready} onClick={togglePlay}/><output>{stamp(time)} / {stamp(duration)}</output></div><div className="studio-time-ruler">{Array.from({length:9},(_,i)=><span key={i}>{(duration*i/8).toFixed(1)}s</span>)}<input aria-label="Scene playhead" disabled={!ready} type="range" min="0" max={duration} step="0.01" value={Math.min(time,duration)} onChange={e=>seek(Number(e.target.value))}/></div></div><div className="studio-track-list">{tracks.map(track=><div className={'studio-track '+(selection===track.id?'selected':'')} key={track.id}><button className="studio-track-label" onClick={()=>changeSelection(track.id)}><track.icon size={13}/>{track.label}{track.muted?<EyeSlash size={12}/>:null}</button><div className="studio-track-lane" onClick={e=>{const box=e.currentTarget.getBoundingClientRect();seek((e.clientX-box.left)/box.width*duration);}}><button className={'studio-clip '+track.color+(track.muted?' muted':'')} style={{left:track.start/duration*100+'%',width:(1-track.start/duration)*100+'%'}} onClick={e=>{e.stopPropagation();changeSelection(track.id);}}>{track.detail}</button>{track.id==='text'?<input className="studio-delay" aria-label="Dialogue start time" disabled={editingMaster} title="Dialogue delay" type="range" min="0" max={Math.min(duration,20)} step=".1" value={Math.min(duration,20,stage.textDelaySeconds||0)} onChange={e=>update(project=>patchStage(project,scene.id,{textDelaySeconds:Number(e.target.value)}))}/>:null}<i className="studio-playhead" style={{left:Math.min(100,time/duration*100)+'%'}}/></div></div>)}</div><div className="studio-timeline-foot"><span>{playing?'Playing':'Paused'} · {scene.enabled===false?'Disabled scene inspection':'Selected scene'} · Space to play</span><button className="studio-audio-status" onClick={()=>changeSelection('audio')} title={audioError||audioStatus}>{audioError?'Audio unavailable':audioStatus.startsWith('Native scene audio audition')?'Audio audition started':'Native audio cues'}</button></div></section>
    </main>
    <aside ref={movableInspector.ref} tabIndex={-1} className={'studio-inspector-wrap studio-layout-inspector '+(inspectorOpen?'open':'closed')+(floating?' floating':' docked')+(movableInspector.dragging?' dragging':'')} style={floating?movableInspector.style:undefined} aria-label="Scene inspector" hidden={!inspectorOpen}>
      <div className={'studio-layout-header '+(floating?'movable':'')} {...(floating?movableInspector.dragHandleProps:{})} role="toolbar" tabIndex={floating?0:undefined} aria-label={floating?'Move scene inspector':'Scene inspector controls'}>
        <strong>Inspector</strong><span className="studio-toolbar-fill"/>
        {!narrow?<button onClick={()=>preference('inspectorFloating',!inspectorFloating)} title={floating?'Dock inspector to workspace':'Float inspector over workspace'}>{floating?'Dock':'Float'}</button>:null}
        {floating?<IconButton icon={ArrowCounterClockwise} label="Reset inspector position" onClick={()=>movableInspector.reset()}/>:null}
        <IconButton icon={X} label="Close scene inspector" onClick={()=>setInspectorOpen(false)}/>
      </div>
      <div className="studio-inspector-body">{editingMaster?<SceneDefaultsInspector ctx={ctx} component={masterComponent} activation={masterActivation}/>:<SceneStudioInspector ctx={ctx} selection={selection} setSelection={setSelection} device={device} setDevice={setDevice} locked={locked} setLocked={setLocked} audioTools={{status:audioStatus,error:audioError,audition:auditionAudio,stop:stopAudio}}/>}</div>
      {inspectorOpen&&!floating?<WidthResize label="Resize scene inspector" value={inspectorWidth} onChange={value=>preference('inspectorWidth',value)} min={220} max={420} initial={DEFAULT_LAYOUT.inspectorWidth} direction={-1}/>:null}
    </aside>
  </div>;
}
