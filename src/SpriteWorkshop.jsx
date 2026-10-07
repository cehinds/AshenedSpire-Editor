import {useEffect, useRef, useState} from 'react';
import {publicUrl} from './paths.js';
import {hostedSpritePack, portablePackProject, projectPoseRows, unpackSpritePack} from './sprite-pack.mjs';
import './sprite-workshop.css';

const examples = [['','Workshop example'], ...['reaver','herald','rogue'].flatMap(character => ['a','b'].map(group => [`hammer-${character}-${group}`, `${character} hammer ${group.toUpperCase()}`]))];

export function SpriteWorkshop() {
  const frame = useRef(null), input = useRef(null), activeRequest = useRef('');
  const [example,setExample] = useState(''), [pack,setPack] = useState(null), [entryId,setEntryId] = useState('');
  const [classId,setClassId] = useState(''), [rig,setRig] = useState(null), [poseId,setPoseId] = useState('');
  const [weapon,setWeapon] = useState(''), [status,setStatus] = useState('Import a portable sprite pack to browse class, armor and loadout.'), [busy,setBusy] = useState(false), [ready,setReady] = useState(false);
  const [details,setDetails] = useState(false);
  const [openRecovery,setOpenRecovery] = useState('');
  const standalone = !!globalThis.__ASHENEDSPIRE_HTML__;
  const entries = pack?.manifest.projects || [], classes = [...new Set(entries.map(row=>row.classId))];
  const shown = entries.filter(row=>!classId||row.classId===classId), entry = entries.find(row=>row.id===entryId);
  const poses = rig ? projectPoseRows(rig) : [], weapons = [...new Set(poses.map(row=>row.weaponType).filter(Boolean))];
  const visiblePoses = poses.filter(row=>!weapon||row.weaponType===weapon);
  const url = publicUrl('sprite-workshop/index.html') + (example ? `?project=${encodeURIComponent(example)}` : '');

  useEffect(()=>{
    const listener = event=>{
      if(event.origin!==location.origin || event.source!==frame.current?.contentWindow)return;
      if(event.data?.type==='sprite-workshop:ready')setReady(true);
      if(event.data?.requestId!==activeRequest.current)return;
      if(event.data?.type==='sprite-workshop:opened'){setBusy(false);setOpenRecovery(event.data.recoveryKey);setStatus(`Opened ${event.data.poseId}${event.data.recovered?' with recovered edits':''}. Save project preserves layers and artwork.`);}
      if(event.data?.type==='sprite-workshop:error'){setBusy(false);setStatus(event.data.message);}
    };
    window.addEventListener('message',listener);return()=>window.removeEventListener('message',listener);
  },[]);
  async function acceptPack(next) {
    setPack(next);setClassId('');setEntryId('');setRig(null);setPoseId('');setWeapon('');
    setStatus(`${next.manifest.title}: ${next.manifest.projects.length} armor projects. Choose one to inspect its loadouts.`);
  }
  async function importPack(file) {
    if(!file)return;setBusy(true);
    try{await acceptPack(unpackSpritePack(new Uint8Array(await file.arrayBuffer())));}catch(error){setStatus(error.message);}finally{setBusy(false);}
  }
  async function chooseEntry(id) {
    setEntryId(id);setRig(null);setPoseId('');setWeapon('');if(!id)return;setBusy(true);
    try{const next=await portablePackProject(pack,entries.find(row=>row.id===id));setRig(next);setPoseId(Object.keys(next.poses)[0]);setStatus(`${Object.keys(next.poses).length} loadouts ready. Open in Workshop to edit layers.`);}catch(error){setStatus(error.message);}finally{setBusy(false);}
  }
  function openRig() {
    if(!rig||!ready||busy)return;setBusy(true);activeRequest.current=crypto.randomUUID();
    frame.current.contentWindow.postMessage({type:'sprite-workshop:open',requestId:activeRequest.current,recoveryKey:`pack:${pack.manifest.id}:${entry.id}`,project:rig,poseId},location.origin);
  }
  if(standalone)return <section className="padded"><h2>Sprite Workshop</h2><p>Use the local or ordinary hosted editor for layered sprite packs. The single-file preview does not bundle the Workshop’s modules and source artwork.</p></section>;
  return <section className="sprite-workshop" aria-label="Sprite Workshop">
    <div className="sprite-workshop-toolbar">
      <button disabled={busy} onClick={()=>input.current.click()}>Import sprite pack</button>
      <input ref={input} hidden type="file" accept=".zip,application/zip" onChange={event=>{const file=event.target.files[0];event.target.value='';importPack(file);}}/>
      <button disabled={busy} onClick={async()=>{setBusy(true);try{await acceptPack(await hostedSpritePack(publicUrl('sprite-packs/current/manifest.json')));}catch(error){setStatus(error.message);}finally{setBusy(false);}}}>Bundled armor pack</button>
      {pack?<>
        <label>Class <select value={classId} disabled={busy} onChange={event=>{setClassId(event.target.value);setEntryId('');setRig(null);setPoseId('');setWeapon('');}}><option value="">All classes</option>{classes.map(id=><option key={id}>{id}</option>)}</select></label>
        <label>Armor <select value={entryId} disabled={busy} onChange={event=>chooseEntry(event.target.value)}><option value="">Choose armor…</option>{shown.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
      </>:<label>Example <select value={example} onChange={event=>{setReady(false);setExample(event.target.value);}}>{examples.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>}
      {rig?<>
        <label>Weapon <select value={weapon} disabled={busy} onChange={event=>{const value=event.target.value;setWeapon(value);setPoseId(poses.find(row=>!value||row.weaponType===value)?.id||'');}}><option value="">All weapons</option>{weapons.map(id=><option key={id}>{id}</option>)}</select></label>
        <label>Loadout <select value={poseId} disabled={busy} onChange={event=>setPoseId(event.target.value)}>{visiblePoses.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
        <button className="primary" disabled={busy||!ready||!poseId} onClick={openRig}>Open in Workshop</button>
      </>:null}
      <button aria-expanded={details} onClick={()=>setDetails(value=>!value)}>Pack details</button>
      <a href={openRecovery?publicUrl('sprite-workshop/index.html')+'?recovery='+encodeURIComponent(openRecovery):url} target="_blank" rel="noreferrer" title="Use one editing view at a time; both share browser recovery">Full window</a>
    </div>
    <div className="sprite-workshop-status" role="status">{busy?'Loading… ':''}{status}</div>
    {details?<div className="sprite-pack-details"><strong>{pack?.manifest.title||'Portable layered sprite authoring'}</strong><p>Authoring projects only. Browser recovery and portable exports are separate from game checkout writes and animation bindings.</p>{entry?<p><code>{entry.classId} / {entry.armorId}</code> · {poses.length} loadouts · {poses.filter(row=>row.reviewed).length} marked reviewed</p>:null}<p>Opening an armor restores its own saved edits. Use the Workshop Save project command for a durable .rig.json copy. Pack filters do not change the open canvas.</p>{pack?.manifest.provenance?<pre>{JSON.stringify(pack.manifest.provenance,null,2)}</pre>:null}</div>:null}
    <iframe ref={frame} src={url} title="Sprite Workshop editor"/>
  </section>;
}
