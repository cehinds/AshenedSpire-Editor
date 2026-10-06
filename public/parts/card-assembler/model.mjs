import { ASSETS, RECIPES } from './catalog.mjs';
import { clone } from '../footer-atelier/model.mjs';
// Share the existing Atelier manipulation model, including group and lock rules.
export { clone, clamp, bounds, selectedIds, move, snap, resize, attach } from '../footer-atelier/model.mjs';
export { ASSETS } from './catalog.mjs';

const assets = new Map(ASSETS.map(asset => [asset.id, asset]));
const fonts = new Set(['Georgia', 'serif', 'sans-serif', 'Arial', 'Verdana', 'Times New Roman']);
const fits = new Set(['stretch', 'contain', 'cover']);
const color = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
const label = (value, fallback, length = 160) => typeof value === 'string' ? value.slice(0, length) : fallback;

// Limits count encoded base64 ASCII bytes, excluding the data URL prefix.
export const MAX_CUSTOM_IMAGE_BYTES = 12*1024*1024;
export const MAX_CUSTOM_TOTAL_BYTES = 40*1024*1024;
export const MAX_CUSTOM_ASSETS = 30;
function validateCustomAssets(raw) {
  if (!Array.isArray(raw) || raw.length > MAX_CUSTOM_ASSETS) throw Error('A card can contain up to 30 imported images.');
  const ids = new Set(); let total = 0;
  return raw.map(asset=>{
    if (!asset || typeof asset.id !== 'string' || !/^custom\.[\w.-]{1,113}$/.test(asset.id) || ids.has(asset.id) || assets.has(asset.id)) throw Error('Each imported image needs a unique custom.* ID.');
    ids.add(asset.id);
    if (![asset.width,asset.height].every(n=>Number.isInteger(n)&&n>=1&&n<=4096)) throw Error('Imported image dimensions must be whole pixels from 1 to 4096.');
    if (typeof asset.src !== 'string') throw Error('Imported images must contain raster image data.');
    const prefix = /^data:image\/(png|jpeg|webp);base64,/.exec(asset.src);
    if (!prefix) throw Error('Imported images must be embedded PNG, JPEG, or WebP data URLs.');
    const encoded = asset.src.slice(prefix[0].length);
    total += encoded.length;
    if (encoded.length > MAX_CUSTOM_IMAGE_BYTES || total > MAX_CUSTOM_TOTAL_BYTES) throw Error('Imported image data exceeds the 12 MB per image or 40 MB total encoded limit.');
    const padding = encoded.indexOf('=');
    if (!encoded.length || encoded.length%4 || /[^A-Za-z0-9+/=]/.test(encoded) || (padding !== -1 && !['=','=='].includes(encoded.slice(padding)))) throw Error('Imported image base64 data is malformed.');
    const header = atob(encoded.slice(0,Math.min(64,encoded.length)));
    const bytes = [...header].map(char=>char.charCodeAt(0));
    const type = prefix[1];
    const png = bytes.slice(0,8).join(',') === '137,80,78,71,13,10,26,10';
    const jpeg = bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
    const webp = header.slice(0,4)==='RIFF' && header.slice(8,12)==='WEBP';
    if (!(type==='png'?png:type==='jpeg'?jpeg:webp)) throw Error('Imported image header does not match its raster type.');
    if (type==='png') {
      const uint32 = offset=>bytes[offset]*16777216+bytes[offset+1]*65536+bytes[offset+2]*256+bytes[offset+3];
      if (header.length<24 || header.slice(12,16)!=='IHDR' || uint32(16)!==asset.width || uint32(20)!==asset.height) throw Error('PNG dimensions do not match the imported image metadata.');
    }
    return {id:asset.id,name:label(asset.name,'Imported image'),width:asset.width,height:asset.height,src:asset.src};
  });
}

