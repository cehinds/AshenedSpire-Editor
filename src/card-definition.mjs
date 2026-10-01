import {validateProject} from './core.mjs';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Structural native-card checks; engine semantics remain the native preview's job. */
export function validateCardDefinition(value, expectedId) {
  if (!record(value)) return ['Card definition must be a JSON object.'];
  const issues = [];
  if (typeof value.id !== 'string' || value.id !== expectedId) issues.push('Card ID must remain unchanged.');
  if (typeof value.name !== 'string' || !value.name.trim()) issues.push('Card name must not be empty.');
  function fields(card, prefix, base) {
    for (const key of ['type', 'class', 'rarity', 'icon', 'textTemplate', 'flavor']) {
      if (card[key] !== undefined && typeof card[key] !== 'string') issues.push(`${prefix}${key} must be text.`);
    }
    if (typeof card.type === 'string' && !card.type.trim()) issues.push(`${prefix}type must not be empty.`);
    for (const key of ['cost', 'staminaCost', 'manaCost']) {
      if (card[key] !== undefined && (typeof card[key] !== 'number' || !Number.isFinite(card[key]) || card[key] < 0)) issues.push(`${prefix}${key} must be a finite number of zero or more.`);
    }
    if (card.keywords !== undefined && (!Array.isArray(card.keywords) || card.keywords.some(keyword => typeof keyword !== 'string'))) issues.push(`${prefix}keywords must be an array of text values.`);
    if (base || card.effects !== undefined) {
      if (!Array.isArray(card.effects)) issues.push(`${prefix}effects must be an array.`);
      else if (card.effects.some(effect => !record(effect) || typeof effect.op !== 'string' || !effect.op.trim())) issues.push(`${prefix}effects must contain objects with a nonempty op.`);
    }
  }
  fields(value, '', true);
  if (value.upgrade !== undefined) {
    if (!record(value.upgrade)) issues.push('upgrade must be an object.');
    else {
      if (value.upgrade.id !== undefined && value.upgrade.id !== expectedId) issues.push('upgrade.id must match the unchanged card ID.');
      if (value.upgrade.name !== undefined && (typeof value.upgrade.name !== 'string' || !value.upgrade.name.trim())) issues.push('upgrade.name must be nonempty text.');
      fields(value.upgrade, 'upgrade.', false);
    }
  }
  return issues;
}

export function prepareCardDefinition(project, id, value) {
  const issues = validateCardDefinition(value, id);
  if (issues.length) throw new Error(issues.join(' '));
  if (!project.cards.some(card => card.id === id)) throw new Error('Selected card is no longer in this draft.');
  // JSON round-trip rejects values which cannot be represented in the draft.
  let serialized;
  try {
    serialized = JSON.stringify(value, (key, item) => {
      if (typeof item === 'number' && !Number.isFinite(item) || ['undefined', 'function', 'symbol', 'bigint'].includes(typeof item)) throw new Error('Card fields must contain JSON values.');
      return item;
    });
  } catch { throw new Error('Card fields must contain finite, non-circular JSON values.'); }
  if (serialized.length > 1_000_000) throw new Error('Card definition exceeds the 1 MB editor limit.');
  const candidate = JSON.parse(serialized);
  const next = {...project, cards: project.cards.map(card => card.id === id ? candidate : card)};
  const projectIssues = validateProject(next);
  if (projectIssues.length) throw new Error(projectIssues.join('; '));
  return candidate;
}

export function parseCardDefinition(text, project, id) {
  if (typeof text !== 'string' || text.length > 1_000_000) throw new Error('Card JSON must contain at most 1 MB of text.');
  let value;
  try { value = JSON.parse(text); } catch { throw new Error('Finish valid JSON to update the preview. The last valid card remains active.'); }
  return prepareCardDefinition(project, id, value);
}
