import loadAudioRuntime from './native/scene-audio/runtime.js?native-text';
import {createSceneAudioController} from './scene-audio-controller.mjs';

// The vendored audio runtime is a self-contained ES module (~0.5 MB, mostly the
// native game config it bundles). It is fetched as a build asset on the first
// audition and evaluated from a Blob URL, so it never ships inside a chunk.
let pending = null;

export function loadSceneAudio() {
  pending ??= (async () => {
    const url = URL.createObjectURL(new Blob([await loadAudioRuntime()], {type: 'text/javascript'}));
    try { return createSceneAudioController(await import(/* @vite-ignore */ url)); }
    finally { URL.revokeObjectURL(url); }
  })().catch(error => { pending = null; throw error; });
  return pending;
}
