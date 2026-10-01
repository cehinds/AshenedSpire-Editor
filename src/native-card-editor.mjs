/** Serialized into the native script-only frame. Keep every dependency inside. */
export function installCardEditor(host, emit, applyLayout, partDefs) {
  const doc = host.ownerDocument;
  const win = doc.defaultView;
  const definitions = (Array.isArray(partDefs) ? partDefs : []).filter(part => typeof part?.id === 'string' && typeof part.selector === 'string');
  const known = new Set(definitions.map(part => part.id));
  const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const clone = value => JSON.parse(JSON.stringify(value || {}));
  const round = value => Number(value.toFixed(6));
  const snap = (value, interval) => round(Math.round(value / interval) * interval);
  const label = id => definitions.find(part => part.id === id)?.label || id;
  const original = {backgroundImage: host.style.backgroundImage, backgroundSize: host.style.backgroundSize, backgroundPosition: host.style.backgroundPosition, position: host.style.position, touchAction: host.style.touchAction, tabIndex: host.getAttribute('tabindex')};
  const attributes = new WeakMap();
  const style = doc.createElement('style');
  style.textContent = `.native-card-part-editable{outline:1px dashed #d8b26988;outline-offset:2px;cursor:move;touch-action:none;user-select:none}.native-card-part-editable[data-editor-selected="true"]{outline:2px solid #edc878;outline-offset:3px}.native-card-part-editable:focus-visible{outline:3px solid #ffe3a2}.native-card-rotate-handle{position:absolute!important;z-index:2147483000!important;width:24px!important;height:24px!important;min-width:24px!important;padding:0!important;border:1px solid #efc875!important;border-radius:50%!important;background:#242a30!important;color:#ffdc8c!important;font:18px/22px system-ui!important;cursor:crosshair!important;touch-action:none!important;box-shadow:0 1px 5px #0009}.native-card-rotate-handle:focus-visible{outline:2px solid #fff}`;
  doc.head.append(style);
  if (win.getComputedStyle(host).position === 'static') host.style.position = 'relative';
  if (!host.hasAttribute('tabindex')) host.tabIndex = 0;
  let snapshot = {};
  let entries = [];
  let gesture = null;
  let rotateHandle = null;
  let disposed = false;
  let viewZoom = 100;
  let measurementFrame = null;
  const measurements = new Map();
  const pan = {x: 0, y: 0};

  function measureParts() {
    measurementFrame = null;
    if (disposed || gesture) return;
    refreshView();
    for (const entry of entries) {
      const nativeBoxes = applyLayout(entry.face, layoutFor(entry.cardId));
      if (!nativeBoxes || typeof nativeBoxes !== 'object') continue;
      const boxes = {};
      for (const {id} of definitions) {
        const box = nativeBoxes[id];
        if (!box || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(box[key]))) continue;
        boxes[id] = {x: round(clamp(box.x, -32768, 32768)), y: round(clamp(box.y, -32768, 32768)), width: round(clamp(box.width, 0, 32768)), height: round(clamp(box.height, 0, 32768)), rotation: round(clamp(finite(box.rotation), -360, 360))};
      }
      const cardWidth = clamp(finite(entry.face.offsetWidth), 0, 32768), cardHeight = clamp(finite(entry.face.offsetHeight), 0, 32768);
      if (!cardWidth || !cardHeight || !Object.keys(boxes).length) continue;
      const event = {type: 'card-parts-measured', cardId: entry.cardId, boxes, cardWidth, cardHeight};
      const signature = JSON.stringify(event);
      if (measurements.get(entry.cardId) !== signature) {
        measurements.set(entry.cardId, signature);
        emit(event);
      }
    }
    handlePosition();
  }
  function scheduleMeasurements() {
    if (measurementFrame === null && !disposed) measurementFrame = win.requestAnimationFrame(measureParts);
  }

  function layoutFor(id) {return snapshot.draft?.styles?.[id]?.layout || {};}
  function view() {
    const options = snapshot.layoutView || {};
    return {gridEnabled: options.gridEnabled === true, gridSize: clamp(finite(options.gridSize, 10), 1, 256), snapEnabled: options.snapEnabled === true, rotationSnap: clamp(finite(options.rotationSnap, 15), 1, 180)};
  }
  function selectedFor(id) {
    const selected = snapshot.layoutSelection;
    const values = Array.isArray(selected) ? selected : selected?.cardId && selected.cardId !== id ? [] : selected?.partIds;
    return [...new Set((Array.isArray(values) ? values : []).filter(part => known.has(part)))];
  }
  function expandGroup(layout, selected) {
    const groups = new Set(selected.map(id => layout.parts?.[id]?.groupId).filter(Boolean));
    return [...new Set([...selected, ...definitions.filter(part => groups.has(layout.parts?.[part.id]?.groupId)).map(part => part.id)])];
  }
  function entryFor(id) {return entries.find(entry => entry.cardId === id);}
  function scale(entry) {return Math.max(0.0001, entry.face.getBoundingClientRect().width / 280);}
  function marked(target) {
    const element = target?.closest?.('[data-editor-part]');
    if (!element || !host.contains(element) || !known.has(element.dataset.editorPart)) return null;
    const entry = entries.find(item => item.face.contains(element));
    return entry ? {...entry, element, partId: element.dataset.editorPart} : null;
  }
  function dragOver(event) {
    if (disposed || snapshot.editable !== true || !Array.from(event.dataTransfer?.types || []).includes('Files')) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = marked(event.target) ? 'copy' : 'none';
  }
  function dropArt(event) {
    if (disposed || snapshot.editable !== true) return;
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    event.preventDefault(); event.stopPropagation();
    const picked = marked(event.target);
    if (!picked || !['image/png', 'image/webp'].includes(file.type) || !Number.isFinite(file.size) || file.size < 0 || file.size > 2_000_000) return;
    emit({type: 'card-part-art-drop', cardId: picked.cardId, partId: picked.partId, file});
  }
  function capture(pointerId) {try {host.setPointerCapture(pointerId);} catch {}}
  function release(pointerId) {try {if (host.hasPointerCapture(pointerId)) host.releasePointerCapture(pointerId);} catch {}}
  function handlePosition() {
    if (!rotateHandle) return;
    const entry = entryFor(rotateHandle.dataset.editorCard);
    const part = definitions.find(item => item.id === rotateHandle.dataset.editorRotate);
    const element = entry?.face.querySelector(part?.selector || ':not(*)');
    if (!element) {rotateHandle.hidden = true; return;}
    const rect = element.getBoundingClientRect(), bounds = host.getBoundingClientRect();
    const hostScaleX = bounds.width / (host.offsetWidth || bounds.width || 1);
    const hostScaleY = bounds.height / (host.offsetHeight || bounds.height || 1);
    rotateHandle.hidden = !rect.width || !rect.height || win.getComputedStyle(element).visibility==='hidden';
    rotateHandle.style.left = `${(rect.left + rect.width / 2 - bounds.left) / hostScaleX + host.scrollLeft - 12}px`;
    rotateHandle.style.top = `${Math.max(4,(rect.top - bounds.top - 32) / hostScaleY + host.scrollTop)}px`;
  }
  function refreshView() {
    if (disposed) return;
    for (const entry of entries) {
      const wrapper = entry.face.parentElement;
      const displayScale = Math.max(0.0001, entry.face.getBoundingClientRect().width / (entry.face.offsetWidth || 280));
      if (wrapper && wrapper !== host) wrapper.style.translate = `${pan.x / displayScale}px ${pan.y / displayScale}px`;
    }
    const options = view();
    const active = entries.find(entry => selectedFor(entry.cardId).length) || entries[0];
    if (snapshot.editable === true && options.gridEnabled && active) {
      const rect = active.face.getBoundingClientRect(), bounds = host.getBoundingClientRect();
      const hostScale = bounds.width / (host.offsetWidth || bounds.width || 1);
      const spacing = options.gridSize * scale(active) / hostScale;
      host.style.backgroundImage = 'linear-gradient(to right,#d5b57024 1px,transparent 1px),linear-gradient(to bottom,#d5b57024 1px,transparent 1px)';
      host.style.backgroundSize = `${spacing}px ${spacing}px`;
      host.style.backgroundPosition = `${(rect.left - bounds.left) / hostScale + host.scrollLeft}px ${(rect.top - bounds.top) / hostScale + host.scrollTop}px`;
    } else {
      host.style.backgroundImage = original.backgroundImage;
      host.style.backgroundSize = original.backgroundSize;
      host.style.backgroundPosition = original.backgroundPosition;
    }
    handlePosition();
  }
  function decorate() {
    rotateHandle?.remove(); rotateHandle = null;
    for (const entry of entries) {
      const selection = expandGroup(layoutFor(entry.cardId), selectedFor(entry.cardId));
      for (const part of definitions) {
        const element = entry.face.querySelector(part.selector);
        if (!element) continue;
        if (!attributes.has(element)) attributes.set(element, {role: element.getAttribute('role'), tabindex: element.getAttribute('tabindex'), label: element.getAttribute('aria-label')});
        if (snapshot.editable === true) {
          element.dataset.editorPart = part.id;
          element.dataset.editorSelected = String(selection.includes(part.id));
          element.classList.add('native-card-part-editable');
          element.setAttribute('role', 'button'); element.setAttribute('tabindex', '0');
          element.setAttribute('aria-label', `Select ${part.label || part.id}; double-click or Enter to edit`);
        } else {
          delete element.dataset.editorPart; delete element.dataset.editorSelected;
          element.classList.remove('native-card-part-editable');
          const prior = attributes.get(element);
          for (const [key, value] of [['role', prior.role], ['tabindex', prior.tabindex], ['aria-label', prior.label]]) value === null ? element.removeAttribute(key) : element.setAttribute(key, value);
        }
      }
      const anchor = selection[0];
      if (snapshot.editable === true && !rotateHandle && anchor) {
        const element = entry.face.querySelector(definitions.find(part => part.id === anchor).selector);
        if (element && layoutFor(entry.cardId).parts?.[anchor]?.visible !== false) {
          rotateHandle = doc.createElement('button'); rotateHandle.type = 'button';
          rotateHandle.className = 'native-card-rotate-handle'; rotateHandle.textContent = '↻';
          rotateHandle.dataset.editorRotate = anchor; rotateHandle.dataset.editorCard = entry.cardId;
          rotateHandle.setAttribute('aria-label', `Rotate ${label(anchor)}`);
          rotateHandle.title = 'Drag to rotate; Left/Right keys rotate selection';
          host.append(rotateHandle);
        }
      }
    }
    host.style.touchAction = snapshot.editable === true ? 'none' : original.touchAction;
    refreshView();
  }
  function translated(base, partIds, dx, dy) {
    const next = clone(base); next.parts ||= {};
    dx = clamp(dx, Math.max(...partIds.map(id => -4096 - finite(base.parts?.[id]?.x))), Math.min(...partIds.map(id => 4096 - finite(base.parts?.[id]?.x))));
    dy = clamp(dy, Math.max(...partIds.map(id => -4096 - finite(base.parts?.[id]?.y))), Math.min(...partIds.map(id => 4096 - finite(base.parts?.[id]?.y))));
    for (const id of partIds) next.parts[id] = {...next.parts[id], x: round(finite(base.parts?.[id]?.x) + dx), y: round(finite(base.parts?.[id]?.y) + dy)};
    return {next, dx: round(dx), dy: round(dy)};
  }
  function rotated(base, partIds, angle) {
    const anchor = finite(base.parts?.[partIds[0]]?.rotation);
    const delta = clamp(angle - anchor, Math.max(...partIds.map(id => -360 - finite(base.parts?.[id]?.rotation))), Math.min(...partIds.map(id => 360 - finite(base.parts?.[id]?.rotation))));
    const next = clone(base); next.parts ||= {};
    for (const id of partIds) next.parts[id] = {...next.parts[id], rotation: round(finite(base.parts?.[id]?.rotation) + delta)};
    return {next, rotation: round(anchor + delta)};
  }
  function live(next) {
    const entry = entryFor(gesture.cardId);
    if (entry) {applyLayout(entry.face, next); gesture.current = next; handlePosition();}
  }
  function pointerDown(event) {
    if (disposed || gesture || event.isPrimary === false) return;
    if (event.button === 1) {
      event.preventDefault(); event.stopPropagation();
      gesture = {kind: 'pan', pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: pan.x, y: pan.y};
      capture(event.pointerId); return;
    }
    if (event.button !== 0 || snapshot.editable !== true) return;
    const rotate = event.target?.closest?.('[data-editor-rotate]');
    const picked = rotate && host.contains(rotate) ? {cardId: rotate.dataset.editorCard, partId: rotate.dataset.editorRotate, ...entryFor(rotate.dataset.editorCard)} : marked(event.target);
    if (!picked?.face) return;
    event.preventDefault(); event.stopPropagation();
    const base = clone(layoutFor(picked.cardId));
    const selection = selectedFor(picked.cardId);
    const chosen = selection.includes(picked.partId) ? selection : event.shiftKey ? [...selection, picked.partId] : [picked.partId];
    const partIds = expandGroup(base, [picked.partId, ...chosen.filter(id => id !== picked.partId)]);
    if (!rotate) emit({type: 'card-part-select', cardId: picked.cardId, partId: picked.partId, additive: event.shiftKey === true});
    gesture = {kind: rotate ? 'rotate' : 'translate', pointerId: event.pointerId, cardId: picked.cardId, partIds, base, before: JSON.stringify(layoutFor(picked.cardId)), startX: event.clientX, startY: event.clientY, scale: scale(picked), moved: false, current: base, dx: 0, dy: 0, rotation: finite(base.parts?.[picked.partId]?.rotation), options: view()};
    if (rotate) {
      const element = picked.face.querySelector(definitions.find(part => part.id === picked.partId).selector);
      const rect = element.getBoundingClientRect();
      gesture.center = {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2};
      gesture.startAngle = Math.atan2(event.clientY - gesture.center.y, event.clientX - gesture.center.x);
    }
    capture(event.pointerId);
  }
  function pointerMove(event) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    const dx = event.clientX - gesture.startX, dy = event.clientY - gesture.startY;
    if (gesture.kind === 'pan') {pan.x = gesture.x + dx; pan.y = gesture.y + dy; refreshView(); return;}
    if (!gesture.moved && Math.hypot(dx, dy) < 3) return;
    gesture.moved = true;
    if (gesture.kind === 'translate') {
      const anchor = gesture.base.parts?.[gesture.partIds[0]] || {};
      let x = dx / gesture.scale, y = dy / gesture.scale;
      if (gesture.options.snapEnabled) {x = snap(finite(anchor.x) + x, gesture.options.gridSize) - finite(anchor.x); y = snap(finite(anchor.y) + y, gesture.options.gridSize) - finite(anchor.y);}
      const result = translated(gesture.base, gesture.partIds, x, y);
      gesture.dx = result.dx; gesture.dy = result.dy; live(result.next);
    } else {
      const current = Math.atan2(event.clientY - gesture.center.y, event.clientX - gesture.center.x);
      const delta = Math.atan2(Math.sin(current - gesture.startAngle), Math.cos(current - gesture.startAngle)) * 180 / Math.PI;
      let angle = finite(gesture.base.parts?.[gesture.partIds[0]]?.rotation) + delta;
      if (gesture.options.snapEnabled) angle = snap(angle, gesture.options.rotationSnap);
      const result = rotated(gesture.base, gesture.partIds, angle);
      gesture.rotation = result.rotation; live(result.next);
    }
  }
  function finish(event, cancel = false) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const finished = gesture; gesture = null;
    release(event.pointerId);
    if (finished.kind === 'pan') {if (cancel) {pan.x = finished.x; pan.y = finished.y; refreshView();} return;}
    if (cancel) {const entry = entryFor(finished.cardId); if (entry) applyLayout(entry.face, finished.base); handlePosition(); return;}
    if (!finished.moved) return;
    if (finished.kind === 'translate' && (finished.dx || finished.dy)) emit({type: 'card-layout-translate', cardId: finished.cardId, partIds: finished.partIds, dx: finished.dx, dy: finished.dy, before: finished.before});
    if (finished.kind === 'rotate' && finished.rotation !== finite(finished.base.parts?.[finished.partIds[0]]?.rotation)) emit({type: 'card-layout-rotate', cardId: finished.cardId, partIds: finished.partIds, rotation: finished.rotation, before: finished.before});
  }
  function click(event) {
    if (snapshot.editable === true && (marked(event.target) || event.target?.closest?.('[data-editor-rotate]'))) {event.preventDefault(); event.stopPropagation();}
  }
  function doubleClick(event) {
    if (snapshot.editable !== true) return;
    const picked = marked(event.target);
    if (picked) {event.preventDefault(); event.stopPropagation(); emit({type: 'card-part-edit', cardId: picked.cardId, partId: picked.partId});}
  }
  function zoom(value) {viewZoom = clamp(Math.round(value), 50, 250); emit({type: 'card-view-zoom', zoom: viewZoom});}
  function wheel(event) {
    if (!event.ctrlKey) return;
    event.preventDefault(); event.stopPropagation();
    zoom(viewZoom + (event.deltaY < 0 ? 10 : -10));
  }
  function keydown(event) {
    if (event.key === 'Escape' && gesture) {event.preventDefault(); event.stopPropagation(); finish({pointerId: gesture.pointerId}, true); return;}
    if ((event.ctrlKey || event.metaKey) && ['+', '=', '-', '0'].includes(event.key)) {event.preventDefault(); event.stopPropagation(); zoom(event.key === '0' ? 100 : viewZoom + (event.key === '-' ? -10 : 10)); return;}
    if (snapshot.editable !== true || gesture) return;
    const picked = marked(event.target);
    const rotate = event.target?.closest?.('[data-editor-rotate]');
    if (picked && ['Enter', ' '].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      emit({type: event.key === 'Enter' ? 'card-part-edit' : 'card-part-select', cardId: picked.cardId, partId: picked.partId, additive: event.shiftKey === true}); return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) || (!picked && !rotate)) return;
    event.preventDefault(); event.stopPropagation();
    const cardId = picked?.cardId || rotate.dataset.editorCard, partId = picked?.partId || rotate.dataset.editorRotate;
    const base = layoutFor(cardId), before = JSON.stringify(base), options = view();
    const selection = selectedFor(cardId);
    const partIds = expandGroup(base, [partId, ...(selection.includes(partId) ? selection.filter(id => id !== partId) : [])]);
    if (rotate) {
      const direction = ['ArrowLeft', 'ArrowDown'].includes(event.key) ? -1 : 1;
      const result = rotated(base, partIds, finite(base.parts?.[partId]?.rotation) + direction * (options.snapEnabled ? options.rotationSnap : event.shiftKey ? 15 : 1));
      if (result.rotation !== finite(base.parts?.[partId]?.rotation)) emit({type: 'card-layout-rotate', cardId, partIds, rotation: result.rotation, before});
    } else {
      const step = options.snapEnabled ? options.gridSize : event.shiftKey ? 10 : 1;
      const result = translated(base, partIds, event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0, event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0);
      if (result.dx || result.dy) emit({type: 'card-layout-translate', cardId, partIds, dx: result.dx, dy: result.dy, before});
    }
  }
  const pointerUp = event => finish(event);
  const pointerCancel = event => finish(event, true);
  const lostCapture = event => {if (gesture?.pointerId === event.pointerId) finish(event, true);};
  const listeners = [['pointerdown', pointerDown, true], ['pointermove', pointerMove, true], ['pointerup', pointerUp, true], ['pointercancel', pointerCancel, true], ['lostpointercapture', lostCapture, true], ['click', click, true], ['dblclick', doubleClick, true], ['keydown', keydown, true], ['wheel', wheel, {passive: false}], ['dragover', dragOver, true], ['drop', dropArt, true]];
  for (const [type, handler, options] of listeners) host.addEventListener(type, handler, options);
  win.addEventListener('resize', scheduleMeasurements);
  host.addEventListener('scroll', handlePosition);

  function update(next, faces) {
    if(next?.fitRevision!==snapshot.fitRevision){pan.x=0;pan.y=0;}
    if (disposed) return;
    const pending = gesture;
    snapshot = next || {};
    viewZoom = clamp(finite(snapshot.zoom, viewZoom), 50, 250);
    entries = (Array.isArray(faces) ? faces : []).map((face, index) => ({face, cardId: snapshot.ids?.[index] || snapshot.cardId})).filter(entry => entry.face && typeof entry.cardId === 'string');
    if (pending && pending.kind !== 'pan') {
      const entry = entryFor(pending.cardId);
      if (!entry || snapshot.editable !== true || JSON.stringify(layoutFor(pending.cardId)) !== pending.before) {
        finish({pointerId: pending.pointerId}, true);
        if (entry) applyLayout(entry.face, layoutFor(pending.cardId));
      }
      else if (pending.moved) applyLayout(entry.face, pending.current);
    }
    decorate();
    scheduleMeasurements();
  }
  function destroy() {
    if (disposed) return;
    if (gesture) finish({pointerId: gesture.pointerId}, true);
    snapshot = {...snapshot, editable: false}; decorate();
    disposed = true;
    for (const [type, handler, options] of listeners) host.removeEventListener(type, handler, options);
    win.removeEventListener('resize', scheduleMeasurements); host.removeEventListener('scroll', handlePosition);
    if (measurementFrame !== null) win.cancelAnimationFrame(measurementFrame);
    for (const entry of entries) if (entry.face.parentElement && entry.face.parentElement !== host) entry.face.parentElement.style.translate = '';
    for (const key of ['backgroundImage', 'backgroundSize', 'backgroundPosition', 'position', 'touchAction']) host.style[key] = original[key];
    if (original.tabIndex === null) host.removeAttribute('tabindex'); else host.setAttribute('tabindex', original.tabIndex);
    rotateHandle?.remove(); style.remove();
  }
  return {update, destroy};
}
