import {useEffect,useMemo,useRef,useState} from 'react';
import {loadImage} from './Controls.jsx';
import {assignments} from './data.js';
import {cardsForTag, previewContentBundle} from './game-card-preview.mjs';
import {NativePreviewFrame} from './NativePreviewFrame.jsx';
import './game-card-preview.css';
import {CardPreviewControls} from './CardPreviewControls.jsx';
import {CARD_LAYOUT_PARTS,applyCardLayout,normalizeCardLayout} from './card-layout.mjs';
import {applyCardPresentation} from './card-presentation.mjs';
import {installCardEditor} from './native-card-editor.mjs';

function cardBoot(N,host,makeBundle,applyLayout,applyPresentation,installEditor,partDefs,emit) {
  const editor=installEditor(host,emit,applyLayout,partDefs);
  let fitCards=()=>{};
  window.addEventListener('resize',()=>fitCards());
  const style = document.createElement('style');
  style.textContent = `body{background:#151612;margin:0}#app{padding:24px;box-sizing:border-box;display:flex;flex-direction:row;flex-wrap:wrap;gap:24px;align-items:flex-start;justify-content:center;align-content:safe center;min-height:100vh;height:auto;overflow:auto}.editor-native-card{display:flex;flex-direction:column;align-items:center;gap:8px}.editor-native-card .card{position:relative;transform:none!important;width:280px!important;max-width:100%;height:auto;aspect-ratio:var(--card-ratio,5/7)}.editor-native-card figcaption{font:12px system-ui;color:#cbc6ba;max-width:280px}.editor-native-card .editor-art{width:100%;height:100%;position:absolute;inset:0}.editor-native-card .art{position:relative}.editor-native-card .ctags{z-index:1}`;
  document.head.append(style);
  for (const [key,value] of Object.entries({...N.cardShapeCssProperties?.(),...N.cardLevelCssProperties?.()})) document.documentElement.style.setProperty(key,value);
  return snapshot => {
    const registries = N.createRegistries(makeBundle(N.contentBundle,snapshot.draft,snapshot.assignments));
    const fragment = document.createDocumentFragment();
    const faces = [];
    for (const [index,id] of snapshot.ids.entries()) {
      const wrapper = document.createElement('figure');
      wrapper.className = 'editor-native-card';
      wrapper.style.margin = '0';
      const definition = registries.cards.get(id);
      const face = N.renderCard(registries,{cardId:id,upgraded:snapshot.upgraded && !!definition.upgrade,instanceId:`editor-${index}-${id}`},{inspection:false,level:'inspect',owned:snapshot.draft.owned?.[id]});
      face.setAttribute('aria-label',definition.name);
      const caption = document.createElement('figcaption');
      caption.textContent = snapshot.ids.length===1 ? `${snapshot.upgraded&&definition.upgrade?'Upgraded':'Base'} definition` : `${snapshot.offset + index + 1}. ${definition.name}${snapshot.upgraded && definition.upgrade ? ' · Upgraded' : ''}`;
      wrapper.append(face,caption);fragment.append(wrapper);faces.push(face);
    }
    host.replaceChildren(fragment);
    for(const face of faces)applyPresentation(face,snapshot.draft.styles?.[face.dataset.cardId]||{},applyLayout);
    N.scheduleCardFits(faces);
    fitCards=()=>{for(const face of faces){
      const fit=snapshot.ids.length===1?Math.min(2.5,(window.innerWidth-48)/280,(window.innerHeight-76)/face.offsetHeight):1;
      face.parentElement.style.zoom=String(Math.max(.001,fit)*(snapshot.zoom||100)/100);
    }};
    fitCards();
    editor.update(snapshot,faces);
  };
}

// Explicitly serialize the pure content adapter into the sandbox, with no
// editor closures or parent-window capabilities carried across the boundary.
const boot = `function(N,host,emit){return (${cardBoot.toString()})(N,host,${previewContentBundle.toString()},${applyCardLayout.toString()},${applyCardPresentation.toString()},${installCardEditor.toString()},${JSON.stringify(CARD_LAYOUT_PARTS)},emit);}`;
const noRuntimeAssets = () => false;

