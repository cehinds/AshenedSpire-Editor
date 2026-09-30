const scalar = value => value && typeof value === 'object' ? JSON.stringify(value) : value ?? '';
const properties = value => Object.entries(value || {}).map(([key,value])=>({key,value:scalar(value)}));
export function authoringSheets(project, workspace, mode) {
  const cards={name:'Cards',records:project.cards};
  const tags={name:'Tags',records:project.nodes};
  const scenes={name:'Opening scenes',records:project.scenes.components.sequence.scenes};
  const settings={name:'Game settings',records:properties(project.gameSettings?.overrides)};
  const layouts={name:'UI config',records:properties(project.ui)};
  switch(workspace) {
    case 'cards': return [cards];
    case 'tags': return [tags];
    case 'scenes': return [scenes];
    case 'decks': return [{name:'Deck',records:project.deck.map((id,index)=>({position:index+1,id,name:project.cards.find(card=>card.id===id)?.name||'',sandboxOwned:project.owned[id]||0}))}];
    case 'ui': return [layouts,{name:'Wireframes',records:project.wireframes||[]}];
    case 'poses': return [{name:'Effect clips',records:project.pose.clips},{name:'Bindings',records:project.pose.bindings}];
    case 'battlefield': return [{name:'Battlefield proposal',records:properties(project.lab)}];
    case 'combat': return [{name:'Scenario proposal',records:properties(project.scenario)}];
    default: return mode==='Game settings'?[settings]:[cards,tags,scenes,layouts,settings];
  }
}
export function tableCsvRecords(project,workspace,mode) {
  const sheets=authoringSheets(project,workspace,mode);
  const sheet=sheets[0];
  const headers=[...new Set(sheet.records.flatMap(record=>Object.keys(record)))];
  return {name:sheet.name,headers,rows:sheet.records.map(record=>Object.fromEntries(headers.map(key=>[key,scalar(record[key])]))) };
}
