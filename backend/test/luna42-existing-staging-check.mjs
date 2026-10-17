// Execute the reviewed staging workers locally against the SAME isolated
// staging database. No cloud publication, plaintext secret file or raw logs.
// Normal server/global generation switches are not widened by this runner.
import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {randomBytes,createHash} from 'node:crypto';
assert.equal(process.versions.node.split('.')[0],'22');
const site='a634a7fc-1ecb-47fa-8b43-edd81a7e3694',cli=process.env.LUNA_NETLIFY_CLI;
assert.ok(cli&&cli.endsWith('/netlify-cli/bin/run.js'),'Provide the existing Netlify CLI executable');
let values;
try{values=JSON.parse(execFileSync(process.execPath,[cli,'env:list','--site',site,'--context','production','--scope','functions','--json'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:1024*1024}));}catch{throw Error('Staging configuration could not be read securely; no provider call dispatched.');}
assert.ok(values&&typeof values==='object'&&!Array.isArray(values),'Unexpected resolved environment format');
for(const key of ['BOT_TOKEN','SUPABASE_SERVICE_ROLE_KEY','OPENAI_API_KEY'])assert.ok(typeof values[key]==='string'&&values[key].length>10,'Staging credential missing; no values are logged');
assert.equal(values.SUPABASE_URL,'https://funvzpmpbgazsisehiru.supabase.co');
assert.equal(values.STAGING_MODE,'true');assert.equal(values.STAGING_HOST,'netlify');
assert.equal(values.BOT_USERNAME,'luna_staging_qa_eger_bot');
const credentialShapes={database:/^sb_secret_/.test(values.SUPABASE_SERVICE_ROLE_KEY)||values.SUPABASE_SERVICE_ROLE_KEY.split('.').length===3,openai:values.OPENAI_API_KEY.startsWith('sk-'),telegram:/^[0-9]+:/.test(values.BOT_TOKEN)};
if(process.argv.includes('--inspect')){console.log(JSON.stringify({status:'CONFIG_PRESENT_NOT_AUTHENTICATED',site,project:'funvzpmpbgazsisehiru',credentialShapes,secretsPrinted:false,providerCalls:0}));process.exit(0);}
assert.ok(Object.values(credentialShapes).every(Boolean),'CLI returned masked credentials. Use the approved staging runtime worker; do not copy or print secrets. No provider call dispatched.');
const mode=process.argv.includes('--foundation')?'foundation':process.argv.includes('--actions')?'actions':null;assert.ok(mode,'Choose --inspect, --foundation or --actions');
if(mode==='actions')assert.equal(process.env.LUNA42_ACTION_APPROVED,'four_calls_within_usd2.03','Explicit bounded provider approval required');
// Refuse any accidentally inherited production environment before server import.
for(const key of ['DATABASE_URL','WEBHOOK_URL','LUNA30_QA_ENABLED','LUNA21_QA_ENABLED','RELEASE_QA_TAROT_ENABLED','FEATURE_TAROT_RELEASE_AI_QA'])delete process.env[key];
Object.assign(process.env,values,{RUN_MIGRATIONS:'false',REMINDER_SCHEDULER_ENABLED:'false',STAGING_SETUP_QA_BOT:'false'});
globalThis.Netlify={env:{get:key=>process.env[key]}};
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();assert.match(sourceCommit,/^[a-f0-9]{40}$/);
const dirty=execFileSync('git',['diff','--name-only','HEAD','--','backend/src','backend/scripts','backend/test','frontend/src','supabase/migrations'],{encoding:'utf8'}).trim();assert.equal(dirty,'','Commit reviewed source before real staging checks');
const nonce=randomBytes(32).toString('hex'),options={authSha256:createHash('sha256').update(nonce).digest('hex'),expiresAt:new Date(Date.now()+600000).toISOString(),sourceCommit,release:'luna42',readOnly:false},context={site:{id:site},ip:'127.0.0.1'},url='https://luna-staging-itfl.netlify.app/qa/command';
const {run}=await import(mode==='actions'?'./luna41-staging-actions.mjs':'./luna41-staging-foundation-worker.mjs');
const response=await run(new Request(url,{method:'POST',headers:{authorization:`Bearer ${nonce}`,'content-type':'application/json'},body:JSON.stringify({action:'foundation'})}),context,options);assert.equal(response.status,204);
const {supabase:db}=await import('../dist/db.js'),name=mode==='actions'?'luna42-action-language-20261017-v1':'luna41-foundation-'+sourceCommit.slice(0,12),result=await db.from('luna30_qa_report_runs').select('state,result').eq('run_name',name).single();assert.ifError(result.error);
// The workers persist only synthetic QA messages and metered counts. Secrets,
// signed Telegram initData and authorization headers are never returned.
console.log(JSON.stringify({execution:'local worker with real existing staging backend/database',...result.data}));
assert.equal(result.data.state,'completed');
