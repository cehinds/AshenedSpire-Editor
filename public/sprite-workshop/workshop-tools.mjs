import {clone,uid,worldMatrix,setWorldMatrix,reparent,point,inverse,anchorWorld,validateProject,effectivePose} from './core.mjs';
import {descendants,createLayerGroup,ungroupLayer,reorderParts,attachAnchors} from './parts.mjs';

export function installWorkshopTools(api) {
  const $=id=>document.getElementById(id);
  let selected=new Set(), selectionPose='', activeDrag=null, preview=null, connection=null, lastDownload=null,finishPointerDrag=null;
  let componentSource='current',sourcePartId='';
  const p=()=>api.pose(), state=()=>api.state();
  function sourceFrame(value=componentSource){if(!value.startsWith('frame:'))return null;const [animationId,index]=JSON.parse(value.slice(6));return state().project.animations[animationId]?.frames[index]||null;}
  function sourcePose(value=componentSource){const f=sourceFrame(value);return f?effectivePose(state().project,f):value.startsWith('pose:')?state().project.poses[value.slice(5)]:api.displayed();}
  function sourceDrag(part){return {type:'component',ids:[part.id],poseId:sourcePose().id,rootId:part.id,source:componentSource};}
  const run=fn=>api.guard(fn);
  const ids=()=>selected.has(state().layerId)?[...selected]:[state().layerId];
  const choose=(id,extend=false)=>{
    if(!extend)selected.clear();
    if(extend&&selected.has(id)&&selected.size>1){selected.delete(id);id=[...selected].at(-1);}else selected.add(id);
    api.select(id); api.render();
  };
  function edit(fn,message){api.mutate(()=>{api.prepareComponentEdit();const before=clone(p());fn();api.constrained(before,p());},message);}
  const button=(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.onclick=run(fn);return b;};
  function componentPose(source=p(),chosen=ids()) {
    const included=descendants(source,chosen), out=clone(source);
    out.layers=out.layers.filter(l=>included.has(l.id));
    for(const l of out.layers)if(!included.has(l.parentId)){
      const m=worldMatrix(source,source.layers.find(x=>x.id===l.id));l.parentId=null;setWorldMatrix(out,l,m);
    }
    out.bones=(out.bones||[]).filter(b=>included.has(b.from[0])&&included.has(b.to[0]));
    return out;
  }
  function componentCanvas(source=p(),chosen=ids()) {
    const out=componentPose(source,chosen);out.layers.forEach(l=>l.visible=true);
    return api.exportCanvas(out);
  }
  function componentThumbnail(source,chosen){
    const canvas=componentCanvas(source,chosen),pixels=canvas.getContext('2d').getImageData(0,0,512,512).data;
    let left=512,top=512,right=-1,bottom=-1;
    for(let y=0;y<512;y++)for(let x=0;x<512;x++)if(pixels[(y*512+x)*4+3]>20){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    const out=document.createElement('canvas');out.width=out.height=96;
    if(right>=left){const w=right-left+1,h=bottom-top+1,scale=84/Math.max(w,h);out.getContext('2d').drawImage(canvas,left,top,w,h,(96-w*scale)/2,(96-h*scale)/2,w*scale,h*scale);}
    return out.toDataURL('image/png');
  }
  function remapGroup(l,map){if(l.groupRestoreParents)l.groupRestoreParents=Object.fromEntries(Object.entries(l.groupRestoreParents).filter(([id])=>map.has(id)).map(([id,parent])=>[map.get(id),map.get(parent)||null]));}
  function portableParts() {
    const out=clone(state().project), part=componentPose(api.displayed());
    part.reference=null;part.gripMode='released';part.id='component';
    out.poses={component:part};out.animations={preview:{id:'preview',name:'Component',frames:[{id:'frame',poseId:'component',duration:150,overrides:{},event:''}]}};
    out.queues={preview:{id:'preview',name:'Component',loop:false,items:[{id:'item',animationId:'preview',repeats:1,pause:0}]}};
    const used=new Set(part.layers.flatMap(l=>[l.assetId,...Object.values(l.views||{})]));
    out.assets=Object.fromEntries(Object.entries(out.assets).filter(([id])=>used.has(id)));
    out.id=uid('component');out.name='Selected components';out.revisions=[];
    return api.portable(out);
  }
  async function exportParts(config=false) {
    if(config)api.saveJSON(portableParts(),'selected.component.json');
    else api.download(await api.blobOf(componentCanvas(api.displayed()),'image/png'),'selected-components.png');
  }
  function beginDrag(e,data,image) {
    activeDrag=data;e.dataTransfer.effectAllowed='copyMove';
    e.dataTransfer.setData('application/x-rig',JSON.stringify(data));
    if(image)e.dataTransfer.setDragImage(image,32,32);
    closeMenu();
  }
  function endDrag(){activeDrag=null;preview=null;document.querySelectorAll('.drop-before,.drop-after,.drop-active').forEach(x=>x.classList.remove('drop-before','drop-after','drop-active'));api.draw();}
  function group(){const chosen=ids();edit(()=>{const hands=chosen.every(id=>/hand/i.test(p().layers.find(l=>l.id===id)?.name||'')),g=createLayerGroup(p(),chosen,hands?'Hands':'Component group');selected=new Set([g.id]);api.select(g.id);},'Grouped as separate editable components. Select the group to move together, or select a child to edit it.');}
  function detach(){edit(()=>{for(const l of p().layers.filter(l=>ids().includes(l.id))){if(l.locked)throw Error('Unlock '+l.name+' first.');reparent(p(),l,null);}},'Selected parts detached; placement preserved.');}
  function ungroup(){edit(()=>{const active=p().layers.find(l=>l.id===state().layerId),parent=p().layers.find(l=>l.id===active?.parentId),target=active?.role==='group'?active:parent?.role==='group'?parent:active;if(!target)throw Error('Select a group or one of its children.');const children=ungroupLayer(p(),target.id);if(!children.length)throw Error('This component has no grouped children.');if(target.role==='group')for(const a of Object.values(state().project.animations))for(const f of a.frames)if(f.poseId===p().id&&f.overrides)delete f.overrides[target.id];selected=new Set(children);api.select(children[0]);},'Ungrouped. Each hand remains separately editable; placement preserved.');}
  function lockSelection(value){edit(()=>{for(const l of p().layers)if(descendants(p(),ids()).has(l.id))l.locked=value;},value?'Selection and connected children locked.':'Selection and connected children unlocked.');}
  function deleteSelected(){
    const remove=new Set(ids());
    for(const l of p().layers)if(remove.has(l.id)&&l.role==='group')for(const id of descendants(p(),[l.id]))remove.add(id);
    for(const l of p().layers)if(l.handFragment&&remove.has(l.parentId))remove.add(l.id);
    edit(()=>{
      const parts=p().layers.filter(l=>remove.has(l.id));
      if(parts.some(l=>l.locked))throw Error('Unlock selected components before deleting them.');
      if(parts.length===p().layers.length)throw Error('Keep at least one component. Hide it for an empty frame.');
      for(const child of p().layers.filter(l=>!remove.has(l.id)&&remove.has(l.parentId)))reparent(p(),child,null);
      p().layers=p().layers.filter(l=>!remove.has(l.id));
      p().bones=(p().bones||[]).filter(b=>!remove.has(b.from[0])&&!remove.has(b.to[0]));
      for(const a of Object.values(state().project.animations))for(const f of a.frames)if(f.poseId===p().id)for(const id of remove)if(f.overrides)delete f.overrides[id];
      selected=new Set([p().layers[0].id]);api.select(p().layers[0].id);
    },'Selected components deleted. Group contents and finger overlays follow their component. Undo restores the deletion.');
  }

  function renderLayers() {
    if(selectionPose!==p().id){selected.clear();selectionPose=p().id;connection=null;}
    selected=new Set([...selected].filter(id=>p().layers.some(l=>l.id===id)));
    if(!selected.has(state().layerId))selected=new Set([state().layerId]);
    const selection=p().layers.filter(l=>ids().includes(l.id)),lockedSelection=p().layers.some(l=>descendants(p(),ids()).has(l.id)&&l.locked),canUngroup=selection.some(l=>l.role==='group'||p().layers.some(parent=>parent.id===l.parentId&&parent.role==='group'));for(const id of ['groupComponents','groupParts'])$(id).disabled=selection.length<2||lockedSelection;for(const id of ['ungroupComponents','ungroupParts'])$(id).disabled=!canUngroup||lockedSelection;for(const id of ['deleteComponent','deleteLayer','upLayer','downLayer'])$(id).disabled=lockedSelection;
    $('layers').replaceChildren();
    for(const part of [...api.displayed().layers].reverse()) {
      const row=document.createElement('div');row.className='layer'+(selected.has(part.id)?' selected':'');
      row.draggable=false;row.dataset.layerId=part.id;row.setAttribute('aria-label',part.name+' layer');
      const grip=document.createElement('span');grip.className='layer-grip';grip.textContent='⠿';grip.draggable=false;grip.title='Drag '+part.name+' to reorder or place on canvas';
      // Pointer capture gives the drag handle the same behavior on touch and desktop.
      let pointerDrag=null;
      grip.onpointerdown=e=>{if(e.button!==0||part.locked)return;e.preventDefault();e.stopPropagation();if(!selected.has(part.id)){selected=new Set([part.id]);api.select(part.id);}pointerDrag={start:[e.clientX,e.clientY],data:{type:'layer',ids:ids(),poseId:p().id,rootId:part.id},moved:false};finishPointerDrag=grip.onpointerup;grip.setPointerCapture(e.pointerId);};
      grip.onpointermove=e=>{
        if(!pointerDrag)return;const d=pointerDrag;if(Math.hypot(e.clientX-d.start[0],e.clientY-d.start[1])<4&&!d.moved)return;d.moved=true;
        document.querySelectorAll('.drop-before,.drop-after').forEach(x=>x.classList.remove('drop-before','drop-after'));
        const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.layer');d.target=null;d.at=null;
        if(target){d.target=target.dataset.layerId;d.front=e.clientY<target.getBoundingClientRect().top+target.offsetHeight/2;target.classList.add(d.front?'drop-before':'drop-after');api.msg('Release to place selection '+(d.front?'in front of ':'behind ')+(p().layers.find(l=>l.id===d.target)?.name||'layer')+'.');}
        preview=null;
        for(const surface of [api.canvas,api.clean]){const r=surface.getBoundingClientRect();if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom){d.at=api.snap(api.coords({clientX:e.clientX,clientY:e.clientY,currentTarget:surface}),e,[null,null,descendants(p(),d.data.ids)]);preview={data:d.data,at:d.at};}}
        api.draw();
      };
      grip.onpointerup=run(e=>{if(!pointerDrag)return;const d=pointerDrag;pointerDrag=null;finishPointerDrag=null;if(e.pointerId!==undefined&&grip.hasPointerCapture(e.pointerId))grip.releasePointerCapture(e.pointerId);endDrag();if(!d.moved)return;if(d.at)place(d.data,d.at);else if(d.target)edit(()=>reorderParts(p(),d.data.ids,d.target,d.front),'Layer order updated. Top rows draw in front.');else api.msg('Drop cancelled. Release on a layer row or inside a canvas.');});
      grip.onpointercancel=()=>{pointerDrag=null;finishPointerDrag=null;endDrag();};
      const pick=document.createElement('input');pick.type='checkbox';pick.checked=selected.has(part.id);pick.setAttribute('aria-label','Select '+part.name);
      pick.onclick=e=>{e.stopPropagation();choose(part.id,true);};
      const thumb=document.createElement('img');thumb.src=componentThumbnail(api.displayed(),[part.id]);thumb.alt='';thumb.draggable=false;
      const name=button((part.role==='group'?'▣ ':part.parentId?'↳ ':'')+part.name,()=>choose(part.id));name.className='layer-name';name.title='Select; Shift-click to select several layers';name.onclick=e=>{e.stopPropagation();choose(part.id,e.shiftKey||e.ctrlKey||e.metaKey);};
      const visibility=button(part.visible?'◉':'○',()=>edit(()=>p().layers.find(l=>l.id===part.id).visible=!part.visible));visibility.setAttribute('aria-label',(part.visible?'Hide ':'Show ')+part.name);
      const lock=button(part.locked?'🔒':'🔓',()=>{selected=new Set([part.id]);api.select(part.id);lockSelection(!part.locked);});lock.setAttribute('aria-label',(part.locked?'Unlock ':'Lock ')+part.name);lock.setAttribute('aria-pressed',String(part.locked));
      const actions=button('⋮',e=>{e.stopPropagation();if(!selected.has(part.id))choose(part.id);menu(e);});actions.title='Actions for '+part.name;actions.setAttribute('aria-label','Actions for '+part.name);actions.className='ellipsis-button';row.append(grip,pick,thumb,name,visibility,lock,actions);
      row.oncontextmenu=e=>{e.preventDefault();if(!selected.has(part.id))choose(part.id);menu(e);};
      $('layers').append(row);
    }
    $('selectionCount').textContent=ids().length+' selected · check boxes or Shift-click for groups';
    const sourceSelect=$('componentSource');sourceSelect.replaceChildren();
    const option=(parent,value,label)=>{const o=document.createElement('option');o.value=value;o.textContent=label;parent.append(o);};
    option(sourceSelect,'current','Current canvas');
    for(const a of Object.values(state().project.animations)){const group=document.createElement('optgroup');group.label=a.name;for(const [i,f] of a.frames.entries())option(group,'frame:'+JSON.stringify([a.id,i]),`${i+1} · ${state().project.poses[f.poseId].name}`);sourceSelect.append(group);}
    const library=document.createElement('optgroup');library.label='Pose library';for(const pose of Object.values(state().project.poses))option(library,'pose:'+pose.id,pose.name);sourceSelect.append(library);
    if(![...sourceSelect.options].some(o=>o.value===componentSource))componentSource='current';sourceSelect.value=componentSource;
    const donor=sourcePose();if(!donor.layers.some(l=>l.id===sourcePartId&&!l.handFragment))sourcePartId=donor.layers.find(l=>l.handGroup)?.id||donor.layers[0]?.id;
    $('components').replaceChildren();
    for(const part of donor.layers.filter(l=>!l.handFragment)) {
      const picked=componentSource==='current'?selected.has(part.id):sourcePartId===part.id;
      const tile=document.createElement('button');tile.className='component-tile'+(picked?' selected':'');tile.draggable=true;tile.title='Click to select. Drag onto the current canvas to add a copy.';tile.setAttribute('aria-pressed',String(picked));
      const img=document.createElement('img');img.src=componentThumbnail(donor,[part.id]);img.alt='';img.draggable=false;
      const text=document.createElement('span');text.textContent=part.name;tile.append(img,text);
      tile.ondragstart=e=>beginDrag(e,sourceDrag(part),img);tile.ondragend=endDrag;
      tile.onclick=e=>{sourcePartId=part.id;if(componentSource==='current')choose(part.id,e.shiftKey||e.ctrlKey||e.metaKey);else api.render();};
      tile.oncontextmenu=e=>{e.preventDefault();if(componentSource!=='current'){sourcePartId=part.id;api.render();menu(e,null,null,false,part.name);return;}if(!selected.has(part.id))choose(part.id);menu(e);};
      $('components').append(tile);
    }
    $('addSourceComponent').disabled=!donor.layers.length;
    $('componentSourceHint').textContent=componentSource==='current'?'Showing parts on the current canvas.':'Browsing '+donor.name+'; destination remains '+p().name+'. Copies include connected child parts.';
    $('dragOutImage').src=componentCanvas(api.displayed()).toDataURL('image/png');
    $('componentSelection').textContent='Canvas selection: '+p().layers.filter(l=>ids().includes(l.id)).map(l=>l.name).join(', ')+'. Add component imports artwork or an editable component file.';
  }

  function placedPose(data,at,source=data.source?sourcePose(data.source):state().project.poses[data.poseId]) {
    if(!source)throw Error('This component is no longer available.');
    const previewPose=clone(source), included=descendants(source,data.ids),root=source.layers.find(l=>l.id===data.rootId)||source.layers.find(l=>included.has(l.id));
    const pivot=point(worldMatrix(source,root),root.pivot),dx=at[0]-pivot[0],dy=at[1]-pivot[1];
    const roots=previewPose.layers.filter(l=>included.has(l.id)&&!included.has(l.parentId));
    for(const l of roots){const m=worldMatrix(source,source.layers.find(x=>x.id===l.id));m[4]+=dx;m[5]+=dy;setWorldMatrix(previewPose,l,m);}
    return {pose:previewPose,included};
  }
  function place(data,at) {
    const originalPoseId=p().id,result=placedPose(data,at,data.source?sourcePose(data.source):data.poseId===originalPoseId?api.displayed():state().project.poses[data.poseId]);
    edit(()=>{
      if(data.type==='layer') {
        if(data.poseId!==originalPoseId)throw Error('Select the source pose first.');
        for(const l of p().layers)if(result.included.has(l.id)){
          const next=result.pose.layers.find(x=>x.id===l.id);Object.assign(l,next);
        }
      } else {
        const part=componentPose(result.pose,[...result.included]),map=new Map(part.layers.map(l=>[l.id,uid('part')]));
        for(const l of part.layers){const old=l.id;l.id=map.get(old);l.parentId=map.get(l.parentId)||null;remapGroup(l,map);l.name+=' copy';l.locked=false;l.anchors.forEach(a=>a.pinned=false);p().layers.push(l);}
        for(const b of part.bones||[])p().bones.push({...b,from:[map.get(b.from[0]),b.from[1]],to:[map.get(b.to[0]),b.to[1]]});
        selected=new Set(part.layers.map(l=>l.id));api.select(map.get(data.rootId)||part.layers[0].id);
      }
    },'Component placed. Drop position uses the part pivot; Alt bypasses snapping.');
  }

  function drawPreview(ctx) {
    if(!preview)return;
    if(preview.data){const r=placedPose(preview.data,preview.at);api.paint(ctx,componentPose(r.pose,[...r.included]),.55);}
    ctx.save();ctx.strokeStyle='#93f4c8';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(preview.at[0]-12,preview.at[1]);ctx.lineTo(preview.at[0]+12,preview.at[1]);ctx.moveTo(preview.at[0],preview.at[1]-12);ctx.lineTo(preview.at[0],preview.at[1]+12);ctx.stroke();ctx.restore();
  }
  for(const surface of [api.canvas,api.clean]) {
    surface.ondragenter=e=>e.preventDefault();
    surface.ondragover=run(e=>{e.preventDefault();surface.classList.add('drop-active');const data=activeDrag;const exclude=data?.type==='layer'?descendants(p(),data.ids):new Set();preview={data:['layer','component'].includes(data?.type)?data:null,at:api.snap(api.coords(e),e,[null,null,exclude])};api.draw();});
    surface.ondragleave=()=>{preview=null;surface.classList.remove('drop-active');api.draw();};
    surface.ondrop=run(async e=>{e.preventDefault();const data=activeDrag||api.readDrag(e),at=preview?.at||api.snap(api.coords(e),e);endDrag();if(['layer','component'].includes(data?.type))place(data,at);else if(data?.type==='pose')api.selectPose(data.id);else for(const f of e.dataTransfer.files){if(f.name.endsWith('.json'))await importParts(f,at);else await api.addArtwork(f,at);}});
    surface.addEventListener('contextmenu',e=>{e.preventDefault();const at=api.coords(e),a=$('anchors').checked?api.nearestAnchor(at):null,hit=api.hit(at);if(a){choose(a[0].id);api.select(a[0].id,a[1].id);}else if(hit&&!selected.has(hit))choose(hit);menu(e,at,a?[a[0].id,a[1].id]:null,!a&&!hit);});
    surface.addEventListener('pointerdown',run(e=>{if(!connection||e.button!==0)return;e.stopImmediatePropagation();e.preventDefault();const a=api.nearestAnchor(api.coords(e));if(!a){api.msg('Click the target anchor, or press Escape to cancel.');return;}finishConnection([a[0].id,a[1].id]);}),true);
  }
  async function importParts(file,at) {
    if(file.size>100*1024*1024)throw Error('Component file exceeds 100 MB.');
    const incoming=validateProject(JSON.parse(await file.text()));
    if(!Object.values(incoming.assets).every(a=>a.src.startsWith('data:')))throw Error('Use an embedded component file. Open project restores full projects.');
    const source=Object.values(incoming.poses)[0],prefix=uid('import')+'-';
    // Decode before mutating; malformed imports cannot leave half an operation.
    const decoded=await Promise.all(Object.values(incoming.assets).map(a=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve([a,img]);img.onerror=()=>reject(Error('Cannot decode component artwork.'));img.src=a.src;})));
    edit(()=>{
      for(const [a,img] of decoded){const id=prefix+a.id;state().project.assets[id]={...a,id};api.addImage(id,img);}
      const out=componentPose(source,source.layers.map(l=>l.id)),map=new Map(out.layers.map(l=>[l.id,prefix+l.id]));
      for(const l of out.layers){l.id=map.get(l.id);l.parentId=map.get(l.parentId)||null;remapGroup(l,map);l.assetId=prefix+l.assetId;if(l.views)l.views=Object.fromEntries(Object.entries(l.views).map(([k,v])=>[k,prefix+v]));l.locked=false;l.anchors.forEach(a=>a.pinned=false);}
      const roots=out.layers.filter(l=>!l.parentId),pivot=point(worldMatrix(out,roots[0]),roots[0].pivot);
      for(const l of roots){l.x+=at[0]-pivot[0];l.y+=at[1]-pivot[1];}
      p().layers.push(...out.layers);for(const b of out.bones||[])p().bones.push({...b,from:[map.get(b.from[0]),b.from[1]],to:[map.get(b.to[0]),b.to[1]]});
      selected=new Set(out.layers.map(l=>l.id));api.select(out.layers[0].id);
    },'Editable components imported with anchors and separate layers.');
  }
  const menuEl=$('partMenu');
  function closeMenu(){menuEl.hidden=true;}
  function finishConnection(target){const current=connection;edit(()=>attachAnchors(p(),current.from,target,current.attach),current.attach?'Anchors snapped together and parts attached.':'Anchors connected with a skeleton line.');connection=null;api.render();}
  function menu(e,at=null,anchor=null,empty=false,donor=null) {
    document.querySelectorAll('.menu-popover[open]').forEach(d=>d.open=false);const other=document.getElementById('workspaceContext');if(other)other.hidden=true;menuEl.replaceChildren();menuEl.hidden=false;
    const add=(label,fn)=>{const b=button(label,()=>{closeMenu();return fn();});b.setAttribute('role','menuitem');menuEl.append(b);};
    const chosen=p().layers.filter(l=>ids().includes(l.id)),current=p().layers.find(l=>l.id===state().layerId),locked=p().layers.some(l=>descendants(p(),ids()).has(l.id)&&l.locked);
    const title=document.createElement('div');title.className='menu-heading';title.textContent=donor?'Source: '+donor:empty?'Canvas':anchor?'Anchor':chosen.length>1?chosen.length+' components':current?.name||'Component';menuEl.append(title);
    if(donor){add('Add this component to the canvas',()=>$('addSourceComponent').click());}else if(empty){
      add('Add component…',()=>$('addComponent').click());add('Fit canvas',()=>$('fitView').click());
      add($('anchors').checked?'Hide anchors':'Show anchors',()=>$('anchors').click());
      add($('grid').checked?'Hide grid':'Show grid',()=>$('grid').click());
    }else{
      if(!locked){
        add('Move selected',()=>{$('autoPick').checked=false;$('tool').value='move';api.draw();});
        add('Rotate around pivot',()=>{$('autoPick').checked=false;$('tool').value='rotate';api.draw();});
      }
      add('Inspect component',()=>{document.body.classList.remove('hide-inspector');document.getElementById('inspector-tab-1')?.click();});
      add('Duplicate selected component',()=>$('copyComponent').click());
      if(!locked){
        add('Delete selected components',deleteSelected);
        if(chosen.length>1)add('Group selected components',group);
        if(chosen.some(l=>l.role==='group'||p().layers.some(parent=>parent.id===l.parentId&&parent.role==='group')))add('Ungroup selected component',ungroup);
        if(chosen.some(l=>l.parentId))add('Detach selected from parents',detach);
        add('Bring selected to front',()=>edit(()=>{const list=p().layers,chosen=ids();p().layers=[...list.filter(l=>!chosen.includes(l.id)),...list.filter(l=>chosen.includes(l.id))];}));
      }
      add(locked?'Unlock selected + children':'Lock selected + children',()=>lockSelection(!locked));
      if(at&&!locked&&!anchor)add('Add anchor here',()=>edit(()=>{const l=p().layers.find(l=>l.id===state().layerId),q=point(inverse(worldMatrix(p(),l)),at),id=uid('joint');l.anchors.push({id,name:'Joint '+(l.anchors.length+1),x:q[0],y:q[1],kind:'joint',pinned:false});api.select(l.id,id);$('anchors').checked=true;}));
      const from=anchor||(state().anchorId?[state().layerId,state().anchorId]:null);
      if(from){
        if(connection)add('Finish connection here',()=>finishConnection(from));
        if(!locked)for(const attach of [false,true])add(attach?'Snap this anchor to another…':'Connect this anchor to another…',()=>{api.requirePoseMode();connection={from,attach};$('anchors').checked=true;$('skeleton').checked=true;api.draw();api.msg('Click the target anchor. '+(attach?'Source part will move and attach to it.':'Adds a skeleton line without moving artwork.')+' Escape cancels.');});
        add('Inspect anchor',()=>{document.body.classList.remove('hide-inspector');document.getElementById('inspector-tab-2')?.click();});
      }
      add('Save selected components (editable)',()=>exportParts(true));add('Save selected components (PNG)',()=>exportParts());
    }
    if(connection)add('Cancel anchor connection',()=>{connection=null;api.msg('Connection cancelled.');});
    const rect=e.currentTarget?.getBoundingClientRect(),x=e.clientX||rect?.left||8,y=e.clientY||rect?.bottom||8;
    menuEl.style.left=Math.max(4,Math.min(x,innerWidth-menuEl.offsetWidth-8))+'px';menuEl.style.top=Math.max(4,Math.min(y,innerHeight-menuEl.offsetHeight-8))+'px';
    menuEl.querySelector('button')?.focus({preventScroll:true});
  }
  document.addEventListener('pointerdown',e=>{if(!menuEl.contains(e.target))closeMenu();});
  document.addEventListener('pointerup',e=>finishPointerDrag?.(e),true);
  document.addEventListener('mouseup',e=>finishPointerDrag?.(e),true);
  menuEl.addEventListener('keydown',e=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;e.preventDefault();const buttons=[...menuEl.querySelectorAll('button')],i=buttons.indexOf(document.activeElement),n=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[n]?.focus();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();connection=null;preview=null;api.draw();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();e.stopImmediatePropagation();$('save').click();}},true);
  $('groupParts').onclick=run(group);$('ungroupParts').onclick=run(ungroup);
  $('groupComponents').onclick=run(group);$('ungroupComponents').onclick=run(ungroup);
  $('addComponent').onclick=()=>api.chooseFile('.json,image/png,image/webp,image/jpeg',f=>f.name.toLowerCase().endsWith('.json')?importParts(f,[256,256]):api.addArtwork(f));
  $('componentSource').onchange=()=>{componentSource=$('componentSource').value;sourcePartId='';api.render();};
  $('addSourceComponent').onclick=run(()=>{const donor=sourcePose(),id=componentSource==='current'?state().layerId:sourcePartId,part=donor.layers.find(l=>l.id===id);if(!part)throw Error('Select a source component first.');place(sourceDrag(part),[256,256]);});
  $('copyComponent').onclick=run(()=>place({type:'component',ids:ids(),poseId:p().id,rootId:state().layerId},[256,256]));
  $('deleteComponent').onclick=run(deleteSelected);
  $('partActions').onclick=e=>menu(e);
  $('saveComponents').onclick=run(()=>exportParts(true));$('saveComponentPNG').onclick=run(()=>exportParts());
  $('importComponents').onclick=()=>api.chooseFile('.json',f=>importParts(f,[256,256]));
  $('dragOut').ondragstart=run(e=>{
    const data=portableParts(),url='data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(data));
    e.dataTransfer.setData('DownloadURL','application/json:selected.component.json:'+url);
    e.dataTransfer.setData('text/uri-list',url);e.dataTransfer.effectAllowed='copy';
    beginDrag(e,{type:'component',ids:ids(),poseId:p().id,rootId:state().layerId},$('dragOutImage'));
    api.msg('Drag to a supporting browser or desktop. If files cannot be dropped there, use Save components.');
  });$('dragOut').ondragend=endDrag;
  $('quickSave').onclick=()=>$('save').click();$('quickSprite').onclick=()=>$('exportSprite').click();
  return {renderLayers,drawPreview,downloadReceipt(url,name){
    if(lastDownload){const previous=lastDownload;setTimeout(()=>URL.revokeObjectURL(previous),30000);}lastDownload=url;
    $('saveReceipt').textContent='Download started: '+name+'. Check Downloads or your chosen folder.';
    $('downloadAgain').href=url;$('downloadAgain').download=name;$('downloadAgain').hidden=false;
  }};
}
