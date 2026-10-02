// Battlefield studio model. Every editable value maps to a native store:
//  - p.ui (ui/scenes/w4a-combat.json) formation sizing/positioning — native UI document save
//  - p.gameSettings.overrides gameConfig.presentation.* — native settings profile / defaults promotion
//  - p.lab.stage — balance.ui.combatantStage tokens; preview + export only (no checkout adapter)
// Device, encounter, class and guides are view choices kept outside authored records and undo.

export const LAB_SCHEMA = 'ashenspire.battlefield-lab/2';
export const SETTING_PREFIX = 'gameConfig.presentation.';

export const BATTLEFIELD_DEVICES = Object.freeze([
  {id: 'desktop', label: 'Desktop 1440×900', width: 1440, height: 900},
  {id: 'laptop', label: 'Laptop 1280×720', width: 1280, height: 720},
  {id: 'tablet', label: 'Tablet 1024×768', width: 1024, height: 768},
  {id: 'phone', label: 'Phone landscape 844×390', width: 844, height: 390},
]);
export const deviceById = id => BATTLEFIELD_DEVICES.find(device => device.id === id) || BATTLEFIELD_DEVICES[0];

// Native balance.ui.combatantStage defaults (runtime aC()).
export const STAGE_FIELDS = Object.freeze([
  {key: 'centerPct', label: 'Stage center', min: 10, max: 90, step: 1, unit: '%', def: 50},
  {key: 'hudClearanceViewportPct', label: 'HUD clearance', min: 0, max: 20, step: 0.5, unit: 'vh', def: 3},
  {key: 'actionClearanceViewportPct', label: 'Action rail clearance', min: 0, max: 20, step: 0.5, unit: 'vh', def: 3},
  {key: 'intentGapPx', label: 'Intent badge gap', min: 0, max: 40, step: 1, unit: 'px', def: 6},
]);
// Vendored game CSS fixes combat rows at 10% / 45% / 45% (10 / 55 / 35 below 700px height),
// overriding the w4a band adapter. Authored rows are a preview-only proposal over that rule.
export const NATIVE_ROWS = Object.freeze({tall: {hud: 10, field: 45, hand: 45}, short: {hud: 10, field: 55, hand: 35}});
export const ROW_FIELDS = Object.freeze([
  {key: 'hud', label: 'HUD row', min: 5, max: 20},
  {key: 'field', label: 'Battlefield row', min: 20, max: 80},
  {key: 'hand', label: 'Hand and action row', min: 15, max: 70},
]);
export function rowsProblems(rows) {
  if (!record(rows)) return ['Screen rows must be an object'];
  const issues = [];
  for (const field of ROW_FIELDS) if (!Number.isInteger(rows[field.key]) || rows[field.key] < field.min || rows[field.key] > field.max) issues.push(`${field.label} must be a whole number ${field.min}–${field.max}%`);
  if (Object.keys(rows).some(key => !ROW_FIELDS.some(field => field.key === key))) issues.push('Unknown screen row');
  if (!issues.length && rows.hud + rows.field + rows.hand !== 100) issues.push('Screen rows must sum to 100%');
  return issues;
}
// Change one row; the battlefield absorbs the difference, or the hand row when the battlefield itself changes.
export function shiftRows(rows, key, value) {
  const spec = ROW_FIELDS.find(field => field.key === key), next = {...rows, [key]: Math.round(Math.min(spec.max, Math.max(spec.min, value)))};
  const other = key === 'field' ? 'hand' : 'field', otherSpec = ROW_FIELDS.find(field => field.key === other);
  next[other] = 100 - next.hud - next.field - next.hand + next[other];
  if (next[other] < otherSpec.min || next[other] > otherSpec.max) return rows;
  return next;
}
export function measuredRows(lab, metrics) {
  if (lab?.rows && !rowsProblems(lab.rows).length) return {...lab.rows};
  return metrics?.viewport?.height < 700 ? {...NATIVE_ROWS.short} : {...NATIVE_ROWS.tall};
}

export const STAGE_DEFAULTS = Object.freeze(Object.fromEntries(STAGE_FIELDS.map(field => [field.key, field.def])));

