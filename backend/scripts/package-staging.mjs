// Package only the existing isolated QA site. No deployment or test worker.
import {readFile,writeFile,cp,mkdir,mkdtemp,realpath} from 'node:fs/promises';
import {createRequire} from 'node:module';import {dirname,resolve} from 'node:path';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
assert.equal(process.versions.node.split('.')[0],'22');
const source=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),commit=execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim();
assert.equal(process.env.LUNA_STAGING_SOURCE_COMMIT,commit,'Commit verified source first');
execFileSync('git',['diff','--exit-code','HEAD','--','backend/src','backend/scripts','frontend/src','frontend/scripts','frontend/index.html','supabase/migrations'],{cwd:source});
const {build}=await import(createRequire(await realpath(source+'/frontend/node_modules/vite/package.json')).resolve('esbuild'));
const luna41=process.env.LUNA41_STAGING_RELEASE==='true';
const directory=await mkdtemp(luna41?'/tmp/luna41-staging.':'/tmp/luna40-staging.'),functions=directory+'/functions';await mkdir(functions);await mkdir(directory+'/.netlify');await cp(source+'/frontend/dist-staging',directory+'/public',{recursive:true});
const index=await readFile(directory+'/public/index.html','utf8');assert.ok(!/offline-local-qa|window\.Telegram\?\?=/.test(index));
// Published _redirects runs before TOML. Replace the app's generic SPA fallback
// with isolated QA API rules so no request can fall through to production.
await writeFile(directory+'/public/_redirects','/api/* /.netlify/functions/luna-staging/api/:splat 200!\n/health /.netlify/functions/luna-staging/health 200!\n/telegram/* /.netlify/functions/luna-staging/telegram/:splat 200!\n/qa/* /index.html 404!\n/* /index.html 200\n');
await writeFile(directory+'/.netlify/state.json',JSON.stringify({siteId:'a634a7fc-1ecb-47fa-8b43-edd81a7e3694'}));
const catalog=await readFile(source+'/backend/dist/tarot-catalog.json','utf8'),compressed=(await readFile(source+'/backend/dist/data/geonames-cities15000.json.gz')).toString('base64'),metadata=await readFile(source+'/backend/dist/data/geonames-attribution.json','utf8'),astronomy=createRequire(source+'/backend/package.json').resolve('astronomy-engine');
const plugins=[{name:'verified-runtime-assets',setup(b){
 b.onLoad({filter:/\/dist\/tarot-policy\.js$/},async({path})=>{const text=await readFile(path,'utf8'),line=text.split('\n').find(l=>l.startsWith('const manifest = JSON.parse('));assert.ok(line);return{contents:text.replace(line,'const manifest = '+catalog+';'),loader:'js'};});
 b.onLoad({filter:/\/dist\/luna30-locations\.js$/},async({path})=>{const text=await readFile(path,'utf8'),needle="const compressed = readFileSync(new URL(directory + 'geonames-cities15000.json.gz', import.meta.url)), meta = JSON.parse(readFileSync(new URL(directory + 'geonames-attribution.json', import.meta.url), 'utf8'));";assert.ok(text.includes(needle));return{contents:text.replace(needle,`const compressed = Buffer.from('${compressed}','base64'),meta=${metadata};`),loader:'js'};});
 b.onLoad({filter:/\/dist\/luna30-astrology-engine\.js$/},async({path})=>{const text=await readFile(path,'utf8'),needle="createRequire(import.meta.url)('astronomy-engine')";assert.ok(text.includes(needle));return{contents:`import lunaAstronomy from ${JSON.stringify(astronomy)};\n`+text.replace(needle,'lunaAstronomy'),loader:'js'};});
}}];
const options={bundle:true,packages:'bundle',format:'esm',platform:'node',target:'node22',external:['pg-native'],banner:{js:"import {createRequire as __lunaCreateRequire} from 'node:module'; const require=__lunaCreateRequire(import.meta.url);"},plugins,logLevel:'warning'};
await build({...options,entryPoints:[source+'/backend/staging/functions/luna-staging.mjs'],outfile:functions+'/luna-staging.mjs'});
let authFile=null,expiresAt=null;
let evaluationAuthFile=null;
if(process.env.LUNA41_EVALUATION_APPROVED==='400_calls_2_usd'){
 assert.ok(luna41,'Evaluation belongs only to the Luna 4.1 staging artifact');
 const nonce=randomBytes(32).toString('hex'),authSha256=createHash('sha256').update(nonce).digest('hex');expiresAt=new Date(Date.now()+8*60*60000).toISOString();
 for(const readOnly of [false,true]){const name=readOnly?'luna41-qa-status':'luna41-qa-background';await build({...options,stdin:{contents:`import {run} from '${source}/backend/test/luna41-staging-evaluation.mjs';export default async function(request,context){return run(request,context,${JSON.stringify({authSha256,expiresAt,sourceCommit:commit,readOnly})});}${readOnly?'':'export const config={background:true};'}`,resolveDir:source,sourcefile:name+'.mjs'},outfile:functions+'/'+name+'.mjs'});}
 evaluationAuthFile=directory+'/luna41-qa-command-private.json';await writeFile(evaluationAuthFile,JSON.stringify({nonce,expiresAt}),{mode:0o600,flag:'wx'});
}
if(process.env.LUNA40_SMOKE_APPROVED==='owner-4-calls-usd0.03'){
 const nonce=randomBytes(32).toString('hex'),authSha256=createHash('sha256').update(nonce).digest('hex');expiresAt=new Date(Date.now()+90*60000).toISOString();
 await build({...options,stdin:{contents:`import {run} from '${source}/backend/test/luna40-staging-smoke.mjs';export default async function(request,context){return run(request,context,${JSON.stringify({authSha256,expiresAt,sourceCommit:commit,followup:process.env.LUNA40_SMOKE_FOLLOWUP==='true',finalCheck:process.env.LUNA40_SMOKE_FINAL_APPROVED==='owner-2-additional-calls-total-usd0.03'})});}export const config={background:true};`,resolveDir:source,sourcefile:'luna40-qa-background.mjs'},outfile:functions+'/luna40-qa-background.mjs'});
 authFile=directory+'/qa-command-private.json';await writeFile(authFile,JSON.stringify({nonce,expiresAt}),{mode:0o600,flag:'wx'});
}
const staging=await readFile(source+'/staging/netlify.toml','utf8');await writeFile(directory+'/netlify.toml','[build]\n publish="public"\n[functions]\n directory="functions"\n node_bundler="esbuild"\n'+staging.slice(staging.indexOf('[[headers]]')));
await writeFile(process.env.LUNA_STAGING_ARTIFACT_LOCATION??'/tmp/luna40-staging-location.json',JSON.stringify({directory,functions,sourceCommit:commit,authFile,evaluationAuthFile,expiresAt}),{mode:0o600});
console.log(JSON.stringify({status:'PACKAGED_NOT_DEPLOYED',directory,sourceCommit:commit,functions:['luna-staging',...(authFile?['luna40-qa-background']:[]),...(evaluationAuthFile?['luna41-qa-background','luna41-qa-status']:[])],secretsEmbedded:false}));
