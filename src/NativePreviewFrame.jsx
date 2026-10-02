import {useEffect, useMemo, useRef, useState} from 'react';
import runtime from './native/game-preview/runtime.js?raw';
import nativeCss from './native/game-preview/styles.css?raw';
import nativeLicense from './native/game-preview/LICENSE?raw';
import nativeCredits from './native/game-preview/CREDITS.md?raw';
import {nativeAssetPaths} from './native/game-preview/assets.js';
import {publicFrameUrl as publicUrl} from './paths.js';

const scriptSafe = value => value.replace(/<\/script/gi, '<\\/script');
const allAssets = () => true;
const noGlobals = Object.freeze({});

function frameDocument(boot, assetFilter, initialGlobals) {
  const url = path => new URL(publicUrl(path), window.location.href).href;
  const assets = Object.fromEntries(Object.entries(nativeAssetPaths).filter(([key]) => assetFilter(key)).map(([key,path]) => [key,url(path)]));
  const css = nativeCss.replace(/url\(\s*(['"]?)([^'"\)]+)\1\s*\)/g, (full,quote,path) => {
    const key = path.replace(/^(\.\.\/)+/, '');
    return nativeAssetPaths[key] ? `url("${url(nativeAssetPaths[key])}")` : full;
  });
  const bootstrap = `
    const channel = 'ashenedspire-native-preview';
    const send = data => parent.postMessage({channel,...data}, '*');
    addEventListener('keydown', event => {if(event.key === 'Escape') send({type:'escape'});});
    let handler, initializationError;
    try {
      if(typeof AshenNative === 'undefined') throw new Error(globalThis.__ASHEN_PREVIEW_INIT_ERROR__ || 'Native runtime failed to initialize. Check the current draft.');
      Object.assign(AshenNative.ASSET_MAP, ${JSON.stringify(assets)});
      handler = (${boot.toString()})(AshenNative, document.getElementById('app'), send);
    }
    catch(error) { initializationError = error.message;send({type:'error',message:error.message}); }
    let latestRevision = 0;
    addEventListener('message', async event => {
      if(event.source !== parent || event.data?.channel !== channel) return;
      if(event.data.type === 'ping') {send({type:'ready'});return;}
      if(event.data.type !== 'snapshot') return;
      const {snapshot,revision} = event.data;
      if(!Number.isSafeInteger(revision) || revision <= latestRevision) return;
      latestRevision = revision;
      try {
        const active = await handler;
        if(revision !== latestRevision) return;
        if(!active) throw new Error(initializationError || 'Native renderer did not initialize');
        await (typeof active === 'function' ? active(snapshot) : active.update(snapshot));
        if(revision === latestRevision) send({type:'applied',revision});
      } catch(error) {send({type:'error',revision,message:error.message});}
    });
    send({type:'ready'});
  `;
  const setup = `
    addEventListener('error', event => {globalThis.__ASHEN_PREVIEW_INIT_ERROR__ = event.message;parent.postMessage({channel:'ashenedspire-native-preview',type:'error',message:event.message || 'Native runtime error'},'*');});
    addEventListener('unhandledrejection', event => parent.postMessage({channel:'ashenedspire-native-preview',type:'error',message:String(event.reason?.message || event.reason)},'*'));
    Object.assign(globalThis,${JSON.stringify(initialGlobals)});
  `;
  const notices = JSON.stringify({ license: nativeLicense, credits: nativeCredits });
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css.replace(/<\/style/gi,'<\\/style')}\nhtml,body{margin:0;min-height:100%;}body{overflow:auto;}#app{min-height:100vh;}</style><script id="native-game-notices" type="application/json">${scriptSafe(notices)}</script></head><body><main id="app"></main><script>${scriptSafe(setup)}</script><script>${scriptSafe(runtime)}</script><script>${scriptSafe(bootstrap)}</script></body></html>`;
}

/** A script-only sandbox: renderer code has no editor DOM, storage or host access. */
export function NativePreviewFrame({title, boot, snapshot, height = 650, assetFilter = allAssets, onStatus, initialGlobals = noGlobals, toolbar, compactControls = false, bare = false, width = '100%'}) {
  const iframe = useRef(null);
  const container = useRef(null);
  const state = useRef({snapshot, revision: 0, ready: false, onStatus});
  const [status, setStatus] = useState({type:'loading'});
  const [fullScreenError,setFullScreenError] = useState('');
  const [expanded,setExpanded] = useState(false);
  state.current.snapshot = snapshot;
  state.current.onStatus = onStatus;
  const srcDoc = useMemo(() => frameDocument(boot,assetFilter,initialGlobals), [boot,assetFilter,initialGlobals]);
  const sendSnapshot = () => {
    if (!state.current.ready || !iframe.current?.contentWindow) return;
    const revision = ++state.current.revision;
    iframe.current.contentWindow.postMessage({channel:'ashenedspire-native-preview',type:'snapshot',revision,snapshot:state.current.snapshot}, '*');
  };
  useEffect(() => {
    state.current.ready = false;
    const receive = event => {
      if (event.source !== iframe.current?.contentWindow || event.data?.channel !== 'ashenedspire-native-preview') return;
      const next = event.data;
      if (next.type === 'escape') {
        setExpanded(false);setFullScreenError('');
        if (document.fullscreenElement === container.current) document.exitFullscreen().catch(() => {});
        return;
      }
      if (next.type === 'ready') {
        if(state.current.ready) return;
        state.current.ready = true;sendSnapshot();
      }
      if (next.type === 'applied' && next.revision !== state.current.revision) return;
      if(next.type === 'ready' || next.type === 'applied' || next.type === 'error') setStatus(next);
      state.current.onStatus?.(next);
    };
    window.addEventListener('message',receive);
    return () => window.removeEventListener('message',receive);
  }, [srcDoc]);
  useEffect(() => {sendSnapshot();}, [snapshot]);
  useEffect(() => {
    if (!expanded) return;
    const close = event => {
      if (event.key !== 'Escape') return;
      setExpanded(false);
      setFullScreenError('');
      if (document.fullscreenElement === container.current) document.exitFullscreen().catch(() => {});
    };
    const sync = () => {if (!document.fullscreenElement) setExpanded(false);};
    window.addEventListener('keydown',close);
    document.addEventListener('fullscreenchange',sync);
    return () => {window.removeEventListener('keydown',close);document.removeEventListener('fullscreenchange',sync);};
  }, [expanded]);
  const fullScreen = async () => {
    if (expanded) {
      setExpanded(false);
      setFullScreenError('');
      if (document.fullscreenElement === container.current) await document.exitFullscreen().catch(() => {});
      return;
    }
    setExpanded(true);
    try {
      setFullScreenError('');
      if(document.fullscreenElement === container.current) await document.exitFullscreen();
      else if(container.current?.requestFullscreen) await container.current.requestFullscreen();
    } catch {setFullScreenError('Browser fullscreen is unavailable. Expanded preview is open; press Esc to close.');}
  };
  if (bare) return <iframe ref={iframe} title={title} className="native-preview-frame" srcDoc={srcDoc} sandbox="allow-scripts" allow="gamepad" style={{width,height,border:0,display:'block',background:'#100f0d'}} onLoad={() => iframe.current?.contentWindow?.postMessage({channel:'ashenedspire-native-preview',type:'ping'},'*')}/>;
  return <div ref={container} className={'native-preview-frame-wrap'+(expanded?' native-preview-expanded':'')}>
    <div className="native-preview-screen-controls">{toolbar}<button className={compactControls ? 'native-preview-fullscreen-icon' : undefined} aria-label={expanded?'Exit full screen':'Full screen'} title={expanded?'Exit full screen (Esc)':'Full screen (Esc to exit)'} onClick={fullScreen}>{compactControls ? (expanded?'✕':'⛶') : expanded?'Exit full screen':'Full screen'}</button>{fullScreenError ? <span role="alert">{fullScreenError}</span> : !compactControls ? <span>Press Esc to leave full screen.</span> : null}</div>
    <iframe ref={iframe} title={title} className="native-preview-frame" srcDoc={srcDoc} sandbox="allow-scripts" allow="gamepad" allowFullScreen style={{width:'100%',height,border:'1px solid #43515a',borderRadius:6,background:'#100f0d'}} onLoad={() => iframe.current?.contentWindow?.postMessage({channel:'ashenedspire-native-preview',type:'ping'},'*')}/>
    <div className={status.type === 'error' ? 'notice error' : 'native-preview-status'} role="status">{status.type === 'error' ? `Native preview: ${status.message}` : status.type === 'applied' ? 'Draft applied to native renderer' : 'Loading native renderer…'}</div>
  </div>;
}
