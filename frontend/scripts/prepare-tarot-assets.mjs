// Deterministic format conversion only. Never edits or removes source images.
import assert from 'node:assert/strict';
import {readFile, readdir, mkdir, writeFile, realpath, lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname, resolve, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

assert.equal(process.versions.node.split('.')[0], '22', 'Use Node.js 22');
const frontend=resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceArg=process.argv[process.argv.indexOf('--source')+1];
assert.ok(process.argv.includes('--source') && sourceArg, 'Pass --source /absolute/path/to/tarot');
const source=await realpath(sourceArg);
const destination=resolve(frontend,'public/assets/tarot/cards');
assert.ok(destination!==source && !destination.startsWith(source+sep) && !source.startsWith(destination+sep), 'Source and destination must be separate');
const mapping=JSON.parse(await readFile(resolve(frontend,'src/features/tarot/source-map.json'),'utf8'));
assert.equal(mapping.cards.length,78);
assert.equal(new Set(mapping.cards.map(c=>c.id)).size,78);
const files=(await readdir(source)).filter(name=>!name.startsWith('.')).sort();
assert.deepEqual(files,mapping.cards.map(c=>c.sourceFile).sort(),'Source folder must match the reviewed 78-card registry exactly');
const sharpModule=process.env.TAROT_SHARP_MODULE;
const {default:sharp}=await import(sharpModule ? pathToFileURL(sharpModule).href : 'sharp');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
// Verify every input before writing any output; fail closed on changed/unreviewed artwork.
for(const card of mapping.cards){
 assert.match(card.id,/^[a-z]+(?:-[a-z]+)*$/);
 assert.match(card.sourceFile,/^[A-F0-9-]+\.PNG$/);
 assert.equal(hash(await readFile(resolve(source,card.sourceFile))),card.sourceSha256,`Original changed: ${card.sourceFile}`);
}
await mkdir(destination,{recursive:true});
const actualDestination=await realpath(destination);
assert.ok(actualDestination!==source && !actualDestination.startsWith(source+sep) && !source.startsWith(actualDestination+sep),'Destination symlink must not overlap source');
const output=[];
for(const card of mapping.cards){
 const original=await readFile(resolve(source,card.sourceFile));
 const bytes=await sharp(original).toColourspace('srgb').webp({quality:86,effort:6,smartSubsample:true}).toBuffer();
 const info=await sharp(bytes).metadata();
 assert.equal(info.width,card.width);assert.equal(info.height,card.height);
 assert.equal(info.format,'webp');assert.equal(info.exif,undefined);
 const path=resolve(destination,card.id+'.webp');
 const existing=await lstat(path).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
 if(existing){
  assert.ok(existing.isFile()&&!existing.isSymbolicLink(),'Refusing non-regular output');
  assert.equal(hash(await readFile(path)),hash(bytes),'Refusing to overwrite an existing different asset');
 }else await writeFile(path,bytes,{flag:'wx'});
 assert.equal(hash(await readFile(resolve(source,card.sourceFile))),card.sourceSha256,'Source must remain unchanged');
 output.push({id:card.id,image:'/assets/tarot/cards/'+card.id+'.webp',width:info.width,height:info.height,bytes:bytes.length,sha256:hash(bytes),sourceSha256:card.sourceSha256});
}
const sourceBytes=mapping.cards.reduce((sum,c)=>sum+c.sourceBytes,0),optimizedBytes=output.reduce((sum,c)=>sum+c.bytes,0);
await writeFile(resolve(frontend,'src/features/tarot/asset-report.json'),JSON.stringify({sourceFiles:78,optimizedFiles:78,sourceBytes,optimizedBytes,reductionPercent:Math.round((1-optimizedBytes/sourceBytes)*10000)/100,preserveResolution:true,crop:false,exifRemoved:true,originalsUnchanged:true,cards:output},null,2)+'\n');
console.log(JSON.stringify({sourceFiles:78,optimizedFiles:78,sourceBytes,optimizedBytes,reductionPercent:Math.round((1-optimizedBytes/sourceBytes)*10000)/100,originalsUnchanged:true},null,2));
