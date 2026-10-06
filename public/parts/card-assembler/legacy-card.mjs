import {validate,MAX_CUSTOM_IMAGE_BYTES,MAX_CUSTOM_TOTAL_BYTES} from './model.mjs';
import {FULL_ART_HASHES,normalizeLegacyLayer} from './full-art.mjs';

export function isLegacyCard(input) {
 return !!input && input.schema === undefined && input.clipShape === 'card' && Array.isArray(input.layers) && typeof input.id === 'string' && Number.isFinite(input.width) && Number.isFinite(input.height);
}

// Embedded originals become catalog references when their bytes match. Unknown PNGs
// remain portable custom assets and must be decoded by the app before draft commit.
export async function fromLegacyCard(input) {
 if (!isLegacyCard(input) || input.width < 100 || input.height < 100 || input.width > 4096 || input.height > 4096 || input.layers.length > 200) throw Error('Choose an original layered card document with a card-shaped canvas.');
 const items=[],customAssets=[],ids=new Set(),customIds=new Set();let total=0;
 for(const n of input.layers) {
  if(!n || typeof n.id!=='string' || !/^[\w.-]{1,100}$/.test(n.id) || ids.has(n.id) || !['image','text'].includes(n.type))throw Error('Legacy layers need unique IDs and image or text types.');
  ids.add(n.id);
  if(n.rotation!==undefined && n.rotation!==0)throw Error('Rotate legacy layers to zero before importing this card.');
  if(n.artScale!==undefined && n.artScale!==100)throw Error('Legacy art scale must be 100; use the artwork layer dimensions to scale it.');
  let asset;
  if(n.type==='image') {
   if(typeof n.src!=='string' || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(n.src))throw Error('Legacy images must contain embedded PNG data.');
   const encoded=n.src.slice('data:image/png;base64,'.length);total+=encoded.length;
   if(encoded.length%4 || encoded.length>MAX_CUSTOM_IMAGE_BYTES || total>MAX_CUSTOM_TOTAL_BYTES)throw Error('Legacy card image data exceeds the supported size.');
   const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
   if(bytes.length<24 || bytes.slice(0,8).join(',')!=='137,80,78,71,13,10,26,10')throw Error('Invalid legacy PNG header.');
   const view=new DataView(bytes.buffer),width=view.getUint32(16),height=view.getUint32(20);
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
   asset=FULL_ART_HASHES[digest]||'custom.legacy-'+digest;
   if(!FULL_ART_HASHES[digest]&&!customIds.has(asset)){customIds.add(asset);customAssets.push({id:asset,name:n.name||n.id,width,height,src:n.src});}
  }
  items.push(normalizeLegacyLayer(n,input.width,input.height,asset));
 }
 return validate({schema:'ashenspire.card-assembler',version:1,width:1024,height:1536,clipShape:'card',name:input.name||'Imported card',presetId:'legacy.'+input.id,items,...(customAssets.length?{customAssets}:{})});
}
