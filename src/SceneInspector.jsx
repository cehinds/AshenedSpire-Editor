import {useState} from 'react';
import {NumberControl, TextField} from './Controls.jsx';
import nativeActors from './native/game-preview/scene-actors.json';

export function SceneInspector({ctx: {scene, update}}) {
  const [layout, setLayout] = useState('desktop');
  const defaults = nativeActors[scene.id]?.[layout] || {x: layout === 'mobile' ? 40 : 50, y: 96, height: 40};
  const actor = {...defaults, ...scene.actor?.[layout]};
  const patch = (key, value) => update(project => {
    project.scenes.components.sequence.scenes.find(item => item.id === scene.id)[key] = value;
  });
  const place = (key, value) => update(project => {
    const selected = project.scenes.components.sequence.scenes.find(item => item.id === scene.id);
    selected.actor ||= {};
    selected.actor[layout] = {...actor, [key]: value, positionMode: 'manual'};
  });
  return <>
    <h2>{scene.name}</h2><code>{scene.id}</code>
    <NumberControl label="Scene duration" value={scene.seconds ?? 5} min={.1} max={60} step={.1} unit="sec" onChange={value => patch('seconds', value)}/>
    <label className="check"><input type="checkbox" checked={scene.enabled !== false} onChange={event => patch('enabled', event.target.checked)}/>Enabled</label>
    <label className="check"><input type="checkbox" checked={!!scene.waitForInput} onChange={event => patch('waitForInput', event.target.checked)}/>Wait for input</label>
    <TextField label="Speaker" value={scene.speaker} onChange={value => patch('speaker', value)}/>
    <TextField label="Scene words" value={scene.text} onChange={value => patch('text', value)} multiline/>
    <h3>In-game traveller</h3>
    <label className="check"><input type="checkbox" checked={!!scene.character} onChange={event => patch('character', event.target.checked)}/>Show traveller</label>
    {scene.character ? <>
      <label className="field">Placement target<select value={layout} onChange={event => setLayout(event.target.value)}><option value="desktop">Desktop / tablet</option><option value="mobile">Phone</option></select></label>
      <NumberControl label="Traveller x" value={actor.x} min={0} max={100} unit="%" onChange={value => place('x', value)}/>
      <NumberControl label="Footline y" value={actor.y} min={0} max={100} unit="%" onChange={value => place('y', value)}/>
      <NumberControl label="Traveller height" value={actor.height} min={10} max={100} unit="%" onChange={value => place('height', value)}/>
      <small>Native staging: x and footline y are measured from the top-left. Height excludes the shadow. Play preview to see changes.</small>
    </> : <small>Enable the traveller to edit its in-game placement.</small>}
  </>;
}
