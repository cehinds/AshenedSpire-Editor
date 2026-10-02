import {lazy, Suspense} from 'react';

// Native renderer sources are multi-megabyte; load them on first use so the editor shell paints first.
function deferred(load, name, label) {
  const Component = lazy(() => load().then(module => ({default: module[name]})));
  function Deferred(props) {
    return <Suspense fallback={<div className="native-loading" role="status">Loading {label}…</div>}><Component {...props}/></Suspense>;
  }
  Deferred.displayName = `Deferred(${name})`;
  return Deferred;
}

export const SceneStudio = deferred(() => import('./SceneStudio.jsx'), 'SceneStudio', 'scene studio');
export const GameCardPreview = deferred(() => import('./GameCardPreview.jsx'), 'GameCardPreview', 'native card renderer');
export const ScenePreview = deferred(() => import('./ScenePreview.jsx'), 'ScenePreview', 'native scene renderer');
export const InGamePreview = deferred(() => import('./InGamePreview.jsx'), 'InGamePreview', 'in-game preview');
