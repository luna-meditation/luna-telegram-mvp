// Package only the existing isolated QA site; paid test workers require a
// separate finite owner-approved opt-in below. This script never deploys.
import {readFile,writeFile,cp,mkdir,mkdtemp,realpath,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';import {dirname,resolve} from 'node:path';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
assert.equal(process.versions.node.split('.')[0],'22');
const source=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),commit=execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim();
assert.equal(process.env.LUNA_STAGING_SOURCE_COMMIT,commit,'Commit verified source first');
execFileSync('git',['diff','--exit-code','HEAD','--','backend/src','backend/scripts','backend/test','frontend/src','frontend/scripts','frontend/index.html','supabase/migrations'],{cwd:source});
const {build}=await import(createRequire(await realpath(source+'/frontend/node_modules/vite/package.json')).resolve('esbuild'));
const luna43=process.env.LUNA43_STAGING_RELEASE==='true',luna42=luna43||process.env.LUNA42_STAGING_RELEASE==='true',luna41=luna42||process.env.LUNA41_STAGING_RELEASE==='true';
const intelligence3=process.env.LUNA_INTELLIGENCE3_STAGING_RELEASE==='true',intelligence2=process.env.LUNA_INTELLIGENCE2_STAGING_RELEASE==='true';
const intelligence=intelligence3||intelligence2||process.env.LUNA_INTELLIGENCE_STAGING_RELEASE==='true';
const directory=await mkdtemp(luna43?'/tmp/luna43-staging.':luna41?'/tmp/luna41-staging.':'/tmp/luna40-staging.'),functions=directory+'/functions';await mkdir(functions);await mkdir(directory+'/.netlify');await cp(source+'/frontend/dist-staging',directory+'/public',{recursive:true});
const index=await readFile(directory+'/public/index.html','utf8');assert.ok(!/offline-local-qa|window\.Telegram\?\?=/.test(index));
// Published _redirects runs before TOML. Replace the app's generic SPA fallback
// with isolated QA API rules so no request can fall through to production.
await writeFile(directory+'/public/_redirects','/api/* /.netlify/functions/luna-staging/api/:splat 200!\n/health /.netlify/functions/luna-staging/health 200!\n/telegram/* /.netlify/functions/luna-staging/telegram/:splat 200!\n/qa/* /index.html 404!\n/* /index.html 200\n');
await writeFile(directory+'/.netlify/state.json',JSON.stringify({siteId:'a634a7fc-1ecb-47fa-8b43-edd81a7e3694'}));
const catalog=await readFile(source+'/backend/dist/tarot-catalog.json','utf8'),compressed=(await readFile(source+'/backend/dist/data/geonames-cities15000.json.gz')).toString('base64'),metadata=await readFile(source+'/backend/dist/data/geonames-attribution.json','utf8'),astronomy=createRequire(source+'/backend/package.json').resolve('astronomy-engine');
const plugins=[{name:'verified-runtime-assets',setup(b){
 b.onLoad({filter:/\/dist\/luna42-editorial\.js$/},async({path})=>{let text=await readFile(path,'utf8');for(const [variable,file]of [['editorialBaseline','luna42-editorial-baseline.json'],['bundledAssets','luna42-editorial-assets.json']]){const data=await readFile(source+'/backend/dist/'+file,'utf8'),line=text.split('\n').find(l=>l.startsWith(variable==='editorialBaseline'?'export const editorialBaseline =':'const bundledAssets ='));assert.ok(line);text=text.replace(line,variable==='editorialBaseline'?`export const editorialBaseline = ${data};`:`const bundledAssets = new Set(${data});`);}return{contents:text,loader:'js'};});
 b.onLoad({filter:/\/dist\/tarot-policy\.js$/},async({path})=>{const text=await readFile(path,'utf8'),line=text.split('\n').find(l=>l.startsWith('const manifest = JSON.parse('));assert.ok(line);return{contents:text.replace(line,'const manifest = '+catalog+';'),loader:'js'};});
 b.onLoad({filter:/\/dist\/luna30-locations\.js$/},async({path})=>{const text=await readFile(path,'utf8'),needle="const compressed = readFileSync(new URL(directory + 'geonames-cities15000.json.gz', import.meta.url)), meta = JSON.parse(readFileSync(new URL(directory + 'geonames-attribution.json', import.meta.url), 'utf8'));";assert.ok(text.includes(needle));return{contents:text.replace(needle,`const compressed = Buffer.from('${compressed}','base64'),meta=${metadata};`),loader:'js'};});
 b.onLoad({filter:/\/dist\/luna30-astrology-engine\.js$/},async({path})=>{const text=await readFile(path,'utf8'),needle="createRequire(import.meta.url)('astronomy-engine')";assert.ok(text.includes(needle));return{contents:`import lunaAstronomy from ${JSON.stringify(astronomy)};\n`+text.replace(needle,'lunaAstronomy'),loader:'js'};});
}}];
const options={bundle:true,packages:'bundle',format:'esm',platform:'node',target:'node22',external:['pg-native'],banner:{js:"import {createRequire as __lunaCreateRequire} from 'node:module'; const require=__lunaCreateRequire(import.meta.url);"},plugins,logLevel:'warning'};
await build({...options,entryPoints:[source+'/backend/staging/functions/luna-staging.mjs'],outfile:functions+'/luna-staging.mjs'});
let authFile=null,expiresAt=null;
let evaluationAuthFile=null;
let voiceAuthFile=null;
let actionAuthFile=null;
let transcriptionAuthFile=null;
let integrationAuthFile=null,integrationGrantId=null;
if(intelligence){
 assert.equal(process.env.LUNA_INTELLIGENCE_QA_APPROVED,intelligence3?'90_responses_8_stt_combined_usd0.75':intelligence2?'60_responses_combined_usd0.50':'180_responses_combined_usd1');
 assert.ok(!luna43&&!luna42&&!luna41,'Do not bundle historical paid workers with Intelligence');
 const nonce=randomBytes(32).toString('hex'),authSha256=createHash('sha256').update(nonce).digest('hex');expiresAt=new Date(Date.now()+8*3600000).toISOString();
 const samples=intelligence3?JSON.parse(await readFile(process.env.LUNA3_VOICE_SAMPLES,'utf8')):[];
 if(intelligence3){assert.equal(samples.length,5);for(const sample of samples)assert.equal(createHash('sha256').update(Buffer.from(sample.base64,'base64')).digest('hex'),sample.sha256);}
 for(const readOnly of [false,true]){const name=readOnly?'luna-intelligence-status':'luna-intelligence-background';await build({...options,stdin:{contents:`import {run} from '${source}/backend/test/luna-intelligence-staging.mjs';export default async function(request,context){return run(request,context,${JSON.stringify({authSha256,expiresAt,sourceCommit:commit,readOnly,...(intelligence3?{program:'intelligence3',samples:readOnly?[]:samples}:intelligence2?{program:'intelligence2'}:{})})});}${readOnly?'':'export const config={background:true};'}`,resolveDir:source,sourcefile:name+'.mjs'},outfile:functions+'/'+name+'.mjs'});}
 authFile=directory+'/luna-intelligence-command-private.json';await writeFile(authFile,JSON.stringify({nonce,expiresAt}),{mode:0o600,flag:'wx'});
}
if(luna43){
 assert.equal(process.env.LUNA43_QA_APPROVED,'40_responses_8_stt_combined_usd0.50');
 const samples=[];
 for(const [language,expectedHash]of [['en','76cbb651f67b925278e64d5040ac7822e5efda4f78a655341ac6129b10c3785b'],['ru','8e8125e342ed33003069177509d2ea8d503722cd8e3fcd9d7fe9d5af091cfb85']]){
  const original=await readFile('/tmp/luna41-voice-qa/'+language+'-sample.wav');assert.equal(createHash('sha256').update(original).digest('hex'),expectedHash);assert.equal(original.readUInt32LE(24),24000);
  const count=(original.length-44)/2,length=Math.floor(count*2/3),wav=Buffer.alloc(44+length*2);original.copy(wav,0,0,44);wav.writeUInt32LE(wav.length-8,4);wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);wav.writeUInt32LE(length*2,40);
  for(let i=0;i<length;i++){const position=i*1.5,a=Math.floor(position),fraction=position-a;wav.writeInt16LE(Math.round(original.readInt16LE(44+a*2)*(1-fraction)+original.readInt16LE(44+Math.min(a+1,count-1)*2)*fraction),44+i*2);}
  samples.push({language,base64:wav.toString('base64')});
 }
 const nonce=randomBytes(32).toString('hex'),authSha256=createHash('sha256').update(nonce).digest('hex');expiresAt=new Date(Date.now()+8*3600000).toISOString();
 for(const readOnly of [false,true]){const name=readOnly?'luna43-release-status':'luna43-release-background';await build({...options,stdin:{contents:`import {run} from '${source}/backend/test/luna43-staging-release.mjs';export default async function(request,context){return run(request,context,${JSON.stringify({authSha256,expiresAt,sourceCommit:commit,readOnly,samples:readOnly?[]:samples})});}${readOnly?'':'export const config={background:true};'}`,resolveDir:source,sourcefile:name+'.mjs'},outfile:functions+'/'+name+'.mjs'});}
 authFile=directory+'/luna43-command-private.json';await writeFile(authFile,JSON.stringify({nonce,expiresAt}),{mode:0o600,flag:'wx'});
}
if(luna42&&process.env.LUNA42_INTEGRATION_QA==='two_voice_http_calls_remaining_usd0.03'){
 const samples=[];
 for(const [language,hash]of [['en','76cbb651f67b925278e64d5040ac7822e5efda4f78a655341ac6129b10c3785b'],['ru','8e8125e342ed33003069177509d2ea8d503722cd8e3fcd9d7fe9d5af091cfb85']]){
  const original=await readFile('/tmp/luna41-voice-qa/'+language+'-sample.wav');assert.equal(createHash('sha256').update(original).digest('hex'),hash);assert.equal(original.readUInt32LE(24),24000);
  const length=Math.floor((original.length-44)/2*2/3),wav=Buffer.alloc(44+length*2);original.copy(wav,0,0,44);wav.writeUInt32LE(wav.length-8,4);wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);wav.writeUInt32LE(length*2,40);
  for(let i=0;i<length;i++){const offset=i*1.5,a=Math.floor(offset),fraction=offset-a,s0=original.readInt16LE(44+a*2),s1=original.readInt16LE(44+Math.min(a+1,(original.length-44)/2-1)*2);wav.writeInt16LE(Math.round(s0+(s1-s0)*fraction),44+i*2);}
  samples.push({language,requestId:'42004210-0000-4000-8000-00000000000'+samples.length,base64:wav.toString('base64')});
 }
 const {randomUUID}=await import('node:crypto');integrationGrantId=randomUUID();const nonce=randomBytes(32).toString('hex'),authSha256=createHash('sha256').update(nonce).digest('hex'),expiresAt=new Date(Date.now()+8*3600000).toISOString();
 for(const readOnly of [false,true]){const name=readOnly?'luna42-integration-status':'luna42-integration-background';await build({...options,stdin:{contents:`import {run} from '${source}/backend/test/luna42-staging-integration.mjs';export default async function(request,context){return run(request,context,${JSON.stringify({authSha256,expiresAt,sourceCommit:commit,readOnly,grantId:integrationGrantId,samples:readOnly?[]:samples})});}${readOnly?'':'export const config={background:true};'}`,resolveDir:source,sourcefile:name+'.mjs'},outfile:functions+'/'+name+'.mjs'});}
 integrationAuthFile=directory+'/luna42-integration-command-private.json';await writeFile(integrationAuthFile,JSON.stringify({nonce,expiresAt}),{mode:0o600,flag:'wx'});
}
if(luna42&&process.env.LUNA42_TRANSCRIPTION_APPROVED==='synthetic_audio_usd0.03'){
 const samples=[];
 const known=[['en','76cbb651f67b925278e64d5040ac7822e5efda4f78a655341ac6129b10c3785b','Luna, please recommend a short meditation for focus.'],['ru','8e8125e342ed33003069177509d2ea8d503722cd8e3fcd9d7fe9d5af091cfb85','Луна, подбери короткую медитацию для фокуса.'],['mixed','021b6a0002edc1d159a9c5e883e15f6a05be865f769c5ebf44d3f10a51d60dd6','Луна, открой Moon Garden, а затем дыхательную практику.']];
 for(const [language,hash,expected] of known){
  const original=await readFile('/tmp/luna41-voice-qa/'+language+'-sample.wav');assert.equal(createHash('sha256').update(original).digest('hex'),hash,'Only the reviewed synthetic fixture is allowed');assert.equal(original.readUInt32LE(24),24000);assert.equal(original.readUInt16LE(22),1);assert.equal(original.readUInt16LE(34),16);
  const length=Math.floor((original.length-44)/2*2/3),wav=Buffer.alloc(44+length*2);original.copy(wav,0,0,44);wav.writeUInt32LE(wav.length-8,4);wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);wav.writeUInt32LE(length*2,40);
  for(let i=0;i<length;i++){const offset=i*1.5,a=Math.floor(offset),fraction=offset-a,s0=original.readInt16LE(44+a*2),s1=original.readInt16LE(44+Math.min(a+1,(original.length-44)/2-1)*2);wav.writeInt16LE(Math.round(s0+(s1-s0)*fraction),44+i*2);}
  samples.push({language,expected,requestId:'42004200-0000-4000-8000-00000000000'+samples.length,base64:wav.toString('base64')});
 }
 const nonce=randomBytes(32).toString('hex'),authSha256=createHash('sha256').update(nonce).digest('hex'),transcriptionExpiresAt=new Date(Date.now()+8*60*60000).toISOString();
 for(const readOnly of [false,true]){const name=readOnly?'luna42-transcription-status':'luna42-transcription-background';await build({...options,stdin:{contents:`import {run} from '${source}/backend/test/luna42-staging-transcription.mjs';export default async function(request,context){return run(request,context,${JSON.stringify({authSha256,expiresAt:transcriptionExpiresAt,sourceCommit:commit,readOnly,samples:readOnly?[]:samples})});}${readOnly?'':'export const config={background:true};'}`,resolveDir:source,sourcefile:name+'.mjs'},outfile:functions+'/'+name+'.mjs'});}
 transcriptionAuthFile=directory+'/luna42-transcription-command-private.json';await writeFile(transcriptionAuthFile,JSON.stringify({nonce,expiresAt:transcriptionExpiresAt}),{mode:0o600,flag:'wx'});
}
if(process.env.LUNA41_FOUNDATION_REVIEW==='true'){
 assert.ok(luna41);const nonce=randomBytes(32).toString('hex'),authSha256=createHash('sha256').update(nonce).digest('hex');expiresAt=new Date(Date.now()+8*60*60000).toISOString();
 for(const readOnly of [false,true]){const name=readOnly?'luna41-qa-status':'luna41-qa-background';await build({...options,stdin:{contents:`import {run} from '${source}/backend/test/luna41-staging-foundation-worker.mjs';export default async function(request,context){return run(request,context,${JSON.stringify({authSha256,expiresAt,sourceCommit:commit,readOnly})});}${readOnly?'':'export const config={background:true};'}`,resolveDir:source,sourcefile:name+'.mjs'},outfile:functions+'/'+name+'.mjs'});}
 evaluationAuthFile=directory+'/luna41-qa-command-private.json';await writeFile(evaluationAuthFile,JSON.stringify({nonce,expiresAt}),{mode:0o600,flag:'wx'});
}
if(process.env.LUNA41_ACTION_APPROVED==='four_calls_usd0.02'||luna42&&process.env.LUNA42_ACTION_APPROVED==='four_calls_within_usd2.03'){
 assert.ok(luna41);const nonce=randomBytes(32).toString('hex'),authSha256=createHash('sha256').update(nonce).digest('hex'),actionExpiresAt=new Date(Date.now()+8*60*60000).toISOString();
 for(const readOnly of [false,true]){const name=readOnly?'luna41-action-status':'luna41-action-background';await build({...options,stdin:{contents:`import {run} from '${source}/backend/test/luna41-staging-actions.mjs';export default async function(request,context){return run(request,context,${JSON.stringify({authSha256,expiresAt:actionExpiresAt,sourceCommit:commit,readOnly,...(luna42?{release:'luna42'}:{})})});}${readOnly?'':'export const config={background:true};'}`,resolveDir:source,sourcefile:name+'.mjs'},outfile:functions+'/'+name+'.mjs'});}
 actionAuthFile=directory+'/luna41-action-command-private.json';await writeFile(actionAuthFile,JSON.stringify({nonce,expiresAt:actionExpiresAt}),{mode:0o600,flag:'wx'});
}
if(process.env.LUNA41_VOICE_APPROVED==='synthetic_audio_usd0.05'){
 assert.ok(luna41);const nonce=randomBytes(32).toString('hex'),authSha256=createHash('sha256').update(nonce).digest('hex'),voiceExpiresAt=new Date(Date.now()+8*60*60000).toISOString();
 for(const readOnly of [false,true]){const name=readOnly?'luna41-voice-status':'luna41-voice-background';await build({...options,stdin:{contents:`import {run} from '${source}/backend/test/luna41-staging-voice.mjs';export default async function(request,context){return run(request,context,${JSON.stringify({authSha256,expiresAt:voiceExpiresAt,sourceCommit:commit,readOnly})});}${readOnly?'':'export const config={background:true};'}`,resolveDir:source,sourcefile:name+'.mjs'},outfile:functions+'/'+name+'.mjs'});}
 voiceAuthFile=directory+'/luna41-voice-command-private.json';await writeFile(voiceAuthFile,JSON.stringify({nonce,expiresAt:voiceExpiresAt}),{mode:0o600,flag:'wx'});
}
if(process.env.LUNA41_EVALUATION_APPROVED==='400_calls_2_usd'||luna42&&process.env.LUNA42_EVALUATION_APPROVED==='300_calls_2_usd'){
 assert.notEqual(process.env.LUNA41_FOUNDATION_REVIEW,'true','Use the provider-free foundation worker after paid evaluation is finished');
 assert.ok(luna41,'Evaluation belongs only to the Luna 4.1 staging artifact');
 const nonce=randomBytes(32).toString('hex'),authSha256=createHash('sha256').update(nonce).digest('hex');expiresAt=new Date(Date.now()+8*60*60000).toISOString();
 for(const readOnly of [false,true]){const name=readOnly?'luna41-qa-status':'luna41-qa-background';await build({...options,stdin:{contents:`import {run} from '${source}/backend/test/luna41-staging-evaluation.mjs';export default async function(request,context){return run(request,context,${JSON.stringify({authSha256,expiresAt,sourceCommit:commit,readOnly,...(luna42?{release:'luna42'}:{})})});}${readOnly?'':'export const config={background:true};'}`,resolveDir:source,sourcefile:name+'.mjs'},outfile:functions+'/'+name+'.mjs'});}
 evaluationAuthFile=directory+'/luna41-qa-command-private.json';await writeFile(evaluationAuthFile,JSON.stringify({nonce,expiresAt}),{mode:0o600,flag:'wx'});
}
if(process.env.LUNA40_SMOKE_APPROVED==='owner-4-calls-usd0.03'){
 const nonce=randomBytes(32).toString('hex'),authSha256=createHash('sha256').update(nonce).digest('hex');expiresAt=new Date(Date.now()+90*60000).toISOString();
 await build({...options,stdin:{contents:`import {run} from '${source}/backend/test/luna40-staging-smoke.mjs';export default async function(request,context){return run(request,context,${JSON.stringify({authSha256,expiresAt,sourceCommit:commit,followup:process.env.LUNA40_SMOKE_FOLLOWUP==='true',finalCheck:process.env.LUNA40_SMOKE_FINAL_APPROVED==='owner-2-additional-calls-total-usd0.03'})});}export const config={background:true};`,resolveDir:source,sourcefile:'luna40-qa-background.mjs'},outfile:functions+'/luna40-qa-background.mjs'});
 authFile=directory+'/qa-command-private.json';await writeFile(authFile,JSON.stringify({nonce,expiresAt}),{mode:0o600,flag:'wx'});
}
const staging=await readFile(source+'/staging/netlify.toml','utf8');await writeFile(directory+'/netlify.toml','[build]\n publish="public"\n[functions]\n directory="functions"\n node_bundler="esbuild"\n'+staging.slice(staging.indexOf('[[headers]]')));
await writeFile(process.env.LUNA_STAGING_ARTIFACT_LOCATION??'/tmp/luna40-staging-location.json',JSON.stringify({directory,functions,sourceCommit:commit,authFile,evaluationAuthFile,voiceAuthFile,actionAuthFile,transcriptionAuthFile,integrationAuthFile,integrationGrantId,expiresAt}),{mode:0o600});
console.log(JSON.stringify({status:'PACKAGED_NOT_DEPLOYED',directory,sourceCommit:commit,siteId:'a634a7fc-1ecb-47fa-8b43-edd81a7e3694',functions:(await readdir(functions)).filter(file=>file.endsWith('.mjs')).map(file=>file.slice(0,-4)).sort(),secretsEmbedded:false}));
