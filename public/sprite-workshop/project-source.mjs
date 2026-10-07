// Bundled projects have independent browser recovery slots. Opening one never
// replaces the example project's autosave or another outfit family's work.
export function projectSource(search = '') {
  const recovery = new URLSearchParams(search).get('recovery');
  if(recovery){if(!recovery.startsWith('pack:')||recovery.length>300||/[\u0000-\u001f]/.test(recovery))throw Error('Invalid recovery slot.');return {src:'starter.json',recoveryKey:recovery};}
  const id = new URLSearchParams(search).get('project');
  if (!id) return {src: 'starter.json', recoveryKey: 'autosave'};
  if (!/^hammer-(reaver|herald|rogue)-[ab]$/.test(id)) {
    throw new Error('Unknown bundled sprite project.');
  }
  return {src: `projects/${id}.rig.json`, recoveryKey: `bundled:${id}`};
}
