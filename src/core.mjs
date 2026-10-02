import {validateCardLayout} from './card-layout.mjs';
import {validate as validatePose} from './native/model/presentationSequence.js';
import {validateWireframes} from './authoring-create.mjs';
import {validateGameSettingsOptional} from './game-settings.mjs';
import {validateLab,fitProblems} from './battlefield-lab.mjs';

export const clone = value => structuredClone(value);
export const SCHEMA = 'ashenspire.workbench/1';
export function parseCSV(text) {
  text=String(text).replace(/^\uFEFF/,'');
  const records=[];let row=[],cell='',quoted=false,closed=false,rowStart=true,hasContent=false;
  const finish=()=>{row.push(cell);if(hasContent)records.push(row);row=[];cell='';closed=false;rowStart=true;hasContent=false;};
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(rowStart&&!quoted){const rest=text.slice(i);if(/^[ \t]*#/.test(rest)){while(i<text.length&&text[i]!=='\n'&&text[i]!=='\r')i++;if(text[i]==='\r'&&text[i+1]==='\n')i++;continue;}rowStart=false;}
    if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
    if(c===','){row.push(cell);cell='';closed=false;hasContent=true;continue;}
    if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;finish();continue;}
    if(closed)throw new Error('Unexpected character after CSV quote');
    if(c==='"'){if(cell)throw new Error('Unexpected quote in CSV cell');quoted=true;hasContent=true;}
    else{cell+=c;if(c.trim())hasContent=true;}
  }
  if(quoted)throw new Error('Unclosed CSV quote');
  if(hasContent||row.length||cell)finish();
  if(!records.length)return [];
  const headers=records.shift();
  if(headers.some(h=>!h)||new Set(headers).size!==headers.length)throw new Error('CSV headers must be nonempty and unique');
  return records.map((cells,i)=>{if(cells.length!==headers.length)throw new Error(`CSV row ${i+2} has ${cells.length} fields; expected ${headers.length}`);return Object.fromEntries(headers.map((h,j)=>[h,cells[j]]));});
}
export function toCSV(rows,headers=Object.keys(rows[0]||{})) {const cell=v=>{const s=String(v??'');return s===''||/[",\n\r]/.test(s)||/^[ \t]*#/.test(s)?'"'+s.replaceAll('"','""')+'"':s;};if(!headers.length)return '';return [headers.map(cell).join(','),...rows.map(r=>headers.map(k=>cell(r[k])).join(','))].join('\n')+'\n';}
export function validateNodes(nodes) {
  const errors=[],map=new Map();for(const n of nodes){if(!n.id||!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(n.id))errors.push(`Invalid ID: ${n.id}`);if(map.has(n.id))errors.push(`Duplicate ID: ${n.id}`);map.set(n.id,n);}
  for(const n of nodes){if(n.parentId&&!map.has(n.parentId))errors.push(`Missing parent ${n.parentId} for ${n.id}`);let id=n.id;const seen=new Set();while(id&&map.has(id)){if(seen.has(id)){errors.push(`Parent cycle at ${n.id}`);break;}seen.add(id);id=map.get(id).parentId;}}return [...new Set(errors)];
}
export function reparent(nodes,id,parentId){if(!nodes.some(n=>n.id===id))throw new Error('Node does not exist');const next=nodes.map(n=>n.id===id?{...n,parentId}:n);const errors=validateNodes(next);if(errors.length)throw new Error(errors[0]);return next;}
export function validateProject(p) {const e=[];if(p?.schema!==SCHEMA)return ['Unsupported workbench package'];if(!Array.isArray(p.cards)||!p.cards.length||!Array.isArray(p.nodes)||!p.nodes.length||!Array.isArray(p.deck)||!p.styles||typeof p.styles!=='object'||!Array.isArray(p.scenes?.components?.sequence?.scenes)||!p.scenes.components.sequence.scenes.length||!p.lab||!p.pose||!p.ui||!p.scenario||!p.owned||!p.scenePlacement)return ['Incomplete workbench package'];
  if(p.nodes.some(n=>!n||typeof n.id!=='string'||typeof n.parentId!=='string'||typeof n.label!=='string'))return ['Malformed tag record'];
  if(p.cards.some(c=>!c||typeof c.id!=='string'||typeof c.name!=='string'||!c.name||!Array.isArray(c.effects)||c.effects.some(e=>!e||typeof e.op!=='string')||c.textTemplate!==undefined&&typeof c.textTemplate!=='string'))return ['Malformed card definition'];
  const ids=new Set();for(const card of p.cards){if(!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(card.id)||ids.has(card.id))e.push('Card IDs must be safe and unique');ids.add(card.id);}
  if(p.tagging!==undefined){
    if(!Array.isArray(p.tagging)||p.tagging.some(row=>!row||typeof row!=='object'||['family','scope','objectId','tagId'].some(key=>typeof row[key]!=='string')||!row.family||!row.objectId||!row.tagId))return ['Malformed native tag assignments'];
    const links=new Set();for(const row of p.tagging){const key=JSON.stringify([row.family,row.scope,row.objectId,row.tagId]);if(links.has(key))e.push('Duplicate native tag assignment');links.add(key);}
  }
  const scenes=p.scenes.components.sequence.scenes,sceneIds=new Set();for(const s of scenes){if(!s||typeof s.id!=='string'||!s.id||sceneIds.has(s.id)||typeof s.name!=='string'||typeof s.text!=='string')return ['Malformed scene definition'];sceneIds.add(s.id);}
  const bands=p.ui?.sizing?.bands;if(!bands||typeof bands!=='object'||Object.values(bands).some(v=>!Number.isFinite(v)||v<0)||Math.abs(Object.values(bands).reduce((a,b)=>a+b,0)-100)>.0001)e.push('UI bands must be nonnegative and sum to 100');
  for(const s of Object.values(p.styles)){if(!s||typeof s!=='object'||validateCardLayout(s.layout).length||s.theme!==undefined&&!['native','paper'].includes(s.theme)||s.fontSize!==undefined&&(!Number.isFinite(s.fontSize)||s.fontSize<12||s.fontSize>24)||['ratioWidth','ratioHeight'].some(key=>s[key]!==undefined&&(!Number.isFinite(s[key])||s[key]<1||s[key]>20))||s.art!==undefined&&(typeof s.art!=='string'||!/^data:image\/(png|webp);base64,[A-Za-z0-9+/=]+$/.test(s.art)||s.art.length>3_000_000))e.push('Invalid card presentation sidecar');}
  e.push(...validateLab(p.lab).map(message=>'Battlefield: '+message),...fitProblems(p.ui).map(message=>'Battlefield fit: '+message));
  try {e.push(...validatePose(p.pose).map(message=>'Presentation: '+message));}catch {e.push('Malformed presentation project');}
  if(p.erdNative!=null){
    try {
      const retained=p.erdNative,pages=inspectERD(retained.raw),page=pages.find(q=>q.id===retained.page),entity=page?.nodes.find(q=>q.id===retained.entity),mapping=retained.mapping;
      if(!entity||entity.type!=='entity'||!mapping||typeof mapping!=='object'||Array.isArray(mapping)||!['id','parent','label'].every(k=>typeof mapping[k]==='string')||!mapping.id||!mapping.label||!['id','parent','label'].every(k=>k==='parent'&&!mapping[k]||(entity.fields||[]).some(f=>f.name===mapping[k])))throw new Error('Invalid retained page, entity or field mapping');
    }catch(error){e.push('ERD mapping: '+error.message);}
  }
  if(!['legacy','foundations'].includes(p.scenario.ruleset)||!ids.has(p.scenario.cardId)||!Number.isFinite(p.scenario.playerHp)||!Number.isFinite(p.scenario.enemyHp))e.push('Malformed scenario draft');
  for(const id of p.deck)if(!ids.has(id))e.push(`Deck reference missing: ${id}`);
  e.push(...validateNodes(p.nodes),...validateWireframes(p.wireframes),...validateGameSettingsOptional(p.gameSettings));return e;
}
export function historyState(p){return {past:[],present:clone(p),future:[]};}
export function commit(h,p){return {past:[...h.past,clone(h.present)].slice(-40),present:clone(p),future:[]};}
export function undo(h){return h.past.length?{past:h.past.slice(0,-1),present:h.past.at(-1),future:[clone(h.present),...h.future]}:h;}
export function redo(h){return h.future.length?{past:[...h.past,clone(h.present)],present:h.future[0],future:h.future.slice(1)}:h;}
export function deckIssues(deck,owned,rules,cards) {const issues=[];if(!rules.deckMinUnlimited&&deck.length<rules.deckMinSize)issues.push(`At least ${rules.deckMinSize} cards required`);if(!rules.deckMaxUnlimited&&deck.length>rules.deckMaxSize)issues.push(`At most ${rules.deckMaxSize} cards allowed`);const counts={};for(const id of deck)counts[id]=(counts[id]||0)+1;for(const [id,n]of Object.entries(counts)){if(n>(owned[id]||0))issues.push(`${id}: only ${owned[id]||0} owned in this sandbox`);if(cards.find(c=>c.id===id)?.type==='power'&&n>rules.classSpellPowerCopies)issues.push(`${id}: class Power copy limit ${rules.classSpellPowerCopies}`);}return issues;}
export function inspectERD(data) {
  if(data?.format!=='erd-workbench'||![2,3].includes(data.version))throw new Error('Expected ERD Workbench native version 2 or 3');
  const pages=data.version===2?[{...data,name:'Page 1',id:'legacy'}]:data.pages;
  if(!Array.isArray(pages)||!pages.length||pages.length>40)throw new Error('Project requires 1-40 pages');
  for(const p of pages){
    if(!p||!Array.isArray(p.nodes)||!Array.isArray(p.edges)||p.nodes.length>500||p.edges.length>1000)throw new Error('Page exceeds supported diagram limits');
    const ids=new Set();
    for(const n of p.nodes){
      if(!n||typeof n.id!=='string'||!n.id||ids.has(n.id))throw new Error('Duplicate or missing diagram node ID');
      if(n.fields!==undefined&&(!Array.isArray(n.fields)||n.fields.some(f=>!f||typeof f.name!=='string')))throw new Error('Malformed diagram fields');
      ids.add(n.id);
    }
    for(const e of p.edges)if(!e||!ids.has(e.from)||!ids.has(e.to))throw new Error('Dangling diagram connector');
    if(p.data!=null){
      if(typeof p.data!=='object'||Array.isArray(p.data))throw new Error('Malformed diagram data');
      for(const d of Object.values(p.data))if(d?.mode==='imported'&&(!Array.isArray(d.rows)||d.rows.some(row=>!row||typeof row!=='object')))throw new Error('Malformed supplied rows');
    }
  }
  return pages;
}
export function suppliedRows(page,entityId){const n=page.nodes.find(n=>n.id===entityId),d=page.data?.[entityId];if(!n||d?.mode!=='imported'||!Array.isArray(d.rows))return [];return d.rows.map(row=>Array.isArray(row)?Object.fromEntries((n.fields||[]).map((f,i)=>[f.name,row[i]])):row);}
export function mapTagRows(rows,mapping,existing){const proposed=rows.map((r,i)=>{const id=String(r[mapping.id]??'').trim(),base=existing.find(n=>n.id===id)||Object.fromEntries(Object.keys(existing[0]||{id:'',parentId:'',label:''}).map(k=>[k,'']));return {...base,id,parentId:String(r[mapping.parent]??'').trim(),label:String(r[mapping.label]??'').trim(),_row:i+1};});const merged=new Map(existing.map(n=>[n.id,n]));for(const r of proposed)merged.set(r.id,r);const duplicates=proposed.filter((r,i)=>proposed.findIndex(q=>q.id===r.id)!==i).map(r=>`Duplicate supplied ID ${r.id}`);return {proposed,errors:[...duplicates,...proposed.filter(r=>!r.label).map(r=>`Row ${r._row}: label required`),...validateNodes([...merged.values()])],changed:proposed.filter(r=>existing.some(n=>n.id===r.id)).length};}
