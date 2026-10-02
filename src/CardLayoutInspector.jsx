import {useEffect, useRef, useState} from 'react';
import {loadImage} from './Controls.jsx';
import {CARD_LAYOUT_ORDER, getCardLayoutParts, getCardLayoutGroupMembers, addCardLayoutComponent, setCardLayoutPartState, normalizeCardLayout, validateCardLayout, reorderCardLayout} from './card-layout.mjs';
import './card-layout-inspector.css';

const MIXED = Symbol('mixed');
const DEFAULT_VIEW = {gridEnabled: true, gridSize: 10, snapEnabled: true, rotationSnap: 15};

// Call only with a normalized layout. Avoid repeatedly validating embedded image
// data while rendering each layer's controls.
function normalizedGroupMembers(layout, id) {
  const group = layout.parts[id]?.groupId;
  return Object.keys(layout.parts).filter(member => member === id || group && layout.parts[member].groupId === group);
}

export function editableCardLayoutSelection(layout, selection) {
  const next = normalizeCardLayout(layout);
  const ids = getCardLayoutGroupMembers(next, selection);
  if (!ids.length) throw new Error('Select a component first.');
  if (ids.some(id => next.parts[id].locked || next.parts[id].enabled === false || next.parts[id].removed)) throw new Error('Unlock, enable and restore every linked component before editing this group.');
  return ids;
}

export function hasCardLayoutMeasurements(measurement, cardId, selection) {
  return Boolean(measurement && measurement.cardId === cardId && selection.length && Number.isFinite(measurement.cardWidth) && measurement.cardWidth > 0 && Number.isFinite(measurement.cardHeight) && measurement.cardHeight > 0 && selection.every(id => {
    const box = measurement.boxes?.[id];
    return box && ['x', 'y', 'width', 'height'].every(key => Number.isFinite(box[key])) && box.width > 0 && box.height > 0;
  }));
}

export function alignMeasuredCardLayout(layout, selection, measurement, direction) {
  selection = editableCardLayoutSelection(layout, selection);
  if (!hasCardLayoutMeasurements(measurement, measurement?.cardId, selection)) throw new Error('Wait for native measurements of every selected component.');
  if (!['left', 'center', 'right', 'top', 'middle', 'bottom'].includes(direction)) throw new Error('Choose a supported alignment.');
  const next = normalizeCardLayout(layout), unitScale = measurement.cardWidth / 280;
  const boxes = selection.map(id => measurement.boxes[id]);
  const left = Math.min(...boxes.map(box => box.x)), top = Math.min(...boxes.map(box => box.y));
  const right = Math.max(...boxes.map(box => box.x + box.width)), bottom = Math.max(...boxes.map(box => box.y + box.height));
  const dx = direction === 'left' ? -left : direction === 'center' ? (measurement.cardWidth - (right - left)) / 2 - left : direction === 'right' ? measurement.cardWidth - right : 0;
  const dy = direction === 'top' ? -top : direction === 'middle' ? (measurement.cardHeight - (bottom - top)) / 2 - top : direction === 'bottom' ? measurement.cardHeight - bottom : 0;
  for (const id of selection) {next.parts[id].x += dx / unitScale; next.parts[id].y += dy / unitScale;}
  const errors = validateCardLayout(next);
  if (errors.length) throw new Error(errors.join('; '));
  return next;
}