// Native w4a formation fitting. Paths are into p.ui.
export const FIT_FIELDS = Object.freeze([
  {path: ['sizing', 'formation', 'displayScale'], label: 'Display scale', min: 0.3, max: 3, step: 0.05, unit: 'x', group: 'Fit'},
  {path: ['sizing', 'formation', 'minimumSpritePx'], label: 'Minimum sprite height', min: 24, max: 400, step: 1, unit: 'px', group: 'Fit'},
  {path: ['sizing', 'formation', 'detailReserveRem'], label: 'Detail reserve', min: 0, max: 12, step: 0.1, unit: 'rem', group: 'Fit'},
  ...['A', 'B', 'C+'].map((row, index) => ({path: ['sizing', 'formation', 'depth', index], label: `Row ${row} depth`, min: 0.3, max: 2, step: 0.01, unit: 'x', group: 'Depth'})),
  ...['A', 'B', 'C+'].map((row, index) => ({path: ['sizing', 'formation', 'selectedGrowth', index], label: `Row ${row} selected growth`, min: 1, max: 2, step: 0.01, unit: 'x', group: 'Depth'})),
  {path: ['positioning', 'formation', 'insetRem'], label: 'Edge inset', min: 0, max: 8, step: 0.1, unit: 'rem', group: 'Spacing'},
  {path: ['positioning', 'formation', 'horizontalStepFraction'], label: 'Horizontal step', min: 0, max: 0.3, step: 0.005, unit: 'of width', group: 'Spacing'},
  {path: ['positioning', 'formation', 'minimumStepPx'], label: 'Minimum step', min: 0, max: 80, step: 1, unit: 'px', group: 'Spacing'},
  {path: ['positioning', 'formation', 'gapNarrowFraction'], label: 'Team gap (narrow)', min: 0, max: 0.3, step: 0.005, unit: 'of width', group: 'Spacing'},
  {path: ['positioning', 'formation', 'gapWideFraction'], label: 'Team gap (wide)', min: 0, max: 0.3, step: 0.005, unit: 'of width', group: 'Spacing'},
  {path: ['positioning', 'formation', 'innerRetreatFraction'], label: 'Inner retreat', min: 0, max: 0.3, step: 0.005, unit: 'of width', group: 'Spacing'},
  {path: ['positioning', 'formation', 'maxRetreatSpacingFraction'], label: 'Max retreat spacing', min: 0, max: 0.5, step: 0.005, unit: 'of width', group: 'Spacing'},
]);

const ROWS = ['A', 'B', 'C', 'D', 'E', 'F'];
const num = (key, label, min, max, step, def, group, unit = '') => ({key, label, type: 'number', min, max, step, def, group, unit});
const choice = (key, label, choices, def, group, labels = {}) => ({key, label, type: 'choice', choices, def, group, labels});
// Mirrors the native advanced-config rows for gameConfig.presentation.* (runtime zp / Z3 / dT / Pn).
export const PRESENTATION_FIELDS = Object.freeze([
  num('playerSpriteScale', 'Player sprite scale', 0.5, 2, 0.05, 0.9, 'Figures', 'x'),
  num('enemySpriteScale', 'Enemy sprite scale', 0.5, 2, 0.05, 0.9, 'Figures', 'x'),
  ...ROWS.map(row => num(`row${row}Scale`, `Row ${row} scale`, 0.25, 3, 0.05, 1, 'Rows', 'x')),
  ...ROWS.map(row => num(`row${row}Layer`, `Row ${row} layer`, -500, 500, 1, 0, 'Layers')),
  choice('formationPreset', 'Formation preset', ['straight', 'forward-slant', 'back-slant', 'classic-v'], 'classic-v', 'Formation', {straight: 'Straight ranks', 'forward-slant': 'Forward slant', 'back-slant': 'Back slant', 'classic-v': 'Classic V'}),
  num('formationColumns', 'Columns per side', 1, 3, 1, 2, 'Formation'),
  num('formationRows', 'Rows per side', 1, 6, 1, 3, 'Formation'),
  num('formationWidth', 'Formation width', 40, 100, 1, 80, 'Formation', '%'),
  num('formationDepth', 'Formation depth', 30, 100, 1, 60, 'Formation', '%'),
  num('formationGap', 'Team gap', 4, 30, 1, 12, 'Formation', '%'),
  num('groundTilt', 'Ground tilt', 0, 65, 1, 35, 'Formation', '°'),
  num('groundSkew', 'Ground skew', -35, 35, 1, 15, 'Formation', '°'),
  num('frontOffsetX', 'Front column X offset', -150, 150, 1, 0, 'Columns', 'px'),
  num('frontOffsetY', 'Front column Y offset', -100, 100, 1, 0, 'Columns', 'px'),
  num('backOffsetX', 'Back column X offset', -150, 150, 1, 0, 'Columns', 'px'),
  num('backOffsetY', 'Back column Y offset', -100, 100, 1, 0, 'Columns', 'px'),
  num('frontLayer', 'Front column layer', 0, 500, 1, 0, 'Layers'),
  num('backLayer', 'Back column layer', 0, 500, 1, 200, 'Layers'),
  choice('playerSpawnRow', 'Player preferred row', ROWS, 'C', 'Spawn'),
  choice('enemySpawnRow', 'Enemy preferred row', ROWS, 'C', 'Spawn'),
  choice('playerSpawnColumn', 'Player preferred column', ['1', '2', '3'], '2', 'Spawn'),
  choice('enemySpawnColumn', 'Enemy preferred column', ['2', '3', '4', '5', '6'], '3', 'Spawn'),
  {key: 'showFormationGrid', label: 'Show formation grid in game', type: 'boolean', def: false, group: 'Grid'},
  choice('gridShape', 'Tile shape', ['square', 'rectangle', 'rhombus', 'wide-rhombus', 'circle', 'ellipse'], 'wide-rhombus', 'Grid', {'wide-rhombus': 'Rectangular rhombus'}),
  choice('gridLayer', 'Grid layer', ['behind', 'above'], 'behind', 'Grid'),
  {key: 'playerGridColor', label: 'Player tile color', type: 'color', def: '#d5cc63', group: 'Grid'},
  {key: 'enemyGridColor', label: 'Enemy tile color', type: 'color', def: '#e1a679', group: 'Grid'},
]);
export const presentationField = key => PRESENTATION_FIELDS.find(field => field.key === key);

