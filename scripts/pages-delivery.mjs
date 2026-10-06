import { cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

export const HOSTED_HTML_THRESHOLD = 90 * 1024 * 1024;
export const HOSTED_CHUNK_BYTES = 40 * 1024 * 1024;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

// This exact function is also serialized into the hosted loader: tests exercise
// the browser's verification and decompression implementation, not a substitute.
export async function decodeHostedHtml(manifest, fetchChunk, progress = () => {}) {
  if (manifest?.version !== 1 || manifest.encoding !== 'gzip' || !Number.isSafeInteger(manifest.originalBytes) || manifest.originalBytes < 1 || !/^[a-f0-9]{64}$/.test(manifest.originalSha256) || !Array.isArray(manifest.chunks) || !manifest.chunks.length) throw Error('Invalid editor delivery manifest.');
  const hash = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
  const names = new Set();
  for (const chunk of manifest.chunks) {
    if (!/^editor-part-\d{4,}\.bin$/.test(chunk.file) || names.has(chunk.file) || !Number.isSafeInteger(chunk.bytes) || chunk.bytes < 1 || chunk.bytes > 40 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(chunk.sha256)) throw Error('Invalid editor delivery chunk.');
    names.add(chunk.file);
  }
  // Fetch, verify and decompress sequentially so the compressed archive is never
  // retained alongside the full editor. At most one compressed part is queued.
  let nextChunk = 0;
  const stream = new ReadableStream({async pull(controller) {
    if (nextChunk === manifest.chunks.length) { progress('Verifying the complete editor…'); controller.close(); return; }
    const i = nextChunk++, chunk = manifest.chunks[i];
    progress(`Loading editor artwork and tools (${i + 1}/${manifest.chunks.length})…`);
    const bytes = new Uint8Array(await fetchChunk(chunk.file));
    if (bytes.byteLength !== chunk.bytes || await hash(bytes) !== chunk.sha256) throw Error(`Editor download verification failed for part ${i + 1}. Please retry.`);
    controller.enqueue(bytes);
  }}, {highWaterMark:0});
  const reader = stream.pipeThrough(new DecompressionStream('gzip')).getReader();
  const original = new Uint8Array(manifest.originalBytes); let length = 0;
  try {
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      if (length + value.byteLength > manifest.originalBytes) throw Error('Editor decompressed size exceeds its manifest.');
      original.set(value, length);length += value.byteLength;
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  if (length !== manifest.originalBytes) throw Error('Editor decompressed size does not match its manifest.');
  if (await hash(original) !== manifest.originalSha256) throw Error('Editor content verification failed. Please retry.');
  return original;
}

function hostedLoader(manifest) {
  const data = JSON.stringify(manifest).replaceAll('<', '\\u003c');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Opening AshenedSpire Editor</title><style>body{margin:10vh auto;padding:0 1.5rem;max-width:42rem;background:#181b20;color:#e8dfca;font:17px/1.5 system-ui}button{font:inherit;padding:.65rem 1rem;margin:.3rem;border:1px solid #bda566;border-radius:.4rem;background:#272b30;color:#f1e7cf;cursor:pointer}button:disabled{opacity:.5}#error{color:#ffb7a8}small{color:#c4c7cd}</style></head><body><h1>AshenedSpire Editor</h1><p>This build includes the complete artwork library. Loading it may take a moment.</p><p id="status" role="status" aria-live="polite">Preparing verified download…</p><p id="error" role="alert" hidden></p><button id="download">Download single HTML instead</button><button id="open" hidden>Open editor</button><button id="retry" hidden>Retry</button><p><small>The download preserves the original single-file editor. No artwork is omitted or reduced.</small></p><noscript>JavaScript is needed to unpack this editor. Enable it and reload this page.</noscript><script>
const manifest=${data};
const decodeHostedHtml=${decodeHostedHtml.toString()};
const status=document.getElementById('status'),error=document.getElementById('error'),download=document.getElementById('download'),openButton=document.getElementById('open'),retry=document.getElementById('retry');
let intent='open',pending=null,original=null,downloadUrl=null;
async function load(){
 if(original)return original;
 if(pending)return pending;
 error.hidden=true;retry.hidden=true;
 pending=decodeHostedHtml(manifest,async file=>{const response=await fetch(new URL(file,location.href),{cache:'no-store',signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error('Editor part could not load (HTTP '+response.status+'). Please retry.');return response.arrayBuffer();},text=>status.textContent=text).then(bytes=>original=bytes).catch(reason=>{pending=null;throw reason;});
 return pending;
}
function failed(reason){status.textContent='The editor has not opened.';error.textContent=reason.message||'Could not load the editor. Please retry.';error.hidden=false;retry.hidden=false;download.disabled=false;openButton.disabled=false;}
async function openEditor(){intent='open';try{const bytes=await load();if(intent!=='open')return;const html=new TextDecoder('utf-8',{fatal:true}).decode(bytes);original=null;pending=null;if(downloadUrl){URL.revokeObjectURL(downloadUrl);downloadUrl=null;}document.open();document.write(html);document.close();}catch(reason){failed(reason);}}
download.onclick=async()=>{intent='download';download.disabled=true;try{const bytes=await load();downloadUrl??=URL.createObjectURL(new Blob([bytes],{type:'text/html;charset=utf-8'}));const link=document.createElement('a');link.href=downloadUrl;link.download='AshenedSpire-Editor.html';link.click();status.textContent='Verified single-file editor is ready. Open it here or save another copy.';openButton.hidden=false;download.disabled=false;}catch(reason){failed(reason);}};
openButton.onclick=openEditor;retry.onclick=()=>{intent==='download'?download.click():openEditor();};
openEditor();
</script></body></html>\n`;
}

export async function copyHostedBuild(buildDirectory, destination, {thresholdBytes = HOSTED_HTML_THRESHOLD, chunkBytes = HOSTED_CHUNK_BYTES} = {}) {
  if (!Number.isSafeInteger(thresholdBytes) || thresholdBytes < 1 || thresholdBytes > HOSTED_HTML_THRESHOLD || !Number.isSafeInteger(chunkBytes) || chunkBytes < 1 || chunkBytes > HOSTED_CHUNK_BYTES) throw Error('Invalid hosted delivery size limits.');
  const entry = path.join(buildDirectory, 'index.html');
  if ((await stat(entry)).size <= thresholdBytes) {
    await cp(buildDirectory, destination, {recursive:true, force:false, errorOnExist:true});
    return null;
  }
  await cp(buildDirectory, destination, {recursive:true, force:false, errorOnExist:true, filter:source=>source !== entry});
  await mkdir(destination, {recursive:true});
  const original = await readFile(entry), compressed = gzipSync(original, {level:9});
  const manifest = {version:1, encoding:'gzip', originalBytes:original.length, originalSha256:sha256(original), chunks:[]};
  for (let offset=0; offset<compressed.length; offset+=chunkBytes) {
    const bytes=compressed.subarray(offset,offset+chunkBytes),file=`editor-part-${String(manifest.chunks.length+1).padStart(4,'0')}.bin`;
    await writeFile(path.join(destination,file),bytes,{flag:'wx'});
    manifest.chunks.push({file,bytes:bytes.length,sha256:sha256(bytes)});
  }
  await writeFile(path.join(destination,'editor-delivery.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  await writeFile(path.join(destination,'index.html'),hostedLoader(manifest),{flag:'wx'});
  return {encoding:manifest.encoding,originalBytes:manifest.originalBytes,originalSha256:manifest.originalSha256,chunks:manifest.chunks.length};
}
