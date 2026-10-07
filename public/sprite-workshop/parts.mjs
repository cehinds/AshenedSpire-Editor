import {clone, uid, point, worldMatrix, setWorldMatrix, reparent, anchorWorld} from './core.mjs';

export function createLayerGroup(p,ids,name='Component group',id=uid('group')) {
  const members=p.layers.filter(l=>ids.includes(l.id));
  if(members.length<2)throw Error('Select at least two components to group.');
  if(members.some(l=>l.locked))throw Error('Unlock selected components before grouping.');
  const roots=members.filter(l=>!ids.includes(l.parentId));
  const pivots=roots.map(l=>point(worldMatrix(p,l),l.pivot));
  const pivot=pivots.reduce((sum,v)=>sum.map((n,i)=>n+v[i]/pivots.length),[0,0]);
  const group={id,name,assetId:members[0].assetId,role:'group',x:0,y:0,rotation:0,scale:1,pivot,visible:true,locked:false,opacity:1,parentId:null,anchors:[],masks:[],erase:[],groupRestoreParents:Object.fromEntries(roots.map(l=>[l.id,l.parentId])),notes:'Group container; children retain separate artwork and anchors.'};
  p.layers.push(group);for(const l of roots)reparent(p,l,id);return group;
}

export function ungroupLayer(p,id) {
  const group=p.layers.find(l=>l.id===id);if(!group)throw Error('Select a group.');
  const children=p.layers.filter(l=>l.parentId===id);
  if(group.locked||children.some(l=>l.locked))throw Error('Unlock the group and its children first.');
  for(const l of children){const old=group.groupRestoreParents?.[l.id];reparent(p,l,old&&p.layers.some(x=>x.id===old)&&!descendants(p,[l.id]).has(old)?old:group.parentId||null);}
  if(group.role==='group'){p.layers=p.layers.filter(l=>l.id!==id);p.bones=(p.bones||[]).filter(b=>b.from[0]!==id&&b.to[0]!==id);}
  return children.map(l=>l.id);
}

export function layerVisible(p,l){if(!l.visible)return false;const parent=p.layers.find(x=>x.id===l.parentId);return !parent||layerVisible(p,parent);}
export function groupOpacity(p,l){const parent=p.layers.find(x=>x.id===l.parentId);return parent?(parent.role==='group'?parent.opacity:1)*groupOpacity(p,parent):1;}

export function descendants(p, ids) {
  const result = new Set(ids);
  let size;
  do { size = result.size; for (const l of p.layers) if (result.has(l.parentId)) result.add(l.id); } while (size !== result.size);
  return result;
}

export function assertMovable(before, after) {
  for (const l of before.layers) if (l.locked) {
    const next = after.layers.find(x => x.id === l.id);
    if (!next || worldMatrix(before,l).some((n,i) => Math.abs(n-worldMatrix(after,next)[i]) > 1e-6))
      throw Error('Unlock '+l.name+' before moving its group.');
  }
}

// Parent links form groups without flattening artwork or changing draw order.
export function groupParts(p, ids, rootId) {
  const members = p.layers.filter(l => ids.includes(l.id));
  if (members.length < 2 || !ids.includes(rootId)) throw Error('Select two or more layers. The last selected part becomes the group handle.');
  if (members.some(l => l.locked)) throw Error('Unlock selected layers before grouping.');
  const root = members.find(l => l.id === rootId);
  const next = clone(p), target = next.layers.find(l => l.id === rootId);
  reparent(next,target,null);
  for (const l of next.layers.filter(l => ids.includes(l.id) && l.id !== rootId)) reparent(next,l,rootId);
  assertMovable(p,next);
  p.layers = next.layers;
  return root.name;
}

export function reorderParts(p, ids, targetId, front) {
  const moving = p.layers.filter(l => ids.includes(l.id));
  if (!moving.length || ids.includes(targetId)) return;
  if (moving.some(l => l.locked)) throw Error('Unlock layers before reordering.');
  const rest = p.layers.filter(l => !ids.includes(l.id));
  const index = rest.findIndex(l => l.id === targetId);
  if (index < 0) throw Error('Missing drop target.');
  rest.splice(index + (front ? 1 : 0),0,...moving);
  p.layers = rest;
}

export function attachAnchors(p, from, to, attach=false) {
  const a = anchorWorld(p,from), b = anchorWorld(p,to);
  if (!a || !b || (from[0]===to[0] && from[1]===to[1])) throw Error('Choose two different anchors.');
  const source = p.layers.find(l => l.id === from[0]);
  if (source.locked) throw Error('Unlock the source layer.');
  if (attach) {
    if (from[0] === to[0]) throw Error('An attachment needs two different layers.');
    const next=clone(p), l=next.layers.find(l=>l.id===from[0]);
    reparent(next,l,to[0]);
    const m=worldMatrix(next,l); m[4]+=b[0]-a[0]; m[5]+=b[1]-a[1]; setWorldMatrix(next,l,m);
    assertMovable(p,next);
    p.layers=next.layers;
  }
  p.bones ??= [];
  if (!p.bones.some(x=>JSON.stringify([x.from,x.to])===JSON.stringify([from,to]))) p.bones.push({from:clone(from),to:clone(to),locked:false});
}