export const LAB_DEFAULT = Object.freeze({schema: LAB_SCHEMA, stage: {}});
export const VIEW_DEFAULT = Object.freeze({device: 'desktop', encounter: 'loneSoldier', testClass: 'rogue', guides: true, grid: false});

export function normalizeView(view) {
  const next = {...VIEW_DEFAULT, ...(record(view) ? view : {})};
  if (!BATTLEFIELD_DEVICES.some(device => device.id === next.device)) next.device = VIEW_DEFAULT.device;
  if (typeof next.encounter !== 'string' || !/^[A-Za-z0-9_.-]{1,80}$/.test(next.encounter)) next.encounter = VIEW_DEFAULT.encounter;
  if (!['rogue', 'reaver', 'herald', 'starseer'].includes(next.testClass)) next.testClass = VIEW_DEFAULT.testClass;
  next.guides = next.guides !== false;
  next.grid = next.grid === true;
  return {device: next.device, encounter: next.encounter, testClass: next.testClass, guides: next.guides, grid: next.grid};
}

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isLegacy = lab => record(lab) && lab.schema === undefined && 'base' in lab;

export function validateLab(lab) {
  if (!record(lab)) return ['Invalid battlefield lab'];
  if (isLegacy(lab)) return []; // pre-2 packages: arithmetic-only proposal, replaced on read
  const issues = [];
  if (lab.schema !== LAB_SCHEMA) issues.push('Unsupported battlefield lab schema');
  for (const key of Object.keys(lab)) if (!['schema', 'stage', 'rows'].includes(key)) issues.push(`Unknown battlefield lab field ${key}`);
  if (lab.rows !== undefined) issues.push(...rowsProblems(lab.rows));
  if (!record(lab.stage)) issues.push('Battlefield stage overrides must be an object');
  else for (const [key, value] of Object.entries(lab.stage)) {
    const field = STAGE_FIELDS.find(item => item.key === key);
    if (!field) issues.push(`Unknown stage token ${key}`);
    else if (!Number.isFinite(value) || value < field.min || value > field.max) issues.push(`${field.label} must be ${field.min}–${field.max}`);
  }
  return issues;
}

export function normalizeLab(lab) {
  if (!record(lab) || isLegacy(lab) || validateLab(lab).length) return {...LAB_DEFAULT, stage: {}};
  return {schema: LAB_SCHEMA, stage: {...lab.stage}, ...(lab.rows ? {rows: {...lab.rows}} : {})};
}

export function getPath(object, path) {
  return path.reduce((value, key) => value?.[key], object);
}
export function setPath(object, path, value) {
  let target = object;
  for (const key of path.slice(0, -1)) target = target[key];
  target[path.at(-1)] = value;
}

export function fitProblems(ui) {
  const issues = [];
  for (const field of FIT_FIELDS) {
    const value = getPath(ui, field.path);
    if (value === undefined) continue;
    if (!Number.isFinite(value) || value < field.min || value > field.max) issues.push(`${field.label} must be ${field.min}–${field.max}`);
  }
  return issues;
}

export function presentationValue(overrides, field) {
  const value = overrides?.[SETTING_PREFIX + field.key];
  if (value === undefined) return field.def;
  if (field.type === 'number') return Number.isFinite(Number(value)) ? Math.min(field.max, Math.max(field.min, Number(value))) : field.def;
  if (field.type === 'boolean') return value === true;
  if (field.type === 'choice') return field.choices.includes(String(value)) ? String(value) : field.def;
  return /^#[0-9a-f]{6}$/i.test(value) ? value : field.def;
}

