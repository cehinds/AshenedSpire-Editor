import {undo, redo} from './core.mjs';
import {CardCreation} from './AuthoringCreate.jsx';
import {ResponsiveChoices} from './ResponsiveChoices.jsx';
import './workspace-toolbar.css';

export function WorkspaceToolbar({ctx, title, modes, workspaces, repositoryMode, openLibrary, openInspector}) {
  const runAction = action => {
    if (action === 'undo') ctx.setH(undo);
    if (action === 'redo') ctx.setH(redo);
    if (action === 'library') openLibrary();
    if (action === 'inspector') openInspector();
  };
  return <div className="document-head workspace-toolbar" role="toolbar" aria-label="Workspace controls">
    <h1 title={title}>{title}</h1>
    <select className="collapsed-workspaces" aria-label="Workspace" value={ctx.ws} onChange={event=>ctx.switchWs(event.target.value)}>{workspaces.map(([id,label])=><option value={id} key={id}>{label}</option>)}</select>
    <ResponsiveChoices className="mode-tabs" label="Canvas preview modes" choices={modes.map(mode=>({value:mode,label:mode}))} value={ctx.mode} onChange={ctx.setMode}/>
    <div className="workspace-draft-actions">
      <button className="workspace-icon history-action" title="Undo draft change (Ctrl+Z)" aria-label="Undo draft change" disabled={repositoryMode || !ctx.h.past.length} onClick={() => ctx.setH(undo)}>↶</button>
      <button className="workspace-icon history-action" title="Redo draft change (Ctrl+Shift+Z)" aria-label="Redo draft change" disabled={repositoryMode || !ctx.h.future.length} onClick={() => ctx.setH(redo)}>↷</button>
      {ctx.ws === 'cards' ? <CardCreation ctx={ctx} compact/> : null}
    </div>
    <select className="collapsed-actions" aria-label="Workspace actions" value="" onChange={event=>runAction(event.target.value)}>
      <option value="" disabled>Actions</option>
      <option value="undo" disabled={repositoryMode || !ctx.h.past.length}>Undo draft change</option>
      <option value="redo" disabled={repositoryMode || !ctx.h.future.length}>Redo draft change</option>
      {!repositoryMode ? <option value="library">Library</option> : null}
      <option value="inspector">Inspector</option>
    </select>
    <span className="workspace-state" title={repositoryMode ? 'Repository host · explicit file saves' : 'Local draft · checkout saves remain separate'} aria-label={repositoryMode ? 'Repository host' : 'Local draft'}>●</span>
    {!repositoryMode ? <button className="mobile-library workspace-icon" title="Library" aria-label="Library" onClick={openLibrary}>☷</button> : null}
    <button className="mobile-inspector workspace-icon" title="Inspector" aria-label="Inspector" onClick={openInspector}>☰</button>
  </div>;
}
