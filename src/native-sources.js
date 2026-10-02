import {use} from 'react';
import loadRuntime from './native/game-preview/runtime.js?native-text';
import loadStyles from './native/game-preview/styles.css?native-text';

// The vendored native renderer (~2.7 MB) and its stylesheet (~0.6 MB) are text
// injected into sandboxed preview frames. They download once, on the first
// native preview, instead of being bundled into JavaScript chunks.
let loaded = null;
let pending = null;
let failed = false;

export function loadNativeSources() {
  if (loaded) return Promise.resolve(loaded);
  pending ??= Promise.all([loadRuntime(), loadStyles()]).then(
    ([runtime, styles]) => (loaded = {runtime, styles}),
    error => { failed = true; throw error; });
  return pending;
}

// A failed download stays failed (so error boundaries can show it) until a Retry asks again.
export function retryNativeSources() {
  if (failed) { failed = false; pending = null; }
}

/** Suspends until the native sources are available; failures reach the nearest error boundary. */
export function useNativeSources() {
  return loaded ?? use(loadNativeSources());
}
