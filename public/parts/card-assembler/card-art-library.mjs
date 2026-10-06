// Optional library: only the manifest and visible thumbnails load while browsing.
// Selected artwork becomes an ordinary embedded image in the saved design.
function embeddedResolver(){try{return globalThis.parent?.__ASHENEDSPIRE_ASSET_URL__;}catch{return undefined;}}
const embeddedBase='https://card-assembler.local/';
export function libraryResourceUrl(url,resolver=embeddedResolver()) {
 if(url.startsWith(embeddedBase)){
  if(typeof resolver!=='function')throw Error('The embedded artwork library is unavailable.');
  return resolver(new URL(url).pathname.slice(1));
 }
 return url;
}
export function libraryManifestUrl(pageUrl) {
 const page=new URL(pageUrl);
 if(page.protocol==='blob:'&&embeddedResolver())return embeddedBase+'parts/card-assembler/card-art-library/catalog.json';
 const relative=/\/parts\/card-assembler\/index\.html$/.test(page.pathname)?'card-art-library/catalog.json':'parts/card-assembler/card-art-library/catalog.json';
 return new URL(relative,page).href;
}
export function validateArtLibrary(value,manifestUrl) {
 if(value?.version!==1||!Array.isArray(value.cards)||value.cards.length>10000)throw Error('Unsupported card artwork catalog.');
 const base=new URL('.',manifestUrl),ids=new Set();
 return value.cards.map(card=>{
  if(!card||typeof card.id!=='string'||!card.id.trim()||ids.has(card.id)||typeof card.name!=='string'||!card.name.trim())throw Error('Card artwork catalog has an invalid or duplicate card.');
  if(typeof card.src!=='string'||!card.src||card.src.startsWith('/')||/^[a-z][a-z\d+.-]*:/i.test(card.src))throw Error('Card artwork must use a relative library path.');
  const url=new URL(card.src,base);
  if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname)||url.search||url.hash||! /\.(webp|png|jpe?g)$/i.test(url.pathname))throw Error('Card artwork path leaves its library.');
  if(!Number.isInteger(card.width)||!Number.isInteger(card.height)||card.width<1||card.height<1||card.width>4096||card.height>4096)throw Error('Card artwork dimensions must be between 1 and 4096 pixels.');
  if(card.class!==undefined&&typeof card.class!=='string')throw Error('Card artwork class must be text.');
  ids.add(card.id);return{id:card.id,name:card.name,class:card.class||'Unassigned',src:url.href,width:card.width,height:card.height};
 });
}
export async function loadArtCatalogs(manifestUrl) {
 const variantsUrl=new URL('variants.json',manifestUrl).href;
 const [canonicalResult,variantResult]=await Promise.allSettled([
  fetch(libraryResourceUrl(manifestUrl),{signal:AbortSignal.timeout(10000)}),
  fetch(libraryResourceUrl(variantsUrl),{signal:AbortSignal.timeout(10000)})
 ]);
 if(canonicalResult.status!=='fulfilled'||!canonicalResult.value.ok)throw Error('The card artwork library is not available in this copy. Open the editor with its artwork folder, or import an image.');
 const value=await canonicalResult.value.json(),canonical=validateArtLibrary(value,manifestUrl);
 let variants=[],warning='';
 try {
  if(variantResult.status==='rejected')throw Error('Alternate artwork is temporarily unavailable.');
  const response=variantResult.value;
  if(response.ok){
   variants=validateArtLibrary(await response.json(),variantsUrl);
   const canonicalIds=new Set(canonical.map(card=>card.id));
   if(variants.some(card=>!card.id.startsWith('variant:')||canonicalIds.has(card.id)))throw Error('Alternate artwork IDs must be unique and start with variant:.');
  }else if(response.status!==404)throw Error('Alternate artwork is temporarily unavailable.');
 }catch(error){variants=[];warning=error.message;}
 return {cards:[...canonical,...variants],canonicalCount:canonical.length,variantCount:variants.length,total:Number.isInteger(value.totalSubjects)&&value.totalSubjects>=canonical.length?value.totalSubjects:canonical.length,warning};
}
export function filterArtLibrary(cards,query='',className='') {
 const words=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 return cards.filter(card=>(!className||card.class===className)&&words.every(word=>`${card.name} ${card.id} ${card.class}`.toLocaleLowerCase().includes(word)));
}
export async function fetchCardArtwork(card) {
 const response=await fetch(libraryResourceUrl(card.src),{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('This artwork could not be loaded. Try again.');
 if(Number(response.headers.get('content-length'))>9*1024*1024)throw Error('Artwork exceeds the 9 MB import limit.');
 const blob=await response.blob();if(blob.size>9*1024*1024)throw Error('Artwork exceeds the 9 MB import limit.');
 const extension=new URL(card.src).pathname.split('.').at(-1).toLowerCase(),type=extension==='webp'?'image/webp':extension==='png'?'image/png':'image/jpeg';
 return new File([blob],`${card.name}.${extension}`,{type});
}
export function mountCardArtLibrary({panel,search,classSelect,results,message,retry,onUse,pageUrl=location.href}) {
 let cards=null,total=0,canonicalCount=0,variantCount=0,warning='',loading=false,busy=false;
 function render(){
  if(!cards)return;const matches=filterArtLibrary(cards,search.value,classSelect.value);results.replaceChildren();
  message.textContent=`${matches.length} shown · ${canonicalCount} of ${total} card artworks available${variantCount?` + ${variantCount} alternates`:""}. Select an artwork layer to replace it, or add a new layer.${warning?` ${warning}`:""}`;
  for(const card of matches){
   const button=document.createElement('button');button.className='card-art-choice';button.disabled=busy;button.title=`${card.name} · ${card.class} · ${card.id}`;button.setAttribute('aria-label',`Use card artwork: ${card.name}`);
   const img=document.createElement('img');img.loading='lazy';img.decoding='async';img.src=libraryResourceUrl(card.src);img.alt='';img.width=card.width;img.height=card.height;
   img.addEventListener('error',()=>{img.hidden=true;button.classList.add('image-unavailable');button.title+=' · Preview unavailable';},{once:true});
   const label=document.createElement('span');label.textContent=card.name;const detail=document.createElement('small');detail.textContent=card.class;
   button.append(img,label,detail);button.addEventListener('click',async()=>{
    if(busy)return;busy=true;results.querySelectorAll('button').forEach(b=>b.disabled=true);message.textContent=`Loading ${card.name}…`;
    try{await onUse(card);message.textContent=`${card.name} added. Use Crop / trim to compose the artwork.`;}catch(error){message.textContent=error.message;}
    finally{busy=false;results.querySelectorAll('button').forEach(b=>b.disabled=false);}
   });results.append(button);
  }
 }
 async function load(){
  if(loading||cards)return;loading=true;retry.hidden=true;message.textContent='Loading card artwork catalog…';
  try{const loaded=await loadArtCatalogs(libraryManifestUrl(pageUrl));({cards,total,canonicalCount,variantCount,warning}=loaded);for(const name of [...new Set(cards.map(c=>c.class))].sort()){const option=document.createElement('option');option.value=name;option.textContent=name;classSelect.append(option);}render();}
  catch(error){message.textContent=error instanceof SyntaxError?'The card artwork library is not available in this copy. You can still import an image.':error.message;retry.hidden=false;}
  finally{loading=false;}
 }
 panel.addEventListener('toggle',()=>{if(panel.open)void load();});search.addEventListener('input',render);classSelect.addEventListener('change',render);retry.addEventListener('click',load);
 if(panel.open)void load();
}
