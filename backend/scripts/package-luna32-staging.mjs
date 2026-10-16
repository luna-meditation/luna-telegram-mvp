// Builds a local artifact for the EXISTING QA site. Does not publish anything.
import {readFile,writeFile,cp,mkdir,mkdtemp,realpath} from 'node:fs/promises';
import {createRequire} from 'node:module';import {createHash,randomBytes} from 'node:crypto';
import {dirname,resolve} from 'node:path';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
assert.equal(process.versions.node.split('.')[0],'22');
const source=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),commit=execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim();
assert.equal(process.env.LUNA32_SOURCE_COMMIT,commit,'Commit and verify source before packaging');
execFileSync('git',['diff','--exit-code','HEAD','--','backend/src','backend/scripts','backend/test/luna32-staging-smoke.mjs','frontend/src','frontend/scripts','frontend/index.html','supabase/migrations/20261016112135_luna32_beta_ai_budget_and_dreams.sql'],{cwd:source});
const {build}=await import(createRequire(await realpath(source+'/frontend/node_modules/vite/package.json')).resolve('esbuild'));
const directory=await mkdtemp('/tmp/luna32-staging.'),functions=directory+'/functions';await mkdir(functions);await mkdir(directory+'/.netlify');
await cp(source+'/frontend/dist-staging',directory+'/public',{recursive:true});
await writeFile(directory+'/.netlify/state.json',JSON.stringify({siteId:'a634a7fc-1ecb-47fa-8b43-edd81a7e3694'}));
const catalog=await readFile(source+'/backend/dist/tarot-catalog.json','utf8'),compressed=(await readFile(source+'/backend/dist/data/geonames-cities15000.json.gz')).toString('base64'),metadata=await readFile(source+'/backend/dist/data/geonames-attribution.json','utf8'),astronomy=createRequire(source+'/backend/package.json').resolve('astronomy-engine');
const plugins=[{name:'verified-runtime-assets',setup(b){
 b.onLoad({filter:/\/dist\/tarot-policy\.js$/},async({path})=>{const text=await readFile(path,'utf8'),line=text.split('\n').find(l=>l.startsWith('const manifest = JSON.parse('));assert.ok(line);return{contents:text.replace(line,'const manifest = '+catalog+';'),loader:'js'};});
 b.onLoad({filter:/\/dist\/luna30-locations\.js$/},async({path})=>{const text=await readFile(path,'utf8'),needle="const compressed = readFileSync(new URL(directory + 'geonames-cities15000.json.gz', import.meta.url)), meta = JSON.parse(readFileSync(new URL(directory + 'geonames-attribution.json', import.meta.url), 'utf8'));";assert.ok(text.includes(needle));return{contents:text.replace(needle,`const compressed = Buffer.from('${compressed}','base64'),meta=${metadata};`),loader:'js'};});
 b.onLoad({filter:/\/dist\/luna30-astrology-engine\.js$/},async({path})=>{const text=await readFile(path,'utf8'),needle="createRequire(import.meta.url)('astronomy-engine')";assert.ok(text.includes(needle));return{contents:`import lunaAstronomy from ${JSON.stringify(astronomy)};\n`+text.replace(needle,'lunaAstronomy'),loader:'js'};});
}}];
const options={bundle:true,packages:'bundle',format:'esm',platform:'node',target:'node22',external:['pg-native'],banner:{js:"import {createRequire as __lunaCreateRequire} from 'node:module'; const require=__lunaCreateRequire(import.meta.url);"},plugins,logLevel:'warning'};
await build({...options,entryPoints:[source+'/backend/staging/functions/luna-staging.mjs'],outfile:functions+'/luna-staging.mjs'});
const nonce=randomBytes(32).toString('hex'),authSha256=createHash('sha256').update(nonce).digest('hex'),expiresAt=new Date(Date.now()+90*60000).toISOString();
await build({...options,stdin:{contents:`import {run} from '${source}/backend/test/luna32-staging-smoke.mjs';export default async function(request,context){return run(request,context,${JSON.stringify({authSha256,expiresAt,sourceCommit:commit})});}export const config={background:true};`,resolveDir:source,sourcefile:'luna32-qa-background.mjs'},outfile:functions+'/luna32-qa-background.mjs'});
const staging=await readFile(source+'/staging/netlify.toml','utf8');await writeFile(directory+'/netlify.toml','[build]\n publish="public"\n[functions]\n directory="functions"\n node_bundler="esbuild"\n'+staging.slice(staging.indexOf('[[headers]]')));
const authFile=directory+'/qa-command-private.json';await writeFile(authFile,JSON.stringify({nonce,expiresAt}),{mode:0o600,flag:'wx'});
const location=process.env.LUNA32_ARTIFACT_LOCATION??'/tmp/luna32-staging-location.json';
await writeFile(location,JSON.stringify({directory,functions,sourceCommit:commit,authFile,expiresAt}),{mode:0o600});
console.log(JSON.stringify({status:'PACKAGED_NOT_DEPLOYED',directory,sourceCommit:commit,expiresAt,credentialPrinted:false}));
