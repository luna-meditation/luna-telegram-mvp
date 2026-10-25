import {spawn} from 'node:child_process';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {homedir,tmpdir} from 'node:os';
if(Number(process.versions.node.split('.')[0])!==22)throw Error('Luna local QA requires Node 22.');
const root=fileURLToPath(new URL('../',import.meta.url)),output=join(root,'qa/intelligence-core-v1/local'),node=process.execPath;
await mkdir(output,{recursive:true});
const env={PATH:dirname(node)+':/usr/local/bin:/usr/bin:/bin',HOME:homedir(),TMPDIR:tmpdir(),DOTENV_CONFIG_PATH:'/dev/null',BOT_TOKEN:'synthetic-local',BOT_USERNAME:'synthetic_test',MINI_APP_URL:'http://localhost',SUPABASE_URL:'http://127.0.0.1:9',SUPABASE_SERVICE_ROLE_KEY:'synthetic-local',NODE_OPTIONS:'--import '+JSON.stringify(join(root,'backend/test/intelligence-core-network-guard.mjs')),GIT_TERMINAL_PROMPT:'0',GIT_NO_LAZY_FETCH:'1',VITE_API_URL:'/api',VITE_DEPLOY_ENV:'local-core-qa'};
for(const match of (await readFile(join(root,'netlify.toml'),'utf8')).matchAll(/^\s*(VITE_[A-Z0-9_]+)\s*=\s*"(true|false)"/gm))env[match[1]]=match[2];
const files=async(folder,pattern)=>(await readdir(join(root,folder))).filter(n=>pattern.test(n)).sort();
const tasks=[
 ['backend-tests','backend',[[node,'--import','tsx','--test','--test-concurrency=4',...(await files('backend/src',/\.test\.ts$/)).map(n=>'src/'+n)]]],
 ['frontend-tests','frontend',[[node,'--test','--test-concurrency=4',...(await files('frontend/test',/\.test\.mjs$/)).map(n=>'test/'+n)]]],
 ...['backend','frontend'].flatMap(p=>[[p+'-typecheck',p,[[node,'node_modules/typescript/bin/tsc','--noEmit']]],[p+'-lint',p,[[node,'node_modules/eslint/bin/eslint.js',p==='backend'?'src/**/*.ts':'src/**/*.{ts,tsx}']]]]),
 ['backend-build','backend',[[node,'node_modules/typescript/bin/tsc'],[node,'scripts/package-tarot-catalog.mjs']]],
 ['frontend-build','frontend',[[node,'node_modules/vite/bin/vite.js','build','--mode','development']]],
 ['website-build','website',[[node,'node_modules/vite/bin/vite.js','build','--mode','development']]]
];
async function run([name,folder,steps]){
 const started=performance.now(),log=createWriteStream(join(output,name+'.log'));let code=0;
 for(const [command,...args] of steps){code=await new Promise(resolve=>{const p=spawn(command,args,{cwd:join(root,folder),env,stdio:['ignore','pipe','pipe']});p.stdout.pipe(log,{end:false});p.stderr.pipe(log,{end:false});const timer=setTimeout(()=>p.kill('SIGTERM'),240000);p.on('error',()=>{clearTimeout(timer);resolve(127);});p.on('close',value=>{clearTimeout(timer);resolve(value??124);});});if(code)break;}
 await new Promise(resolve=>log.end(resolve));const result={check:name,exitCode:code,seconds:Math.round((performance.now()-started)/10)/100};console.log(JSON.stringify(result));return result;
}
let index=0;const results=[];
await Promise.all(Array.from({length:4},async()=>{while(index<tasks.length){const task=tasks[index++];results.push(await run(task));}}));
await writeFile(join(output,'commands.json'),JSON.stringify({node:process.version,syntheticConfiguration:true,externalNetworkBlocked:true,productionDeploy:false,results},null,2)+'\n');
if(results.some(r=>r.exitCode))process.exitCode=1;
