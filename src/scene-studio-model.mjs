import nativeActors from './native/game-preview/scene-actors.json' with {type: 'json'};
import {nativeAssetPaths} from './native/game-preview/assets.js';
import {publicUrl} from './paths.js';

const artLabels = {none: 'No artwork', warmth: 'Remembered warmth', year: 'The Burning', carry: 'What the fire left', night: 'Last night', step: 'The first step', road: 'The road'};
const classes = ['reaver', 'starseer', 'rogue', 'herald'];
const actorRules = {x: [0, 100], y: [0, 100], height: [10, 100], rotation: [-180, 180]};

export function clamp(value, min, max) {
  const number = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(number) ? number : min));
}

export function sceneArtUrl(scene, classId = 'reaver', device = 'desktop') {
  const art = scene?.art === undefined ? scene?.id : scene.art;
  if (!art || art === 'none' || !Object.hasOwn(artLabels, art)) return '';
  const target = device === 'mobile' ? 'mobile' : 'desktop';
  const name = art === 'carry' ? `carry-${classes.includes(classId) ? classId : 'reaver'}` : art;
  const path = nativeAssetPaths[`assets/prologue/${name}-${target}.webp`];
  return path ? publicUrl(path) : '';
}

export function sceneArtOptions(classId = 'reaver', device = 'desktop') {
  return Object.entries(artLabels).map(([id, label]) => ({id, label, src: sceneArtUrl({art: id}, classId, device)}));
}

export function getActor(scene, device = 'desktop') {
  const target = device === 'mobile' ? 'mobile' : 'desktop';
  const defaults = nativeActors[scene?.id]?.[target] || nativeActors.warmth[target];
  const actor = {...defaults};
  for (const [key, value] of Object.entries(scene?.actor?.[target] || {})) {
    if (Object.hasOwn(actorRules, key)) {
      const [min, max] = actorRules[key];
      if (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max) actor[key] = value;
    } else if (key === 'layer' && ['behindWash', 'front'].includes(value)) actor[key] = value;
    else if (key === 'positionMode' && ['auto', 'manual'].includes(value)) actor[key] = value;
    else if (key === 'locked' && typeof value === 'boolean') actor[key] = value;
  }
  return actor;
}

const sequenceOf = project => project?.scenes?.components?.sequence;
const findScene = (project, sceneId) => sequenceOf(project)?.scenes?.find(scene => scene.id === sceneId);

// Mutations operate on the draft given to the editor's update transaction.
export function patchActor(project, sceneId, device, patch) {
  const scene = findScene(project, sceneId);
  if (!scene) return false;
  const target = device === 'mobile' ? 'mobile' : 'desktop';
  const actor = {...getActor(scene, target), ...scene.actor?.[target]};
  for (const [key, value] of Object.entries(patch || {})) {
    if (Object.hasOwn(actorRules, key) && Number.isFinite(Number(value))) actor[key] = clamp(value, ...actorRules[key]);
    else if (key === 'layer' && ['behindWash', 'front'].includes(value)) actor.layer = value;
    else if (key === 'locked' && typeof value === 'boolean') actor.locked = value;
  }
  actor.positionMode = patch?.positionMode === 'auto' ? 'auto' : 'manual';
  scene.actor ||= {};
  scene.actor[target] = actor;
  return true;
}

function validRuleValue(rule, value) {
  if (!rule) return false;
  if (rule.type === 'number') return typeof value === 'number' && Number.isFinite(value) && value >= rule.min && value <= rule.max && (!rule.integer || Number.isInteger(value));
  if (rule.type === 'choice') return rule.choices.includes(value);
  if (rule.type === 'colorSwatch' || rule.type === 'color') return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  return typeof value === 'boolean';
}

const validStageValue = (key, value) => validRuleValue(stageRules[key], value);

// Shared defaults stay in the native presentation block. Sparse scene.stage
// overrides keep their meaning; editing the master never rewrites any scene.
export function patchPresentation(project, patch) {
  const sequence = sequenceOf(project);
  if (!sequence) return false;
  const accepted = Object.fromEntries(Object.entries(patch || {}).filter(([key, value]) => validRuleValue(presentationRules[key], value)));
  if (!Object.keys(accepted).length) return false;
  sequence.presentation = {...sequence.presentation, ...accepted};
  return true;
}

