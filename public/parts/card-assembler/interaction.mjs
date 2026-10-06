import { clone, clamp, bounds, move, snap } from './model.mjs';

const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const selected = (doc, ids) => doc.items.filter(item => ids.includes(item.id));
const finite = (...values) => values.every(Number.isFinite);

/** Include the card and visible overflow without changing document coordinates. */
export function contentBounds(doc, padding = 0) {
  if (!finite(padding) || padding < 0) throw Error('Padding must be a nonnegative number.');
  const boxes = [{ x:0, y:0, w:doc.width, h:doc.height }];
  for (const item of doc.items) {
    if (item.visible === false) continue;
    const stroke = item.asset === 'text' ? (item.strokeWidth || 0) / 2 : 0;
    if (item.clipToCard) {
      const x = Math.max(0,item.x), y = Math.max(0,item.y);
      const right = Math.min(doc.width,item.x+item.w), bottom = Math.min(doc.height,item.y+item.h);
      if (right>x && bottom>y) boxes.push({x,y,w:right-x,h:bottom-y});
    } else boxes.push({ x:item.x-stroke, y:item.y-stroke, w:item.w+stroke*2, h:item.h+stroke*2 });
  }
  const box = bounds(boxes);
  return { x:box.x-padding, y:box.y-padding, w:box.w+padding*2, h:box.h+padding*2 };
}

/** Transform the selection around the opposite handle, or its centre with Alt. */
export function resizeSelection(doc, ids, handle, dx, dy, { aspect = true, center = false } = {}) {
  if (!handles.includes(handle)) throw Error('Unknown resize handle.');
  if (!finite(dx,dy)) throw Error('Resize deltas must be finite numbers.');
  const out = clone(doc), nodes = selected(out,ids);
  if (!nodes.length || nodes.some(n=>n.locked) || (!dx && !dy)) return out;
  const box = bounds(nodes);
  const west = handle.includes('w'), east = handle.includes('e');
  const north = handle.includes('n'), south = handle.includes('s');
  const horizontal = west || east, vertical = north || south;
  const factor = center ? 2 : 1;
  let sx = horizontal ? (box.w + (west ? -dx : dx)*factor)/box.w : 1;
  let sy = vertical ? (box.h + (north ? -dy : dy)*factor)/box.h : 1;
  const proportional = aspect && horizontal && vertical;
  const minX = Math.max(...nodes.map(n=>8/n.w)), maxX = Math.min(...nodes.map(n=>4096/n.w));
  const minY = Math.max(...nodes.map(n=>8/n.h)), maxY = Math.min(...nodes.map(n=>4096/n.h));
  if (proportional) {
    const scale = Math.abs(sx-1) >= Math.abs(sy-1) ? sx : sy;
    sx = sy = clamp(scale,Math.max(minX,minY),Math.min(maxX,maxY));
  } else {
    if (horizontal) sx = clamp(sx,minX,maxX);
    if (vertical) sy = clamp(sy,minY,maxY);
  }
  const anchorX = center ? box.x+box.w/2 : west ? box.x+box.w : box.x;
  const anchorY = center ? box.y+box.h/2 : north ? box.y+box.h : box.y;
  for (const node of nodes) {
    node.x = anchorX+(node.x-anchorX)*sx;
    node.y = anchorY+(node.y-anchorY)*sy;
    node.w *= sx; node.h *= sy;
    if (node.asset === 'text') node.fontSize = clamp(node.fontSize*Math.min(sx,sy),6,200);
  }
  return out;
}

/** Footer Atelier edge/centre snapping, with the card itself as another target. */
export function snapTranslation(doc, ids, dx, dy, { threshold = 8, grid = 0, enabled = true, edges = true } = {}) {
  if (!finite(dx,dy,threshold,grid) || threshold < 0 || grid < 0) throw Error('Snap parameters must be finite, nonnegative numbers.');
  const nodes = selected(doc,ids);
  if (!nodes.length || nodes.some(n=>n.locked)) return {doc:clone(doc),guides:[]};
  if (!enabled) return {doc:move(doc,ids,dx,dy),guides:[]};
  const box = bounds(nodes), proposed = {...box,x:box.x+dx,y:box.y+dy};
  const others = [{id:'artboard',x:0,y:0,w:doc.width,h:doc.height},...doc.items.filter(n=>n.visible !== false && !ids.includes(n.id))];
  const result = snap(proposed,others,{threshold,grid,edges});
  return {doc:move(doc,ids,result.x-box.x,result.y-box.y),guides:result.guides};
}

export function hitHandles(box, point, tolerance) {
  if (!finite(point.x,point.y,tolerance) || tolerance < 0) return null;
  const coordinates = {nw:[0,0],n:[.5,0],ne:[1,0],e:[1,.5],se:[1,1],s:[.5,1],sw:[0,1],w:[0,.5]};
  let nearest = null, distance = Infinity;
  for (const handle of handles) {
    const [x,y] = coordinates[handle];
    const d = Math.hypot(point.x-(box.x+box.w*x),point.y-(box.y+box.h*y));
    if (d <= tolerance && d < distance) {nearest=handle;distance=d;}
  }
  return nearest;
}

