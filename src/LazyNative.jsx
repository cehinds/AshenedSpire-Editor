import {Component, lazy, Suspense, useState} from 'react';
import {loadNativeSources, retryNativeSources} from './native-sources.js';

class LoadBoundary extends Component {
  state = {error: null};
  static getDerivedStateFromError(error) { return {error}; }
  render() {
    if (!this.state.error) return this.props.children;
    return <div className="notice error native-load-error" role="alert">
      <strong>The {this.props.label} could not be loaded.</strong>
      <p>{this.state.error.message || 'The renderer download failed.'} Your draft is unchanged. Some browsers cache a failed download; if Retry fails, reload the editor (the draft autosaves in this browser; undo history resets).</p>
      <div className="button-row">
        <button type="button" onClick={() => { this.setState({error: null}); this.props.onRetry(); }}>Retry</button>
        <button type="button" onClick={() => window.location.reload()}>Reload editor</button>
      </div>
    </div>;
  }
}

// Native renderer sources are multi-megabyte; load them on first use so the editor shell paints first.
// React.lazy caches a rejected import, so Retry builds a fresh lazy component.
function deferred(load, name, label, {quiet = false} = {}) {
  const make = () => lazy(() => load().then(module => ({default: module[name]})));
  let shared = make();
  function Deferred(props) {
    const [Loaded, setLoaded] = useState(() => shared);
    const retry = () => { retryNativeSources(); shared = make(); setLoaded(() => shared); };
    return <LoadBoundary label={label} onRetry={retry}>
      <Suspense fallback={quiet ? null : <div className="native-loading" role="status">Loading {label}…</div>}><Loaded {...props}/></Suspense>
    </LoadBoundary>;
  }
  Deferred.displayName = `Deferred(${name})`;
  return Deferred;
}

// Renderers start the native source download alongside their code; a failure
// surfaces through useNativeSources() inside the same boundary.
const withSources = load => () => { loadNativeSources().catch(() => {}); return load(); };

export const SceneStudio = deferred(withSources(() => import('./SceneStudio.jsx')), 'SceneStudio', 'scene studio');
export const GameCardPreview = deferred(withSources(() => import('./GameCardPreview.jsx')), 'GameCardPreview', 'native card renderer');
export const ScenePreview = deferred(withSources(() => import('./ScenePreview.jsx')), 'ScenePreview', 'native scene renderer');
export const InGamePreview = deferred(withSources(() => import('./InGamePreview.jsx')), 'InGamePreview', 'in-game preview');
export const BattlefieldStudio = deferred(withSources(() => import('./BattlefieldStudio.jsx')), 'BattlefieldStudio', 'battlefield renderer');
export const BattlefieldInspector = deferred(() => import('./BattlefieldStudio.jsx'), 'BattlefieldInspector', 'battlefield inspector');

// Rarely used editor tools download on first use instead of with the shell.
export const RepositoryWorkspace = deferred(() => import('./RepositoryWorkspace.jsx'), 'RepositoryWorkspace', 'repository tools');
export const GameSettings = deferred(() => import('./GameSettings.jsx'), 'GameSettings', 'game settings');
export const NativeDocumentBridge = deferred(() => import('./NativeDocumentBridge.jsx'), 'NativeDocumentBridge', 'native document tools', {quiet: true});
export const BookAtelier = deferred(() => import('./BookAtelier.jsx'), 'BookAtelier', 'Book Atelier');

export const FooterAtelier = deferred(() => import('./FooterAtelier.jsx'), 'FooterAtelier', 'Footer Atelier');
