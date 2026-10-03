import {useEffect, useRef, useState} from 'react';
import {publicUrl} from './paths.js';
import {useLocalHost} from './AuthGate.jsx';
import {validate} from '../public/parts/footer-atelier/model.mjs';
import {FOOTER_SOURCE, readFooterSource, reviewFooterSource} from './footer-layout-source.mjs';
import './footer-atelier.css';

export function FooterAtelier() {
 const host=useLocalHost(), local=host?.connected===true&&!host.offline;
 const frame=useRef(null),token=useRef(''),current=useRef('');
 const [draft,setDraft]=useState(null),[repos,setRepos]=useState([]),[repoId,setRepoId]=useState('');
 const [review,setReview]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const draftKey=JSON.stringify(draft);
 current.current=draftKey;
 useEffect(()=>{token.current='';setRepos([]);setRepoId('');setReview(null);},[host?.connectionId,local]);
 useEffect(()=>{
  const receive=event=>{
   if(event.source!==frame.current?.contentWindow||event.origin!==location.origin||event.data?.type!=='footer-atelier:change')return;
   try{setDraft(validate(event.data.document));}catch(problem){setError(problem.message);}
  };
  window.addEventListener('message',receive);
  frame.current?.contentWindow?.postMessage({type:'footer-atelier:request'},location.origin==='null'?'*':location.origin);
  return ()=>window.removeEventListener('message',receive);
 },[]);
 async function action(fn){setError('');setBusy(true);try{await fn();}catch(problem){setError(problem.message);}finally{setBusy(false);}}
 async function request(path,options={}){
  if(!local)throw Error('Checkout access requires the local editor host.');
  const response=await fetch('/api/workbench'+path,{...options,credentials:'same-origin',headers:{Accept:'application/json',...(options.body?{'Content-Type':'application/json','X-Workbench-CSRF':token.current}:{})}});
  if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Local repository host unavailable.');
  const result=await response.json();if(!response.ok)throw Error(result.error||'Checkout request failed.');return result;
 }
 async function connect(){
  token.current=(await request('/status')).csrfToken;
  const available=(await request('/repos')).repos.filter(repo=>repo.kind==='local'&&repo.status==='connected');
  setRepos(available);setRepoId(available[0]?.id||'');setReview(null);
  setMessage(available.length?'Choose the game checkout.':'Add a local game repository in Project tools → Repositories first.');
 }
 const source=()=>request(`/repos/${encodeURIComponent(repoId)}/file?path=${encodeURIComponent(FOOTER_SOURCE)}`);
 async function load(){
  const next=readFooterSource((await source()).content);
  frame.current?.contentWindow?.postMessage({type:'footer-atelier:load',document:next},location.origin==='null'?'*':location.origin);
  setReview(null);setMessage('Loaded checkout layout into the Footer Atelier draft.');
 }
 async function prepare(){
  const key=draftKey,value=await source(),result=reviewFooterSource(value.content,draft);
  if(current.current!==key)throw Error('Draft changed while reading checkout. Review again.');
  setReview({...result,revision:value.revision,repoId,draftKey:key});
  setMessage('Review artwork geometry and text templates before saving. Live game counts are not edited.');
 }
 async function save(){
  if(!review||review.draftKey!==current.current||review.repoId!==repoId)throw Error('Draft or checkout changed since review. Review again.');
  await request(`/repos/${encodeURIComponent(repoId)}/file`,{method:'PUT',body:JSON.stringify({path:FOOTER_SOURCE,content:review.after,revision:review.revision})});
  setReview(null);setMessage('Footer layout saved to the local checkout. Rebuild the game to apply it. No commit or push.');
 }
 return <section className="footer-atelier-host" aria-label="Footer component authoring">
  <iframe ref={frame} title="Footer Atelier" src={publicUrl('footer-atelier.html')}/>
  <details className="footer-checkout"><summary>Save footer layout to game checkout</summary>
   <p>Artwork and text use independent layers. Text bindings supply live game values; fonts, alignment and positions remain editable.</p>
   {local?<><div className="button-row"><button disabled={busy} onClick={()=>action(connect)}>Find local checkouts</button><select aria-label="Footer target checkout" value={repoId} disabled={busy} onChange={e=>{setRepoId(e.target.value);setReview(null);}}><option value="">Choose game checkout</option>{repos.map(repo=><option key={repo.id} value={repo.id}>{repo.name||repo.id}</option>)}</select><button disabled={busy||!repoId} onClick={()=>action(load)}>Load checkout layout</button><button disabled={busy||!repoId||!draft} onClick={()=>action(prepare)}>Review footer save</button></div>
    {review?<><p>{review.draftKey!==draftKey?'Draft changed. Review again before saving.':'Revision '+review.revision.slice(0,12)}</p><div className="footer-source-review"><label>Current checkout<textarea aria-label="Current footer layout" readOnly value={review.before}/></label><label>Proposed layout<textarea aria-label="Proposed footer layout" readOnly value={review.after}/></label></div><button className="primary" disabled={busy||review.draftKey!==draftKey||review.repoId!==repoId||review.before===review.after} onClick={()=>action(save)}>Save reviewed footer to game</button></>:null}</>:<p>Public previews support drafts and exports. Use the local editor for reviewed checkout saves.</p>}
   {error?<p className="notice error" role="alert">{error}</p>:null}<p role="status">{message}</p><code>{FOOTER_SOURCE}</code>
  </details>
 </section>;
}
