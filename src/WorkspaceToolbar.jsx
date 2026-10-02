import {undo,redo} from './core.mjs';
import {CardCreation} from './AuthoringCreate.jsx';
import {ResponsiveChoices} from './ResponsiveChoices.jsx';
import './workspace-toolbar.css';

export function WorkspaceToolbar({ctx,title,modes,workspaces,repositoryMode,libraryOpen,openLibrary,openInspector}) {
  const cards=ctx.p.cards.filter(card=>(card.id+' '+card.name).toLowerCase().includes(ctx.query.toLowerCase()));
  const index=cards.findIndex(card=>card.id===ctx.card.id);
  const runAction=value=>{
    if(value.startsWith('workspace:'))ctx.switchWs(value.slice(10));
    if(value==='undo')ctx.setH(undo);
    if(value==='redo')ctx.setH(redo);
    if(value==='library')openLibrary();
    if(value==='inspector')openInspector();
    if(value==='card-to-game')ctx.openNativeCard?.(ctx.card.id);
  };
  return <div className={'document-head workspace-toolbar'+(ctx.ws==='cards'?' card-toolbar':'')} role="toolbar" aria-label="Workspace controls">
    {ctx.ws==='cards'?<CardCreation ctx={ctx} compact/>:null}
    <h1 title={title}>{ctx.ws==='cards'?ctx.card.name:title}</h1>
    {!repositoryMode?<button className="library-dropdown" title="Toggle Library" aria-label="Library" aria-expanded={libraryOpen} aria-controls="workspace-library" onClick={openLibrary}>{workspaces.find(([id])=>id===ctx.ws)?.[1]||'Library'} <span aria-hidden="true">▾</span></button>:null}
    {ctx.ws==='cards'?<>
      <div className="card-navigation"><button className="workspace-icon" title="Previous card" aria-label="Previous card" disabled={index<=0} onClick={()=>ctx.choose(cards[index-1].id)}>‹</button><button className="workspace-icon" title="Next card" aria-label="Next card" disabled={index<0||index===cards.length-1} onClick={()=>ctx.choose(cards[index+1].id)}>›</button></div>
      <label className="check card-visual-toggle"><input type="checkbox" role="switch" aria-label="In game preview" checked={ctx.mode==='In game'} onChange={event=>ctx.setMode(event.target.checked?'In game':'Visual')}/>In game</label>
      <button className="workspace-icon card-to-game" title="Add / save card to game… (reviewed, revision-checked checkout write)" aria-label="Add or save card to game" onClick={()=>ctx.openNativeCard?.(ctx.card.id)}>⇪</button>
    </>:<ResponsiveChoices className="mode-tabs" label="Canvas preview modes" viewportBreakpoint={1050} choices={modes.map(mode=>({value:mode,label:mode}))} value={ctx.mode} onChange={ctx.setMode}/>}
    <div className="workspace-draft-actions">
      <button className="workspace-icon history-action" title="Undo draft change (Ctrl+Z)" aria-label="Undo draft change" disabled={repositoryMode||!ctx.h.past.length} onClick={()=>ctx.setH(undo)}>↶</button>
      <button className="workspace-icon history-action" title="Redo draft change (Ctrl+Shift+Z)" aria-label="Redo draft change" disabled={repositoryMode||!ctx.h.future.length} onClick={()=>ctx.setH(redo)}>↷</button>
    </div>
    <select className="workspace-command-menu" aria-label="Workspace and actions" value={'workspace:'+ctx.ws} onChange={event=>runAction(event.target.value)}>
      <optgroup label="Workspaces">{workspaces.map(([id,label])=><option value={'workspace:'+id} key={id}>{label}</option>)}</optgroup>
      <optgroup label="Actions"><option value="undo" disabled={repositoryMode||!ctx.h.past.length}>Undo draft change</option><option value="redo" disabled={repositoryMode||!ctx.h.future.length}>Redo draft change</option>{ctx.ws==='cards'?<option value="card-to-game">Add / save card to game…</option>:null}{!repositoryMode?<option value="library">Toggle Library</option>:null}<option value="inspector">Inspector</option></optgroup>
    </select>
    <span className="workspace-state" title={repositoryMode?'Repository host · explicit file saves':'Local draft · checkout saves remain separate'} aria-label={repositoryMode?'Repository host':'Local draft'}>●</span>
    <button className="mobile-inspector workspace-icon" title="Inspector" aria-label="Inspector" onClick={openInspector}>☰</button>
  </div>;
}
