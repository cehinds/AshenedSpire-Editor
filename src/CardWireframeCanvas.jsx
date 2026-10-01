import {rulesText} from './Controls.jsx';
import './card-inspector.css';

export function CardWireframeCanvas({ctx}) {
  const {card,p,cardSection,chooseCardSection}=ctx;
  const style=p.styles[card.id]||{};
  const section=(id,label,children)=> <button type="button" className={'card-wireframe-section section-'+id+(cardSection===id?' selected':'')} aria-label={'Edit '+label+' section'} aria-pressed={cardSection===id} onClick={()=>chooseCardSection(id)}><span className="wireframe-section-label">{label}</span>{children}</button>;
  return <section className="card-wireframe-canvas" aria-label="Expanded card wireframe">
    <div className="expanded-card-wireframe">
      {section('identity','Name and identity',<><strong className="wireframe-card-name">{card.name}</strong><span>{card.class||'Colorless'} · {card.type} · {card.rarity||'Unspecified rarity'}</span></>)}
      {section('costs','Resource costs',<div className="wireframe-costs"><span><b>{card.cost??0}</b> Action</span><span><b>{card.staminaCost??0}</b> Stamina</span><span><b>{card.manaCost??0}</b> Mana</span></div>)}
      {section('art','Artwork',style.art?<img src={style.art} alt={card.name+' artwork override'} style={{objectFit:style.fit==='contain'?'contain':'cover'}}/>:<div className="wireframe-art-empty"><span>Artwork region</span><small>Import PNG or WebP in the inspector</small></div>)}
      {section('tags','Keywords',<div className="wireframe-keywords">{card.keywords?.length?card.keywords.map((keyword,index)=><span key={index}>{typeof keyword==='string'?keyword:JSON.stringify(keyword)}</span>):<span>No definition keywords</span>}</div>)}
      {section('rules','Rules and effects',<><p style={{fontSize:style.fontSize??17}}>{rulesText(card)}</p><small>{card.effects.length} native effect{card.effects.length===1?'':'s'}</small></>)}
      {section('footer','Flavor and footer',<><p>{card.flavor||'No flavor text'}</p><code>{card.id}</code></>)}
      {section('upgrade','Upgrade',<span>{card.upgrade?'Upgraded definition available':'No upgrade defined'}</span>)}
    </div>
    <p className="wireframe-caption">Draft anatomy · Native rendering in In game · Checkout saves remain separate.</p>
  </section>;
}