export function GameCardPreview({ctx,editable=false}) {
  const {p,ws,card,node,cardZoom,cardUpgraded}=ctx;
  const upgraded=cardUpgraded;
  const [page,setPage] = useState(0);
  const latest=useRef({ctx,editable}),mounted=useRef(true);latest.current={ctx,editable};
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  async function dropArtwork(status){
    const targetCard=status.cardId,targetPart=status.partId;
    const before=JSON.stringify(latest.current.ctx.p.styles[targetCard]?.layout||{});
    try{
      if(!(status.file instanceof File))return;
      const art=await loadImage(status.file),current=latest.current;
      if(!mounted.current||!current.editable||current.ctx.card.id!==targetCard)return;
      current.ctx.update(next=>{
        if(JSON.stringify(next.styles[targetCard]?.layout||{})!==before)throw Error('Card layout changed during artwork import; drop the image again.');
        const layout=normalizeCardLayout(next.styles[targetCard]?.layout);
        layout.parts[targetPart].backgroundArt=art;
        layout.parts[targetPart].backgroundVisible=true;
        next.styles[targetCard]={...next.styles[targetCard],layout};
      },'Component background artwork imported');
    }catch(error){if(mounted.current)latest.current.ctx.tell(error.message);}
  }
  const tagging = p.tagging ?? assignments;
  const ids = ws === 'decks' ? p.deck : ws === 'tags' ? cardsForTag(p.cards,p.nodes,tagging,node.id).map(row => row.id) : [card.id];
  const size = ws === 'cards' ? 1 : 6;
  const maxPage = Math.max(0,Math.ceil(ids.length/size)-1);
  const currentPage = Math.min(page,maxPage);
  const visibleIds = ids.slice(currentPage*size,(currentPage+1)*size);
  const snapshot = useMemo(() => ({draft:{cards:p.cards,nodes:p.nodes,styles:p.styles,owned:p.owned,tagging},ids:visibleIds,offset:currentPage*size,upgraded,zoom:cardZoom,fitRevision:ctx.cardFitRevision,editable,layoutView:ctx.cardLayoutView,layoutSelection:ctx.cardLayoutSelection}), [p.cards,p.nodes,p.styles,p.owned,tagging,visibleIds.join('|'),currentPage,size,upgraded,cardZoom,ctx.cardFitRevision,editable,ctx.cardLayoutView,ctx.cardLayoutSelection]);
  const receive=status=>{
    if(status.type==='card-view-zoom'&&Number.isFinite(status.zoom)){ctx.setCardZoom(Math.max(50,Math.min(250,status.zoom)));return;}
    if(status.type==='card-parts-measured'&&status.cardId===ctx.card.id&&status.boxes&&Number.isFinite(status.cardWidth)&&Number.isFinite(status.cardHeight)){
      const boxes={};for(const part of CARD_LAYOUT_PARTS){const box=status.boxes[part.id];if(box&&['x','y','width','height'].every(key=>Number.isFinite(box[key])&&Math.abs(box[key])<=20000))boxes[part.id]=box;}
      const next={cardId:status.cardId,boxes,cardWidth:status.cardWidth,cardHeight:status.cardHeight};ctx.setCardLayoutBoxes(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);return;
    }
    if(!editable||status.cardId!==ctx.card.id)return;
    const known=id=>CARD_LAYOUT_PARTS.some(part=>part.id===id);
    if(status.type==='card-part-art-drop'&&known(status.partId)){dropArtwork(status);return;}
    if(status.type==='card-part-select'&&known(status.partId)){
      ctx.setCardLayoutSelection(old=>status.additive?(old.includes(status.partId)?old.filter(id=>id!==status.partId):[...old,status.partId]):[status.partId]);ctx.setInspectorMode('Layout');return;
    }
    if(status.type==='card-part-edit'&&known(status.partId)){ctx.chooseCardSection(status.partId==='type'?'identity':status.partId);return;}
    if(!['card-layout-translate','card-layout-rotate'].includes(status.type))return;
    const partIds=Array.isArray(status.partIds)?[...new Set(status.partIds)].filter(known):[];
    if(!partIds.length||partIds.length>7)return;
    const before=JSON.stringify(p.styles[card.id]?.layout||{});
    if(status.before!==before){ctx.tell('Card layout changed during this gesture; try again.');return;}
    if(status.type==='card-layout-translate'&&(!Number.isFinite(status.dx)||!Number.isFinite(status.dy)||Math.abs(status.dx)>8192||Math.abs(status.dy)>8192))return;
    if(status.type==='card-layout-rotate'&&(!Number.isFinite(status.rotation)||Math.abs(status.rotation)>360))return;
    ctx.update(next=>{
      if(JSON.stringify(next.styles[card.id]?.layout||{})!==before)throw Error('Card layout changed; try again.');
      const layout=normalizeCardLayout(next.styles[card.id]?.layout),anchor=layout.parts[partIds[0]],delta=status.rotation-anchor.rotation;
      for(const id of partIds){const part=layout.parts[id];if(status.type==='card-layout-translate'){part.x=Math.max(-4096,Math.min(4096,part.x+status.dx));part.y=Math.max(-4096,Math.min(4096,part.y+status.dy));}else part.rotation=((part.rotation+delta+540)%360)-180;}
      next.styles[card.id]={...next.styles[card.id],layout};
    },status.type==='card-layout-translate'?'Card components moved':'Card components rotated');
  };
  const toolbar = <>
      <strong className={ws==='cards'?'card-native-title':undefined}>{ws === 'decks' ? 'Deck shelf' : ws === 'tags' ? `${node.label} · linked cards` : 'Card in game'}</strong>
      <CardPreviewControls ctx={ctx} upgradeAvailable={ids.some(id=>p.cards.find(row=>row.id===id)?.upgrade)}/>
      {maxPage > 0 ? <div className="button-row"><button disabled={!currentPage} onClick={() => setPage(currentPage-1)}>Previous</button><span>{currentPage+1} / {maxPage+1}</span><button disabled={currentPage===maxPage} onClick={() => setPage(currentPage+1)}>Next</button></div> : null}
    </>;
  return <section className={'game-card-preview'+(editable?' native-card-authoring':'')}>
    {ids.length ? <NativePreviewFrame title="AshenSpire native card preview" boot={boot} snapshot={snapshot} onStatus={receive} height={ws==='cards'?470:650} assetFilter={noRuntimeAssets} toolbar={toolbar} compactControls/> : <><div className="game-card-preview-toolbar">{toolbar}</div><div className="notice">{ws==='decks' ? 'Add cards to the deck to preview them here.' : 'No authored cards are linked to this tag or its descendants.'}</div></>}
    <details className="game-card-preview-note"><summary>{editable?'Drag parts · double-click to edit · middle-drag to pan · Ctrl+wheel to zoom · ':''}Native AshenSpire renderer, current draft</summary><p>Card definitions, tag labels and presentation overrides update after an edit is applied. Printed values come from the native token resolver; combat outcomes require the playable combat preview.</p></details>
  </section>;
}