export function presentationProblems(field, value) {
  if (field.type === 'number') return Number.isFinite(value) && value >= field.min && value <= field.max ? [] : [`${field.label} must be ${field.min}–${field.max}`];
  if (field.type === 'boolean') return typeof value === 'boolean' ? [] : [`${field.label} must be true or false`];
  if (field.type === 'choice') return field.choices.includes(value) ? [] : [`${field.label} must be one of ${field.choices.join(', ')}`];
  return /^#[0-9a-f]{6}$/i.test(value) ? [] : [`${field.label} must be a #rrggbb color`];
}

// Whole battlefield document for JSON editing and export: the three native stores in one view.
export function battlefieldDocument(p) {
  const overrides = p.gameSettings?.overrides || {};
  return {
    schema: 'ashenspire.battlefield/2',
    lab: normalizeLab(p.lab),
    formation: {sizing: structuredClone(p.ui?.sizing?.formation ?? {}), positioning: structuredClone(p.ui?.positioning?.formation ?? {})},
    presentation: Object.fromEntries(PRESENTATION_FIELDS.filter(field => (SETTING_PREFIX + field.key) in overrides).map(field => [field.key, overrides[SETTING_PREFIX + field.key]])),
  };
}

export function battlefieldDocumentProblems(doc) {
  if (!record(doc) || doc.schema !== 'ashenspire.battlefield/2') return ['Expected ashenspire.battlefield/2 document'];
  const issues = [...validateLab(doc.lab)];
  if (!record(doc.formation) || !record(doc.formation.sizing) || !record(doc.formation.positioning)) issues.push('formation.sizing and formation.positioning are required');
  else issues.push(...fitProblems({sizing: {formation: doc.formation.sizing}, positioning: {formation: doc.formation.positioning}}));
  if (!record(doc.presentation)) issues.push('presentation must be an object');
  else for (const [key, value] of Object.entries(doc.presentation)) {
    const field = presentationField(key);
    issues.push(...(field ? presentationProblems(field, value) : [`Unknown presentation setting ${key}`]));
  }
  return issues;
}

export function applyBattlefieldDocument(next, doc) {
  next.lab = normalizeLab(doc.lab);
  next.ui.sizing.formation = structuredClone(doc.formation.sizing);
  next.ui.positioning.formation = structuredClone(doc.formation.positioning);
  next.gameSettings ??= {schemaVersion: 1, game: 'Ashen Spire', build: {}, statRows: 7, overrides: {}};
  for (const field of PRESENTATION_FIELDS) delete next.gameSettings.overrides[SETTING_PREFIX + field.key];
  for (const [key, value] of Object.entries(doc.presentation)) next.gameSettings.overrides[SETTING_PREFIX + key] = value;
}

// Measured-layout checks. Metrics come from the native frame in CSS pixels.
export function diagnose(metrics, ui) {
  if (!metrics?.regions?.field) return [];
  const issues = [], field = metrics.regions.field, minimum = ui?.sizing?.formation?.minimumSpritePx;
  const hudBottom = metrics.regions.hud ? metrics.regions.hud.y + metrics.regions.hud.height : field.y;
  for (const actor of metrics.combatants || []) {
    const art = actor.art, name = actor.name || actor.eid;
    if (art.y < hudBottom - 1) issues.push({tone: 'warning', eid: actor.eid, text: `${name}: art rises ${Math.round(hudBottom - art.y)} px into the HUD.`});
    if (art.y + art.height > field.y + field.height + 1) issues.push({tone: 'warning', eid: actor.eid, text: `${name}: art extends ${Math.round(art.y + art.height - field.y - field.height)} px below the battlefield.`});
    if (art.x < field.x - 1 || art.x + art.width > field.x + field.width + 1) issues.push({tone: 'warning', eid: actor.eid, text: `${name}: art crosses the stage edge.`});
    if (Number.isFinite(minimum) && art.height + 1 < minimum) issues.push({tone: 'info', eid: actor.eid, text: `${name}: ${Math.round(art.height)} px is below the ${minimum} px minimum sprite height.`});
  }
  const actors = metrics.combatants || [];
  for (let i = 0; i < actors.length; i++) for (let j = i + 1; j < actors.length; j++) {
    const a = actors[i].art, b = actors[j].art;
    const overlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
    if (overlap > Math.min(a.width, b.width) * 0.35 && actors[i].role !== actors[j].role) issues.push({tone: 'warning', eid: actors[i].eid, text: `${actors[i].name} and ${actors[j].name} overlap by ${Math.round(overlap)} px.`});
  }
  return issues;
}
