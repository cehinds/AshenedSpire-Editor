import {useEffect, useRef, useState} from 'react';
import {createCardDefinition, createWireframeDefinition, suggestDraftId} from './authoring-create.mjs';
import {Notice, download} from './Controls.jsx';
import './authoring-create.css';

function CreationReview({kind, records, defaultName, make, commit, children}) {
  const [open, setOpen] = useState(false), [name, setName] = useState(defaultName), [id, setId] = useState(() => suggestDraftId(defaultName, records));
  const [customId, setCustomId] = useState(false), input = useRef();
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  let proposed, issue = '';
  if (open) try { proposed = make({id, name}); } catch (error) { issue = error.message; }
  function start() { setName(defaultName); setId(suggestDraftId(defaultName, records)); setCustomId(false); setOpen(true); }
  return <section className="draft-create" aria-label={'Create ' + kind + ' draft'}>
    <div className="button-row"><button onClick={start} disabled={open}>New {kind}…</button><small>{kind === 'card' ? 'Copy a native definition into a separate draft.' : 'Save current native layout as a named draft.'}</small></div>
    {open ? <div className="draft-create-review"><h2>Review new {kind} draft</h2><div className="form-grid"><label className="field">New {kind} name<input ref={input} aria-label={'New ' + kind + ' name'} maxLength={120} value={name} onChange={event => { const next = event.target.value; setName(next); if (!customId) setId(suggestDraftId(next, records)); }}/></label><label className="field">Stable {kind} ID<input aria-label={'New ' + kind + ' ID'} maxLength={96} value={id} onChange={event => { setId(event.target.value); setCustomId(true); }}/></label>{children}</div>
      <Notice>{kind === 'card' ? 'Copies all native fields, effects and upgrade from the chosen template. This creates two owned sandbox copies; tag assignments, artwork overrides and game source are unchanged.' : 'Stores the full native UI configuration, including unknown fields, in the authoring package. This is a geometry draft; creating it does not add a runtime mode or compile game source.'}</Notice>
      {issue ? <Notice tone="error">{issue}</Notice> : <details><summary>Inspect complete proposed JSON</summary><pre>{JSON.stringify(proposed, null, 2)}</pre></details>}
      <div className="button-row"><button className="primary" disabled={!!issue} onClick={() => { commit(proposed); setOpen(false); }}>Create reviewed {kind} draft</button><button onClick={() => setOpen(false)}>Cancel creation</button></div>
    </div> : null}
  </section>;
}

export function CardCreation({ctx: c}) {
  const [templateId, setTemplateId] = useState(c.card.id);
  const activeTemplate = c.p.cards.some(card => card.id === templateId) ? templateId : c.card.id;
  return <CreationReview kind="card" records={c.p.cards} defaultName="New card" make={identity => createCardDefinition(c.p, activeTemplate, identity)} commit={definition => {
    c.update(project => { project.cards.push(definition); project.owned[definition.id] = 2; }, 'New card created in authoring draft');
    c.clearQuery?.();
    c.choose(definition.id, 'cards');
  }}><label className="field">Native card template<select aria-label="Native card template" value={activeTemplate} onChange={event => setTemplateId(event.target.value)}>{c.p.cards.map(card => <option key={card.id} value={card.id}>{card.name} / {card.id}</option>)}</select></label></CreationReview>;
}

export function WireframeCreation({ctx: c}) {
  const records = c.p.wireframes || [], [selectedId, setSelectedId] = useState(''), [replaceReviewed, setReplaceReviewed] = useState(false);
  const selected = records.find(record => record.id === selectedId);
  const activeMatches = selected && JSON.stringify(selected.config) === JSON.stringify(c.p.ui);
  useEffect(() => { setReplaceReviewed(false); }, [selected?.config, c.p.ui]);
  return <><CreationReview kind="wireframe" records={records} defaultName="New combat layout" make={identity => createWireframeDefinition(c.p, identity)} commit={definition => {
    c.update(project => { project.wireframes = [...(project.wireframes || []), definition]; }, 'New wireframe stored in authoring draft');
    setSelectedId(definition.id); setReplaceReviewed(false);
  }}/>{records.length ? <section className="wireframe-library" aria-label="Wireframe drafts"><h3>Wireframe drafts <span>{records.length}</span></h3><label className="field">Stored layout<select aria-label="Stored wireframe" value={selected?.id || ''} onChange={event => { setSelectedId(event.target.value); setReplaceReviewed(false); }}><option value="">Choose a draft</option>{records.map(record => <option key={record.id} value={record.id}>{record.name} / {record.id}</option>)}</select></label>{selected ? <><small>{activeMatches ? 'Matches current layout.' : 'Stored layout differs from current draft.'} Use Undo to reverse layout changes.</small><details><summary>Review stored native configuration</summary><pre>{JSON.stringify(selected.config, null, 2)}</pre></details><label className="check"><input type="checkbox" checked={replaceReviewed} onChange={event => setReplaceReviewed(event.target.checked)}/>I reviewed replacing the current layout with this stored draft</label><div className="button-row"><button disabled={!replaceReviewed || activeMatches} onClick={() => { c.update(project => { project.ui = structuredClone(selected.config); }, 'Stored wireframe applied to current layout draft'); setReplaceReviewed(false); }}>Apply reviewed wireframe</button><button disabled={activeMatches} onClick={() => c.update(project => { project.wireframes = project.wireframes.map(record => record.id === selected.id ? {...record, config: structuredClone(project.ui)} : record); }, 'Wireframe snapshot updated from current layout')}>Update snapshot from current layout</button><button onClick={() => download(selected.id + '.json', selected.config)}>Export native layout JSON</button></div></> : null}</section> : null}</>;
}
