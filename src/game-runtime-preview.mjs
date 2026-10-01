// Legacy authoring packages have no tagging field. Use the editor's source
// assignments for those packages; an explicit array, including [], is authored.
export function combatPreviewSnapshot(p, workspace, testClass, sourceTagging) {
  return {
    project: {
      cards: p.cards, styles:p.styles, nodes: p.nodes, tagging: p.tagging ?? sourceTagging,
      deck: p.deck, scenario: p.scenario, ui: p.ui, gameSettings: p.gameSettings,
      pose: workspace === 'poses' ? p.pose : undefined,
    },
    workspace,
    testClass,
  };
}