/** Hidden group members stay attached, so making one visible restores alignment. */
export function selectionIds(doc, id, linked = true) {
  const first = doc.items.find(item=>item.id===id);
  if (!first) return [];
  const roles = [['action-rim','action-icon','action-value'],['mana-icon','mana-value','mana-mount']];
  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    const members = doc.items.filter(item=>ids.has(item.id));
    const groups = new Set(members.map(item=>item.group).filter(Boolean));
    const linkedRoles = new Set(linked ? roles.filter(set=>members.some(item=>set.includes(item.role))).flat() : []);
    for (const item of doc.items) {
      if (!ids.has(item.id) && ((item.group && groups.has(item.group)) || linkedRoles.has(item.role))) {
        ids.add(item.id); changed = true;
      }
    }
  }
  return doc.items.filter(item=>ids.has(item.id)).map(item=>item.id);
}

/** Explicit groups remain units even when automatic cost linking is disabled. */
export function selectionUnits(doc, ids, { linked = true } = {}) {
  const requested = new Set(ids), used = new Set(), units = [];
  for (const item of doc.items) {
    if (!requested.has(item.id) || used.has(item.id)) continue;
    const members = selectionIds(doc,item.id,linked);
    members.forEach(id=>used.add(id));
    units.push({ids:members,box:bounds(selected(doc,members))});
  }
  return units;
}

const alignmentModes = {
  left:['x','w',0], 'center-x':['x','w',.5], right:['x','w',1],
  top:['y','h',0], 'center-y':['y','h',.5], bottom:['y','h',1]
};
function shiftUnit(doc, ids, axis, delta) {
  const members = new Set(ids);
  for (const item of doc.items) if (members.has(item.id)) item[axis] += delta;
}
function operationMembers(doc, units) {
  return selected(doc,[...new Set(units.flatMap(unit=>unit.ids))]);
}

export function alignSelection(doc, ids, mode, { target = 'card', linked = true } = {}) {
  if (!Object.hasOwn(alignmentModes,mode)) throw Error('Unknown alignment mode.');
  if (!['card','selection'].includes(target)) throw Error('Alignment target must be card or selection.');
  const out = clone(doc), units = selectionUnits(out,ids,{linked}), members = operationMembers(out,units);
  if (!members.length || members.some(item=>item.locked)) return out;
  const [axis,size,factor] = alignmentModes[mode], combined = bounds(members);
  if (target === 'card') {
    const delta = (axis === 'x' ? out.width : out.height)*factor-(combined[axis]+combined[size]*factor);
    shiftUnit(out,members.map(item=>item.id),axis,delta);
  } else {
    const destination = combined[axis]+combined[size]*factor;
    for (const unit of units) shiftUnit(out,unit.ids,axis,destination-unit.box[axis]-unit.box[size]*factor);
  }
  return out;
}

export function distributeSelection(doc, ids, axis, { linked = true } = {}) {
  if (!['x','y'].includes(axis)) throw Error('Distribution axis must be x or y.');
  const out = clone(doc), units = selectionUnits(out,ids,{linked}), members = operationMembers(out,units);
  if (units.length < 3 || members.some(item=>item.locked)) return out;
  const size = axis === 'x' ? 'w' : 'h';
  units.sort((a,b)=>a.box[axis]-b.box[axis]);
  const first = units[0], last = units.at(-1);
  const span = last.box[axis]+last.box[size]-first.box[axis];
  const gap = (span-units.reduce((sum,unit)=>sum+unit.box[size],0))/(units.length-1);
  let position = first.box[axis]+first.box[size]+gap;
  for (let i=1;i<units.length-1;i++) {
    shiftUnit(out,units[i].ids,axis,position-units[i].box[axis]);
    position += units[i].box[size]+gap;
  }
  return out;
}

/** Merge complete explicit groups; implicit cost links remain a view preference. */
export function groupSelection(doc, ids, groupId) {
  if (typeof groupId !== 'string' || !/^[\w.-]{1,100}$/.test(groupId)) throw Error('A group needs a safe ID of up to 100 characters.');
  const out = clone(doc), requested = [...ids,...out.items.filter(item=>item.group===groupId).map(item=>item.id)];
  const members = operationMembers(out,selectionUnits(out,requested,{linked:false}));
  if (members.length < 2 || members.some(item=>item.locked)) return out;
  for (const item of members) item.group = groupId;
  return out;
}

export function ungroupSelection(doc, ids) {
  const out = clone(doc), members = operationMembers(out,selectionUnits(out,ids,{linked:false}));
  if (members.some(item=>item.locked)) return out;
  for (const item of members) item.group = '';
  return out;
}
