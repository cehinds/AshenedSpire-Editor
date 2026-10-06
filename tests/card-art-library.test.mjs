import test from 'node:test';
import assert from 'node:assert/strict';
import {libraryManifestUrl,validateArtLibrary,filterArtLibrary,fetchCardArtwork,loadArtCatalogs,libraryResourceUrl} from '../public/parts/card-assembler/card-art-library.mjs';

const url='https://example.test/editor/test/7/parts/card-assembler/card-art-library/catalog.json';
const card={id:'gorefire-slash',name:'Gorefire Slash',class:'Reaver',src:'art/gorefire.webp',width:1024,height:1536};
const catalog=(cards=[card])=>({version:1,cards});

test('manifest resolves from both development sources and nested portable delivery',()=>{
 assert.equal(libraryManifestUrl('https://example.test/editor/test/7/parts/card-assembler/index.html'),url);
 assert.equal(libraryManifestUrl('https://example.test/editor/test/7/card-assembler.html'),url);
});

test('library preserves canonical card IDs and validates paths without fetching artwork',()=>{
 const cards=validateArtLibrary(catalog(),url);
 assert.equal(cards[0].id,card.id);assert.equal(cards[0].src,new URL(card.src,url).href);
 for(const src of ['../outside.webp','art/../../outside.webp','/outside.webp','https://other.test/a.webp','data:image/png;base64,YQ==','a.svg','a.webp?secret=true'])assert.throws(()=>validateArtLibrary(catalog([{...card,src}]),url));
 assert.throws(()=>validateArtLibrary(catalog([card,card]),url),/duplicate/);
 assert.throws(()=>validateArtLibrary(catalog([{...card,width:0}]),url),/dimensions/);
 assert.throws(()=>validateArtLibrary({version:2,cards:[]},url));
});

test('filter combines card title or ID words with class while keeping distinct same-name cards',()=>{
 const cards=validateArtLibrary(catalog([card,{...card,id:'reaver-gorefire-upgrade'},{...card,id:'herald-gorefire',class:'Herald'}]),url);
 assert.equal(filterArtLibrary(cards,'GORE fire').length,3);
 assert.deepEqual(filterArtLibrary(cards,'missing'),[]);
 assert.equal(filterArtLibrary(cards,'gorefire','Reaver').length,2);
 assert.equal(filterArtLibrary(cards,'upgrade','Reaver')[0].id,'reaver-gorefire-upgrade');
 assert.equal(filterArtLibrary(cards,'','Herald').length,1);
});

test('chosen artwork fetches only that card and becomes a file for the existing import validator',async t=>{
 const calls=[];t.mock.method(globalThis,'fetch',async src=>{calls.push(src);return new Response(new Uint8Array([1,2,3]),{status:200});});
 const [item]=validateArtLibrary(catalog(),url),file=await fetchCardArtwork(item);
 assert.deepEqual(calls,[item.src]);assert.equal(file.type,'image/webp');assert.equal(file.name,'Gorefire Slash.webp');assert.equal(file.size,3);
});

test('missing and oversize artwork fail before the design import',async t=>{
 const [item]=validateArtLibrary(catalog(),url);
 const mock=t.mock.method(globalThis,'fetch',async()=>new Response('',{status:404}));
 await assert.rejects(fetchCardArtwork(item),/could not be loaded/);
 mock.mock.mockImplementation(async()=>new Response('',{headers:{'content-length':String(10*1024*1024)}}));
 await assert.rejects(fetchCardArtwork(item),/9 MB/);
});


test('optional variants are lazy catalog choices and never count toward canonical coverage',async t=>{
 const calls=[];
 t.mock.method(globalThis,'fetch',async src=>{
  calls.push(src);
  return Response.json(src.endsWith('/variants.json')?catalog([{...card,id:'variant:frost-aegis',name:'Frost Aegis',class:'Variants',src:'variants/frost.webp'}]):{...catalog(),totalSubjects:236});
 });
 const loaded=await loadArtCatalogs(url);
 assert.equal(loaded.cards.length,2);assert.equal(loaded.canonicalCount,1);assert.equal(loaded.variantCount,1);assert.equal(loaded.total,236);
 assert.deepEqual(calls,[url,new URL('variants.json',url).href]);
 assert.equal(loaded.cards[1].src,new URL('variants/frost.webp',url).href);
});

test('missing or invalid optional variants leave the canonical library usable',async t=>{
 let variantResponse=new Response('',{status:404});
 t.mock.method(globalThis,'fetch',async src=>src.endsWith('/variants.json')?variantResponse:Response.json(catalog()));
 let loaded=await loadArtCatalogs(url);assert.equal(loaded.cards.length,1);assert.equal(loaded.warning,'');
 variantResponse=Response.json(catalog());
 loaded=await loadArtCatalogs(url);assert.equal(loaded.cards.length,1);assert.match(loaded.warning,/variant:/);
 variantResponse=Response.json(catalog([{...card,id:'variant:bad',src:'../outside.webp'}]));
 loaded=await loadArtCatalogs(url);assert.equal(loaded.cards.length,1);assert.match(loaded.warning,/leaves its library/);
});


test('consolidated editor resolves each library resource lazily from the parent asset store',()=>{
 const calls=[],resolve=name=>{calls.push(name);return 'blob:embedded-choice';};
 assert.equal(libraryResourceUrl('https://card-assembler.local/parts/card-assembler/card-art-library/art/card-fire.webp',resolve),'blob:embedded-choice');
 assert.deepEqual(calls,['parts/card-assembler/card-art-library/art/card-fire.webp']);
 assert.equal(libraryResourceUrl(url,resolve),url);
 assert.throws(()=>libraryResourceUrl('https://card-assembler.local/parts/card-assembler/card-art-library/catalog.json',null),/unavailable/);
});
