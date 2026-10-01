// Adapter inputs for the vendored AshenSpire renderer. This only projects
// authoring records; game rules and token resolution remain native.
export function previewContentBundle(base, draft, assignments = base.tagging) {
  const merge = (original = [], edited = []) => {
    const rows = new Map(original.map(row => [row.id, {...row}]));
    for (const row of edited) rows.set(row.id, {...rows.get(row.id), ...row});
    return [...rows.values()];
  };
  const nodes = merge(base.nodes, draft.nodes);
  const byId = new Map(nodes.map(row => [row.id, row]));
  const domain = row => {
    const seen = new Set();
    while (row.parentId && byId.has(row.parentId) && !seen.has(row.id)) {
      seen.add(row.id);
      row = byId.get(row.parentId);
    }
    return row.id;
  };
  const tags = nodes.filter(row => row.parentId).map(row => ({
    id: row.id, domain: domain(row), label: row.label,
    color: /^[0-9a-f]{6}$/i.test(row.color || '') ? row.color : 'D9B568',
    glyph: row.glyph || '', blurb: row.blurb || '', visibility: row.visibility || '',
  }));
  return {
    ...base,
    cards: merge(base.cards, draft.cards), nodes, tags,
    tagDomains: nodes.filter(row => !row.parentId).map(row => ({...row})),
    tagging: (draft.tagging ?? assignments ?? []).map(row => ({...row})),
  };
}

export function cardsForTag(cards, nodes, assignments, nodeId) {
  const selected = new Set([nodeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (selected.has(node.parentId) && !selected.has(node.id)) {
        selected.add(node.id);
        changed = true;
      }
    }
  }
  const ids = new Set(assignments.filter(row => row.family === 'card' && selected.has(row.tagId)).map(row => row.objectId));
  return cards.filter(card => ids.has(card.id));
}
