import {Views,Inspector} from './Views.jsx';
import {CardLayoutInspector} from './CardLayoutInspector.jsx';
import {CardDefinitionEditor} from './CardDefinitionEditor.jsx';
import './card-inspector.css';

export const INSPECTOR_EDIT_MODES=['Table','Form','Layout','JSON','Prompt'];
export function InspectorModeControl({ctx,modes}) {
  return <select aria-label="Inspector editing mode" value={ctx.inspectorMode} onChange={event=>ctx.setInspectorMode(event.target.value)}>{['Selection',...modes].map(mode=><option key={mode} value={mode}>{mode}</option>)}</select>;
}
export function InspectorWorkspace({ctx,modes}) {
  const selected=ctx.inspectorMode;
  const editorCtx={...ctx,mode:selected};
  return <>
    <div id="inspector-editor-panel" role="tabpanel" aria-label={selected+' inspector'} className="inspector-content">
      {selected==='Selection'?<Inspector ctx={ctx}/>:selected==='Layout'&&ctx.ws==='cards'?<CardLayoutInspector ctx={ctx}/>:ctx.ws==='cards'?<CardDefinitionEditor ctx={editorCtx}/>:<Views key={ctx.ws+'-'+selected} ctx={editorCtx}/>}
    </div>
  </>;
}
