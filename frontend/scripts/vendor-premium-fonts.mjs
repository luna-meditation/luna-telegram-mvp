// Download only the official Google Fonts EN/RU subsets and their OFL licenses.
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const output=new URL('../public/assets/fonts/',import.meta.url);await mkdir(output,{recursive:true});
const response=await fetch('https://fonts.googleapis.com/css2?family=Inter:wght@400..700&family=Cormorant+Garamond:wght@600;700&display=swap',{headers:{'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'}});
if(!response.ok)throw Error(`Font CSS: ${response.status}`);
const css=await response.text();let local='/* Google Fonts, SIL Open Font License; EN/RU subsets, no runtime third-party requests. */\n';const downloads=new Map();
for(const block of css.matchAll(/\/\*\s*(cyrillic|latin|latin-ext)\s*\*\/\s*(@font-face\s*\{[^}]+\})/g)){
 let rule=block[2];const url=rule.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/)?.[1];if(!url)continue;
 let name=downloads.get(url);if(!name){const res=await fetch(url);if(!res.ok)throw Error(`Font download ${res.status}`);const bytes=Buffer.from(await res.arrayBuffer());name=`luna-${createHash('sha256').update(bytes).digest('hex').slice(0,12)}.woff2`;await writeFile(new URL(name,output),bytes);downloads.set(url,name);}
 local+=rule.replace(url,`/assets/fonts/${name}`)+'\n';
}
if(downloads.size===0)throw Error('No approved font subsets matched');
for(const name of ['inter','cormorantgaramond']){const res=await fetch(`https://raw.githubusercontent.com/google/fonts/main/ofl/${name}/OFL.txt`);if(!res.ok)throw Error(`Missing license: ${name}`);const license=await res.text();if(!license.includes('SIL OPEN FONT LICENSE'))throw Error('License verification failed');await writeFile(new URL(`${name}-OFL.txt`,output),license);}
await writeFile(new URL('../src/design-system/fonts.css',import.meta.url),local);console.log(`Self-hosted ${downloads.size} licensed WOFF2 files.`);