export function validate(raw) {
  if (!raw || raw.schema !== 'ashenspire.card-assembler' || raw.version !== 1) throw Error('Choose a Card Assembler version 1 layout.');
  if (!Number.isFinite(raw.width) || !Number.isFinite(raw.height) || raw.width < 100 || raw.height < 100 || raw.width > 4096 || raw.height > 4096) throw Error('Canvas dimensions must be between 100 and 4096 pixels.');
  if (!Array.isArray(raw.items) || raw.items.length > 200) throw Error('A card can contain up to 200 layers.');
  if (raw.clipShape !== undefined && raw.clipShape !== 'card') throw Error('Unknown card clipping shape.');
  const customAssets = raw.customAssets === undefined ? undefined : validateCustomAssets(raw.customAssets);
  const available = new Map([...assets,...(customAssets || []).map(asset=>[asset.id,asset])]);
  const ids = new Set();
  const items = raw.items.map(n => {
    if (!n || typeof n.id !== 'string' || !/^[\w.-]{1,120}$/.test(n.id) || ids.has(n.id)) throw Error('Each layer needs a unique, safe ID.');
    ids.add(n.id);
    if (n.asset !== 'text' && !available.has(n.asset)) throw Error('Unknown component asset.');
    for (const key of ['x', 'y', 'w', 'h', 'opacity']) if (!Number.isFinite(n[key])) throw Error('Layer geometry must use finite numbers.');
    if (Math.abs(n.x) > 8192 || Math.abs(n.y) > 8192 || n.w < 4 || n.h < 4 || n.w > 4096 || n.h > 4096 || n.opacity < 0 || n.opacity > 1) throw Error('Layer geometry is out of range.');
    if (n.fit !== undefined && !fits.has(n.fit)) throw Error('Choose stretch, contain, or cover.');
    const item = { id:n.id, asset:n.asset, name:label(n.name, n.asset === 'text' ? 'Editable text' : available.get(n.asset).name), role:label(n.role, '', 100), x:n.x, y:n.y, w:n.w, h:n.h, visible:n.visible !== false, locked:!!n.locked, opacity:n.opacity, fit:n.fit || 'stretch', group:label(n.group, '', 100) };
    for (const key of ['cropX','cropY']) {
      if (n[key] === undefined) continue;
      if (n.asset === 'text' || !Number.isFinite(n[key]) || n[key]<0 || n[key]>1) throw Error('Image crop positions must be numbers between 0 and 1.');
      item[key] = n[key];
    }
    if (n.sourceRect !== undefined) {
      const rect = n.sourceRect, asset = available.get(n.asset);
      if (n.asset==='text' || !Array.isArray(rect) || rect.length!==4 || !rect.every(Number.isFinite) || rect[0]<0 || rect[1]<0 || rect[2]<=0 || rect[3]<=0 || rect[0]+rect[2]>asset.width || rect[1]+rect[3]>asset.height) throw Error('Source rectangle must fit inside its image dimensions.');
      item.sourceRect = [...rect];
    }
    if (n.clipToCard !== undefined) {
      if (n.asset==='text' || typeof n.clipToCard!=='boolean') throw Error('Card clipping must be a boolean on an image layer.');
      item.clipToCard = n.clipToCard;
    }
    for (const key of ['tintColor','trimColor','tintAmount','trimAmount']) {
      if (n[key] === undefined) continue;
      if (n.asset === 'text') throw Error('Component tint and trim apply only to image layers.');
      if (key.endsWith('Color') ? !color(n[key]) : !Number.isFinite(n[key]) || n[key] < 0 || n[key] > 1) throw Error('Component colors must be hexadecimal colors and strengths between 0 and 1.');
      item[key] = n[key];
    }
    if (n.asset === 'text') {
      if (typeof n.text !== 'string' || n.text.length > 2000 || !Number.isFinite(n.fontSize) || n.fontSize < 6 || n.fontSize > 200 || !color(n.color)) throw Error('Invalid text content, size, or color.');
      if (n.fontFamily !== undefined && !fonts.has(n.fontFamily)) throw Error('Choose a supported font family.');
      if (n.align !== undefined && !['start','middle','end'].includes(n.align)) throw Error('Choose start, middle, or end alignment.');
      if (n.fontWeight !== undefined && !['normal','bold'].includes(n.fontWeight)) throw Error('Choose normal or bold text weight.');
      if (n.stroke !== undefined && !color(n.stroke)) throw Error('Text stroke must be a hexadecimal color.');
      if (n.strokeWidth !== undefined && (!Number.isFinite(n.strokeWidth) || n.strokeWidth < 0 || n.strokeWidth > 20)) throw Error('Text stroke width must be between 0 and 20.');
      Object.assign(item, {text:n.text, fontSize:n.fontSize, color:n.color, fontFamily:n.fontFamily || 'Georgia', align:n.align || 'middle', italic:!!n.italic, fontWeight:n.fontWeight || 'normal', stroke:n.stroke || '#000000', strokeWidth:n.strokeWidth ?? 0});
    }
    return item;
  });
  return { schema:'ashenspire.card-assembler', version:1, width:raw.width, height:raw.height, name:label(raw.name, 'Untitled card'), presetId:label(raw.presetId, '', 120), items, ...(customAssets === undefined ? {} : {customAssets}), ...(raw.clipShape === undefined ? {} : {clipShape:raw.clipShape}) };
}

