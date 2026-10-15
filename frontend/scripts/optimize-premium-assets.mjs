// Build-time utility only. Originals are never modified; derivatives are content-addressed.
import {readdir,readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,relative,extname,basename} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const {default:sharp}=await import(process.env.LUNA_SHARP_MODULE?pathToFileURL(process.env.LUNA_SHARP_MODULE).href:'sharp');
const frontend=resolve(fileURLToPath(new URL('..',import.meta.url)));
const root=resolve(frontend,'public'),out=resolve(root,'assets/optimized');
await mkdir(out,{recursive:true});
const manifest={},tarotManifest={},report=[];
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){
 const file=resolve(dir,entry.name);if(entry.isDirectory()){if(entry.name!=='optimized')await walk(file);continue;}
 const path='/'+relative(root,file).split('\\').join('/');
 if(!/\.(png|webp|jpe?g)$/i.test(path))continue;
 if(!/^\/(images\/|assets\/(moon-garden|tarot|brand)\/|luna-avatar)/.test(path))continue;
 const input=await readFile(file),meta=await sharp(input).metadata();
 const tarot=path.startsWith('/assets/tarot/'),garden=path.startsWith('/assets/moon-garden/');
 const sizes=tarot?[160,480]:garden?[320,800,1440]:path.includes('brand')?[96,192]:[320,800,1200];
 const variants=[];
 for(const width of [...new Set([...sizes.filter(w=>w<=(meta.width??0)),...(garden?[Math.min(meta.width,1440)]:[])])].sort((a,b)=>a-b)){
  const buffer=await sharp(input).rotate().resize({width,withoutEnlargement:true}).webp({quality:tarot?88:84,effort:5}).toBuffer();
  const hash=createHash('sha256').update(buffer).digest('hex').slice(0,12);
  const name=`${basename(file,extname(file))}-${width}-${hash}.webp`;await writeFile(resolve(out,name),buffer);
  variants.push({width,src:'/assets/optimized/'+name,bytes:buffer.length});
 }
 if(variants.length)(tarot?tarotManifest:manifest)[path]={width:meta.width,height:meta.height,variants};
 report.push({source:path,bytes:(await stat(file)).size,width:meta.width,height:meta.height,variants});
}}
await walk(root);
// Existing published meditation artwork only. No authenticated or signed asset URLs.
for(const source of JSON.parse(await readFile(resolve(frontend,'public-meditation-covers.json'),'utf8'))){
 const url=new URL(source);if(url.origin!=='https://vkcdtasbdoeilgfucoax.supabase.co'||!url.pathname.startsWith('/storage/v1/object/public/')||url.search)throw Error('Only known public, unsigned meditation covers are allowed');
 const response=await fetch(url);if(!response.ok)throw Error(`Public cover failed: ${response.status}`);const input=Buffer.from(await response.arrayBuffer()),meta=await sharp(input).metadata(),variants=[];
 for(const width of [160,480,960,1440].filter(w=>w<=meta.width)){const bytes=await sharp(input).rotate().resize({width,withoutEnlargement:true}).webp({quality:84,effort:5}).toBuffer(),hash=createHash('sha256').update(bytes).digest('hex').slice(0,12),name=`meditation-${createHash('sha256').update(source).digest('hex').slice(0,8)}-${width}-${hash}.webp`;await writeFile(resolve(out,name),bytes);variants.push({width,src:'/assets/optimized/'+name,bytes:bytes.length});}
 if(variants.length)manifest[source]={width:meta.width,height:meta.height,variants};report.push({source,originalStorage:'unchanged public Supabase object',sourceSha256:createHash('sha256').update(input).digest('hex'),bytes:input.length,width:meta.width,height:meta.height,variants});
}
await writeFile(resolve(frontend,'src/design-system/image-manifest.json'),JSON.stringify(manifest));
await writeFile(resolve(frontend,'src/features/tarot/image-manifest.json'),JSON.stringify(tarotManifest));
const night=manifest['/images/home/hero-night.png'].variants.find(v=>v.width===800);
await writeFile(resolve(frontend,'src/design-system/image-backgrounds.css'),`:root { --luna-night-image: url('${night.src}'); }\n`);
await mkdir(resolve(frontend,'asset-reports'),{recursive:true});
await writeFile(resolve(frontend,'asset-reports/luna22-images.json'),JSON.stringify({originalsPreserved:true,files:report},null,2));
console.log(`Prepared ${report.length} source images, ${report.reduce((n,r)=>n+r.variants.length,0)} derivatives; originals unchanged.`);
