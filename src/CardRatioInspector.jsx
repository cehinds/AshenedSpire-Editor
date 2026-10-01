import {NumberControl} from './Controls.jsx';

export function CardRatioInspector({ctx}) {
  const {p,card,update}=ctx,style=p.styles[card.id]||{};
  const patch=(key,value)=>update(next=>{next.styles[card.id]={...next.styles[card.id],[key]:value};},'Card preview proportions updated');
  return <fieldset className="card-ratio-inspector"><legend>Card presentation</legend><label className="field">Visual appearance<select aria-label="Visual appearance" value={style.theme||'native'} onChange={event=>patch('theme',event.target.value)}><option value="native">Native game card</option><option value="paper">Warm paper</option></select></label><div className="card-ratio-fields">
    <NumberControl label="Ratio width" value={style.ratioWidth??5} min={1} max={20} onChange={value=>patch('ratioWidth',value)}/>
    <NumberControl label="Ratio height" value={style.ratioHeight??7} min={1} max={20} onChange={value=>patch('ratioHeight',value)}/>
    </div><button className="text-button" disabled={style.ratioWidth===undefined&&style.ratioHeight===undefined} onClick={()=>update(next=>{delete next.styles[card.id].ratioWidth;delete next.styles[card.id].ratioHeight;},'Card proportions reset to 5:7')}>Reset to 5:7</button><small>Preview presentation override · export whole project to retain it.</small></fieldset>;
}
