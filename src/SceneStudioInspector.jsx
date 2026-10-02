import {useId, useState} from 'react';
import {CaretRight} from '@phosphor-icons/react/dist/csr/CaretRight';
import {ImageSquare} from '@phosphor-icons/react/dist/csr/ImageSquare';
import {MusicNotes} from '@phosphor-icons/react/dist/csr/MusicNotes';
import {TextT} from '@phosphor-icons/react/dist/csr/TextT';
import {UserCircle} from '@phosphor-icons/react/dist/csr/UserCircle';
import {FilmStrip} from '@phosphor-icons/react/dist/csr/FilmStrip';
import {ImageBroken} from '@phosphor-icons/react/dist/csr/ImageBroken';
import {getActor, patchActor, getStage, patchStage, sceneArtOptions} from './scene-studio-model.mjs';
import './scene-studio-inspector.css';

const selections = {scene: 'Scene', actor: 'Traveller', text: 'Narration', background: 'Background', audio: 'Audio cues'};
const layouts = {caption: 'Caption below art', overlay: 'Text over art', letterbox: 'Letterbox', panelLeft: 'Text panel left', panelRight: 'Text panel right'};
const effects = {fade: 'Crossfade', dip: 'Fade through black', push: 'Slow push', ash: 'Ash reveal', still: 'Still'};
const music = {keep: 'Keep playing', quiet: 'Silence', title: 'Title', map: 'The road', rest: 'Shrine', shop: 'Merchant', combat: 'Combat', elite: 'Elite', boss: 'Boss', victory: 'Victory'};
const stingers = {none: 'None', beat: 'Low beat', stagger: 'Stagger', relic: 'Relic', shrine: 'Shrine', nodeTravel: 'Footfall', enemyDeath: 'Fall', victory: 'Victory'};
const positions = Object.fromEntries(['top', 'middle', 'bottom'].flatMap(y => ['left', 'center', 'right'].map(x => [`${y}-${x}`, `${y} ${x}`])));

function Field({label, value, onChange, multiline = false, maxLength = 160}) {
  return <label className="si-field si-field-stacked"><span>{label}</span>{multiline ? <textarea rows={4} maxLength={maxLength} value={value ?? ''} onChange={event => onChange(event.target.value)}/> : <input maxLength={maxLength} value={value ?? ''} onChange={event => onChange(event.target.value)}/>}</label>;
}

function NumberField({label, value, onChange, min, max, step = 1, unit = '', integer = false}) {
  return <label className="si-field"><span>{label}</span><span className="si-number"><input type="number" aria-label={label} value={Number.isFinite(value) ? Number(value.toFixed(3)) : ''} min={min} max={max} step={step} onChange={event => {
    if (event.target.value === '') return;
    const next = Number(event.target.value);
    if (Number.isFinite(next)) onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, integer ? Math.round(next) : next)));
  }}/>{unit && <small>{unit}</small>}</span></label>;
}

