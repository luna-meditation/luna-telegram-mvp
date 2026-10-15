// Build-time utility only. Originals are never modified; derivatives are content-addressed.
import {readdir,readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,relative,extname,basename} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const {default:sharp}=await import(process.env.LUNA_SHARP_MODULE?pathToFileURL(process.env.LUNA_SHARP_MODULE).href:'sharp');
const frontend=resolve(fileURLToPath(new URL('..',import.meta.url)));
const root=resolve(frontend,'public'),out=resolve(root,'assets/optimized');
await mkdir(out,{recursive:true});
const manifest={},report=[];
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){
 const file=resolve(dir,entry.name);if(entry.isDirectory()){if(entry.name!=='optimized')await walk(file);continue;}
 const path='/'+relative(root,file).split('\\').join('/');
 if(!/\.(png|webp|jpe?g)$/i.test(path))continue;
 if(!/^\/(images\/|assets\/(moon-garden|tarot|brand)\/|luna-avatar)/.test(path))continue;
 const input=await readFile(file),meta=await sharp(input).metadata();
 const tarot=path.startsWith('/assets/tarot/'),garden=path.startsWith('/assets/moon-garden/');
 const sizes=tarot?[160,480]:garden?[320,800,1440]:path.includes('brand')?[96,192]:[320,800,1200];
 const variants=[];
 for(const width of sizes.filter(w=>w<=(meta.width??0))){
  const buffer=await sharp(input).rotate().resize({width,withoutEnlargement:true}).webp({quality:tarot?88:84,effort:5}).toBuffer();
  const hash=createHash('sha256').update(buffer).digest('hex').slice(0,12);
  const name=`${basename(file,extname(file))}-${width}-${hash}.webp`;await writeFile(resolve(out,name),buffer);
  variants.push({width,src:'/assets/optimized/'+name,bytes:buffer.length});
 }
 if(variants.length)manifest[path]={width:meta.width,height:meta.height,variants};
 report.push({source:path,bytes:(await stat(file)).size,width:meta.width,height:meta.height,variants});
}}
await walk(root);
await writeFile(resolve(frontend,'src/design-system/image-manifest.json'),JSON.stringify(manifest));
await mkdir(resolve(frontend,'asset-reports'),{recursive:true});
await writeFile(resolve(frontend,'asset-reports/luna22-images.json'),JSON.stringify({originalsPreserved:true,files:report},null,2));
console.log(`Prepared ${report.length} source images, ${report.reduce((n,r)=>n+r.variants.length,0)} derivatives; originals unchanged.`);
