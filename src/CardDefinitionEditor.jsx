import {useEffect, useRef, useState} from 'react';
import {DataTable, Notice, loadImage} from './Controls.jsx';
import {parseCardDefinition, prepareCardDefinition} from './card-definition.mjs';
import {assignments} from './data.js';

export const CARD_SECTIONS = [['identity', 'Identity'], ['costs', 'Costs'], ['art', 'Artwork'], ['tags', 'Keywords'], ['rules', 'Rules and effects'], ['footer', 'Flavor and sandbox'], ['upgrade', 'Upgrade']];

function LiveField({label, value, onChange, multiline = false, numeric = false}) {
  const [text, setText] = useState(String(value ?? ''));
  const [error, setError] = useState('');
  const applied = useRef(value);
  useEffect(() => {
    if (value !== applied.current) {setText(String(value ?? '')); setError('');}
    applied.current = value;
  }, [value]);
  const edit = event => {
    const next = event.target.value;
    setText(next);
    try {
      if (numeric && (!next.trim() || !Number.isFinite(Number(next)) || Number(next) < 0)) throw new Error('Enter a number of zero or more. The last valid value remains active.');
      const parsed = numeric ? Number(next) : next;
      onChange(parsed);
      applied.current = parsed;
      setError('');
    } catch (problem) {setError(problem.message);}
  };
  const props = {'aria-label': label, 'aria-invalid': Boolean(error), value: text, onChange: edit};
  return <label className="field card-definition-field">{label}
    {multiline ? <textarea rows={4} {...props}/> : <input {...props} inputMode={numeric ? 'decimal' : undefined}/>}
    {error ? <small className="error" role="alert">{error}</small> : null}
  </label>;
}

function CardJson({ctx, apply}) {
  const {card, p} = ctx;
  const serialized = JSON.stringify(card);
  const [text, setText] = useState(() => JSON.stringify(card, null, 2));
  const [error, setError] = useState('');
  const applied = useRef(serialized);
  useEffect(() => {
    if (serialized !== applied.current) {setText(JSON.stringify(card, null, 2)); setError('');}
    applied.current = serialized;
  }, [card, serialized]);
  function edit(event) {
    const next = event.target.value;
    setText(next);
    try {
      const candidate = parseCardDefinition(next, p, card.id);
      apply(card.id, candidate);
      applied.current = JSON.stringify(candidate);
      setError('');
    } catch (problem) {setError(problem.message);}
  }
  return <div className="source-editor card-definition-json">
    <p>Valid JSON updates the shared draft and both previews immediately. The card ID stays fixed.</p>
    <textarea aria-label="Card JSON source" aria-invalid={Boolean(error)} spellCheck={false} value={text} onChange={edit}/>
    {error ? <Notice tone="error"><span role="alert">{error}</span></Notice> : <small role="status">Current valid card is applied to the draft.</small>}
    <button onClick={() => {setText(JSON.stringify(card, null, 2)); setError('');}}>Reset JSON buffer to current card</button>
  </div>;
}

function CardProposal({ctx}) {
  const {card, p, setDialog} = ctx;
  const [proposal, setProposal] = useState(() => JSON.stringify(card, null, 2));
  const [error, setError] = useState('');
  function review() {
    try {
      const value = parseCardDefinition(proposal, p, card.id);
      setError('');
      setDialog({kind: 'proposal', value, before: structuredClone(card)});
    } catch (problem) {setError(problem.message);}
  }
  return <div className="card-definition-prompt">
    <h3>Review a card proposal</h3>
    <p>Paste proposal JSON, then review and apply it. AI is not connected.</p>
    <textarea className="proposal-input" aria-label="Proposed card JSON" spellCheck={false} value={proposal} onChange={event => {setProposal(event.target.value); setError('');}}/>
    {error ? <Notice tone="error"><span role="alert">{error}</span></Notice> : null}
    <div className="button-row"><button className="primary" onClick={review}>Review proposed changes</button><button onClick={() => {setProposal(JSON.stringify(card, null, 2)); setError('');}}>Use current card</button></div>
  </div>;
}

