const safeId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const reservedIds = new Set(['constructor', 'prototype', '__proto__']);
const copy = value => structuredClone(value);
function checkIdentity(records, id, name) {
  if (typeof id !== 'string' || !safeId.test(id) || reservedIds.has(id)) throw new Error('Use a unique ID of 1–96 letters, numbers, dots, underscores, colons or hyphens. Start with a letter or number.');
  if (records.some(record => record.id === id)) throw new Error('This ID already exists. Choose another ID.');
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) throw new Error('Enter a name of 1–120 characters.');
}
export function suggestDraftId(name, records) {
  const base = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'draft';
  let id = reservedIds.has(base) ? 'draft-' + base : base, index = 2;
  const used = new Set(records.map(record => record.id));
  while (used.has(id)) id = base + '-' + index++;
  return id;
}
export function createCardDefinition(project, templateId, {id, name}) {
  checkIdentity(project.cards, id, name);
  const template = project.cards.find(card => card.id === templateId);
  if (!template) throw new Error('The template card no longer exists. Choose another card.');
  return {...copy(template), id, name: name.trim()};
}
export function uiConfigIssues(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config) || !config.sizing?.bands || typeof config.sizing.bands !== 'object' || Array.isArray(config.sizing.bands)) return ['Native sizing.bands required'];
  const values = Object.values(config.sizing.bands);
  return !values.length || values.some(value => !Number.isFinite(value) || value < 0) || Math.abs(values.reduce((a, b) => a + b, 0) - 100) > .0001 ? ['Nonnegative band values must sum to 100'] : [];
}
export function validateWireframes(wireframes) {
  if (wireframes === undefined) return [];
  if (!Array.isArray(wireframes) || wireframes.length > 100) return ['Wireframes require an array with at most 100 drafts'];
  const seen = new Set(), issues = [];
  for (const wireframe of wireframes) {
    if (!wireframe || typeof wireframe.id !== 'string' || !safeId.test(wireframe.id) || reservedIds.has(wireframe.id) || seen.has(wireframe.id) || typeof wireframe.name !== 'string' || !wireframe.name.trim() || wireframe.name.length > 120) return ['Wireframe IDs must be safe and unique; names require 1–120 characters'];
    seen.add(wireframe.id);
    issues.push(...uiConfigIssues(wireframe.config).map(issue => 'Wireframe ' + wireframe.id + ': ' + issue));
  }
  return issues;
}
export function createWireframeDefinition(project, {id, name}) {
  const drafts = project.wireframes || [];
  if (drafts.length >= 100) throw new Error('The project already has 100 wireframe drafts.');
  checkIdentity(drafts, id, name);
  const issues = uiConfigIssues(project.ui);
  if (issues.length) throw new Error(issues[0]);
  return {id, name: name.trim(), config: copy(project.ui)};
}
