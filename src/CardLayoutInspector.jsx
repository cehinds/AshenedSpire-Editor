import {useEffect, useRef, useState} from 'react';
import {loadImage} from './Controls.jsx';
import {CARD_LAYOUT_PARTS, CARD_LAYOUT_ORDER, normalizeCardLayout, validateCardLayout, reorderCardLayout} from './card-layout.mjs';
import './card-layout-inspector.css';

const MIXED = Symbol('mixed');
const DEFAULT_VIEW = {gridEnabled: true, gridSize: 10, snapEnabled: true, rotationSnap: 15};
const partIds = CARD_LAYOUT_PARTS.map(part => part.id);

export function hasCardLayoutMeasurements(measurement, cardId, selection) {
  return Boolean(measurement && measurement.cardId === cardId && selection.length && Number.isFinite(measurement.cardWidth) && measurement.cardWidth > 0 && Number.isFinite(measurement.cardHeight) && measurement.cardHeight > 0 && selection.every(id => {
    const box = measurement.boxes?.[id];
    return partIds.includes(id) && box && ['x', 'y', 'width', 'height'].every(key => Number.isFinite(box[key])) && box.width > 0 && box.height > 0;
  }));
}

export function alignMeasuredCardLayout(layout, selection, measurement, direction) {
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
  if (!hasCardLayoutMeasurements(measurement, measurement?.cardId, selection)) throw new Error('Wait for native measurements of every selected component.');
  if (!['list', 'grid'].includes(arrangement)) throw new Error('Choose List or Grid.');
  if (!Number.isFinite(gap) || gap < 1 || gap > 256) throw new Error('Use a grid gap from 1 to 256 pixels.');
  const next = normalizeCardLayout(layout), unitScale = measurement.cardWidth / 280;
  const ordered = partIds.filter(id => selection.includes(id));
  const columns = arrangement === 'grid' ? Math.min(2, ordered.length) : 1;
  const actualGap = gap * unitScale, cellWidth = (measurement.cardWidth - actualGap * (columns + 1)) / columns;
  if (cellWidth / unitScale < 1) throw new Error('The grid gap leaves no room for components. Reduce Grid size and try again.');
  let y = actualGap;
  for (let start = 0; start < ordered.length; start += columns) {
    const row = ordered.slice(start, start + columns);
    row.forEach((id, column) => {
      const box = measurement.boxes[id], part = next.parts[id];
      part.x += (actualGap + column * (cellWidth + actualGap) - box.x) / unitScale;
      part.y += (y - box.y) / unitScale;
      if (box.width > cellWidth) part.width = cellWidth / unitScale;
    });
    y += Math.max(...row.map(id => measurement.boxes[id].height)) + actualGap;
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
  const current = useRef(ctx), mounted = useRef(true), importInput = useRef();
  current.current = ctx;
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  const [error, setError] = useState('');
  const [loadingArt, setLoadingArt] = useState(false);
  const layout = normalizeCardLayout(p.styles[card.id]?.layout);
  const selected = [...new Set(ctx.cardLayoutSelection || ['identity'])].filter(id => partIds.includes(id));
  const selectedKey = `${card.id}:${selected.join('|')}`;
  const view = {...DEFAULT_VIEW, ...ctx.cardLayoutView};
  const measured = hasCardLayoutMeasurements(ctx.cardLayoutBoxes, card.id, selected);
  const valueOf = key => {
    const values = selected.map(id => layout.parts[id][key]);
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
  const run = action => {try {action(); setError('');} catch (problem) {setError(problem.message || 'Layout change failed.');}};
  const patch = (key, value) => write(next => {
    for (const id of selected) {
      if (value === undefined) delete next.parts[id][key];
      else next.parts[id][key] = value;
    }
  });
  function select(id, checked) {
    ctx.setCardLayoutSelection(checked ? [...new Set([...selected, id])] : selected.filter(part => part !== id));
  }
  function reorder(id, index) {
    run(() => write(next => Object.assign(next, reorderCardLayout(next, id, index)), 'Card layer order updated'));
  }
  function group() {
    const used = new Set(Object.values(layout.parts).map(part => part.groupId));
    let index = 1;
    while (used.has(`group-${index}`)) index++;
    run(() => patch('groupId', `group-${index}`));
  }
  function resetSelected() {
    run(() => write(next => {
      for (const id of selected) delete next.parts[id];
    }, 'Selected card component overrides reset'));
  }
  function arrange(command) {
    run(() => {
      const measurement = current.current.cardLayoutBoxes;
      if (!hasCardLayoutMeasurements(measurement, card.id, selected)) throw new Error('Wait for the selected card’s native preview to finish measuring.');
      const isArrangement = command === 'list' || command === 'grid';
      write(next => Object.assign(next, isArrangement ? arrangeMeasuredCardLayout(next, selected, measurement, command, view.gridSize) : alignMeasuredCardLayout(next, selected, measurement, command)), isArrangement ? 'Selected card components arranged' : 'Selected card components aligned to card');
    });
  }
  function updateView(key, value) {
    ctx.setCardLayoutView(previous => ({...DEFAULT_VIEW, ...previous, [key]: value}));
  }
  async function importBackground(file) {
    if (!file) return;
    const cardId = card.id, selectionAtStart = selected.join('|');
    setLoadingArt(true);
    try {
      const image = await loadImage(file);
      if (!mounted.current) return;
      const active = current.current;
      if (active.card.id !== cardId || (active.cardLayoutSelection || ['identity']).filter(id => partIds.includes(id)).join('|') !== selectionAtStart) throw new Error('Selection changed during import. Choose the image again for the current components.');
      patch('backgroundArt', image);
    } catch (problem) {if (mounted.current) setError(problem.message || 'Image could not be imported.');}
    finally {if (mounted.current) setLoadingArt(false);}
  }
  function number(key, label, min, max, step = 1, optional = false) {
    const value = valueOf(key);
    return <LayoutNumber key={`${selectedKey}:${key}`} label={label} value={value === MIXED ? undefined : value} mixed={value === MIXED} min={min} max={max} step={step} optional={optional} onChange={next => patch(key, next)}/>;
  }
  const background = valueOf('backgroundArt');
  const alignment = valueOf('textAlign');
  const hasGroup = selected.some(id => layout.parts[id].groupId);
  return <section className="card-layout-inspector" aria-label="Card component layout">
    <div className="card-layout-section-head"><strong>Components</strong><span>{selected.length} selected</span><button type="button" onClick={() => ctx.setCardLayoutSelection([...partIds])}>All</button><button type="button" disabled={!selected.length} onClick={() => ctx.setCardLayoutSelection([])}>None</button></div>
    <div className="card-layout-layers" aria-label="Card layers, front to back">
      {[...layout.order].reverse().map((id, index) => {
        const part = CARD_LAYOUT_PARTS.find(part => part.id === id), groupId = layout.parts[id].groupId;
        return <div key={id} className={'card-layout-layer' + (selected.includes(id) ? ' selected' : '')}>
          <label><input type="checkbox" checked={selected.includes(id)} onChange={event => select(id, event.target.checked)} aria-label={`Select ${part.label} component`}/><span>{part.label}</span>{groupId ? <small title={`Linked group: ${groupId}`}>{groupId}</small> : null}</label>
          <button type="button" aria-label={`Move ${part.label} layer up`} title="Move layer toward front" disabled={index === 0} onClick={() => reorder(id, layout.order.indexOf(id) + 1)}>↑</button>
          <button type="button" aria-label={`Move ${part.label} layer down`} title="Move layer toward back" disabled={index === layout.order.length - 1} onClick={() => reorder(id, layout.order.indexOf(id) - 1)}>↓</button>
        </div>;
      })}
    </div>
    <div className="card-layout-actions"><button type="button" disabled={selected.length < 2} onClick={group}>Link group</button><button type="button" disabled={!hasGroup} onClick={() => run(() => patch('groupId', ''))}>Unlink</button><select aria-label="Reset card layout" value="" onChange={event => {
      if (event.target.value === 'parts') resetSelected();
      if (event.target.value === 'order') run(() => write(next => {next.order = [...CARD_LAYOUT_ORDER];}, 'Native card layer order restored'));
    }}><option value="" disabled>Reset…</option><option value="parts" disabled={!selected.length}>Selected overrides</option><option value="order">Layer order</option></select></div>
    <div className="card-layout-arrange"><select aria-label="Align selected components to card" title={measured ? 'Align selection as one group, preserving spacing' : 'Waiting for current native component measurements'} disabled={!measured} value="" onChange={event => arrange(event.target.value)}><option value="" disabled>Align to card…</option><option value="left">Left</option><option value="center">Center horizontally</option><option value="right">Right</option><option value="top">Top</option><option value="middle">Center vertically</option><option value="bottom">Bottom</option></select><select aria-label="Arrange selected card components" title={measured ? 'Arrange in component order using Grid size as the gap' : 'Waiting for current native component measurements'} disabled={!measured} value="" onChange={event => arrange(event.target.value)}><option value="" disabled>Arrange…</option><option value="list">List</option><option value="grid">Grid · 2 columns</option></select></div>
    {selected.length ? <>
      <div className="card-layout-fields">{number('x', 'X offset (px)', -4096, 4096)}{number('y', 'Y offset (px)', -4096, 4096)}{number('rotation', 'Rotation (°)', -360, 360)}{number('opacity', 'Opacity', 0, 1, 0.05)}{number('width', 'Width (px)', 1, 4096, 1, true)}{number('height', 'Height (px)', 1, 4096, 1, true)}</div>
      <div className="card-layout-toggles"><LayoutCheck label="Visible" value={valueOf('visible')} onChange={next => run(() => patch('visible', next))}/><LayoutCheck label="Background" value={valueOf('backgroundVisible')} onChange={next => run(() => patch('backgroundVisible', next))}/></div>
      <label className="card-layout-inline-field">Text alignment<select aria-label="Component text alignment" value={alignment === MIXED ? 'mixed' : alignment || ''} onChange={event => run(() => patch('textAlign', event.target.value || undefined))}>{alignment === MIXED ? <option value="mixed" disabled>Mixed</option> : null}<option value="">Native</option><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
      <div className="card-layout-art"><span>Background art</span><button type="button" disabled={loadingArt} onClick={() => importInput.current?.click()}>{loadingArt ? 'Reading…' : 'Import…'}</button><button type="button" disabled={!selected.some(id => layout.parts[id].backgroundArt)} onClick={() => run(() => patch('backgroundArt', undefined))}>Clear</button><input ref={importInput} hidden type="file" accept="image/png,image/webp" aria-label="Component background artwork" onChange={event => {const file = event.target.files?.[0]; event.target.value = ''; void importBackground(file);}}/>{background && background !== MIXED ? <img src={background} alt="Selected component background artwork"/> : null}</div>
      <small className="card-layout-hint">Pixels use a 280px card reference; blank size uses native dimensions. PNG/WebP up to 2 MB. Linked components move together on the canvas.</small>
    </> : <p className="card-layout-hint">Select a component on the canvas or in this list.</p>}
    <details className="card-layout-view" open><summary>Grid &amp; snapping <small>view only</small></summary><div className="card-layout-toggles"><LayoutCheck label="Show grid" value={view.gridEnabled} onChange={next => updateView('gridEnabled', next)}/><LayoutCheck label="Snap" value={view.snapEnabled} onChange={next => updateView('snapEnabled', next)}/></div><div className="card-layout-fields"><LayoutNumber label="Grid size (px)" value={view.gridSize} min={1} max={256} onChange={next => updateView('gridSize', next)}/><LayoutNumber label="Rotation snap (°)" value={view.rotationSnap} min={1} max={180} onChange={next => updateView('rotationSnap', next)}/></div></details>
    {error ? <p className="card-layout-error" role="alert">{error}</p> : null}
    <small className="card-layout-hint">Layout overrides stay in the authoring draft and editor preview. Checkout promotion is separate.</small>
  </section>;
}
