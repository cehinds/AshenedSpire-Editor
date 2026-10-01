import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {createCardDraft, applyCardDraft, createWireframeDefinition, suggestDraftId} from './authoring-create.mjs';
import {assignments} from './data.js';
import {Notice, download} from './Controls.jsx';
import './authoring-create.css';

function CreationReview({kind, records, defaultName, make, commit, children, compact = false}) {
  const [open, setOpen] = useState(false), [name, setName] = useState(defaultName), [id, setId] = useState(() => suggestDraftId(defaultName, records));
  const [customId, setCustomId] = useState(false), input = useRef(), dialog = useRef(), trigger = useRef();
  const [commitIssue, setCommitIssue] = useState('');
  useEffect(() => {
    if (!open) return;
    const modal = dialog.current;
    if (compact) modal?.showModal();
    input.current?.focus();
    return () => { if (compact) { modal?.close(); trigger.current?.focus(); } };
  }, [open, compact]);
  let proposed, issue = '';
  if (open) try { proposed = make({id, name}); } catch (error) { issue = error.message; }
  function start() { setName(defaultName); setId(suggestDraftId(defaultName, records)); setCustomId(false); setCommitIssue(''); setOpen(true); }
  function create() {
    try {
      if (commit(proposed) === false) throw new Error('Creation was rejected by project validation. Correct the draft and try again; the draft and selection are unchanged.');
      setCommitIssue(''); setOpen(false);
    } catch (error) { setCommitIssue(error.message || 'Creation could not be applied.'); }
  }
  const review = open ? <div className="draft-create-review"><h2>Review new {kind} draft</h2><div className="form-grid"><label className="field">New {kind} name<input ref={input} aria-label={'New ' + kind + ' name'} maxLength={120} value={name} onChange={event => { const next = event.target.value; setName(next); if (!customId) setId(suggestDraftId(next, records)); }}/></label><label className="field">Stable {kind} ID<input aria-label={'New ' + kind + ' ID'} maxLength={96} value={id} onChange={event => { setId(event.target.value); setCustomId(true); }}/></label>{children}</div>
      <Notice>{kind === 'card' ? 'Copies the template definition, effects, upgrade and all native tag assignments, including classification, to the new card ID. Any explicit upgrade ID is updated to match. Review the definition and new tagging rows below. Creates two owned sandbox copies in the same draft transaction; template records, artwork overrides and checkout game source are unchanged.' : 'Stores the full native UI configuration, including unknown fields, in the authoring package. This is a geometry draft; creating it does not add a runtime mode or compile game source.'}</Notice>
      {issue ? <Notice tone="error">{issue}</Notice> : <details><summary>Inspect complete proposed JSON</summary><pre>{JSON.stringify(proposed, null, 2)}</pre></details>}
      {commitIssue ? <Notice tone="error"><span role="alert">{commitIssue}</span></Notice> : null}
      <div className="button-row"><button className="primary" disabled={!!issue} onClick={create}>Create reviewed {kind} draft</button><button onClick={() => setOpen(false)}>Cancel creation</button></div>
    </div> : null;
  return <section className={'draft-create' + (compact ? ' draft-create-compact' : '')} aria-label={'Create ' + kind + ' draft'}>
    <div className="button-row"><button ref={trigger} onClick={start} disabled={open} aria-label={compact ? 'New ' + kind : undefined} title={compact ? 'New ' + kind : undefined} aria-haspopup={compact ? 'dialog' : undefined}>{compact ? '+' : <>New {kind}…</>}</button>{compact ? null : <small>{kind === 'card' ? 'Copy a native definition into a separate draft.' : 'Save current native layout as a named draft.'}</small>}</div>
    {compact && open ? createPortal(<dialog ref={dialog} className="dialog draft-create-modal" role="dialog" aria-label={'Review new ' + kind + ' draft'} onCancel={event => { event.preventDefault(); setOpen(false); }} onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation(); }}>{review}</dialog>, document.body) : review}
  </section>;
}

export function CardCreation({ctx: c, compact = false}) {
  const [templateId, setTemplateId] = useState(c.card.id);
  const activeTemplate = c.p.cards.some(card => card.id === templateId) ? templateId : c.card.id;
  return <CreationReview compact={compact} kind="card" records={c.p.cards} defaultName="New card" make={identity => createCardDraft(c.p, activeTemplate, identity, assignments)} commit={proposal => {
    if (c.update(project => applyCardDraft(project, proposal, assignments), 'New card and native tags created in authoring draft') === false) return false;
    c.clearQuery?.();
    c.choose(proposal.definition.id, 'cards');
    return true;
  }}><label className="field">Native card template<select aria-label="Native card template" value={activeTemplate} onChange={event => setTemplateId(event.target.value)}>{c.p.cards.map(card => <option key={card.id} value={card.id}>{card.name} / {card.id}</option>)}</select></label></CreationReview>;
}

export function WireframeCreation({ctx: c}) {
  const records = c.p.wireframes || [], [selectedId, setSelectedId] = useState(''), [replaceReviewed, setReplaceReviewed] = useState(false);
  const selected = records.find(record => record.id === selectedId);
  const activeMatches = selected && JSON.stringify(selected.config) === JSON.stringify(c.p.ui);
  useEffect(() => { setReplaceReviewed(false); }, [selected?.config, c.p.ui]);
  return <><CreationReview kind="wireframe" records={records} defaultName="New combat layout" make={identity => createWireframeDefinition(c.p, identity)} commit={definition => {
    if (c.update(project => { project.wireframes = [...(project.wireframes || []), definition]; }, 'New wireframe stored in authoring draft') === false) return false;
    setSelectedId(definition.id); setReplaceReviewed(false);
    return true;
  }}/>{records.length ? <section className="wireframe-library" aria-label="Wireframe drafts"><h3>Wireframe drafts <span>{records.length}</span></h3><label className="field">Stored layout<select aria-label="Stored wireframe" value={selected?.id || ''} onChange={event => { setSelectedId(event.target.value); setReplaceReviewed(false); }}><option value="">Choose a draft</option>{records.map(record => <option key={record.id} value={record.id}>{record.name} / {record.id}</option>)}</select></label>{selected ? <><small>{activeMatches ? 'Matches current layout.' : 'Stored layout differs from current draft.'} Use Undo to reverse layout changes.</small><details><summary>Review stored native configuration</summary><pre>{JSON.stringify(selected.config, null, 2)}</pre></details><label className="check"><input type="checkbox" checked={replaceReviewed} onChange={event => setReplaceReviewed(event.target.checked)}/>I reviewed replacing the current layout with this stored draft</label><div className="button-row"><button disabled={!replaceReviewed || activeMatches} onClick={() => { c.update(project => { project.ui = structuredClone(selected.config); }, 'Stored wireframe applied to current layout draft'); setReplaceReviewed(false); }}>Apply reviewed wireframe</button><button disabled={activeMatches} onClick={() => c.update(project => { project.wireframes = project.wireframes.map(record => record.id === selected.id ? {...record, config: structuredClone(project.ui)} : record); }, 'Wireframe snapshot updated from current layout')}>Update snapshot from current layout</button><button onClick={() => download(selected.id + '.json', selected.config)}>Export native layout JSON</button></div></> : null}</section> : null}</>;
}
