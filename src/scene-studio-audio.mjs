import * as native from './native/scene-audio/runtime.js';
import {createSceneAudioController as createController} from './scene-audio-controller.mjs';

// Statically bound controller for Node contract tests and tooling. The editor
// loads the same runtime on first audition through scene-audio-browser.js.
export const createSceneAudioController = options => createController(native, options);

const audio = createSceneAudioController();
export const startSceneAudio = (scene, settings) => audio.start(scene, settings);
export const auditionSceneAudio = startSceneAudio;
export const stopSceneAudio = () => audio.stop();
export const getSceneAudioStatus = () => audio.status();