export function getStage(sequence, scene) {
  const stage = {...presentationDefaults};
  for (const [key, value] of Object.entries(sequence?.presentation || {})) {
    if (Object.hasOwn(stageRules, key) ? validStageValue(key, value) : Object.hasOwn(presentationDefaults, key)) stage[key] = value;
  }
  if (scene?.ownStaging) {
    for (const [key, value] of Object.entries(scene.stage || {})) if (validStageValue(key, value)) stage[key] = value;
  }
  return stage;
}

export function patchStage(project, sceneId, patch) {
  const scene = findScene(project, sceneId);
  if (!scene) return false;
  const accepted = Object.fromEntries(Object.entries(patch || {}).filter(([key, value]) => validStageValue(key, value)));
  if (!Object.keys(accepted).length) return false;
  scene.ownStaging = true;
  scene.stage = {...scene.stage, ...accepted};
  return true;
}

export function sortedScenes(sequence) {
  return (sequence?.scenes || []).map((scene, index) => ({scene, index})).sort((a, b) => (Number.isFinite(a.scene.order) ? a.scene.order : a.index + 1) - (Number.isFinite(b.scene.order) ? b.scene.order : b.index + 1) || a.index - b.index).map(item => item.scene);
}

export function reorderScene(project, id, direction) {
  const scenes = sortedScenes(sequenceOf(project));
  const from = scenes.findIndex(scene => scene.id === id);
  const delta = direction === 'up' || direction === -1 ? -1 : direction === 'down' || direction === 1 ? 1 : 0;
  const to = from + delta;
  if (from < 0 || !delta || to < 0 || to >= scenes.length) return false;
  [scenes[from], scenes[to]] = [scenes[to], scenes[from]];
  scenes.forEach((scene, index) => {scene.order = index + 1;});
  return true;
}

export function addScene(project) {
  const scene = sortedScenes(sequenceOf(project)).find(item => item.enabled === false && Object.hasOwn(nativeActors, item.id));
  if (!scene) return null;
  scene.enabled = true;
  return scene.id;
}

export function sceneDuration(scene) {
  const seconds = scene?.seconds;
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 1 && seconds <= 180 ? seconds : 5;
}

export function formatTime(seconds) {
  const total = Math.max(0, Number.isFinite(Number(seconds)) ? Number(seconds) : 0);
  return `${Math.floor(total / 60).toString().padStart(2, '0')}:${Math.floor(total % 60).toString().padStart(2, '0')}`;
}

