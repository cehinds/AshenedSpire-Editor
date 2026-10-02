import {useEffect,useId,useRef,useState} from 'react';
export function Notice({children,tone=''}){return <div className={'notice '+tone}>{children}</div>;}
export function NumberControl({label,value,min=0,max=100,step=1,unit='',onChange,onReset,live=false}){
 const [draft,setDraft]=useState(String(value)),[error,setError]=useState(''),hintId=useId();
 const ownValue=useRef(null);
 useEffect(()=>{if(ownValue.current!==value){setDraft(String(value));setError('');}ownValue.current=null;},[value]);
 function apply(next=draft){const n=Number(next);if(!next.trim()||!Number.isFinite(n)||n<min||n>max){setError(`Enter a number from ${min} to ${max}${unit?' '+unit:''}.`);return;}if(n!==value&&n!==ownValue.current){ownValue.current=n;onChange(n);}setError('');}
 function edit(next){setDraft(next);if(live)apply(next);else setError('');}
 function resetBuffer(){ownValue.current=null;setDraft(String(value));setError('');}
 const sliderValue=draft.trim()&&Number.isFinite(Number(draft))?Math.min(max,Math.max(min,Number(draft))):value;
 return <div className="number-control"><div className="number-control-head"><label>{label}</label>{onReset?<button type="button" className="text-button" title="Reset to inherited value" onClick={()=>{resetBuffer();onReset();}}>Reset</button>:null}<span>{unit}</span></div><div className="number-row" title={`${min}–${max}${unit?' '+unit:''} · step ${step}`}><button type="button" aria-label={`Decrease ${label}`} disabled={value<=min} onClick={()=>{const next=String(Math.max(min,value-step));setDraft(next);apply(next);}}>-</button><input aria-label={`${label} slider`} aria-describedby={hintId} type="range" min={min} max={max} step={step} value={sliderValue} onChange={e=>edit(e.target.value)} onPointerUp={e=>{if(!live)apply(e.currentTarget.value);}} onKeyUp={e=>{if(!live)apply(e.currentTarget.value);}}/><input aria-label={label} aria-describedby={hintId} className="exact" inputMode="decimal" value={draft} onChange={e=>edit(e.target.value)} onPointerUp={e=>{const el=e.currentTarget;if(el.selectionStart===el.selectionEnd)el.setSelectionRange(el.value.length,el.value.length);}} onBlur={()=>apply()} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}if(e.key==='Escape'){e.preventDefault();resetBuffer();}}}/><button type="button" aria-label={`Increase ${label}`} disabled={value>=max} onClick={()=>{const next=String(Math.min(max,value+step));setDraft(next);apply(next);}}>+</button></div>{error?<small className="error" role="alert">{error}</small>:null}<small id={hintId} className="visually-hidden">{min}–{max} {unit} / step {step}</small></div>;
}
export function TextField({label,value,onChange,multiline=false,disabled=false,live=false}){const [draft,setDraft]=useState(value??'');useEffect(()=>setDraft(value??''),[value]);const props={value:draft,disabled,onChange:e=>{const next=e.target.value;setDraft(next);if(live)onChange(next);},onBlur:()=>{if(!live&&draft!==(value??''))onChange(draft);},'aria-label':label};return <label className="field">{label}{multiline?<textarea rows={4} {...props}/>:<input {...props}/>}</label>;}
export function JsonEditor({value,onApply,validate=()=>[],live=false,showReset=false}){
 const document=JSON.stringify(value);
 const [text,setText]=useState(()=>JSON.stringify(value,null,2)),[error,setError]=useState('');
 const ownDocument=useRef(null);
 // Shared authoring updates clone records. Only changed document content should
 // replace an unfinished buffer; an accepted local edit keeps its formatting.
 useEffect(()=>{if(ownDocument.current!==document){setText(JSON.stringify(JSON.parse(document),null,2));setError('');}ownDocument.current=null;},[document]);
 function apply(next=text){
  try{
   const parsed=JSON.parse(next),problems=validate(parsed);
   if(problems.length)throw new Error(problems.join('; '));
   const serialized=JSON.stringify(parsed);
   if(serialized!==document&&serialized!==ownDocument.current){
    const previous=ownDocument.current;
    ownDocument.current=serialized;
    try{if(onApply(parsed)===false)throw new Error('Draft was rejected. Last valid document remains active.');}
    catch(problem){ownDocument.current=previous;throw problem;}
   }
   setError('');
  }catch(problem){setError(problem.message||'Draft could not be applied.');}
 }
 function resetBuffer(){ownDocument.current=null;setText(JSON.stringify(value,null,2));setError('');}
 return <div className="source-editor"><div className="source-actions"><span>{live?'Valid edits apply live. Last valid document remains active.':'Last valid document remains active.'}</span>{showReset?<button type="button" onClick={resetBuffer}>Reset JSON buffer</button>:null}<button type="button" className="primary" onClick={()=>apply()}>Apply valid draft</button></div><textarea aria-label="JSON source" aria-invalid={Boolean(error)} spellCheck={false} value={text} onChange={e=>{const next=e.target.value;setText(next);if(live)apply(next);else setError('');}}/>{error?<Notice tone="error"><span role="alert">{error}</span></Notice>:null}</div>;
}
export function DataTable({headers,children}){return <div className="table-scroll"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;}
export function rulesText(card){return (card.textTemplate||'No rules text supplied.').replace(/\{([\w.]+)\}/g,(all,key)=>{const [op,index]=key.split('.');const matches=card.effects.filter(e=>e.op===op||e.status===op||op==='hits'&&e.hits!==undefined);const e=matches[(Number(index)||1)-1],v=op==='hits'?e?.hits:e?.amount??e?.stacks;return typeof v==='number'?v:all;});}
export function Card({card,style={},upgraded=false}){return <article className="card-face" style={{fontSize:style.fontSize||17,height:`calc(var(--paper-card-width,262px) * ${(style.ratioHeight??7)/(style.ratioWidth??5)})`,aspectRatio:`${style.ratioWidth??5} / ${style.ratioHeight??7}`}}><h2>{card.name}</h2><span className="card-kind">{card.class||'Colorless'} / {card.type}</span>{style.art?<img className="card-art" src={style.art} alt={`${card.name} artwork override`} style={{objectFit:style.fit||'cover'}}/>:null}<p>{rulesText(card).replace(/\. /g,'.\n')}</p><div className="card-costs">Action {card.cost??0}{card.staminaCost?` / Stamina ${card.staminaCost}`:''}{card.manaCost?` / Mana ${card.manaCost}`:''}</div><span className="card-definition-status">{upgraded?'Upgraded':'Base'} definition</span></article>;}
export function download(name,value,mime='application/json'){const blob=new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)],{type:mime});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function loadImage(file){return new Promise((resolve,reject)=>{if(!['image/png','image/webp'].includes(file.type))return reject(new Error('Use PNG or WebP'));if(file.size>2_000_000)return reject(new Error('Image must be below 2 MB'));const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('Image read failed'));r.readAsDataURL(file);});}
export function PoseImage({src,alt,...props}){const [missing,setMissing]=useState(false);useEffect(()=>setMissing(false),[src]);return missing?<Notice tone="warning">Missing pose asset: {alt}. Replace or repair the reference.</Notice>:<img src={src} alt={alt} onError={()=>setMissing(true)} {...props}/>;}
