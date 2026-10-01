import {scriptJson} from './scene-playback.mjs';
import {captionPreviewScript, captionPreviewStyles} from './scene-caption-preview.mjs';

// Editor-only bridge extension for the pinned, vendored AshenSpire renderer.
// Keep the game bundle untouched. Fail closed when its mount implementation changes.
export function instrumentStudioRuntime(runtime) {
  const start = runtime.indexOf('function W2(');
  const end = runtime.indexOf('var qg=', start);
  if (start < 0 || end < 0) throw new Error('The bundled scene renderer does not support this studio bridge version.');
  let mount = runtime.slice(start, end);
  const replace = (source, target) => {
    if (mount.split(source).length !== 2) throw new Error('The bundled scene clock changed; studio seeking is unavailable.');
    mount = mount.replace(source, target);
  };
  // Native animations already run paused, driven by Y. Expose that same clock,
  // including the native delayed text/reveal callbacks, rather than imitating it.
  replace('(ee||Ga())&&(Y=Math.max(Y,xr))', 'Y=Math.max(0,Y)');
  // A studio viewport shows one selected scene. The game keeps the outgoing
  // plate for inter-scene transitions, but on responsive remounts its actor's
  // z-index can paint above the new background. Swap only after assets decode.
  replace('g.append(Pt);let xr=', 'g.replaceChildren(Pt);let xr=');
  replace('te=!1,v.disabled=!1,V=0}', 'te=!1,v.disabled=!1,V=0,e.__ashenStudio?.seek(Y/1e3)}');
  replace('Y+=V?Math.min(ie-V,250)*u.speed:0', 'Y=Math.min(Ci(d.scenes[ae]),Y+(V?Math.min(ie-V,250)*u.speed:0))');
  replace('u.autoAdvance&&!xe.waitForInput&&Y>=Ci(xe)&&X<U.length-1&&dr(X+1)', 'Y>=Ci(xe)&&(ee=!0,E.textContent=d.labels.resume)');
  replace('return m.addEventListener("change",lr)', `e.__ashenStudio={
    get time(){return Y/1e3},get duration(){return Ci(d.scenes[ae])/1e3},
    get playing(){return !ee&&!Ae},get ready(){return !te&&!Ae},get revision(){return K},
    seek(seconds){const value=Number(seconds);if(!Number.isFinite(value))return;
      Y=Math.max(0,Math.min(Ci(d.scenes[ae]),value*1e3));V=0;
      we.forEach(animation=>{animation.pause();animation.currentTime=Y});
      jr(Y);It&&It(Math.max(0,Y-Ce),Rt());},
    play(){if(Y>=Ci(d.scenes[ae]))this.seek(0);ee=!1;V=0;E.textContent=d.labels.pause},
    pause(){ee=!0;V=0;E.textContent=d.labels.resume},destroy:Kt
  };return m.addEventListener("change",lr)`);
  return runtime.slice(0, start) + mount + runtime.slice(end);
}