// Captured from the bundled AshenNative.prologueRows / PROLOGUE_DEFAULTS.
// Contract tests below compare these boundaries to the actual renderer.
const stageRules = {
  // Existing source fields retained as editor preview extensions. The pinned
  // native game does not consume them; the frame sizing adapter applies them.
  "captionFixedHeight": {"type": "boolean"},
  "captionHeightVh": {"type": "number", "min": 1, "max": 100},
  "layout": {
    "type": "choice",
    "choices": [
      "caption",
      "overlay",
      "letterbox",
      "panelLeft",
      "panelRight"
    ]
  },
  "imageScale": {
    "type": "number",
    "min": 0.5,
    "max": 3
  },
  "imageFit": {
    "type": "choice",
    "choices": [
      "cover",
      "contain",
      "fill"
    ]
  },
  "imageFocusX": {
    "type": "number",
    "integer": true,
    "min": 0,
    "max": 100
  },
  "imageFocusY": {
    "type": "number",
    "integer": true,
    "min": 0,
    "max": 100
  },
  "camera": {
    "type": "choice",
    "choices": [
      "auto",
      "none",
      "in",
      "out",
      "left",
      "right",
      "up",
      "down"
    ]
  },
  "cameraAmount": {
    "type": "number",
    "min": 0,
    "max": 20
  },
  "wash": {
    "type": "number",
    "min": 0,
    "max": 0.4
  },
  "textPosition": {
    "type": "choice",
    "choices": [
      "top-left",
      "top-center",
      "top-right",
      "middle-left",
      "middle-center",
      "middle-right",
      "bottom-left",
      "bottom-center",
      "bottom-right"
    ]
  },
  "textAlign": {
    "type": "choice",
    "choices": [
      "left",
      "center",
      "right"
    ]
  },
  "textScale": {
    "type": "number",
    "min": 0.6,
    "max": 2
  },
  "textInsetX": {
    "type": "number",
    "min": 0,
    "max": 40
  },
  "textInsetY": {
    "type": "number",
    "min": 0,
    "max": 40
  },
  "textBox": {
    "type": "boolean"
  },
  "textBoxVisible": {
    "type": "boolean"
  },
  "textBoxOpacity": {
    "type": "number",
    "min": 0,
    "max": 1
  },
  "textBoxColor": {
    "type": "colorSwatch"
  },
  "textOutline": {
    "type": "boolean"
  },
  "textOutlineColor": {
    "type": "colorSwatch"
  },
  "textOutlineWidth": {
    "type": "number",
    "min": 0,
    "max": 8
  },
  "reveal": {
    "type": "choice",
    "choices": [
      "none",
      "typewriter",
      "lines"
    ]
  },
  "revealSpeed": {
    "type": "number",
    "integer": true,
    "min": 5,
    "max": 200
  },
  "textDelaySeconds": {
    "type": "number",
    "min": 0,
    "max": 20
  },
  "imageBrightness": {
    "type": "number",
    "min": 0.2,
    "max": 2
  },
  "imageContrast": {
    "type": "number",
    "min": 0.2,
    "max": 2
  },
  "imageSaturation": {
    "type": "number",
    "min": 0,
    "max": 2
  },
  "imageBlur": {
    "type": "number",
    "min": 0,
    "max": 20
  },
  "imageFlip": {
    "type": "boolean"
  },
  "vignette": {
    "type": "number",
    "min": 0,
    "max": 1
  },
  "backdropColor": {
    "type": "colorSwatch"
  },
  "letterboxColor": {
    "type": "colorSwatch"
  },
  "transitionSeconds": {
    "type": "number",
    "min": 0,
    "max": 30
  },
  "transitionEase": {
    "type": "choice",
    "choices": [
      "ease-in-out",
      "linear",
      "ease",
      "ease-in",
      "ease-out"
    ]
  },
  "cameraEase": {
    "type": "choice",
    "choices": [
      "linear",
      "ease-in-out",
      "ease-out",
      "ease-in"
    ]
  },
  "titleVisible": {
    "type": "boolean"
  },
  "speakerVisible": {
    "type": "boolean"
  },
  "locationVisible": {
    "type": "boolean"
  },
  "progressStyle": {
    "type": "choice",
    "choices": [
      "numbers",
      "dots",
      "hidden"
    ]
  },
  "titleColor": {
    "type": "colorSwatch"
  },
  "speakerColor": {
    "type": "colorSwatch"
  },
  "dialogueColor": {
    "type": "colorSwatch"
  },
  "locationColor": {
    "type": "colorSwatch"
  },
  "titleScale": {
    "type": "number",
    "min": 0.5,
    "max": 3
  },
  "speakerScale": {
    "type": "number",
    "min": 0.5,
    "max": 3
  },
  "lineHeight": {
    "type": "number",
    "min": 1,
    "max": 2.4
  },
  "letterSpacing": {
    "type": "number",
    "min": -0.05,
    "max": 0.4
  },
  "textMaxWidth": {
    "type": "number",
    "integer": true,
    "min": 30,
    "max": 120
  },
  "textFont": {
    "type": "choice",
    "choices": [
      "display",
      "body"
    ]
  },
  "boxPadding": {
    "type": "number",
    "min": 0,
    "max": 6
  },
  "boxRadius": {
    "type": "number",
    "integer": true,
    "min": 0,
    "max": 40
  },
  "boxBorderWidth": {
    "type": "number",
    "min": 0,
    "max": 6
  },
  "boxBorderColor": {
    "type": "colorSwatch"
  },
  "boxBlur": {
    "type": "number",
    "min": 0,
    "max": 20
  }
};
const presentationRules = {
  ...stageRules,
  playback: {type: 'choice', choices: ['every', 'once', 'off']},
  autoAdvance: {type: 'boolean'},
  speed: {type: 'number', min: 0.25, max: 3},
  reduceMotion: {type: 'boolean'},
  tintSource: {type: 'choice', choices: ['accent', 'character', 'custom']},
  customTint: {type: 'color'},
  shadowStrength: {type: 'number', min: 0, max: 1},
  bannerPosition: {type: 'choice', choices: ['top', 'bottom']},
  controlsPosition: {type: 'choice', choices: ['bar', 'text']},
  controlsAlign: {type: 'choice', choices: ['left', 'center', 'right']},
  controlsSize: {type: 'choice', choices: ['compact', 'normal', 'large']},
  showPause: {type: 'boolean'},
  showSkip: {type: 'boolean'},
  advanceOnClick: {type: 'boolean'},
  previewClass: {type: 'choice', choices: classes},
  previewScene: {type: 'choice', choices: Object.keys(nativeActors)},
};
const presentationDefaults = {
  "captionFixedHeight": false,
  "captionHeightVh": 18,
  "transitionSeconds": 5,
  "speed": 1,
  "tintSource": "accent",
  "accent": "gold",
  "characterTint": "gold",
  "wash": 0.14,
  "reduceMotion": false,
  "playback": "every",
  "autoAdvance": true,
  "customTint": "#c9a227",
  "previewClass": "reaver",
  "previewScene": "warmth",
  "shadowStrength": 0.7,
  "layout": "caption",
  "imageScale": 1,
  "imageFit": "cover",
  "imageFocusX": 50,
  "imageFocusY": 50,
  "bannerPosition": "top",
  "textPosition": "bottom-center",
  "textAlign": "center",
  "textScale": 1,
  "textBox": true,
  "textBoxVisible": true,
  "textBoxOpacity": 1,
  "textBoxColor": "#100e0c",
  "textOutline": false,
  "textOutlineColor": "#100e0c",
  "textOutlineWidth": 2,
  "camera": "auto",
  "cameraAmount": 3.5,
  "textInsetX": 4,
  "textInsetY": 4,
  "reveal": "none",
  "revealSpeed": 45,
  "imageBrightness": 1,
  "imageContrast": 1,
  "imageSaturation": 1,
  "imageBlur": 0,
  "imageFlip": false,
  "vignette": 0,
  "backdropColor": "#100e0c",
  "letterboxColor": "#000000",
  "transitionEase": "ease-in-out",
  "cameraEase": "linear",
  "titleVisible": true,
  "speakerVisible": true,
  "locationVisible": true,
  "progressStyle": "numbers",
  "titleColor": "#c9a227",
  "speakerColor": "#c0b39d",
  "dialogueColor": "#eee6d5",
  "locationColor": "#c9a227",
  "titleScale": 1,
  "speakerScale": 1,
  "lineHeight": 1.5,
  "letterSpacing": 0,
  "textMaxWidth": 65,
  "textFont": "body",
  "textDelaySeconds": 0,
  "boxPadding": 1,
  "boxRadius": 0,
  "boxBorderWidth": 0,
  "boxBorderColor": "#c9a227",
  "boxBlur": 0,
  "controlsPosition": "bar",
  "controlsAlign": "center",
  "controlsSize": "normal",
  "showPause": true,
  "showSkip": true,
  "advanceOnClick": false
};

export function sequenceTimeline(sequence) {
  let start = 0;
  return sortedScenes(sequence).filter(scene => scene.enabled !== false).map(scene => {
    const duration = sceneDuration(scene), stage = getStage(sequence, scene);
    const row = {id: scene.id, scene, start, duration, textStart: Math.min(duration, Math.max(0, stage.textDelaySeconds || 0))};
    start += duration;
    return row;
  });
}

export function sequenceLength(timeline) {
  const last = timeline.at(-1);
  return last ? last.start + last.duration : 0;
}

export function locateSequenceTime(timeline, seconds) {
  if (!timeline.length) return null;
  const value = Math.max(0, Math.min(sequenceLength(timeline), Number(seconds) || 0));
  const row = timeline.find(item => value < item.start + item.duration) || timeline.at(-1);
  return {id: row.id, time: Math.min(row.duration, value - row.start)};
}

export function nextSequenceScene(timeline, id) {
  const index = timeline.findIndex(row => row.id === id);
  return index >= 0 && index < timeline.length - 1 ? timeline[index + 1].id : null;
}
