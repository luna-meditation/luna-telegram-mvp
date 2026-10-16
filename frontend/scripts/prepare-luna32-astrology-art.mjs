// Mechanical optimization of original images from the built-in imagegen tool.
// No provider API call, cropping, source overwrite or paid operation occurs here.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {default:sharp}=await import(pathToFileURL(process.env.LUNA_SHARP_MODULE).href);
const source=process.env.LUNA_IMAGEGEN_DIRECTORY;assert.ok(source);
const root=resolve(fileURLToPath(new URL('..',import.meta.url))),output=resolve(root,'public/images/astrology');await mkdir(output,{recursive:true});
const common='Square premium Luna astrology menu illustration, midnight navy, soft violet, champagne gold, fine celestial detail, clear focal silhouette, no text, numbers, interface, logos or watermark; original decorative artwork, not a calculated chart.';
const inputs=[
 ['natal','exec-32191d60-b908-4895-803e-d07c607216d9.png','A golden natal instrument, concentric rings, zodiac pictograms, a warm central star; one chart only.'],
 ['compatibility','exec-51c23507-c727-45a1-bfd2-016706afd6c8.png','Two intertwined celestial chart instruments, silver-blue and champagne-gold, moon and sun, no people, anatomy or hearts. Edited the first generated variant to remove human portraits while preserving its paired-orbit composition.'],
 ['calendar','exec-800d9170-f67c-4bdf-8eb7-85b395bb31d3.png','Five illuminated moon phases over an abstract dotted calendar grid, violet starfield; no zodiac wheel.'],
 ['path','exec-b5773ca9-a1bf-42d1-a3a8-ebeddc77a522.png','A winding stardust path over an indigo nebula toward one champagne-gold guiding star; no zodiac wheel.']
];
const records=[];
for(const [id,file,subject] of inputs){
 const input=await readFile(resolve(source,file)),meta=await sharp(input).metadata();
 const image=await sharp(input).rotate().resize({width:384,height:384,fit:'inside',withoutEnlargement:true}).webp({quality:84,effort:6}).toBuffer();
 const src='/images/astrology/luna32-'+id+'.webp';
 try{await writeFile(resolve(root,'public'+src),image,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;assert.deepEqual(await readFile(resolve(root,'public'+src)),image,'Do not overwrite a different asset; use a new versioned filename.');}
 assert.ok(image.length<90000);
 records.push({id,src,bytes:image.length,sourceArtifact:file,sourceWidth:meta.width,sourceHeight:meta.height,sourceSha256:createHash('sha256').update(input).digest('hex'),sha256:createHash('sha256').update(image).digest('hex'),prompt:common+' Subject: '+subject});
}
assert.equal(new Set(records.map(r=>r.sha256)).size,4);
await mkdir(resolve(root,'asset-reports'),{recursive:true});await writeFile(resolve(root,'asset-reports/luna32-astrology.json'),JSON.stringify({generator:'built-in image_gen',purpose:'decorative menu images, not factual chart output',originalsPreserved:true,cropped:false,records},null,2));
console.log(JSON.stringify({assets:records.map(({id,src,bytes})=>({id,src,bytes})),totalBytes:records.reduce((n,r)=>n+r.bytes,0),cropped:false,originalsPreserved:true}));
