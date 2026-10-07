import {readFile, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {validatePack, safePackPath, portablePackProject} from '../src/sprite-pack.mjs';

const source=process.argv[2];
if(!source)throw Error('Usage: node scripts/vendor-sprite-pack.mjs <approved pack directory>');
const sourceRoot=path.resolve(source), output=path.resolve('public/sprite-packs/current');
const manifest=validatePack(JSON.parse(await readFile(path.join(sourceRoot,'manifest.json'),'utf8')));
const files=new Set(['manifest.json']);
const read=async name=>new Uint8Array(await readFile(path.join(sourceRoot,safePackPath(name))));
for(const entry of manifest.projects){
  const project=JSON.parse(await readFile(path.join(sourceRoot,entry.projectPath),'utf8'));
  await portablePackProject({manifest,read},entry);
  files.add(entry.projectPath);
  const directory=entry.projectPath.slice(0,entry.projectPath.lastIndexOf('/')+1);
  for(const asset of Object.values(project.assets))if(!asset.src.startsWith('data:image/'))files.add(safePackPath(directory+safePackPath(asset.src)));
}
for(const file of files){const dest=path.join(output,file);await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,await read(file));}
console.log(JSON.stringify({projects:manifest.projects.length,files:files.size,output}));
