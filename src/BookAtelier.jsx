import {useEffect, useRef, useState} from 'react';
import {download} from './Controls.jsx';
import {useLocalHost} from './AuthGate.jsx';
import {BOOK_COVERS, BOOK_SYMBOLS, BOOK_TRIMS, BOOK_PALETTE} from './book-art/catalog.js';
import {renderBookArt, symbolUrl} from './book-art/render.js';
import {BOOK_NAMES, BOOK_SOURCE, defaultBooks, exportBookRecipes, importBookRecipes, readBookSource, reviewBookSource} from './book-art-model.mjs';
import './book-atelier.css';

function BookImage({id, recipe}) {
  const target = useRef(null);
  useEffect(() => {target.current.replaceChildren(renderBookArt({id}, {recipe}));}, [id, JSON.stringify(recipe)]);
  return <span ref={target} className="atelier-image"/>;
}

export function BookAtelier({ctx}) {
  const host = useLocalHost();
  const local = host?.connected === true && !host.offline;
  const recipes = ctx.p.bookArt ?? defaultBooks();
  const [selected, setSelected] = useState(Object.keys(recipes)[0]);
  const id = Object.hasOwn(recipes, selected) ? selected : Object.keys(recipes)[0];
  const recipe = recipes[id];
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [repos, setRepos] = useState([]);
  const [repoId, setRepoId] = useState('');
  const [review, setReview] = useState(null);
  const [busy, setBusy] = useState(false);
  const token = useRef('');
  const file = useRef(null);
  const draftKey = JSON.stringify(recipes);
  const currentDraft = useRef(draftKey);
  currentDraft.current = draftKey;
  useEffect(() => {setReview(null); token.current = ''; setRepos([]); setRepoId('');}, [host?.connectionId, local]);
  const patch = (key, value) => ctx.update(p => {p.bookArt = {...recipes, [id]: {...recipe, [key]: value}};}, 'Book artwork updated');
  async function action(fn) {setError(''); setBusy(true); try {await fn();} catch (problem) {setError(problem.message);} finally {setBusy(false);}}
  async function request(path, options = {}) {
    if (!local) throw new Error('Checkout access requires the local editor host.');
    const response = await fetch('/api/workbench' + path, {...options, credentials: 'same-origin', headers: {'Accept':'application/json', ...(options.body ? {'Content-Type':'application/json', 'X-Workbench-CSRF':token.current} : {})}});
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Local repository host unavailable.');
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Checkout request failed.');
    return result;
  }
  async function connect() {
    const status = await request('/status');
    token.current = status.csrfToken;
    const value = await request('/repos');
    const available = value.repos.filter(repo => repo.kind === 'local' && repo.status === 'connected');
    setRepos(available); setRepoId(available[0]?.id || ''); setReview(null);
    setMessage(available.length ? 'Choose the game checkout to load or review artwork recipes.' : 'Add a local game repository in Project tools → Repositories first.');
  }
  async function load() {
    const value = await request(`/repos/${encodeURIComponent(repoId)}/file?path=${encodeURIComponent(BOOK_SOURCE)}`);
    const parsed = readBookSource(value.content);
    ctx.update(p => {p.bookArt = parsed.recipes;}, 'Checkout book recipes loaded into draft');
    setReview(null); setMessage('Loaded checkout recipes into the authoring draft.');
  }
  async function prepare() {
    const key = draftKey;
    const value = await request(`/repos/${encodeURIComponent(repoId)}/file?path=${encodeURIComponent(BOOK_SOURCE)}`);
    const result = reviewBookSource(value.content, recipes);
    if (currentDraft.current !== key) throw new Error('Draft changed while reading checkout. Review again.');
    setReview({...result, revision:value.revision, repoId, draftKey:key});
    setMessage('Review the proposed module before saving. Unchanged checkout recipes are preserved.');
  }
  async function save() {
    if (!review || review.draftKey !== currentDraft.current || review.repoId !== repoId) throw new Error('Draft or checkout changed since review. Review again.');
    await request(`/repos/${encodeURIComponent(repoId)}/file`, {method:'PUT', body:JSON.stringify({path:BOOK_SOURCE, content:review.after, revision:review.revision})});
    setReview(null); setMessage('Book artwork saved to the local checkout. No commit or push.');
  }
  return <section className="book-atelier" aria-label="Book Atelier">
    <div className="atelier-toolbar"><strong>Book Atelier</strong><span>{Object.keys(recipes).length} recipes</span><button onClick={() => file.current.click()}>Import recipes</button><button onClick={() => download('book-art-recipes.json', {recipes})}>Export JSON</button><button onClick={() => download('bookArtPresets.js', exportBookRecipes(recipes), 'text/javascript')}>Export game module</button><input ref={file} type="file" accept=".json" hidden onChange={event => {const chosen=event.target.files?.[0]; event.target.value=''; if(chosen) action(async () => {if(chosen.size>200000) throw new Error('Recipe file exceeds 200 KB.'); const imported=importBookRecipes(await chosen.text()); ctx.update(p=>{p.bookArt=imported;}, 'Book recipes imported'); setReview(null);});}}/></div>
    {error ? <p className="notice error" role="alert">{error}</p> : null}
    <div className="atelier-layout">
      <nav className="atelier-library" aria-label="Book recipes">{Object.entries(recipes).map(([key, art]) => <button key={key} aria-pressed={key===id} onClick={()=>setSelected(key)}><BookImage id={key} recipe={art}/><span>{BOOK_NAMES[key] || key}</span></button>)}</nav>
      <div className="atelier-canvas"><div className="atelier-hero"><BookImage id={id} recipe={recipe}/></div><h2>{BOOK_NAMES[id] || id}</h2><p>Painted layers · full binding color</p><div className="atelier-variations">{BOOK_COVERS.map(cover=><button key={cover} aria-label={`Use ${cover} binding`} aria-pressed={recipe.cover===cover} onClick={()=>patch('cover',cover)}><BookImage id={id} recipe={{...recipe,cover}}/><span>{cover}</span></button>)}</div></div>
      <aside className="atelier-inspector" aria-label="Book artwork controls"><h3>Binding & emblem</h3><label>Book<select aria-label="Selected book" value={id} onChange={e=>setSelected(e.target.value)}>{Object.keys(recipes).map(key=><option key={key} value={key}>{BOOK_NAMES[key] || key}</option>)}</select></label><label>Binding<select value={recipe.cover} onChange={e=>patch('cover',e.target.value)}>{BOOK_COVERS.map(key=><option key={key}>{key}</option>)}</select></label><div className="atelier-colors"><label>Leather<input type="color" aria-label="Leather color" value={recipe.color} onChange={e=>patch('color',e.target.value)}/></label><label>Metal<input type="color" aria-label="Metal color" value={recipe.ink} onChange={e=>patch('ink',e.target.value)}/></label></div><div className="atelier-palette">{BOOK_PALETTE.map(color=><button key={color} style={{backgroundColor:color}} aria-label={`Leather ${color}`} onClick={()=>patch('color',color)}/>)}</div><label>Finish<select value={recipe.treatment} onChange={e=>patch('treatment',e.target.value)}><option value="solid">Polished relief</option><option value="line">Aged relief</option><option value="seal">Raised seal</option></select></label><label>Tooling<select value={recipe.trim} onChange={e=>patch('trim',e.target.value)}>{BOOK_TRIMS.map(key=><option key={key}>{key}</option>)}</select></label><div className="atelier-symbols" aria-label="Emblems">{BOOK_SYMBOLS.map(symbol=><button key={symbol} title={symbol} aria-label={`Use ${symbol} emblem`} aria-pressed={recipe.symbol===symbol} onClick={()=>patch('symbol',symbol)}><img src={symbolUrl(symbol)} alt=""/><span>{symbol}</span></button>)}</div><button onClick={()=>ctx.update(p=>{p.bookArt={...recipes,[id]:defaultBooks()[id] || defaultBooks().universalTome};},'Selected book reset')}>Reset selected book</button></aside>
    </div>
    <details className="atelier-checkout"><summary>Save artwork to game checkout</summary><p>Drafts autosave with the project and support Undo / Redo. Checkout saves update artwork recipes only. XP and learning rules stay in the game.</p>{local ? <><div className="button-row"><button disabled={busy} onClick={()=>action(connect)}>Find local checkouts</button><select aria-label="Book target checkout" value={repoId} disabled={busy} onChange={e=>{setRepoId(e.target.value);setReview(null);}}><option value="">Choose game checkout</option>{repos.map(repo=><option key={repo.id} value={repo.id}>{repo.name || repo.id}</option>)}</select><button disabled={busy || !repoId} onClick={()=>action(load)}>Load checkout recipes</button><button disabled={busy || !repoId} onClick={()=>action(prepare)}>Review artwork save</button></div>{review ? <><p>{review.draftKey!==draftKey ? 'Draft changed. Review again before saving.' : 'Revision '+review.revision.slice(0,12)}</p><div className="atelier-review"><label>Current checkout<textarea aria-label="Current book source" readOnly value={review.before}/></label><label>Proposed artwork<textarea aria-label="Proposed book source" readOnly value={review.after}/></label></div><button className="primary" disabled={busy || review.draftKey!==draftKey || review.repoId!==repoId || review.before===review.after} onClick={()=>action(save)}>Save reviewed artwork to game</button></> : null}</> : <p>Public previews support drafts and exports. Use the local editor for reviewed checkout saves.</p>}<p role="status">{message}</p></details>
  </section>;
}
