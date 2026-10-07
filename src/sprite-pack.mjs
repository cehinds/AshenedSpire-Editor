import {unzipSync, strFromU8} from 'fflate';
import {validateProject} from '../public/sprite-workshop/core.mjs';

export const PACK_SCHEMA = 'ashenspire.sprite-project-pack.v1';
const MAX_BYTES = 512 * 1024 * 1024;
const text = value => typeof value === 'string' && value.length > 0 && value.length < 1000;
export function safePackPath(path) {
  if (!text(path) || path.startsWith('/') || path.includes('\\') || path.includes(':') || path.includes('%') || path.split('/').some(part => !part || part === '.' || part === '..')) throw Error('Unsafe pack path: ' + path);
  return path;
}
export function validatePack(value) {
  if (value?.schema !== PACK_SCHEMA || !/^[a-zA-Z0-9._-]{1,120}$/.test(value.id) || !text(value.title) || !Array.isArray(value.projects) || !value.projects.length || value.projects.length > 1000) throw Error('Expected a sprite project pack v1 with 1–1000 projects.');
  const ids = new Set();
  for (const project of value.projects) {
    if (!/^[a-zA-Z0-9._-]{1,120}$/.test(project.id) || ids.has(project.id) || !text(project.label) || !text(project.classId) || !text(project.armorId)) throw Error('Invalid or duplicate sprite project metadata.');
    ids.add(project.id); safePackPath(project.projectPath);
  }
  return value;
}
export function unpackSpritePack(bytes) {
  if (bytes.byteLength > MAX_BYTES) throw Error('Pack exceeds 512 MB.');
  let total = 0, count = 0;
  const files = unzipSync(bytes, {filter(entry) {
    if (entry.name.endsWith('/')) return false;
    safePackPath(entry.name);
    if (++count > 20000 || (total += entry.originalSize) > MAX_BYTES) throw Error('Expanded pack exceeds 512 MB or 20000 files.');
    return true;
  }});
  const manifestBytes = files['manifest.json'];
  if (!manifestBytes) throw Error('The ZIP must contain manifest.json at its root.');
  const manifest = validatePack(JSON.parse(strFromU8(manifestBytes)));
  for (const entry of manifest.projects) if (!files[entry.projectPath]) throw Error('Missing project: ' + entry.projectPath);
  return {manifest, read: async path => {const bytes = files[safePackPath(path)]; if (!bytes) throw Error('Missing pack file: ' + path); return bytes;}};
}
export async function hostedSpritePack(manifestUrl, fetcher = fetch) {
  const url = new URL(manifestUrl, globalThis.location?.href || 'http://localhost/');
  const read = async path => {
    const response = await fetcher(new URL(safePackPath(path), url));
    if (!response.ok) throw Error('Cannot load pack file: ' + path);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > MAX_BYTES) throw Error('Pack file exceeds 512 MB.');
    return bytes;
  };
  const response = await fetcher(url);
  if (!response.ok) throw Error('No bundled sprite pack is installed. Import a portable pack ZIP.');
  return {manifest:validatePack(await response.json()), read};
}
function base64(bytes) {
  let binary = '';
  for (let start = 0; start < bytes.length; start += 32768) binary += String.fromCharCode(...bytes.subarray(start, start + 32768));
  return btoa(binary);
}
export async function portablePackProject(pack, entry) {
  const project = JSON.parse(strFromU8(await pack.read(entry.projectPath)));
  validateProject(project);
  const directory = entry.projectPath.slice(0, entry.projectPath.lastIndexOf('/') + 1);
  const cache = new Map();
  for (const asset of Object.values(project.assets)) {
    if (asset.src.startsWith('data:image/')) continue;
    // Assets are relative to the project, with shared assets in a descendant folder.
    const path = safePackPath(directory + safePackPath(asset.src));
    if (!cache.has(path)) {
      const bytes = await pack.read(path), extension = path.split('.').at(-1).toLowerCase();
      if (!['png','webp','jpg','jpeg'].includes(extension)) throw Error('Unsupported pack image: ' + path);
      cache.set(path, `data:image/${extension === 'jpg' ? 'jpeg' : extension};base64,${base64(bytes)}`);
    }
    asset.src = cache.get(path);
  }
  validateProject(project);
  return project;
}
export function projectPoseRows(project) {
  return Object.values(project.poses).map(pose => ({id:pose.id, label:pose.name || pose.id, weaponType:pose.weaponType || pose.weapon || '', offhand:pose.offhandType || pose.offhand || '', reviewed:pose.reviewed === true}));
}