export function studioFrameDocument({runtime, styles, assets, payload, channel}) {
  const instrumented = instrumentStudioRuntime(runtime);
  const resolvedStyles = styles.replace(/url\(\s*(['"]?)([^'"\)]+)\1\s*\)/g, (full, quote, path) => {
    const key = path.replace(/^(\.\.\/)+/, '');
    return assets[key] ? `url("${assets[key]}")` : full;
  });
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${resolvedStyles.replace(/<\/style/gi, '<\\/style')}
html,body{margin:0!important;width:100%;height:100%;overflow:hidden;background:#100e0c}
#studio-host{width:100%;height:100%;pointer-events:none}
#studio-host .prologue-screen{height:100dvh;min-height:0;overflow:hidden}
#studio-host .prologue-bar,#studio-host .prologue-controls,#studio-host .prologue-progress{display:none!important}
#studio-host .prologue-layout-overlay{grid-template-rows:minmax(0,1fr);grid-template-columns:1fr}
#studio-host .prologue-layout-panelLeft,#studio-host .prologue-layout-panelRight{grid-template-rows:minmax(0,1fr)}
#studio-host .prologue-stage{min-height:0}
${captionPreviewStyles}
</style></head><body><div id="studio-host"></div><script>${instrumented.replace(/<\/script/gi, '<\\/script')}</script><script>
${captionPreviewScript()}
const channel=${scriptJson(channel)};
let payload=${scriptJson(payload)}, cleanup=null, clock=null, raf=0, ready=false, readyRevision=-1, lastTime=-1, lastPlaying=null, lastMetrics='', disposed=false, geometryObserver=null;
const host=document.getElementById('studio-host');
const send=value=>parent.postMessage({channel,...value},'*');
// Select the newest native plate so geometry and temporary edits always address
// the current render, including while an asynchronous remount is in progress.
const currentPlate=()=>[...host.querySelectorAll('.prologue-plate')].at(-1);
const normalizedRect=element=>{
  if(!element||element.hidden)return null;
  const rect=element.getBoundingClientRect();
  if(!rect.width||!rect.height)return null;
  return {x:rect.x/innerWidth*100,y:rect.y/innerHeight*100,width:rect.width/innerWidth*100,height:rect.height/innerHeight*100};
};
function metrics(force=false){
  const selected=payload.sequence.scenes.find(scene=>scene.id===payload.selectedId);
  const layers=(selected?.spriteLayers||[]).filter(layer=>layer.enabled);
  const plate=currentPlate();
  const value={type:'metrics',actor:normalizedRect(plate?.querySelector('.prologue-actor')),text:normalizedRect(host.querySelector('.prologue-caption')),background:normalizedRect(plate?.querySelector('.prologue-background')),stage:normalizedRect(host.querySelector('.prologue-stage')),plate:normalizedRect(plate),overlays:[...(plate?.querySelectorAll('.prologue-overlay')||[])].map((element,index)=>({id:layers[index]?.id||String(index),rect:normalizedRect(element)}))};
  const signature=JSON.stringify(value);
  if(force||signature!==lastMetrics){lastMetrics=signature;send(value);}
}
function state(type='time'){if(clock)send({type,time:clock.time,duration:clock.duration,playing:clock.playing});}
function tick(){
  if(disposed)return;
  if(clock?.ready){
    if(!ready||readyRevision!==clock.revision){
      ready=true;readyRevision=clock.revision;lastTime=-1;lastPlaying=null;state('ready');metrics(true);
      geometryObserver?.disconnect();
      if(typeof ResizeObserver!=='undefined'){
        geometryObserver=new ResizeObserver(()=>metrics());
        host.querySelectorAll('.prologue-caption,.prologue-stage,.prologue-actor').forEach(element=>geometryObserver.observe(element));
      }
    }
    if(Math.abs(clock.time-lastTime)>=.033||clock.playing!==lastPlaying){lastTime=clock.time;lastPlaying=clock.playing;state();metrics();}
  }
  raf=requestAnimationFrame(tick);
}
function mount(next){
  geometryObserver?.disconnect();geometryObserver=null;
  cleanup?.();clock=null;ready=false;lastTime=-1;lastMetrics='';
  payload=next;
  // Isolated editor view: a disabled draft can be inspected; authoring data is
  // unchanged and native enabled/sequence behavior remains in In game playback.
  const sequence=structuredClone(payload.sequence);
  const selected=sequence.scenes.find(scene=>scene.id===payload.selectedId);
  if(!selected)throw new Error('Selected scene is missing from the native sequence.');
  selected.enabled=true;
  sequence.presentation={...sequence.presentation,autoAdvance:false,advanceOnClick:false};
  Object.assign(AshenNative.ASSET_MAP,${scriptJson(assets)});
  const changes=AshenNative.prologuePresetOverrides(sequence);
  const settings={...payload.settings,...changes};
  const config=AshenNative.prologueConfig(settings);
  const startScene=config.scenes.findIndex(scene=>scene.id===payload.selectedId);
  if(startScene<0)throw new Error('Selected scene is unsupported by the native renderer.');
  const rows=AshenNative.prologueRows();
  const rejected=Object.entries(changes).filter(([key,value])=>{const row=rows.find(row=>row.key===key);return row&&!AshenNative.prologueValueIsValid(row,value)}).map(([key])=>key);
  if(rejected.length)send({type:'warning',message:'Native validation uses defaults for invalid values: '+rejected.join(', ')});
  const focus=HTMLElement.prototype.focus;
  try{
    HTMLElement.prototype.focus=function(){};
    cleanup=AshenNative.mountPrologue(host,{settings,run:payload.run,startScene,preview:true,onScene:index=>{applyCaptionPreview(host,payload.sequence,config.scenes[index]?.id);send({type:'scene',id:config.scenes[index]?.id,name:config.scenes[index]?.name});}});
  }finally{HTMLElement.prototype.focus=focus;}
  applyCaptionPreview(host,payload.sequence,payload.selectedId);
  clock=host.__ashenStudio;
  if(!clock)throw new Error('The native scene clock is unavailable.');
  clock.seek(payload.studio?.time??0);
  payload.playing?clock.play():clock.pause();
}
addEventListener('message',event=>{
  if(event.source!==parent||event.data?.channel!==channel||event.data?.type!=='studio-command'||disposed)return;
  try{
    const {command,time,payload:next,values}=event.data;
    if(command==='update'&&next){
      const retainedTime=next.selectedId===payload.selectedId?clock?.time??0:0;
      mount({...next,studio:{...next.studio,time:next.studio?.time??retainedTime}});return;
    }
    if(!clock)return;
    if(command==='seek'){clock.pause();clock.seek(time);}
    else if(command==='play')clock.play();
    else if(command==='pause')clock.pause();
    else if(command==='actor-preview'&&values){
      const actor=currentPlate()?.querySelector('.prologue-actor');
      const {x,y,height,rotation=0}=values;
      if(actor&&[x,y,height,rotation].every(Number.isFinite))Object.assign(actor.style,{left:x+'%',bottom:(100-y-height*.32)+'%',height:(height*1.32)+'%',transform:'translateX(-50%) rotate('+rotation+'deg)'});
    }
    else if(command==='text-preview'&&values){
      const screen=host.querySelector('.prologue-screen');
      if(values.layout==='overlay')for(const layout of ['caption','overlay','letterbox','panelLeft','panelRight'])screen?.classList.toggle('prologue-layout-'+layout,layout==='overlay');
      if(/^(top|middle|bottom)-(left|center|right)$/.test(values.textPosition||'')){
        const caption=host.querySelector('.prologue-caption');
        if(caption)caption.dataset.position=values.textPosition;
      }
      for(const [key,property] of Object.entries({textInsetX:'--prologue-inset-x',textInsetY:'--prologue-inset-y',textScale:'--prologue-text-scale'}))if(Number.isFinite(values[key]))screen?.style.setProperty(property,String(values[key]));
    }
    else if(command==='background-preview'&&values){
      const {imageFocusX,imageFocusY}=values;
      if([imageFocusX,imageFocusY].every(Number.isFinite))currentPlate()?.style.setProperty('--prologue-focus',Math.min(100,Math.max(0,imageFocusX))+'% '+Math.min(100,Math.max(0,imageFocusY))+'%');
    }
    else if(command!=='metrics')return;
    state();metrics(true);
  }catch(error){send({type:'error',message:error.message});}
});
addEventListener('resize',()=>metrics(true));
addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(raf);geometryObserver?.disconnect();cleanup?.();},{once:true});
try{mount(payload);tick();}catch(error){host.textContent='Studio preview could not start: '+error.message;send({type:'error',message:error.message});}
</script></body></html>`;
}
