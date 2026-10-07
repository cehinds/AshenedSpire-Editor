import {useEffect, useState} from 'react';
import {publicUrl} from './paths.js';
import './sprite-workshop.css';

export function ArtStudy({ctx}) {
  if(globalThis.__ASHENEDSPIRE_HTML__)return <section className="padded"><h2>Combat art study</h2><p>Open the local or ordinary hosted editor to use the layered Combat Studio. The single-file preview does not bundle this independent tool.</p></section>;
  return <section className="sprite-workshop" aria-label="Combat art study"><div className="sprite-workshop-toolbar"><strong>Combat art study</strong><small>Independent desktop and phone drafts, art sizing and effect previews.</small><button onClick={()=>ctx.setMode('Layout')}>Native HUD & layout</button><a href={publicUrl('combat-art/editor/index.html')} target="_blank" rel="noreferrer">Full window</a></div><iframe title="Combat art study editor" src={publicUrl('combat-art/editor/index.html')}/></section>;
}

export function ArtCatalog() {
  const [catalog,setCatalog]=useState(null),[matrix,setMatrix]=useState([]),[error,setError]=useState('');
  const [query,setQuery]=useState(''),[classId,setClassId]=useState(''),[view,setView]=useState('gallery'),[selected,setSelected]=useState('');
  useEffect(()=>{
    if(globalThis.__ASHENEDSPIRE_HTML__)return;
    let active=true;
    Promise.all(['catalog.json','matrix.json'].map(async file=>{const response=await fetch(publicUrl('combat-art/'+file));if(!response.ok)throw Error('Cannot load the art catalog.');return response.json();})).then(([catalog,matrix])=>{if(active){setCatalog(catalog);setMatrix(matrix);}}).catch(error=>{if(active)setError(error.message);});
    return()=>{active=false;};
  },[]);
  if(globalThis.__ASHENEDSPIRE_HTML__)return <section className="padded"><h2>Combat art catalog</h2><p>The local or ordinary hosted editor includes this provenance catalog. Source masters remain in the approved art package.</p></section>;
  const entries=catalog?.entries||[], classes=[...new Set(entries.map(row=>row.classId).filter(Boolean))];
  const match=row=>(!classId||row.classId===classId)&&JSON.stringify([row.id,row.name,row.armorName,row.canonicalId,row.canonicalIds]).toLowerCase().includes(query.toLowerCase());
  const shown=entries.filter(match), row=entries.find(row=>row.id===selected);
  return <section className="sprite-art-catalog" aria-label="Combat art catalog"><div className="sprite-workshop-toolbar"><label>Search <input aria-label="Search combat art" type="search" value={query} onChange={event=>setQuery(event.target.value)}/></label><label>Class <select value={classId} onChange={event=>setClassId(event.target.value)}><option value="">All artwork</option>{classes.map(id=><option key={id}>{id}</option>)}</select></label><button aria-pressed={view==='gallery'} onClick={()=>setView('gallery')}>Gallery</button><button aria-pressed={view==='matrix'} onClick={()=>setView('matrix')}>Armor matrix</button><small>Derived transparent review previews. Original PNG hashes and canonical restrictions retained.</small></div>
    {error?<p role="alert">{error}</p>:!catalog?<p role="status">Loading artwork…</p>:null}
    {view==='gallery'?<div className="sprite-art-grid">{shown.map(entry=><button className={selected===entry.id?'selected':''} key={entry.id} onClick={()=>setSelected(entry.id)}><img src={publicUrl('combat-art/'+entry.file)} alt={entry.name||entry.id} loading="lazy"/><strong>{entry.name||entry.id}</strong><small>{entry.classId||entry.category||entry.kind} · {entry.id}</small></button>)}</div>:<div className="sprite-art-matrix"><table><thead><tr><th>Armor</th><th>Class</th><th>Coverage</th><th>Canonical IDs / restriction</th></tr></thead><tbody>{matrix.filter(match).map((cell,index)=><tr key={index}><td>{cell.armorName}</td><td>{cell.classId}</td><td>{cell.supported?'Available':'Unsupported'}</td><td>{cell.supported?cell.canonicalIds.join(', '):cell.reason}</td></tr>)}</tbody></table></div>}
    {row?<aside className="sprite-art-provenance"><button onClick={()=>setSelected('')}>Close details</button><strong>{row.name||row.id}</strong><code>{row.canonicalId||row.id}</code><p>{row.facing||row.orientation}</p><small>Original master: {row.sourceMaster.package}/{row.sourceMaster.file}</small><code>SHA256 {row.sourceMaster.sha256}</code><a href={publicUrl('combat-art/'+row.file)} download>Download review WebP</a><small>Authoring preview; inclusion in this catalog does not install a game asset.</small></aside>:null}
  </section>;
}
