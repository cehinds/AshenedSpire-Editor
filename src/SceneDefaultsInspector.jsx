import {getStage, patchPresentation} from './scene-studio-model.mjs';

const components = {text:'Text box',background:'Background',effects:'Effects',playback:'Playback & controls'};

export function SceneDefaultsInspector({ctx:{p,scene,update},component='text'}) {
  const sequence=p.scenes.components.sequence, stage=getStage(sequence);
  const patch=values=>update(project=>{if(!patchPresentation(project,values))throw new Error('Master setting is outside the supported scene contract.');},'Master scene defaults updated');
  const field=(label,key,min,max,step=1,unit='')=><label className="si-field" key={key}><span>{label}</span><span className="si-number"><input type="number" aria-label={label} min={min} max={max} step={step} value={stage[key]??''} onChange={event=>{if(event.target.value==='')return;const value=Number(event.target.value);if(Number.isFinite(value)){const accepted=['imageFocusX','imageFocusY','textMaxWidth'].includes(key)?Math.round(value):value;patch({[key]:Math.min(max,Math.max(min,accepted)),...(key==='captionHeightVh'?{captionFixedHeight:true}:{})});}}}/>{unit&&<small>{unit}</small>}</span></label>;
  const select=(label,key,options)=><label className="si-field" key={key}><span>{label}</span><select aria-label={label} value={stage[key]} onChange={event=>patch({[key]:event.target.value})}>{Object.entries(options).map(([value,text])=><option key={value} value={value}>{text}</option>)}</select></label>;
  const check=(label,key)=><label className="si-check" key={key}><input type="checkbox" aria-label={label} checked={!!stage[key]} onChange={event=>patch({[key]:event.target.checked})}/><span>{label}</span></label>;
  const color=(label,key)=><label className="si-field" key={key}><span>{label}</span><input type="color" aria-label={label} value={stage[key]||'#100e0c'} onChange={event=>patch({[key]:event.target.value})}/></label>;
  const section=(title,children)=><section className="si-section"><h3>{title}</h3>{children}</section>;
  return <aside className="studio-inspector" aria-label="Master default inspector"><div className="si-body">
    <div className="si-identity"><div><strong>Master default</strong><span>{components[component]}</span></div><span className="si-draft">Shared</span></div>
    <p className="si-note">Applies to every scene. A scene’s explicit component overrides take precedence. Previewing {scene.name}.</p>
    {component==='text'&&<>
      {section('Text box',<>
        {select('Layout','layout',{caption:'Caption below art',overlay:'Text over art',letterbox:'Letterbox',panelLeft:'Text panel left',panelRight:'Text panel right'})}
        {check('Fixed text-box height','captionFixedHeight')}
        {field('Text-box height','captionHeightVh',1,100,1,'vh')}
        <p className="si-note">Fixed height is an editor preview extension retained in exports; the current game renderer uses automatic height.</p>
        {check('Text container','textBox')}{check('Container background','textBoxVisible')}
        {color('Container color','textBoxColor')}{field('Container opacity','textBoxOpacity',0,1,.05)}
        {field('Box padding','boxPadding',0,6,.1,'rem')}
      </>)}
      {section('Typography',<>
        {select('Align','textAlign',{left:'Left',center:'Center',right:'Right'})}
        {field('Text size','textScale',.6,2,.05,'×')}{field('Line length','textMaxWidth',30,120,1,'ch')}
        {field('Line height','lineHeight',1,2.4,.05)}{select('Typeface','textFont',{body:'Body sans',display:'Display serif'})}
        {color('Narration color','dialogueColor')}
        {check('Scene title','titleVisible')}{check('Speaker name','speakerVisible')}{check('Location caption','locationVisible')}
      </>)}
    </>}
    {component==='background'&&<>
      {section('Image transform',<>
        {select('Fit','imageFit',{cover:'Cover',contain:'Contain',fill:'Stretch'})}
        {field('Scale','imageScale',.5,3,.05,'×')}
        {field('Focus X','imageFocusX',0,100,1,'%')}{field('Focus Y','imageFocusY',0,100,1,'%')}{check('Mirror artwork','imageFlip')}
      </>)}
      {section('Image color',<>{field('Brightness','imageBrightness',.2,2,.05,'×')}{field('Contrast','imageContrast',.2,2,.05,'×')}{field('Saturation','imageSaturation',0,2,.05,'×')}{field('Blur','imageBlur',0,20,.5,'px')}{color('Backdrop','backdropColor')}</>)}
      <p className="si-note">Artwork remains individual to each scene.</p>
    </>}
    {component==='effects'&&<>
      {section('Transition',<>{field('Fade length','transitionSeconds',0,30,.1,'s')}{select('Easing','transitionEase',{'ease-in-out':'Ease in / out',linear:'Linear',ease:'Ease','ease-in':'Ease in','ease-out':'Ease out'})}</>)}
      {section('Camera & atmosphere',<>{select('Motion','camera',{auto:'Follow transition',none:'Still',in:'Push in',out:'Pull out',left:'Drift left',right:'Drift right',up:'Drift up',down:'Drift down'})}{field('Amount','cameraAmount',0,20,.5,'%')}{field('Color wash','wash',0,.4,.01)}{field('Vignette','vignette',0,1,.05)}</>)}
    </>}
    {component==='playback'&&<>
      {section('Playback',<>{field('Speed','speed',.25,3,.25,'×')}{check('Auto advance','autoAdvance')}{check('Reduce motion','reduceMotion')}</>)}
      {section('In-game controls',<>{select('Controls position','controlsPosition',{bar:'Below scene',text:'Inside text box'})}{select('Controls align','controlsAlign',{left:'Left',center:'Center',right:'Right'})}{select('Controls size','controlsSize',{compact:'Compact',normal:'Normal',large:'Large'})}{check('Show pause','showPause')}{check('Show skip','showSkip')}{check('Advance on click','advanceOnClick')}</>)}
      <p className="si-note">Music, sound cues, duration and traveller placement remain individual to each scene.</p>
    </>}
    <footer className="si-footer"><code>sequence.presentation</code><span>Draft · explicit checkout save</span></footer>
  </div></aside>;
}