export function fromRecipe(input) {
  if (input?.schema === 'ashenspire.card-assembler') return validate(input);
  if (!input || !Array.isArray(input.layers) || input.layers.length > 200) throw Error('Choose a card layout or a layer-kit recipe.');
  if (input.schemaVersion !== undefined && input.schemaVersion !== 1) throw Error('Unsupported recipe version.');
  const width = input.canvas?.width ?? 1024, height = input.canvas?.height ?? 1536;
  if (width !== 1024 || height !== 1536) throw Error('Layer-kit recipes use a 1024 × 1536 canvas.');
  const layers = input.layers.map((layer, index) => {
    if (!layer || !Number.isFinite(layer.z)) throw Error('Each recipe layer needs a finite stacking order.');
    if (layer.type !== undefined && layer.type !== 'text') throw Error('Unknown recipe layer type.');
    return {layer,index};
  }).sort((a,b) => a.layer.z - b.layer.z || a.index - b.index);
  return validate({schema:'ashenspire.card-assembler',version:1,width,height,name:input.name,presetId:input.presetId || input.id,...(input.customAssets === undefined ? {} : {customAssets:input.customAssets}),...(input.clipShape === undefined ? {} : {clipShape:input.clipShape}),items:layers.map(({layer:n}) => ({...n, asset:n.type === 'text' ? 'text' : n.assetId, w:n.width, h:n.height, name:n.name || n.role, group:n.group || '', locked:n.locked || false}))});
}

export function toRecipe(raw) {
  const doc = validate(raw);
  if (doc.width !== 1024 || doc.height !== 1536) throw Error('Layer-kit recipe export requires a 1024 × 1536 canvas.');
  return {schemaVersion:1,name:doc.name,presetId:doc.presetId,canvas:{width:doc.width,height:doc.height},...(doc.customAssets === undefined ? {} : {customAssets:doc.customAssets}),...(doc.clipShape === undefined ? {} : {clipShape:doc.clipShape}),layers:doc.items.map((n,z) => {
    const {asset,w,h, ...rest} = n;
    return {...rest,...(asset === 'text' ? {type:'text'} : {assetId:asset}),width:w,height:h,z};
  })};
}

export const PRESETS = RECIPES.map(recipe => ({id:recipe.id,name:recipe.name,doc:fromRecipe(recipe)}));
export function preset(id = PRESETS[0].id) {
  const found = PRESETS.find(entry => entry.id === id);
  if (!found) throw Error('Unknown card preset.');
  return clone(found.doc);
}
