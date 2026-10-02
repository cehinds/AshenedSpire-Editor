import {useEffect, useRef, useState} from 'react';
import {getStage, patchPresentation} from './scene-studio-model.mjs';

const components = {text:'Text box',background:'Background',effects:'Effects',playback:'Playback & controls'};
const positions = Object.fromEntries(['top','middle','bottom'].flatMap(y=>['left','center','right'].map(x=>[`${y}-${x}`,`${y[0].toUpperCase()+y.slice(1)} ${x}`])));
const groupSections = {
  text:['box','placement','container','typography','labels','reveal'],
  background:['image','color'],
  effects:['transition','camera','tint'],
  playback:['playback','controls'],
};

export function SceneDefaultsInspector({ctx:{p,scene,update},component='text'}) {
  const sequence=p.scenes.components.sequence, stage=getStage(sequence);
  const [open,setOpen]=useState(()=>new Set(groupSections[component]||groupSections.text));
  const body=useRef(null);
  useEffect(()=>{
    setOpen(current=>new Set([...current,...(groupSections[component]||[])]));
    body.current?.querySelector(`[data-group="${component}"]`)?.scrollIntoView?.({block:'start',behavior:'smooth'});
  },[component]);
  const toggle=(id,value)=>setOpen(current=>{const next=new Set(current);value?next.add(id):next.delete(id);return next;});
  const patch=values=>update(project=>{if(!patchPresentation(project,values))throw new Error('Master setting is outside the supported scene contract.');},'Master scene defaults updated');
  const field=(label,key,min,max,step=1,unit='',integer=false)=><label className="si-field" key={key}><span>{label}</span><span className="si-number"><input type="number" aria-label={label} min={min} max={max} step={step} value={stage[key]??''} onChange={event=>{if(event.target.value==='')return;const value=Number(event.target.value);if(Number.isFinite(value)){const accepted=integer?Math.round(value):value;patch({[key]:Math.min(max,Math.max(min,accepted)),...(key==='captionHeightVh'?{captionFixedHeight:true}:{})});}}}/>{unit&&<small>{unit}</small>}</span></label>;
  const select=(label,key,options)=><label className="si-field" key={key}><span>{label}</span><select aria-label={label} value={stage[key]} onChange={event=>patch({[key]:event.target.value})}>{Object.entries(options).map(([value,text])=><option key={value} value={value}>{text}</option>)}</select></label>;
  const check=(label,key)=><label className="si-check" key={key}><input type="checkbox" aria-label={label} checked={!!stage[key]} onChange={event=>patch({[key]:event.target.checked})}/><span>{label}</span></label>;
  const color=(label,key)=><label className="si-field" key={key}><span>{label}</span><input type="color" aria-label={label} value={stage[key]||'#100e0c'} onChange={event=>patch({[key]:event.target.value})}/></label>;
  const section=(id,title,children)=><details className="si-section si-collapsible" key={id} open={open.has(id)} onToggle={event=>{if(event.currentTarget.open!==open.has(id))toggle(id,event.currentTarget.open);}}><summary><h3>{title}</h3></summary>{children}</details>;
  const group=(id,children)=><div className="si-group" data-group={id} key={id}><div className="si-group-head"><strong>{components[id]}</strong><span>
    <button type="button" onClick={()=>setOpen(current=>new Set([...current,...groupSections[id]]))}>Expand</button>
    <button type="button" onClick={()=>setOpen(current=>new Set([...current].filter(item=>!groupSections[id].includes(item))))}>Collapse</button>
  </span></div>{children}</div>;
  return <aside className="studio-inspector" aria-label="Master default inspector"><div className="si-body" ref={body}>
    <div className="si-identity"><div><strong>Master default</strong><span>{components[component]}</span></div><span className="si-draft">Shared</span></div>
    <p className="si-note">Applies to every scene. A scene’s explicit component overrides take precedence. Previewing {scene.name}.</p>
    <div className="si-group-head si-group-all"><span>All shared styles</span><span>
      <button type="button" onClick={()=>setOpen(new Set(Object.values(groupSections).flat()))}>Expand all</button>
      <button type="button" onClick={()=>setOpen(new Set())}>Collapse all</button>
    </span></div>
    {group('text',<>
      {section('box','Text box',<>
        {select('Layout','layout',{caption:'Caption below art',overlay:'Text over art',letterbox:'Letterbox',panelLeft:'Text panel left',panelRight:'Text panel right'})}
        {check('Fixed text-box height','captionFixedHeight')}
        {field('Text-box height','captionHeightVh',1,100,1,'vh')}
        {select('Vertical align','captionVerticalAlign',{auto:'Native default',top:'Top',middle:'Middle',bottom:'Bottom'})}
        <p className="si-note">Fixed height and vertical align are editor preview extensions retained in exports; the current game renderer uses automatic height. Vertical align shows when the box is taller than its text.</p>
      </>)}
      {section('placement','Placement',<>
        {select('Position','textPosition',positions)}
        <div className="si-pair">{field('Inset X','textInsetX',0,40,.5,'%')}{field('Inset Y','textInsetY',0,40,.5,'%')}</div>
        {select('Banner position','bannerPosition',{top:'Across the top',bottom:'Across the bottom'})}
        <p className="si-note">Position and insets place the text plate in Text over art.</p>
      </>)}
      {section('container','Container',<>
        {check('Text container','textBox')}{check('Container visible','textBoxVisible')}
        {color('Container color','textBoxColor')}{field('Container opacity','textBoxOpacity',0,1,.05)}
        {field('Box padding','boxPadding',0,6,.1,'rem')}{field('Corner radius','boxRadius',0,40,1,'px',true)}
        {field('Border width','boxBorderWidth',0,6,.5,'px')}{color('Border color','boxBorderColor')}
        {field('Backdrop blur','boxBlur',0,20,.5,'px')}{color('Letterbox color','letterboxColor')}
      </>)}
      {section('typography','Typography',<>
        {select('Align','textAlign',{left:'Left',center:'Center',right:'Right'})}
        {field('Text size','textScale',.6,2,.05,'×')}{field('Line length','textMaxWidth',30,120,1,'ch',true)}
        {field('Line height','lineHeight',1,2.4,.05)}{field('Letter spacing','letterSpacing',-.05,.4,.01,'em')}
        {select('Typeface','textFont',{body:'Body sans',display:'Display serif'})}
        {color('Narration color','dialogueColor')}
        {check('Text outline','textOutline')}{color('Outline color','textOutlineColor')}{field('Outline width','textOutlineWidth',0,8,.5,'px')}
      </>)}
      {section('labels','Title, speaker & location',<>
        {check('Scene title','titleVisible')}{color('Title color','titleColor')}{field('Title size','titleScale',.5,3,.05,'×')}
        {check('Speaker name','speakerVisible')}{color('Speaker color','speakerColor')}{field('Speaker size','speakerScale',.5,3,.05,'×')}
        {check('Location caption','locationVisible')}{color('Location color','locationColor')}
        {select('Scene counter','progressStyle',{numbers:'Numbers (3 / 5)',dots:'Dots',hidden:'Hidden'})}
      </>)}
      {section('reveal','Text reveal',<>
        {field('Delay','textDelaySeconds',0,20,.5,'s')}
        {select('Reveal','reveal',{none:'All at once',typewriter:'Letter by letter',lines:'Line by line'})}
        {stage.reveal!=='none'&&field('Reveal speed','revealSpeed',5,200,5,'',true)}
      </>)}
    </>)}
    {group('background',<>
      {section('image','Image transform',<>
        {select('Fit','imageFit',{cover:'Cover',contain:'Contain',fill:'Stretch'})}
        {field('Scale','imageScale',.5,3,.05,'×')}
        <div className="si-pair">{field('Focus X','imageFocusX',0,100,1,'%',true)}{field('Focus Y','imageFocusY',0,100,1,'%',true)}</div>
        {check('Mirror artwork','imageFlip')}
      </>)}
      {section('color','Image color',<>{field('Brightness','imageBrightness',.2,2,.05,'×')}{field('Contrast','imageContrast',.2,2,.05,'×')}{field('Saturation','imageSaturation',0,2,.05,'×')}{field('Blur','imageBlur',0,20,.5,'px')}{color('Backdrop','backdropColor')}<p className="si-note">Artwork remains individual to each scene.</p></>)}
    </>)}
    {group('effects',<>
      {section('transition','Transition',<>{field('Fade length','transitionSeconds',0,30,.1,'s')}{select('Easing','transitionEase',{'ease-in-out':'Ease in / out',linear:'Linear',ease:'Ease','ease-in':'Ease in','ease-out':'Ease out'})}</>)}
      {section('camera','Camera & atmosphere',<>{select('Motion','camera',{auto:'Follow transition',none:'Still',in:'Push in',out:'Pull out',left:'Drift left',right:'Drift right',up:'Drift up',down:'Drift down'})}{field('Amount','cameraAmount',0,20,.5,'%')}{select('Camera easing','cameraEase',{linear:'Linear','ease-in-out':'Ease in / out','ease-out':'Ease out','ease-in':'Ease in'})}{field('Color wash','wash',0,.4,.01)}{field('Vignette','vignette',0,1,.05)}</>)}
      {section('tint','Tint & shadow',<>{select('Artwork tint follows','tintSource',{accent:'Interface accent',character:'Character tint',custom:'Custom colour'})}{stage.tintSource==='custom'&&color('Custom tint','customTint')}{field('Character shadow','shadowStrength',0,1,.05)}</>)}
    </>)}
    {group('playback',<>
      {section('playback','Playback',<>{select('Show opening','playback',{every:'Every new game',once:'First time per profile',off:'Off'})}{field('Speed','speed',.25,3,.25,'×')}{check('Auto advance','autoAdvance')}{check('Reduce motion','reduceMotion')}</>)}
      {section('controls','In-game controls',<>{select('Controls position','controlsPosition',{bar:'Below scene',text:'Inside text box'})}{select('Controls align','controlsAlign',{left:'Left',center:'Center',right:'Right'})}{select('Controls size','controlsSize',{compact:'Compact',normal:'Normal',large:'Large'})}{check('Show pause','showPause')}{check('Show skip','showSkip')}{check('Advance on click','advanceOnClick')}<p className="si-note">Music, sound cues, duration and traveller placement remain individual to each scene.</p></>)}
    </>)}
    <footer className="si-footer"><code>sequence.presentation</code><span>Draft · explicit checkout save</span></footer>
  </div></aside>;
}