function Select({label, value, options, onChange}) {
  return <label className="si-field"><span>{label}</span><select value={value ?? ''} onChange={event => onChange(event.target.value)}>{Object.entries(options).map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label>;
}

function Check({label, value, onChange}) {
  return <label className="si-check"><input type="checkbox" checked={!!value} onChange={event => onChange(event.target.checked)}/><span>{label}</span></label>;
}

function Section({title, children, detail}) {
  return <section className="si-section"><h3>{title}{detail && <small>{detail}</small>}</h3>{children}</section>;
}

export function SceneStudioInspector({ctx: {p, scene, update}, selection = 'scene', setSelection, device = 'desktop', setDevice, locked = false, setLocked, audioTools}) {
  const [tab, setTab] = useState('Inspector');
  const tabId = useId();
  const sequence = p.scenes.components.sequence;
  const actor = getActor(scene, device);
  const stage = getStage(sequence, scene);
  const artOptions = sceneArtOptions(sequence.presentation?.previewClass, device);
  const ObjectIcon = {scene: FilmStrip, actor: UserCircle, text: TextT, background: ImageSquare, audio: MusicNotes}[selection] || FilmStrip;
  const patch = (key, value) => update(project => {
    const selected = project.scenes.components.sequence.scenes.find(item => item.id === scene.id);
    if (selected) selected[key] = value;
  });
  const stagePatch = (key, value) => update(project => patchStage(project, scene.id, {[key]: value}));
  const actorPatch = (key, value) => update(project => patchActor(project, scene.id, device, {[key]: value}));
  const number = (label, key, min, max, step = 1, unit = '') => <NumberField key={key} label={label} value={stage[key]} min={min} max={max} step={step} unit={unit} integer={['revealSpeed', 'textMaxWidth'].includes(key)} onChange={value => stagePatch(key, value)}/>;
  const select = (label, key, options) => <Select label={label} value={stage[key]} options={options} onChange={value => stagePatch(key, value)}/>;
  const check = (label, key) => <Check label={label} value={stage[key]} onChange={value => stagePatch(key, value)}/>;
  const color = (label, key) => <label className="si-field"><span>{label}</span><span className="si-color"><input type="color" aria-label={label} value={stage[key] || '#100e0c'} onChange={event => stagePatch(key, event.target.value)}/><code>{stage[key] || '#100e0c'}</code></span></label>;

  const assets = <Section title="Background artwork" detail={`${artOptions.length} native plates`}>
    <div className="si-art-grid">{artOptions.map(art => <button key={art.id} title={art.label} aria-label={`Use ${art.label} artwork`} aria-pressed={(scene.art || scene.id) === art.id} onClick={() => patch('art', art.id)}>
      {art.src ? <img src={art.src} alt=""/> : <span className="si-art-empty"><ImageBroken size={22} aria-hidden="true"/></span>}<span>{art.label}</span>
    </button>)}</div>
    <p className="si-note">Bundled AshenSpire artwork. Changes apply to this scene.</p>
  </Section>;

  const staging = <div className="si-staging"><span className={scene.ownStaging ? 'si-overridden' : ''}>{scene.ownStaging ? 'Scene staging overrides' : 'Inherited sequence staging'}</span>{scene.ownStaging && <button title="Use sequence staging again; keeps the scene’s stored values" onClick={() => patch('ownStaging', false)}>Reset to shared</button>}</div>;

  const actorControls = <>
    <Section title="Transform" detail={device === 'mobile' ? 'Phone' : 'Desktop / tablet'}>
      <Check label="Show traveller" value={scene.character} onChange={value => patch('character', value)}/>
      <div className="si-pair">
        <NumberField label="X" value={actor.x} min={0} max={100} unit="%" onChange={value => actorPatch('x', value)}/>
        <NumberField label="Foot Y" value={actor.y} min={0} max={100} unit="%" onChange={value => actorPatch('y', value)}/>
        <NumberField label="Height" value={actor.height} min={10} max={100} unit="%" onChange={value => actorPatch('height', value)}/>
        <NumberField label="Rotation" value={actor.rotation ?? 0} min={-180} max={180} unit="°" onChange={value => actorPatch('rotation', value)}/>
      </div>
      <Select label="Layer" value={actor.layer || 'behindWash'} options={{behindWash: 'Behind color wash', front: 'In front of wash'}} onChange={value => actorPatch('layer', value)}/>
      <Check label="Lock canvas editing" value={locked} onChange={value => setLocked?.(value)}/>
      <button className="si-wide-button" onClick={() => update(project => patchActor(project, scene.id, device, {...getActor({id: scene.id}, device), positionMode: 'auto'}))}>Reset native placement</button>
    </Section>
    <Section title="Responsive placement">
      <div className="si-segment" role="group" aria-label="Traveller placement profile">{[['desktop', 'Desktop / tablet'], ['mobile', 'Phone']].map(([id, label]) => <button key={id} aria-pressed={device === id} onClick={() => setDevice?.(id)}>{label}</button>)}</div>
      <p className="si-note">Independent native positions. X is the center; Y is the footline. Height preserves the sprite proportions.</p>
      <button className="si-wide-button" onClick={() => update(project => patchActor(project, scene.id, device === 'mobile' ? 'desktop' : 'mobile', {...actor, positionMode: 'manual'}))}>Copy placement to {device === 'mobile' ? 'desktop' : 'phone'}</button>
    </Section>
  </>;

  const backgroundControls = <>
    <Section title="Image transform">
      {select('Fit', 'imageFit', {cover: 'Cover', contain: 'Contain', fill: 'Stretch'})}
      <div className="si-pair">{number('Focus X', 'imageFocusX', 0, 100, 1, '%')}{number('Focus Y', 'imageFocusY', 0, 100, 1, '%')}</div>
      {number('Scale', 'imageScale', .5, 3, .05, '×')}
      {check('Mirror artwork', 'imageFlip')}
      {staging}
    </Section>
    {assets}
    <Section title="Image color">
      {number('Brightness', 'imageBrightness', .2, 2, .05, '×')}
      {number('Contrast', 'imageContrast', .2, 2, .05, '×')}
      {number('Saturation', 'imageSaturation', 0, 2, .05, '×')}
      {number('Blur', 'imageBlur', 0, 20, .5, 'px')}
      {color('Backdrop', 'backdropColor')}
    </Section>
  </>;

  const textControls = <>
    <Section title="Scene words">
      <Field label="Speaker" value={scene.speaker} onChange={value => patch('speaker', value)}/>
      <Field label="Narration" multiline maxLength={5000} value={scene.text} onChange={value => patch('text', value)}/>
      {Object.hasOwn(scene, 'location') && <Field label="Location" value={scene.location} onChange={value => patch('location', value)}/>}
      <p className="si-note">Tokens: {'{name} · {class} · {classLine} · {location}'}</p>
    </Section>
    <Section title="Text layout">
      {select('Layout', 'layout', layouts)}
      {check('Fixed text-box height', 'captionFixedHeight')}
      {number('Text-box height', 'captionHeightVh', 1, 100, 1, 'vh')}
      {select('Vertical align', 'captionVerticalAlign', {auto: 'Native default', top: 'Top', middle: 'Middle', bottom: 'Bottom'})}
      {select('Position', 'textPosition', positions)}
      {select('Align', 'textAlign', {left: 'Left', center: 'Center', right: 'Right'})}
      <div className="si-pair">{number('Inset X', 'textInsetX', 0, 40, 1, '%')}{number('Inset Y', 'textInsetY', 0, 40, 1, '%')}</div>
      {number('Text size', 'textScale', .6, 2, .05, '×')}
      {number('Line length', 'textMaxWidth', 30, 120, 1, 'ch')}
      {select('Typeface', 'textFont', {body: 'Body sans', display: 'Display serif'})}
      {staging}
    </Section>
    <Section title="Visibility">
      {check('Scene title', 'titleVisible')}{check('Speaker name', 'speakerVisible')}{check('Location caption', 'locationVisible')}
      {check('Text container', 'textBox')}{check('Container visible', 'textBoxVisible')}
      {color('Narration color', 'dialogueColor')}
      {color('Container color', 'textBoxColor')}
      {number('Container opacity', 'textBoxOpacity', 0, 1, .05)}
    </Section>
    <Section title="Text reveal">
      {number('Delay', 'textDelaySeconds', 0, 20, .5, 's')}
      {select('Reveal', 'reveal', {none: 'All at once', typewriter: 'Letter by letter', lines: 'Line by line'})}
      {stage.reveal !== 'none' && number('Reveal speed', 'revealSpeed', 5, 200, 5)}
      {stage.reveal !== 'none' && <p className="si-note">{stage.reveal === 'lines' ? 'Lines per ten seconds.' : 'Characters per second.'} Reduced motion shows all text.</p>}
    </Section>
  </>;

  const audioControls = <Section title="Native audio cues">
    <Select label="Music" value={scene.music || 'keep'} options={music} onChange={value => patch('music', value)}/>
    <Select label="Opening sound" value={scene.stinger || 'none'} options={stingers} onChange={value => patch('stinger', value)}/>
    {audioTools ? <>
      <div className="si-audio-actions"><button className="si-wide-button" onClick={() => audioTools.audition()}>Audition native cues</button><button className="si-wide-button" onClick={() => audioTools.stop()}>Stop audio</button></div>
      <p className="si-audio-status" role="status" aria-live="polite">{audioTools.error || audioTools.status || 'Ready to audition'}</p>
      <p className="si-note">Native procedural music and SFX. Audition restarts cues; music does not seek with the animation timeline.</p>
    </> : <div className="si-adapter-note"><strong>Audio host disconnected</strong><p>These identifiers are saved in the native scene document. The editor preview does not play music or sound cues.</p></div>}
  </Section>;

  const effectControls = <>
    <Section title="Transition">
      <Select label="Effect" value={scene.effect || 'fade'} options={effects} onChange={value => patch('effect', value)}/>
      {number('Fade length', 'transitionSeconds', 0, 30, .1, 's')}
      {select('Easing', 'transitionEase', {'ease-in-out': 'Ease in / out', linear: 'Linear', ease: 'Ease', 'ease-in': 'Ease in', 'ease-out': 'Ease out'})}
      <p className="si-note">Native fades are capped at one quarter of the scene duration.</p>
    </Section>
    <Section title="Camera movement">
      {select('Motion', 'camera', {auto: 'Follow transition', none: 'Still', in: 'Push in', out: 'Pull out', left: 'Drift left', right: 'Drift right', up: 'Drift up', down: 'Drift down'})}
      {number('Amount', 'cameraAmount', 0, 20, .5, '%')}
      {select('Easing', 'cameraEase', {linear: 'Linear', 'ease-in-out': 'Ease in / out', 'ease-out': 'Ease out', 'ease-in': 'Ease in'})}
    </Section>
    <Section title="Atmosphere">
      {number('Color wash', 'wash', 0, .4, .01)}
      {number('Vignette', 'vignette', 0, 1, .05)}
      {number('Blur', 'imageBlur', 0, 20, .5, 'px')}
      {staging}
    </Section>
  </>;

  return <aside className="studio-inspector" aria-label="Scene object inspector">
    <div className="si-tabs" role="tablist" aria-label="Scene properties">{['Inspector', 'Assets', 'Effects'].map(name => <button key={name} id={`${tabId}-${name}`} role="tab" aria-selected={tab === name} aria-controls={`${tabId}-panel`} tabIndex={tab === name ? 0 : -1} onClick={() => setTab(name)} onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const names = ['Inspector', 'Assets', 'Effects'];
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (names.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
      setTab(names[index]);
      event.currentTarget.parentElement.children[index].focus();
    }}>{name}</button>)}</div>
    <div className="si-body" role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`}>
      <div className="si-identity"><span className="si-object-icon" aria-hidden="true"><ObjectIcon size={22} weight="duotone"/></span><div><strong>{selections[selection] || 'Scene'}</strong><span>{scene.name}</span></div><span className="si-draft">Draft</span></div>
      {tab === 'Inspector' && <>
        <div className="si-select-object"><Select label="Selection" value={selection} options={selections} onChange={value => setSelection?.(value)}/></div>
        {selection === 'actor' && actorControls}
        {selection === 'background' && backgroundControls}
        {selection === 'text' && textControls}
        {selection === 'audio' && audioControls}
        {selection === 'scene' && <>
          <Section title="Scene">
            <Field label="Name" value={scene.name} onChange={value => patch('name', value)}/>
            <NumberField label="Duration" value={scene.seconds ?? 5} min={1} max={180} step={.1} unit="s" onChange={value => patch('seconds', value)}/>
            <Check label="Enabled in sequence" value={scene.enabled !== false} onChange={value => patch('enabled', value)}/>
            <Check label="Wait for Continue" value={scene.waitForInput} onChange={value => patch('waitForInput', value)}/>
            <Check label="Show title banner" value={scene.banner} onChange={value => patch('banner', value)}/>
            {select('Layout', 'layout', layouts)}
            {staging}
          </Section>
          {assets}
          <Section title="Objects"><div className="si-object-links">{['actor', 'text', 'audio'].map(key => <button key={key} onClick={() => setSelection?.(key)}>{selections[key]}<CaretRight size={13} aria-hidden="true"/></button>)}</div></Section>
        </>}
      </>}
      {tab === 'Assets' && <>{assets}<Section title="Traveller source"><Select label="Preview class" value={sequence.presentation.previewClass || 'reaver'} options={Object.fromEntries(Object.entries(sequence.classes || {}).map(([id, item]) => [id, item.name]))} onChange={value => update(project => {project.scenes.components.sequence.presentation.previewClass = value;})}/><p className="si-note">The game uses the player's selected class. This changes the native editor preview identity.</p><button className="si-wide-button" onClick={() => {setSelection?.('actor'); setTab('Inspector');}}>Edit traveller placement</button></Section></>}
      {tab === 'Effects' && effectControls}
      <footer className="si-footer"><code>{scene.id}</code><span>Draft edits · explicit checkout save</span></footer>
    </div>
  </aside>;
}