export function arrangeMeasuredCardLayout(layout, selection, measurement, arrangement, gap = 10) {
  selection = editableCardLayoutSelection(layout, selection);
  if (!hasCardLayoutMeasurements(measurement, measurement?.cardId, selection)) throw new Error('Wait for native measurements of every selected component.');
  if (!['list', 'grid'].includes(arrangement)) throw new Error('Choose List or Grid.');
  if (!Number.isFinite(gap) || gap < 1 || gap > 256) throw new Error('Use a grid gap from 1 to 256 pixels.');
  const next = normalizeCardLayout(layout), unitScale = measurement.cardWidth / 280;
  const ordered = getCardLayoutParts(next).map(part => part.id).filter(id => selection.includes(id));
  const groups = [], visited = new Set();
  for (const id of ordered) {
    if (visited.has(id)) continue;
    const members = normalizedGroupMembers(next, id).filter(member => selection.includes(member));
    members.forEach(member => visited.add(member));
    const boxes = members.map(member => measurement.boxes[member]);
    const x = Math.min(...boxes.map(box => box.x)), y = Math.min(...boxes.map(box => box.y));
    groups.push({members, x, y, width: Math.max(...boxes.map(box => box.x + box.width)) - x, height: Math.max(...boxes.map(box => box.y + box.height)) - y});
  }
  const columns = arrangement === 'grid' ? Math.min(2, groups.length) : 1;
  const actualGap = gap * unitScale, cellWidth = (measurement.cardWidth - actualGap * (columns + 1)) / columns;
  if (cellWidth / unitScale < 1) throw new Error('The grid gap leaves no room for components. Reduce Grid size and try again.');
  let y = actualGap;
  for (let start = 0; start < groups.length; start += columns) {
    const row = groups.slice(start, start + columns);
    row.forEach((group, column) => {
      if (group.members.length > 1 && group.width > cellWidth) throw new Error('This linked group is wider than the arrangement cell. Reduce its size or unlink it first.');
      for (const id of group.members) {
        const part = next.parts[id];
        part.x += (actualGap + column * (cellWidth + actualGap) - group.x) / unitScale;
        part.y += (y - group.y) / unitScale;
        if (group.members.length === 1 && group.width > cellWidth) part.width = cellWidth / unitScale;
      }
    });
    y += Math.max(...row.map(group => group.height)) + actualGap;
  }
  const errors = validateCardLayout(next);
  if (errors.length) throw new Error(errors.join('; '));
  return next;
}

function LayoutNumber({label, value, mixed = false, min, max, step = 1, optional = false, onChange}) {
  const [text, setText] = useState(mixed ? '' : String(value ?? ''));
  const [error, setError] = useState('');
  const accepted = useRef(value);
  useEffect(() => {
    if (value !== accepted.current || mixed) {setText(mixed ? '' : String(value ?? '')); setError('');}
    accepted.current = value;
  }, [value, mixed]);
  function edit(next) {
    setText(next);
    try {
      const number = next.trim() ? Number(next) : undefined;
      if (number === undefined && !optional || number !== undefined && (!Number.isFinite(number) || number < min || number > max)) throw new Error(`Use ${min}–${max}${optional ? ', or clear for native size' : ''}.`);
      onChange(number);
      accepted.current = number;
      setError('');
    } catch (problem) {setError(problem.message || 'This value was rejected.');}
  }
  return <label className="card-layout-field"><span>{label}</span><input type="number" aria-label={label} aria-invalid={Boolean(error)} title={error || `${min}–${max}`} min={min} max={max} step={step} value={text} placeholder={mixed ? 'Mixed' : optional ? 'Native' : ''} onChange={event => edit(event.target.value)} onKeyDown={event => {
    if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); setText(mixed ? '' : String(value ?? '')); setError('');}
  }}/>{error ? <small className="card-layout-error" role="alert">{error}</small> : null}</label>;
}

function LayoutCheck({label, value, onChange}) {
  const input = useRef();
  useEffect(() => {if (input.current) input.current.indeterminate = value === MIXED;}, [value]);
  return <label className="card-layout-check"><input ref={input} type="checkbox" checked={value === true} aria-checked={value === MIXED ? 'mixed' : value} onChange={event => onChange(event.target.checked)}/>{label}</label>;
}

