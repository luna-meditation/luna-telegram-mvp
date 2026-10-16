// Deterministic local WebP derivatives. Original imagegen outputs remain untouched.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {default:sharp}=await import(pathToFileURL(process.env.LUNA_SHARP_MODULE).href);
const source=process.env.LUNA_IMAGEGEN_DIRECTORY;assert.ok(source);
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
await mkdir(resolve(root,'public/images/home'),{recursive:true});
const common='Premium cinematic painted-realism for Luna. Midnight navy, luminous violet and rose, warm gold; natural material detail, no text, letters, numbers, logos, interface or borders. Full edge-to-edge original artwork, not a screenshot crop.';
const inputs=[
 ['hero','exec-61355cff-bf9e-4895-bee3-d0e6457224ce.png','Wide 3:2 violet-pink mountain lake. Large rose-gold moon upper-right, quiet dark sky on left 60%, distant pine silhouettes, reflected moonlight, no people.',[720,1080,1440]],
 ['tarot','exec-4d8611fd-be09-42bd-8e71-044c0079bb99.png','Square: three navy Tarot cards fanned on velvet, gold celestial engraving, central crescent, candles and amethyst crystals; dark quiet lower quarter.',[360,540]],
 ['astrology','exec-db638d2a-98b5-4931-9d40-61dff18f00cc.png','Square: engraved gold zodiac instrument, luminous central star, concentric orbital rings, decorative pictograms and dimensional planets; quiet dark lower quarter.',[360,540]],
 ['meditations','exec-38efd83e-6e69-43aa-b4fa-abb15174de75.png','Square: seated meditator seen from behind beside still lake, rose-gold moon upper-right, violet mountains and pink blossoms on left, quiet dark lower quarter.',[360,540]],
 ['breathwork','exec-4062d4bc-4587-4828-bc2c-e5b3cc610da9.png','Square: dimensional electric-blue luminous ring, cyan highlights and violet halo floating over volumetric clouds in midnight starfield; quiet dark lower quarter.',[360,540]]
];
const manifest={},records=[];
for(const [id,file,subject,widths] of inputs){
 const input=await readFile(resolve(source,file)),meta=await sharp(input).metadata(),variants=[];
 for(const width of widths){
  const image=await sharp(input).rotate().resize({width,withoutEnlargement:true}).webp({quality:82,effort:6}).toBuffer();
  const src=`/images/home/luna32-${id}-${width}.webp`;
  try{await writeFile(resolve(root,'public'+src),image,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;assert.deepEqual(await readFile(resolve(root,'public'+src)),image);}
  assert.ok(image.length<170000);variants.push({width,src,bytes:image.length,sha256:createHash('sha256').update(image).digest('hex')});
 }
 manifest[id]={width:meta.width,height:meta.height,variants:variants.map(({sha256,...v})=>v)};
 records.push({id,sourceArtifact:file,sourceSha256:createHash('sha256').update(input).digest('hex'),prompt:common+' '+subject,...manifest[id],variants});
}
await writeFile(resolve(root,'src/v2/home-art-32.json'),JSON.stringify(manifest,null,2)+'\n');
await mkdir(resolve(root,'asset-reports'),{recursive:true});
await writeFile(resolve(root,'asset-reports/luna32-home.json'),JSON.stringify({generator:'built-in image_gen',originalsPreserved:true,cropped:false,records},null,2)+'\n');
console.log(JSON.stringify({assets:records.map(({id,variants})=>({id,variants})),totalBytes:records.reduce((n,r)=>n+r.variants.reduce((s,v)=>s+v.bytes,0),0)}));
