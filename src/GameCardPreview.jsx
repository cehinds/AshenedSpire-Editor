import {useMemo, useState} from 'react';
import {assignments} from './data.js';
import {cardsForTag, previewContentBundle} from './game-card-preview.mjs';
import {NativePreviewFrame} from './NativePreviewFrame.jsx';
import './game-card-preview.css';

function cardBoot(N, host, makeBundle) {
  const style = document.createElement('style');
  style.textContent = `body{background:#151612}#app{padding:24px;box-sizing:border-box;display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start;justify-content:center;align-content:flex-start}.editor-native-card{display:flex;flex-direction:column;align-items:center;gap:8px}.editor-native-card .card{position:relative;transform:none!important;width:280px!important;max-width:100%;height:auto;aspect-ratio:var(--card-ratio,5/7)}.editor-native-card figcaption{font:12px system-ui;color:#cbc6ba;max-width:280px}.editor-native-card .editor-art{width:100%;height:100%;position:absolute;inset:0}.editor-native-card .art{position:relative}.editor-native-card .ctags{z-index:1}`;
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
      const overrides = snapshot.draft.styles?.[id] || {};
      if (/^data:image\/(png|webp);base64,[A-Za-z0-9+/=]+$/.test(overrides.art || '')) {
        const artwork = document.createElement('img');
        artwork.className = 'editor-art';artwork.src = overrides.art;artwork.alt = `${definition.name} draft artwork`;
        artwork.style.objectFit = overrides.fit === 'contain' ? 'contain' : 'cover';
        const well = face.querySelector('.art');
        well?.querySelector('.card-art-glyph')?.remove();well?.prepend(artwork);
      }
      if (Number.isFinite(overrides.fontSize)) face.querySelector('.ctext')?.style.setProperty('font-size',`${Math.max(12,Math.min(24,overrides.fontSize))}px`);
      const caption = document.createElement('figcaption');
      caption.textContent = `${snapshot.offset + index + 1}. ${definition.name}${snapshot.upgraded && definition.upgrade ? ' · Upgraded' : ''}`;
      wrapper.append(face,caption);fragment.append(wrapper);faces.push(face);
    }
    host.replaceChildren(fragment);
    N.scheduleCardFits(faces);
  };
}

// Explicitly serialize the pure content adapter into the sandbox, with no
// editor closures or parent-window capabilities carried across the boundary.
const boot = `function(N,host,emit){return (${cardBoot.toString()})(N,host,${previewContentBundle.toString()});}`;
const noRuntimeAssets = () => false;

export function GameCardPreview({ctx: {p, ws, card, node}}) {
  const [upgraded,setUpgraded] = useState(false);
  const [page,setPage] = useState(0);
  const tagging = p.tagging ?? assignments;
  const ids = ws === 'decks' ? p.deck : ws === 'tags' ? cardsForTag(p.cards,p.nodes,tagging,node.id).map(row => row.id) : [card.id];
  const size = ws === 'cards' ? 1 : 6;
  const maxPage = Math.max(0,Math.ceil(ids.length/size)-1);
  const currentPage = Math.min(page,maxPage);
  const visibleIds = ids.slice(currentPage*size,(currentPage+1)*size);
  const snapshot = useMemo(() => ({draft:{cards:p.cards,nodes:p.nodes,styles:p.styles,owned:p.owned,tagging},ids:visibleIds,offset:currentPage*size,upgraded}), [p.cards,p.nodes,p.styles,p.owned,tagging,visibleIds.join('|'),currentPage,size,upgraded]);
  return <section className="game-card-preview">
    <div className="game-card-preview-toolbar">
      <strong>{ws === 'decks' ? 'Deck shelf' : ws === 'tags' ? `${node.label} · linked cards` : 'Card in game'}</strong>
      <label className="check"><input type="checkbox" checked={upgraded} onChange={event => setUpgraded(event.target.checked)}/>Upgraded</label>
      {maxPage > 0 ? <div className="button-row"><button disabled={!currentPage} onClick={() => setPage(currentPage-1)}>Previous</button><span>{currentPage+1} / {maxPage+1}</span><button disabled={currentPage===maxPage} onClick={() => setPage(currentPage+1)}>Next</button></div> : null}
    </div>
    {ids.length ? <NativePreviewFrame title="AshenSpire native card preview" boot={boot} snapshot={snapshot} height={ws==='cards'?470:650} assetFilter={noRuntimeAssets}/> : <div className="notice">{ws==='decks' ? 'Add cards to the deck to preview them here.' : 'No authored cards are linked to this tag or its descendants.'}</div>}
    <p className="game-card-preview-note">Native AshenSpire card renderer with your current draft. Card definitions, tag labels and presentation overrides update here after an edit is applied. Printed values come from the native token resolver; combat outcomes require the playable combat preview.</p>
  </section>;
}