export function CardLayoutInspector({ctx}) {
  const {p, card} = ctx;
  const current = useRef(ctx), mounted = useRef(true), importInput = useRef(), customImportInput = useRef();
  current.current = ctx;
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  const [error, setError] = useState('');
  const [loadingArt, setLoadingArt] = useState(false);
  const layout = normalizeCardLayout(p.styles[card.id]?.layout);
  const definitions = getCardLayoutParts(layout), partIds = definitions.map(part => part.id);
  const selected = [...new Set(ctx.cardLayoutSelection || ['identity'])].filter(id => partIds.includes(id) && !layout.parts[id].removed);
  const targets = [...new Set(selected.flatMap(id => normalizedGroupMembers(layout, id)))];
  const blocked = targets.some(id => layout.parts[id].locked || layout.parts[id].enabled === false || layout.parts[id].removed);
  const selectedKey = `${card.id}:${selected.join('|')}`;
  const view = {...DEFAULT_VIEW, ...ctx.cardLayoutView};
  const measured = !blocked && hasCardLayoutMeasurements(ctx.cardLayoutBoxes, card.id, targets);
  const valueOf = key => {
    const values = targets.map(id => layout.parts[id][key]);
    return values.every(value => Object.is(value, values[0])) ? values[0] : MIXED;
  };
  useEffect(() => {setError('');}, [selectedKey]);

  function write(mutator, message = 'Card component layout updated') {
    const active = current.current;
    if (active.card.id !== card.id) throw new Error('The selected card changed. Select the components again.');
    const saved = active.update(next => {
      const style = next.styles[card.id] || {};
      const candidate = normalizeCardLayout(style.layout);
      mutator(candidate);
      const issues = validateCardLayout(candidate);
      if (issues.length) throw new Error(issues.join('; '));
      next.styles[card.id] = {...style, layout: candidate};
    }, message);
    if (saved === false) throw new Error('Layout change was rejected. The last valid draft remains active.');
    setError('');
  }
  const run = action => {try {action(); setError(''); return true;} catch (problem) {setError(problem.message || 'Layout change failed.'); return false;}};
  const patch = (key, value) => write(next => {
    const ids = editableCardLayoutSelection(next, selected);
    const delta = ['x', 'y', 'rotation'].includes(key) && value !== undefined ? value - next.parts[selected[0]][key] : null;
    for (const id of ids) {
      if (value === undefined) delete next.parts[id][key];
      else next.parts[id][key] = delta === null ? value : next.parts[id][key] + delta;
    }
  });
  function select(id, checked) {
    ctx.setCardLayoutSelection(checked ? [...new Set([...selected, id])] : selected.filter(part => part !== id));
  }
  function reorderIndex(source, id, direction) {
    const members = normalizedGroupMembers(source, id);
    const indexes = members.map(member => source.order.indexOf(member));
    const others = source.order.filter(member => !members.includes(member));
    const edge = direction > 0 ? Math.max(...indexes) : Math.min(...indexes);
    const neighbor = direction > 0 ? source.order.slice(edge + 1).find(member => !source.parts[member].removed) : source.order.slice(0, edge).reverse().find(member => !source.parts[member].removed);
    if (!neighbor) return null;
    const neighborIndexes = normalizedGroupMembers(source, neighbor).map(member => others.indexOf(member)).filter(index => index >= 0);
    return direction > 0 ? Math.max(...neighborIndexes) + 1 : Math.min(...neighborIndexes);
  }
  function reorder(id, direction) {
    run(() => write(next => {
      editableCardLayoutSelection(next, [id]);
      const index = reorderIndex(next, id, direction);
      if (index !== null) Object.assign(next, reorderCardLayout(next, id, index));
    }, 'Card layer order updated'));
  }
  function group() {
    const used = new Set(Object.values(layout.parts).map(part => part.groupId));
    let index = 1;
    while (used.has(`group-${index}`)) index++;
    run(() => patch('groupId', `group-${index}`));
  }
  function resetSelected() {
    run(() => write(next => {
      for (const id of editableCardLayoutSelection(next, selected)) {
        const {groupId, locked, enabled, removed} = next.parts[id];
        next.parts[id] = {groupId, locked, enabled, removed};
      }
    }, 'Selected card component overrides reset'));
  }
  function arrange(command) {
    run(() => {
      const measurement = current.current.cardLayoutBoxes;
      if (!hasCardLayoutMeasurements(measurement, card.id, targets)) throw new Error('Wait for the selected card’s native preview to finish measuring.');
      const isArrangement = command === 'list' || command === 'grid';
      write(next => Object.assign(next, isArrangement ? arrangeMeasuredCardLayout(next, selected, measurement, command, view.gridSize) : alignMeasuredCardLayout(next, selected, measurement, command)), isArrangement ? 'Selected card components arranged' : 'Selected card components aligned to card');
    });
  }
  function updateView(key, value) {
    ctx.setCardLayoutView(previous => ({...DEFAULT_VIEW, ...previous, [key]: value}));
  }
  function lifecycle(command, ids = selected) {
    const patches = {lock: {locked: true}, unlock: {locked: false}, enable: {enabled: true}, disable: {enabled: false}, remove: {removed: true}, restore: {removed: false}};
    return run(() => write(next => {
      const members = getCardLayoutGroupMembers(next, ids);
      if (!members.length) throw new Error('Select a component first.');
      if (!['unlock', 'lock', 'restore'].includes(command) && members.some(id => next.parts[id].locked)) throw new Error('Unlock the linked group before changing its components.');
      Object.assign(next, setCardLayoutPartState(next, members, patches[command]));
    }, command === 'remove' ? 'Components removed from preview; definitions retained' : 'Card component state updated'));
  }
  function addComponent(kind) {
    run(() => {
      let id;
      write(next => {
        const base = kind === 'text' ? 'Text' : 'Artwork';
        const labels = new Set(getCardLayoutParts(next).map(part => part.label));
        let number = 1;
        while (labels.has(`${base} ${number}`)) number++;
        const result = addCardLayoutComponent(next, {kind, label: `${base} ${number}`, ...(kind === 'text' ? {text: 'New text'} : {})});
        id = result.id;
        Object.assign(next, result.layout);
      }, 'Custom card component added');
      ctx.setCardLayoutSelection([id]);
    });
  }
  function customField(id, key, value) {
    write(next => {
      editableCardLayoutSelection(next, [id]);
      if (!next.custom?.[id]) throw new Error('This custom component no longer exists.');
      if (value === undefined) delete next.custom[id][key];
      else next.custom[id][key] = value;
    }, 'Custom card component updated');
  }
  async function importBackground(file, customId) {
    if (!file) return;
    const cardId = card.id, selectionAtStart = selected.join('|');
    const before = JSON.stringify({parts: targets.map(id => [id, layout.parts[id]]), custom: customId ? layout.custom[customId] : undefined});
    setLoadingArt(true);
    try {
      const image = await loadImage(file);
      if (!mounted.current) return;
      const active = current.current;
      const latestLayout = normalizeCardLayout(active.p.styles[cardId]?.layout);
      const latestIds = getCardLayoutParts(latestLayout).map(part => part.id);
      const latestSelection = [...new Set(active.cardLayoutSelection || ['identity'])].filter(id => latestIds.includes(id) && !latestLayout.parts[id].removed);
      if (active.card.id !== cardId || latestSelection.join('|') !== selectionAtStart) throw new Error('Selection changed during import. Choose the image again for the current components.');
      const latestTargets = getCardLayoutGroupMembers(latestLayout, latestSelection);
      if (before !== JSON.stringify({parts: latestTargets.map(id => [id, latestLayout.parts[id]]), custom: customId ? latestLayout.custom[customId] : undefined})) throw new Error('The components changed during import. Choose the image again.');
      if (customId) customField(customId, 'image', image);
      else patch('backgroundArt', image);
    } catch (problem) {if (mounted.current) setError(problem.message || 'Image could not be imported.');}
    finally {if (mounted.current) setLoadingArt(false);}
  }
  function number(key, label, min, max, step = 1, optional = false) {
    const value = valueOf(key);
    return <LayoutNumber key={`${selectedKey}:${key}`} label={label} value={value === MIXED ? undefined : value} mixed={value === MIXED} min={min} max={max} step={step} optional={optional} onChange={next => patch(key, next)}/>;
  }
  const background = valueOf('backgroundArt');
  const alignment = valueOf('textAlign');
  const orientation = valueOf('textRotation');
  const hasGroup = targets.some(id => layout.parts[id].groupId);
  const activeOrder = layout.order.filter(id => !layout.parts[id].removed);
  const removed = definitions.filter(part => layout.parts[part.id].removed);
  const customId = selected.length === 1 && layout.custom?.[selected[0]] ? selected[0] : null;
  const custom = customId ? layout.custom[customId] : null;
  const groupBlocked = id => normalizedGroupMembers(layout, id).some(member => layout.parts[member].locked || layout.parts[member].enabled === false || layout.parts[member].removed);
  return <section className="card-layout-inspector" aria-label="Card component layout">
    <div className="card-layout-section-head"><strong>Components</strong><span>{selected.length} selected{targets.length > selected.length ? ` · ${targets.length} linked` : ''}</span><button type="button" onClick={() => ctx.setCardLayoutSelection([...activeOrder])}>All</button><button type="button" disabled={!selected.length} onClick={() => ctx.setCardLayoutSelection([])}>None</button></div>
    <div className="card-layout-layers" aria-label="Card layers, front to back">
      {[...activeOrder].reverse().map(id => {
        const part = definitions.find(part => part.id === id), state = layout.parts[id];
        return <div key={id} className={'card-layout-layer' + (selected.includes(id) ? ' selected' : '') + (state.enabled === false ? ' disabled-component' : '')}>
          <label><input type="checkbox" checked={selected.includes(id)} onChange={event => select(id, event.target.checked)} aria-label={`Select ${part.label} component`}/><span>{part.label}</span><small title={[state.locked ? 'Locked' : '', state.enabled === false ? 'Disabled' : '', state.groupId ? `Linked group: ${state.groupId}` : ''].filter(Boolean).join(' · ')}>{[state.locked ? 'Locked' : '', state.enabled === false ? 'Off' : '', state.groupId].filter(Boolean).join(' · ')}</small></label>
          <button type="button" aria-label={`Move ${part.label} layer up`} title="Move linked layers toward front" disabled={reorderIndex(layout, id, 1) === null || groupBlocked(id)} onClick={() => reorder(id, 1)}>↑</button>
          <button type="button" aria-label={`Move ${part.label} layer down`} title="Move linked layers toward back" disabled={reorderIndex(layout, id, -1) === null || groupBlocked(id)} onClick={() => reorder(id, -1)}>↓</button>
        </div>;
      })}
    </div>
    <div className="card-layout-actions"><select aria-label="Component actions" value="" onChange={event => {
      const command = event.target.value;
      if (command === 'group') group();
      else if (command === 'ungroup') run(() => patch('groupId', ''));
      else if (command === 'select-group') ctx.setCardLayoutSelection(targets.filter(id => !layout.parts[id].removed));
      else if (command === 'reset') resetSelected();
      else if (command === 'order') run(() => write(next => {if (Object.values(next.parts).some(part => part.locked)) throw new Error('Unlock all components before resetting layer order.'); next.order = [...CARD_LAYOUT_ORDER, ...getCardLayoutParts(next).map(part => part.id).filter(id => !CARD_LAYOUT_ORDER.includes(id))];}, 'Card layer order restored'));
      else lifecycle(command);
    }}><option value="" disabled>Actions…</option><option value="lock" disabled={targets.every(id => layout.parts[id].locked)}>Lock linked selection</option><option value="unlock" disabled={!targets.some(id => layout.parts[id].locked)}>Unlock linked selection</option><option value="enable" disabled={targets.some(id => layout.parts[id].locked) || targets.every(id => layout.parts[id].enabled)}>Enable</option><option value="disable" disabled={targets.some(id => layout.parts[id].locked) || targets.every(id => !layout.parts[id].enabled)}>Disable</option><option value="group" disabled={targets.length < 2 || blocked}>Link group</option><option value="ungroup" disabled={!hasGroup || blocked}>Unlink group</option><option value="select-group" disabled={!hasGroup}>Select entire group</option><option value="reset" disabled={!selected.length || blocked}>Reset transforms &amp; appearance</option><option value="order" disabled={Object.values(layout.parts).some(part => part.locked)}>Reset layer order</option><option value="remove" disabled={!selected.length || targets.some(id => layout.parts[id].locked)}>Remove from preview</option></select><select aria-label="Add or restore card component" value="" onChange={event => {
      const command = event.target.value;
      if (command === 'new-text' || command === 'new-image') addComponent(command === 'new-text' ? 'text' : 'image');
      else if (lifecycle('restore', [command])) ctx.setCardLayoutSelection([command]);
    }}><option value="" disabled>Add / restore…</option><option value="new-text" disabled={Object.keys(layout.custom || {}).length >= 32}>New text</option><option value="new-image" disabled={Object.keys(layout.custom || {}).length >= 32}>New artwork</option>{removed.length ? <optgroup label="Restore component">{removed.map(part => <option key={part.id} value={part.id}>{part.label}</option>)}</optgroup> : null}</select></div>
    <div className="card-layout-arrange"><select aria-label="Align selected components to card" title={measured ? 'Align selection as one group, preserving spacing' : 'Waiting for current native component measurements'} disabled={!measured} value="" onChange={event => arrange(event.target.value)}><option value="" disabled>Align to card…</option><option value="left">Left</option><option value="center">Center horizontally</option><option value="right">Right</option><option value="top">Top</option><option value="middle">Center vertically</option><option value="bottom">Bottom</option></select><select aria-label="Arrange selected card components" title={measured ? 'Arrange in component order using Grid size as the gap' : 'Waiting for current native component measurements'} disabled={!measured} value="" onChange={event => arrange(event.target.value)}><option value="" disabled>Arrange…</option><option value="list">List</option><option value="grid">Grid · 2 columns</option></select></div>
    {selected.length ? <>
      {blocked ? <p className="card-layout-hint">Unlock, enable or restore linked components to edit this selection.</p> : null}
      <fieldset className="card-layout-editable" disabled={blocked}>
      {custom ? <div className="card-layout-custom"><label className="card-layout-inline-field">Label<input aria-label="Custom component label" value={custom.label} maxLength={80} onChange={event => run(() => customField(customId, 'label', event.target.value))}/></label>{custom.kind === 'text' ? <label className="card-layout-field">Text<textarea aria-label="Custom component text" rows={3} maxLength={10000} value={custom.text || ''} onChange={event => run(() => customField(customId, 'text', event.target.value))}/></label> : <div className="card-layout-art"><span>Artwork</span><button type="button" disabled={loadingArt} onClick={() => customImportInput.current?.click()}>{loadingArt ? 'Reading…' : 'Import…'}</button><button type="button" disabled={!custom.image} onClick={() => run(() => customField(customId, 'image', undefined))}>Clear</button><input ref={customImportInput} hidden type="file" accept="image/png,image/webp" aria-label="Custom component artwork" onChange={event => {const file = event.target.files?.[0]; event.target.value = ''; void importBackground(file, customId);}}/>{custom.image ? <img src={custom.image} alt="Custom component artwork"/> : null}</div>}</div> : null}
      <div className="card-layout-fields">{number('x', 'X offset (px)', -4096, 4096)}{number('y', 'Y offset (px)', -4096, 4096)}{number('rotation', 'Rotation (°)', -360, 360)}{number('opacity', 'Opacity', 0, 1, 0.05)}{number('width', 'Width (px)', 1, 4096, 1, true)}{number('height', 'Height (px)', 1, 4096, 1, true)}</div>
      <div className="card-layout-toggles"><LayoutCheck label="Visible" value={valueOf('visible')} onChange={next => run(() => patch('visible', next))}/><LayoutCheck label="Background" value={valueOf('backgroundVisible')} onChange={next => run(() => patch('backgroundVisible', next))}/></div>
      <label className="card-layout-inline-field">Text alignment<select aria-label="Component text alignment" value={alignment === MIXED ? 'mixed' : alignment || ''} onChange={event => run(() => patch('textAlign', event.target.value || undefined))}>{alignment === MIXED ? <option value="mixed" disabled>Mixed</option> : null}<option value="">Native</option><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
      <label className="card-layout-inline-field">Text rotation<select aria-label="Component text rotation" value={orientation === MIXED ? 'mixed' : orientation || 'upright'} onChange={event => run(() => patch('textRotation', event.target.value))}>{orientation === MIXED ? <option value="mixed" disabled>Mixed</option> : null}<option value="upright">Keep upright</option><option value="follow">Follow component</option></select></label>
      <div className="card-layout-art"><span>Background art</span><button type="button" disabled={loadingArt} onClick={() => importInput.current?.click()}>{loadingArt ? 'Reading…' : 'Import…'}</button><button type="button" disabled={!selected.some(id => layout.parts[id].backgroundArt)} onClick={() => run(() => patch('backgroundArt', undefined))}>Clear</button><input ref={importInput} hidden type="file" accept="image/png,image/webp" aria-label="Component background artwork" onChange={event => {const file = event.target.files?.[0]; event.target.value = ''; void importBackground(file);}}/>{background && background !== MIXED ? <img src={background} alt="Selected component background artwork"/> : null}</div>
      </fieldset>
      <small className="card-layout-hint">Pixels use a 280px card reference; blank size uses native dimensions. PNG/WebP up to 2 MB. Linked components move together on the canvas.</small>
    </> : <p className="card-layout-hint">Select a component on the canvas or in this list.</p>}
    <details className="card-layout-view" open><summary>Grid &amp; snapping <small>view only</small></summary><div className="card-layout-toggles"><LayoutCheck label="Show grid" value={view.gridEnabled} onChange={next => updateView('gridEnabled', next)}/><LayoutCheck label="Snap" value={view.snapEnabled} onChange={next => updateView('snapEnabled', next)}/></div><div className="card-layout-fields"><LayoutNumber label="Grid size (px)" value={view.gridSize} min={1} max={256} onChange={next => updateView('gridSize', next)}/><LayoutNumber label="Rotation snap (°)" value={view.rotationSnap} min={1} max={180} onChange={next => updateView('rotationSnap', next)}/></div></details>
    {error ? <p className="card-layout-error" role="alert">{error}</p> : null}
    <small className="card-layout-hint">Layout overrides stay in the authoring draft and editor preview. Checkout promotion is separate.</small>
  </section>;
}
