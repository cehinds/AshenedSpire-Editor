import {Views,Inspector} from './Views.jsx';
import {CardDefinitionEditor} from './CardDefinitionEditor.jsx';
import './card-inspector.css';

export const INSPECTOR_EDIT_MODES=['Table','Form','JSON','Prompt'];
export function InspectorWorkspace({ctx,modes}) {
  const selected=ctx.inspectorMode;
  const editorCtx={...ctx,mode:selected};
  return <>
    <div className="inspector-mode-tabs" role="tablist" aria-label="Inspector editing modes">{['Selection',...modes].map(mode=><button key={mode} type="button" role="tab" aria-selected={selected===mode} aria-controls="inspector-editor-panel" onClick={()=>ctx.setInspectorMode(mode)}>{mode}</button>)}</div>
    <div id="inspector-editor-panel" role="tabpanel" aria-label={selected+' inspector'} className="inspector-content">
      {selected==='Selection'?<Inspector ctx={ctx}/>:ctx.ws==='cards'?<CardDefinitionEditor ctx={editorCtx}/>:<Views key={ctx.ws+'-'+selected} ctx={editorCtx}/>}
    </div>
  </>;
}