function UpgradeJson({value, onChange}) {
  const serialized = JSON.stringify(value);
  const applied = useRef(serialized);
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState('');
  useEffect(() => {
    if (serialized !== applied.current) {setText(JSON.stringify(value, null, 2)); setError('');}
    applied.current = serialized;
  }, [value, serialized]);
  return <label className="field">Upgrade JSON<textarea rows={12} aria-label="Upgrade JSON" aria-invalid={Boolean(error)} spellCheck={false} value={text} onChange={event => {
    const next = event.target.value;
    setText(next);
    try {const candidate = JSON.parse(next); onChange(candidate); applied.current = JSON.stringify(candidate); setError('');}
    catch (problem) {setError(problem.message);}
  }}/>{error ? <small className="error" role="alert">{error}</small> : <small>Valid edits apply immediately. Omitted upgrade fields inherit from the base card.</small>}</label>;
}

function CardForm({ctx, apply, patch, typeField}) {
  const {card, p, update} = ctx;
  const currentContext = useRef(ctx), mounted = useRef(true);
  currentContext.current = ctx;
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  const [localSection, setLocalSection] = useState('identity');
  const [error, setError] = useState('');
  const section = CARD_SECTIONS.some(([id]) => id === ctx.cardSection) ? ctx.cardSection : localSection;
  const style = p.styles[card.id] || {};
  const select = id => {setLocalSection(id); ctx.setCardSection?.(id); setError('');};
  const safe = action => {try {action(); setError('');} catch (problem) {setError(problem.message);}};
  const changeProject = (mutate, message) => {
    if (update(mutate, message) === false) throw new Error('This change did not pass project validation. The last valid draft remains active.');
  };
  const sidecar = (key, value) => changeProject(next => {next.styles[card.id] = {...next.styles[card.id], [key]: value};}, 'Card presentation updated');
  const effectPatch = (index, key, value) => patch(card.id, 'effects', card.effects.map((effect, i) => i === index ? {...effect, [key]: value} : effect));
  const field = (label, key, options = {}) => <LiveField label={label} value={card[key] ?? (options.numeric ? 0 : '')} onChange={value => patch(card.id, key, value)} {...options}/>;
  return <div className="card-definition-form">
    <label className="card-section-picker">Edit section<select aria-label="Card form section" value={section} onChange={event=>select(event.target.value)}>{CARD_SECTIONS.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
    <section className="card-form-section" data-card-section={section} aria-label={`${CARD_SECTIONS.find(([id]) => id === section)?.[1]} card fields`}>
      {section === 'identity' ? <div className="form-grid">
        <label className="field">Card ID<input aria-label="Card ID" value={card.id} readOnly/></label>
        {field('Card name', 'name')}{typeField(card, 'Card type')}{field('Card class', 'class')}{field('Card rarity', 'rarity')}{field('Card icon', 'icon')}
      </div> : section === 'costs' ? <div className="form-grid">
        {field('Action cost', 'cost', {numeric: true})}{field('Stamina cost', 'staminaCost', {numeric: true})}{field('Mana cost', 'manaCost', {numeric: true})}
      </div> : section === 'art' ? <>
        <label className="field">Import card artwork<input type="file" aria-label="Import card artwork" accept="image/png,image/webp" onChange={async event => {
          const file = event.target.files?.[0]; event.target.value = '';
          if (!file) return;
          const targetId = card.id;
          try {
            const art = await loadImage(file);
            if (!mounted.current) return;
            if (currentContext.current.update(next => {
              if (!next.cards.some(record => record.id === targetId)) throw new Error('The artwork target no longer exists.');
              next.styles[targetId] = {...next.styles[targetId], art};
            }, 'Card artwork updated') === false) throw new Error('Artwork did not pass project validation.');
            setError('');
          } catch (problem) {if (mounted.current) setError(problem.message);}
        }}/></label>
        {style.art ? <><img className="card-art-thumbnail" src={style.art} alt="Current artwork override"/><label className="field">Art fit<select aria-label="Art fit" value={style.fit || 'cover'} onChange={event => safe(() => sidecar('fit', event.target.value))}><option value="cover">Cover</option><option value="contain">Contain</option></select></label><button onClick={() => safe(() => changeProject(next => {delete next.styles[card.id].art;}, 'Artwork override removed'))}>Remove artwork override</button></> : <p>No artwork override. The native card uses its source appearance.</p>}
        <small>PNG or WebP, up to 2 MB. Presentation sidecars stay in the authoring project until explicitly saved or exported.</small>
      </> : section === 'tags' ? <>
        <LiveField label="Card keywords" value={(card.keywords || []).join(', ')} onChange={value => patch(card.id, 'keywords', value.split(',').map(keyword => keyword.trim()).filter(Boolean))}/>
        <h4>Native tag assignments</h4>
        <ul>{(p.tagging ?? assignments).filter(row => row.family === 'card' && row.objectId === card.id).map(row => <li key={JSON.stringify([row.scope,row.tagId])}>{p.nodes.find(node => node.id === row.tagId)?.label || row.tagId} <code>{row.tagId}</code>{row.scope ? ` / ${row.scope}` : ''}</li>)}</ul>
        <small>Comma-separated native keyword IDs, such as exhaust. Tag vocabulary and its source assignments remain separate; this field does not create mechanics.</small>
      </> : section === 'rules' ? <>
        {field('Rules template', 'textTemplate', {multiline: true})}
        <div className="card-font-row"><LiveField key={style.fontSize===undefined?"inherited-font":"authored-font"} label="Rules font size" value={style.fontSize ?? 17} numeric onChange={value => {if (value < 12 || value > 24) throw new Error('Rules font size must be 12–24 px.'); sidecar('fontSize', value);}}/>
        <button aria-label="Reset rules font size" disabled={style.fontSize === undefined} onClick={() => safe(() => changeProject(next => {delete next.styles[card.id].fontSize;}, 'Rules font size restored'))}>Reset</button></div>
        <h4>Native effects</h4>
        {card.effects.map((effect, index) => <fieldset className="card-effect-fields" key={index}><legend>Effect {index + 1}</legend>
          <LiveField label={`Effect ${index + 1} operation`} value={effect.op} onChange={value => effectPatch(index, 'op', value)}/>
          {typeof effect.target === 'string' ? <LiveField label={`Effect ${index + 1} target`} value={effect.target} onChange={value => effectPatch(index, 'target', value)}/> : null}
          {typeof effect.status === 'string' || ['applyStatus', 'removeStatus'].includes(effect.op) ? <LiveField label={`Effect ${index + 1} status`} value={effect.status || ''} onChange={value => effectPatch(index, 'status', value)}/> : null}
          {['amount', 'stacks', 'hits'].filter(key => typeof effect[key] === 'number' || key === 'amount' && effect.op === 'damage' && effect.amount === undefined || key === 'stacks' && effect.op === 'applyStatus' && effect.stacks === undefined).map(key => <LiveField key={key} label={`Effect ${index + 1} ${key}`} value={effect[key] ?? 0} numeric onChange={value => effectPatch(index, key, value)}/>)}
          {effect.if ? <small>Native condition retained. Edit its structure in JSON.</small> : null}
          <button onClick={() => safe(() => patch(card.id, 'effects', card.effects.filter((_, i) => i !== index)))}>Remove effect {index + 1}</button>
        </fieldset>)}
        <button onClick={() => safe(() => patch(card.id, 'effects', [...card.effects, {op: 'damage', target: 'enemy', amount: 0}]))}>Add damage effect</button>
        <small>Conditions and unknown native fields are preserved. The native preview reports unsupported operations.</small>
      </> : section === 'footer' ? <>
        {field('Flavor text', 'flavor', {multiline: true})}
        <LiveField label="Sandbox owned copies" value={p.owned[card.id] ?? 0} numeric onChange={value => {if (!Number.isSafeInteger(value)) throw new Error('Owned copies must be a whole number.'); changeProject(next => {next.owned[card.id] = value;}, 'Sandbox ownership updated');}}/>
        <small>Owned copies are the editor deck sandbox allowance, not a saved game inventory.</small>
      </> : <>
        {card.upgrade ? <><UpgradeJson value={card.upgrade} onChange={value => patch(card.id, 'upgrade', value)}/><button onClick={() => safe(() => {const next = {...card}; delete next.upgrade; apply(card.id, next);})}>Remove upgrade</button></> : <><p>This card has no upgrade override.</p><button onClick={() => safe(() => patch(card.id, 'upgrade', {effects: structuredClone(card.effects)}))}>Add upgrade from base effects</button></>}
        <small>Use the Upgraded preview to inspect these overrides; the base definition remains intact.</small>
      </>}
    </section>
    {error ? <Notice tone="error"><span role="alert">{error}</span></Notice> : null}
  </div>;
}

/** Edits the same draft object consumed by Visual and the native In game preview. */
export function CardDefinitionEditor({ctx}) {
  const {p, card, mode, update, query = ''} = ctx;
  const [scope, setScope] = useState('all');
  function apply(id, value) {
    const candidate = prepareCardDefinition(p, id, value);
    const current = p.cards.find(item => item.id === id);
    if (JSON.stringify(candidate) === JSON.stringify(current)) return;
    if (update(next => {next.cards = next.cards.map(item => item.id === id ? candidate : item);}, 'Card definition updated in shared draft') === false) throw new Error('This card change did not pass project validation. The last valid draft remains active.');
  }
  const patch = (id, key, value) => {
    if(mode==='Table'&&id!==card.id)ctx.choose(id,'cards');
    const current = p.cards.find(item => item.id === id);
    apply(id, {...current, [key]: value});
  };
  if (!card) return <Notice>Select a card to edit its definition.</Notice>;
  const typeOptions = [...new Set(['attack', 'skill', 'power', ...p.cards.map(item => item.type).filter(Boolean)])];
  const typeField = (item, label) => <label className="field">{label}<select aria-label={label} value={item.type || ''} onChange={event => patch(item.id, 'type', event.target.value)}>{!item.type ? <option value="" disabled>Select type</option> : null}{typeOptions.map(type => <option key={type} value={type}>{type}</option>)}</select></label>;
  return <section className="card-definition-editor" aria-label="Card definition editor">
    {mode === 'Table' ? <div className="card-definition-table">
      <label className="field">Table scope<select aria-label="Card table scope" value={scope} onChange={event => setScope(event.target.value)}><option value="all">All matching cards</option><option value="selected">Selected card</option></select></label>
      <DataTable headers={['Card', 'Type', 'Action', 'Inspect']}>
        {p.cards.filter(item => (scope === 'all' || item.id === card.id) && (scope === 'selected' || (item.id + ' ' + item.name).toLowerCase().includes(query.toLowerCase()))).map(item => <tr key={item.id} className={item.id === card.id ? 'active selected' : ''} aria-selected={item.id === card.id} data-selected={item.id === card.id}>
          <td><LiveField label={`Name for ${item.id}`} value={item.name} onChange={value => patch(item.id, 'name', value)}/><code>{item.id}</code></td>
          <td>{typeField(item, `Type for ${item.id}`)}</td>
          <td><LiveField label={`Action cost for ${item.id}`} value={item.cost ?? 0} numeric onChange={value => patch(item.id, 'cost', value)}/></td>
          <td><button aria-label={`Inspect ${item.name}`} aria-pressed={item.id === card.id} onClick={() => ctx.inspectCard ? ctx.inspectCard(item.id) : ctx.choose(item.id, 'cards')}>Inspect</button></td>
        </tr>)}
      </DataTable>
      <small>Inspect selects the card for the canvas and inspector. Valid table edits update the shared draft immediately.</small>
    </div> : mode === 'JSON' ? <CardJson key={card.id} ctx={ctx} apply={apply}/> : mode === 'Prompt' ? <CardProposal key={card.id} ctx={ctx}/> : <CardForm key={card.id} ctx={ctx} apply={apply} patch={patch} typeField={typeField}/>}
  </section>;
}
