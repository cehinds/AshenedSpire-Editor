import {nativeAssetPaths} from './native/game-preview/assets.js';
import {publicUrl} from './paths.js';

const musicChoices = new Set(['keep', 'quiet', 'title', 'map', 'rest', 'shop', 'combat', 'elite', 'boss', 'victory']);
const stingerChoices = new Set(['none', 'beat', 'stagger', 'relic', 'shrine', 'nodeTravel', 'enemyDeath', 'victory']);

function nativeSettings(settings, AUDIO_DEFAULTS) {
  const values = Object.fromEntries(Object.entries(settings || {}).map(([key, value]) => [key.replace(/^settings\./, ''), value]));
  return {
    studioProceduralOnly: true,
    musicVolume: values.musicVolume ?? AUDIO_DEFAULTS.musicVolume,
    sfxVolume: values.sfxVolume ?? AUDIO_DEFAULTS.sfxVolume,
    musicEnabled: values.musicEnabled ?? (values.muteMusic !== undefined ? !values.muteMusic : AUDIO_DEFAULTS.musicEnabled !== false),
    muteAudio: values.muteAudio === true,
  };
}

function requireGesture() {
  if (typeof window === 'undefined') throw new Error('Scene audio requires a browser.');
  if (globalThis.navigator?.userActivation?.isActive === false) throw new Error('Press Audition audio to allow browser sound.');
}

// `native` is the vendored scene-audio runtime module ({initAudio, AUDIO_DEFAULTS, ASSET_MAP}).
// The browser loads it on first audition (scene-audio-browser.js); Node tests import it directly.
// Injection is for contract tests; production uses exactly one native engine.
export function createSceneAudioController(native, {createEngine = native.initAudio, assertGesture = requireGesture, prepareAssets = () => {
  for (const [key, path] of Object.entries(nativeAssetPaths)) if (/\.(ogg|mp3|wav)$/i.test(key)) native.ASSET_MAP[key] = publicUrl(path);
}, unlockTimeoutMs = 2500} = {}) {
  let engine = null;
  let revision = 0;
  let status = {state: 'stopped', message: 'Native audio stopped.'};

  const silence = () => {
    if (!engine?.isReal) return;
    // A quiet context clears native music identity as well as its oscillator
    // timers, so auditioning the same cue again can restart it correctly.
    engine.music('quiet');
    engine.stopMusic(0);
    engine.setVolumes({muteAudio: true});
  };

  return {
    async start(scene, settings = {}) {
      const ticket = ++revision;
      try {
        assertGesture();
        const music = scene?.music || 'keep';
        const stinger = scene?.stinger || 'none';
        if (!musicChoices.has(music) || !stingerChoices.has(stinger)) throw new Error('This scene contains an unsupported native audio cue.');
        const volumes = nativeSettings(settings, native.AUDIO_DEFAULTS);
        if (!engine) {
          prepareAssets();
          engine = createEngine(volumes);
        }
        if (!engine?.isReal) throw new Error('Web Audio is unavailable in this browser.');
        let timeout;
        try {
          await Promise.race([
            engine.unlock(),
            new Promise((_, reject) => {timeout = setTimeout(() => reject(new Error('Audio is blocked by the browser. Press Audition audio again.')), unlockTimeoutMs);}),
          ]);
        } finally {clearTimeout(timeout);}
        if (ticket !== revision) return {...status};
        silence();
        engine.setVolumes(volumes);
        if (music !== 'keep') engine.music(music);
        if (stinger !== 'none') engine.sfx(stinger);
        const audible = !volumes.muteAudio && ((music !== 'keep' && music !== 'quiet' && volumes.musicEnabled && Number(volumes.musicVolume) > 0) || (stinger !== 'none' && Number(volumes.sfxVolume) > 0));
        status = {state: audible ? 'playing' : 'silent', music, stinger, message: audible ? 'Native scene audio audition. Music does not seek with the animation timeline.' : 'Native audio is silent: no audible cue or sound is muted.'};
        return {...status};
      } catch (error) {
        if (ticket !== revision) return {...status};
        silence();
        status = {state: 'error', message: error.message || 'Native audio could not start.'};
        throw new Error(status.message, {cause: error});
      }
    },
    stop() {
      revision++;
      silence();
      status = {state: 'stopped', message: 'Native audio stopped.'};
      return {...status};
    },
    status() {return {...status};},
  };
}
