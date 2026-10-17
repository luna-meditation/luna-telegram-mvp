// Mechanical resize/format optimization only. Art is generated with the approved
// built-in image tool, one independent prompt per image. Originals are untouched.
import {readFile,mkdir,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve,dirname} from 'node:path';
const sharp=(await import(process.env.LUNA_SHARP_MODULE?pathToFileURL(process.env.LUNA_SHARP_MODULE).href:'sharp')).default;
const sources=JSON.parse(await readFile(process.argv[2],'utf8')),root=resolve('public/images/achievements/luna34');await mkdir(root,{recursive:true});const report=[];
for(const source of sources){
 const id=source.id.toLowerCase(),metadata=await sharp(source.source).metadata();if(metadata.width<512||metadata.height<512)throw new Error('Insufficient original resolution: '+id);
 const destination=source.kind==='status'?resolve('public/images/statuses/luna34',id+'.webp'):resolve(root,id+'.webp');await mkdir(dirname(destination),{recursive:true});
 const master=await sharp(source.source).resize(768,768,{fit:'inside',withoutEnlargement:true}).webp({quality:86,effort:6}).toBuffer(),small=await sharp(source.source).resize(192,192,{fit:'inside',withoutEnlargement:true}).webp({quality:80,effort:6}).toBuffer(),grid=await sharp(source.source).resize(384,384,{fit:'inside',withoutEnlargement:true}).webp({quality:82,effort:6}).toBuffer();
 await writeFile(destination,master);await writeFile(destination.replace('.webp','-small.webp'),small);await writeFile(destination.replace('.webp','-grid.webp'),grid);
 report.push({id:source.id,kind:source.kind??'achievement',src:destination.slice(resolve('public').length),width:768,height:768,bytes:master.length,thumbnailBytes:small.length,gridBytes:grid.length,sha256:createHash('sha256').update(master).digest('hex'),original:{width:metadata.width,height:metadata.height,bytes:(await stat(source.source)).size},source:'built_in_imagegen',prompt:source.prompt});
}
await mkdir('asset-reports',{recursive:true});await writeFile('asset-reports/luna34-art.json',JSON.stringify({generatedAt:new Date().toISOString(),count:report.length,assets:report},null,2)+'\n');console.log(JSON.stringify({count:report.length,totalBytes:report.reduce((n,r)=>n+r.bytes+r.thumbnailBytes+r.gridBytes,0)}));
