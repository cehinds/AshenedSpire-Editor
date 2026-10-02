import {useEffect, useMemo, useRef, useState} from 'react';
import {Notice} from './Controls.jsx';
import {publicFrameUrl as publicUrl} from './paths.js';
import {useNativeSources} from './native-sources.js';
import {nativeAssetPaths} from './native/game-preview/assets.js';
import {sceneFrameDocument, sceneFramePayload} from './scene-playback.mjs';
import './scene-preview.css';

let sceneAssetCache = null;
const sceneAssets = styles => sceneAssetCache ??= Object.entries(nativeAssetPaths).filter(([key]) => key.startsWith('assets/prologue/') || styles.includes(key));

export function ScenePreview({ctx: {p, scene}}) {
  const {runtime, styles} = useNativeSources();
  const sequence = p.scenes.components.sequence;
  const [device, setDevice] = useState('Desktop');
  const [boot, setBoot] = useState({playing: false, revision: 0});
  const [status, setStatus] = useState('Ready');
  const [playingScene, setPlayingScene] = useState(scene.name);
  const [problem, setProblem] = useState('');
  const [warning, setWarning] = useState('');
  const [preview, setPreview] = useState({name: 'Preview traveller', location: 'Preview location'});
  const frame = useRef(null);
  const channel = useRef(`ashenedspire-scene-${crypto.randomUUID()}`);
  const payload = JSON.stringify(sceneFramePayload(p, scene.id, preview, boot.playing));
  const [settled, setSettled] = useState(payload);
  useEffect(() => {
    const timeout = setTimeout(() => {setSettled(payload); setProblem(''); setWarning('');}, 200);
    return () => clearTimeout(timeout);
  }, [payload]);
  useEffect(() => {
    const receive = event => {
      if (event.source !== frame.current?.contentWindow || event.data?.channel !== channel.current) return;
      const value = event.data;
      if (value.type === 'scene') setPlayingScene(value.name);
      if (value.type === 'state') setStatus(value.state);
      if (value.type === 'finished') setStatus(value.reason === 'completed' ? 'Complete' : 'Stopped');
      if (value.type === 'error') {setProblem(value.message); setStatus('Unavailable');}
      if (value.type === 'warning') setWarning(value.message);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);
  const document = useMemo(() => sceneFrameDocument({runtime, styles, assets: Object.fromEntries(sceneAssets(styles).map(([key, path]) => [key, new URL(publicUrl(path), window.location.href).href])), payload: JSON.parse(settled), channel: channel.current}), [settled]);
  const enabled = sequence.scenes.some(item => item.enabled !== false);
  const launch = playing => {
    setProblem('');
    setWarning('');
    setStatus(playing ? 'Starting' : 'Ready');
    setSettled(JSON.stringify(sceneFramePayload(p, scene.id, preview, playing)));
    setBoot(value => ({playing, revision: value.revision + 1}));
  };
  return <div className="padded scene-preview">
    <div className="button-row scene-player-controls" role="group" aria-label="Scene playback controls">
      <button className="primary" disabled={!enabled} onClick={() => launch(true)}>Play preview</button>
      <button disabled={!enabled || !['Playing', 'Paused'].includes(status)} onClick={() => frame.current?.contentWindow?.postMessage({channel: channel.current, type: 'scene-command', command: status === 'Paused' ? 'resume' : 'pause'}, '*')}>{status === 'Paused' ? 'Resume' : 'Pause'}</button>
      <button disabled={!enabled} onClick={() => launch(true)}>Restart</button>
      <button disabled={!enabled || status === 'Ready'} onClick={() => launch(false)}>Stop</button>
      <label>Target <select value={device} onChange={event => setDevice(event.target.value)}>{['Desktop', 'Tablet', 'Phone'].map(value => <option key={value}>{value}</option>)}</select></label>
      <span className="pill">Native scene renderer</span>
    </div>
    <div className="scene-playback-status"><span role="status">{status} · {playingScene}</span><span>{sequence.presentation?.speed || 1}×</span></div>
    {problem ? <Notice tone="error">{problem}</Notice> : null}
    {warning ? <Notice tone="warning">{warning}</Notice> : null}
    {enabled ? <iframe key={boot.revision} ref={frame} className={'native-scene-frame ' + device.toLowerCase()} title="Playable AshenSpire scene preview" sandbox="allow-scripts" srcDoc={document}/> : <Notice>Enable a scene to play the preview.</Notice>}
    <details className="scene-preview-context"><summary>Preview identity · {sequence.classes?.[preview.classId || sequence.presentation?.previewClass]?.name || 'Traveller'}</summary><div className="form-grid">
      <label className="field">Preview class<select value={preview.classId || sequence.presentation?.previewClass || 'reaver'} onChange={event => setPreview(value => ({...value, classId: event.target.value}))}>{Object.entries(sequence.classes || {}).map(([id, value]) => <option value={id} key={id}>{value.name}</option>)}</select></label>
      <label className="field">Preview name<input value={preview.name} onChange={event => setPreview(value => ({...value, name: event.target.value}))}/></label>
      <label className="field">Preview location<input value={preview.location} onChange={event => setPreview(value => ({...value, location: event.target.value}))}/></label>
    </div><small>Sample identity for native text substitutions; does not change a saved game.</small></details>
    <Notice>Runs the bundled AshenSpire opening renderer with your draft. Use its Pause, Continue and Replay controls below the scene. Draft edits restart the selected scene after a short delay. Traveller controls edit native staging. Audio and the game host are disconnected.</Notice>
  </div>;
}
