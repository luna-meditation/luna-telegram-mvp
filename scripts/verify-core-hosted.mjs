// Opt-in acceptance test: compiled candidate -> localhost HTTP -> isolated Supabase.
// Never load production environment files or contact model/payment providers.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHmac,randomBytes,randomUUID,createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';

assert.equal(process.versions.node.split('.')[0],'22');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const ref='funvzpmpbgazsisehiru',owners=[880025101,880025102];
const secret=readFileSync('/private/tmp/luna-staging-secrets.env','utf8').match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim();
assert.ok(secret?.startsWith('sb_secret_'),'An owner-provided isolated staging secret is required');
const token='local-qa:'+randomBytes(32).toString('hex');
for(const name of Object.keys(process.env))if(!['PATH','HOME','TMPDIR','SSL_CERT_FILE','SSL_CERT_DIR','NODE_EXTRA_CA_CERTS'].includes(name))delete process.env[name];
Object.assign(process.env,{DOTENV_CONFIG_PATH:'/dev/null',NODE_ENV:'production',BOT_TOKEN:token,BOT_USERNAME:'luna_core_local_qa',MINI_APP_URL:'https://luna-staging-itfl.netlify.app',SUPABASE_URL:`https://${ref}.supabase.co`,SUPABASE_SERVICE_ROLE_KEY:secret,STAGING_MODE:'true',STAGING_HOST:'netlify',STAGING_SUPABASE_PROJECT_REF:ref,STAGING_TELEGRAM_IDS:owners.join(','),RUN_MIGRATIONS:'false',ALLOW_UNVERIFIED_TELEGRAM_WEBAPP:'false',REMINDER_SCHEDULER_ENABLED:'false',AI_CHAT_ENABLED:'false',LUNA30_ASTROLOGY_AI_ENABLED:'false',AI_MEMORY_ENABLED:'true',AI_PROMPT_VERSION:'intelligence-v3',LUNA32_ENABLED:'true'});
for(const key of ['PERSONALIZATION','PERSONAL_MEMORY','COSMOS_V2','LUNA_INTELLIGENCE','ASTROLOGY','TAROT_HISTORY','TAROT_DAILY','DAILY_CARD_V2','TAROT_SPREADS'])process.env['FEATURE_'+key]='true';
const fetchReal=globalThis.fetch,requests={local:0,staging:0,blocked:0};
globalThis.fetch=async(input,init)=>{
 const url=new URL(input instanceof Request?input.url:input);
 if(url.protocol==='https:'&&url.hostname===`${ref}.supabase.co`)requests.staging++;
 else if(url.protocol==='http:'&&url.hostname==='127.0.0.1')requests.local++;
 else{requests.blocked++;throw new Error('External provider disabled for hosted Core acceptance');}
 return fetchReal(input,{...init,signal:init?.signal??AbortSignal.timeout(15000)});
};
const {supabase:db}=await import('../backend/dist/db.js');
const checks=[],created=[];let server,base,failure;
function pass(name){checks.push({name,status:'PASS'});console.log(JSON.stringify({check:name,status:'PASS'}));}
function signed(id,{age=0,language='en'}={}){
 const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)-age),user:JSON.stringify({id,first_name:'Synthetic Acceptance',language_code:language}),query_id:randomUUID()});
 const key=createHmac('sha256','WebAppData').update(token).digest();
 const body=[...p].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
 p.set('hash',createHmac('sha256',key).update(body).digest('hex'));return p.toString();
}
async function api(path,{owner=owners[0],method='GET',body,status=200,auth}={}){
 assert.ok(requests.local<100,'Finite request limit exceeded');
 const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(auth===null?{}:{'x-telegram-init-data':auth??signed(owner)})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const data=await response.json();
 assert.equal(response.status,status,`${method} ${path}: ${data.code??data.error??'unexpected status'}`);
 return data;
}
async function noFixtures(){
 const tables=['users','user_memories','luna_personal_profiles','luna30_birth_profiles','luna30_chart_cache','luna4_portrait_snapshots','luna4_portrait_state','ai_conversations','ai_messages','luna42_discoveries','luna40_language_preferences','luna35_funnel_events','luna42_experience_events'];
 for(const table of tables){const r=await db.from(table).select('telegram_id',{count:'exact',head:true}).in('telegram_id',owners);assert.equal(r.status,200,`${table}: HEAD status`);assert.equal(r.error,null,`${table}: ${r.error?.code}`);assert.equal(r.count,0,`${table}: synthetic fixture already present`);}
}
try{
 // The key must authenticate to this exact staging project before any write.
 await noFixtures();pass('isolated-project-key-and-clean-fixture-precondition');
 const {app}=await import('../backend/dist/server.js');
 server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});base=`http://127.0.0.1:${server.address().port}`;
 await api('/api/universe',{auth:null,status:401});
 await api('/api/universe',{auth:signed(owners[0])+'x',status:401});
 await api('/api/universe',{auth:signed(owners[0],{age:90000}),status:401});
 await api('/api/universe',{owner:880025199,status:403});pass('signed-auth-expiry-tampering-and-staging-allowlist');
 for(const owner of owners){await api('/api/users/sync',{owner,method:'POST',body:{}});created.push(owner);}
 pass('real-http-user-bootstrap');
 const profile={display_name:'Synthetic QA',interests:['astrology','meditation'],preferences:'Calm concise answers',birth_date:null,birth_time:null,birth_place:null,ai_context_consent:true};
 await api('/api/personalization',{method:'PUT',body:profile});
 await api('/api/luna/memory',{method:'PATCH',body:{enabled:true}});pass('explicit-ai-context-and-memory-consent');
 const memory={category:'goals',key:'drawing_goal',value:'I want to practise drawing twice a week.',confirmed:false};
 let saved=await api('/api/universe/memories',{method:'POST',body:memory,status:201});
 let portrait=await api('/api/universe/portrait');
 assert.equal(portrait.persistence.state,'saved');assert.equal(portrait.sections.direction.length,0);pass('pending-memory-excluded-from-saved-portrait');
 saved=await api('/api/universe/memories/'+saved.id,{method:'PATCH',body:{...memory,confirmed:true,revision:saved.revision}});
 portrait=await api('/api/universe/portrait');assert.equal(portrait.sections.direction[0].text,memory.value);
 const cached=await api('/api/universe/portrait');assert.equal(cached.persistence.cached,true);assert.equal(cached.persistence.revision,portrait.persistence.revision);pass('confirmed-memory-persisted-and-portrait-cache-reused');
 const {getAiPersonalProfile}=await import('../backend/dist/personal-memory.js');
 let relevant=await getAiPersonalProfile(owners[0],'Help me keep practising drawing');assert.ok(relevant.confirmed_memories?.some(m=>m.value===memory.value));
 const unrelated=await getAiPersonalProfile(owners[0],'Help me plan volunteering');assert.ok(!unrelated.confirmed_memories?.some(m=>m.value===memory.value));
 const refused=await getAiPersonalProfile(owners[0],'Do not use my saved memories');assert.equal(refused.ai_context_consent,false);pass('actual-sdk-memory-relevance-and-turn-level-refusal');
 const foreign=await api('/api/universe',{owner:owners[1]});assert.deepEqual(foreign.memories,[]);
 await api('/api/universe/memories/'+saved.id,{owner:owners[1],method:'PATCH',body:{...memory,confirmed:true,revision:saved.revision},status:409});pass('cross-owner-memory-read-and-edit-denied');
 const operation={operationId:randomUUID(),section:'direction',language:'en'};
 const opened=await api('/api/universe/portrait/explore',{method:'POST',body:operation});
 const replay=await api('/api/universe/portrait/explore',{method:'POST',body:operation});assert.equal(replay.conversationId,opened.conversationId);assert.equal(replay.message.id,opened.message.id);assert.equal(replay.cached,true);
 assert.ok(opened.message.content.includes(memory.value));
 await api('/api/luna/conversations/'+opened.conversationId,{owner:owners[1],status:404});pass('contextual-luna-navigation-persisted-idempotent-and-private');
 const oldRevision=saved.revision;saved=await api('/api/universe/memories/'+saved.id,{method:'PATCH',body:{...memory,value:'I want to practise drawing once a week.',confirmed:true,revision:oldRevision}});
 await api('/api/universe/memories/'+saved.id,{method:'PATCH',body:{...memory,confirmed:true,revision:oldRevision},status:409});
 await api('/api/universe/portrait/explore',{method:'POST',body:operation,status:409});
 portrait=await api('/api/universe/portrait');assert.equal(portrait.sections.direction[0].text,saved.memory_value);pass('memory-correction-stale-write-and-context-replay-invalidation');
 const reflection={category:'reflections',key:'drawing_reflection',value:'Drawing slowly helps me notice details.',confirmed:true,kind:'symbolic'};
 let reflected=await api('/api/universe/memories',{method:'POST',body:reflection,status:201});
 const discoveryBody={requestId:randomUUID(),kind:'reflection',referenceId:reflected.id,title:'A slower creative rhythm'};
 let discovered=(await api('/api/universe/discoveries',{method:'POST',body:discoveryBody})).discovery;
 assert.equal((await api('/api/universe/discoveries',{method:'POST',body:discoveryBody})).discovery.id,discovered.id);
 assert.ok((await api('/api/universe/discoveries')).discoveries.some(d=>d.id===discovered.id));
 assert.equal((await api('/api/universe/discoveries/'+discovered.id+'/open')).referenceId,reflected.id);
 await api('/api/universe/discoveries/'+discovered.id+'/open',{owner:owners[1],status:404});pass('saved-discovery-create-list-source-open-and-owner-isolation');
 discovered=(await api('/api/universe/discoveries/'+discovered.id,{method:'PATCH',body:{requestId:randomUUID(),title:'A clearer creative rhythm',expectedRevision:discovered.revision}})).discovery;
 const source={id:reflected.id,updatedAt:reflected.updated_at};
 const sourceOpening={operationId:randomUUID(),section:'discoveries',language:'ru',memory:source};
 const ru=await api('/api/universe/portrait/explore',{method:'POST',body:sourceOpening});assert.ok(ru.message.content.includes(reflection.value));assert.ok(/символическое размышление/.test(ru.message.content));pass('discovery-correction-and-russian-contextual-reflection');
 reflected=await api('/api/universe/memories/'+reflected.id,{method:'PATCH',body:{...reflection,value:'Drawing helps me focus on a single detail.',revision:reflected.revision}});
 await api('/api/universe/portrait/explore',{method:'POST',body:sourceOpening,status:409});
 await api('/api/universe/memories/'+reflected.id,{method:'DELETE'});
 assert.ok(!(await api('/api/universe/discoveries')).discoveries.some(d=>d.id===discovered.id));
 await api('/api/universe/discoveries/'+discovered.id+'/open',{status:404});
 await api('/api/universe/discoveries/'+discovered.id,{method:'DELETE'});pass('changed-and-deleted-discovery-source-cannot-be-replayed');
 const locations=await api('/api/astrology/locations?q=London');const london=locations.locations.find(l=>l.placeId==='geonames:2643743');assert.ok(london);
 const birth={subjectKind:'self',label:'Synthetic J2000',date:'2000-01-01',time:'12:00',placeId:london.placeId,consent:true};
 const birthSaved=(await api('/api/astrology/profiles',{method:'POST',body:birth,status:201})).profile;
 const calculated=await api('/api/astrology/profiles/'+birthSaved.id+'/chart',{method:'POST',body:{}});
 const chart=calculated.chart.calculation;assert.equal(chart.planets.length,10);assert.equal(chart.houses.length,12);assert.equal(chart.timePrecision,'exact');assert.equal(chart.utcInstant,'2000-01-01T12:00:00Z');assert.ok(chart.aspects.length>0);assert.ok(chart.planets.find(p=>p.id==='sun').longitude>280&&chart.planets.find(p=>p.id==='sun').longitude<281);
 assert.equal((await api('/api/astrology/profiles/'+birthSaved.id+'/chart',{method:'POST',body:{}})).cached,true);
 await api('/api/astrology/charts/'+calculated.chart.id,{owner:owners[1],status:404});pass('real-natal-calculation-cache-and-cross-owner-privacy');
 portrait=await api('/api/universe/portrait');assert.equal(portrait.chartStatus,'current');assert.equal(portrait.chart.id,calculated.chart.id);assert.ok(portrait.numerology);pass('my-cosmos-uses-verified-owned-chart-and-numerology');
 await api('/api/astrology/profiles/'+birthSaved.id,{method:'PUT',body:{...birth,time:null,revision:birthSaved.revision}});
 const unknown=(await api('/api/astrology/profiles/'+birthSaved.id+'/chart',{method:'POST',body:{}})).chart.calculation;
 assert.equal(unknown.ascendant,null);assert.deepEqual(unknown.houses,[]);assert.deepEqual(unknown.aspects,[]);assert.equal(unknown.timePrecision,'unknown');pass('unknown-birth-time-shows-incomplete-calculation');
 await api('/api/profile/language',{method:'POST',body:{language:'ru'}});assert.equal((await api('/api/universe')).identity.language,'ru');
 await api('/api/profile/language',{method:'POST',body:{language:'en'}});assert.equal((await api('/api/universe')).identity.language,'en');pass('real-ru-en-profile-persistence');
 await api('/api/universe/memories/'+saved.id,{method:'DELETE'});portrait=await api('/api/universe/portrait');assert.equal(portrait.sections.direction.length,0);
 await api('/api/personalization',{method:'PUT',body:{...profile,ai_context_consent:false}});
 assert.equal((await api('/api/universe/portrait')).memoryPermission,false);pass('deletion-and-consent-revocation-invalidate-personal-context');
 await api('/api/payments/test-disabled',{method:'POST',body:{},status:403});pass('financial-routes-disabled-in-isolated-test');
}catch(error){failure={message:String(error.message).slice(0,500),stack:String(error.stack).split('\n').slice(1,4)};console.error(JSON.stringify({status:'FAIL',...failure}));}
finally{
 if(server)await new Promise(resolve=>server.close(resolve));
 if(created.length){
  // Remove source records while the parent is still present. The existing
  // invalidation trigger updates its FK-backed state on every source deletion.
  for(const table of ['user_memories','luna_personal_profiles','luna30_birth_profiles']){
   const source=await db.from(table).delete().in('telegram_id',created);assert.equal(source.error,null,`${table}: fixture cleanup`);
  }
  const r=await db.from('users').delete().in('telegram_id',created);assert.equal(r.error,null,`Synthetic fixture cleanup: ${r.error?.code}`);
 }
 await noFixtures();pass('all-owned-staging-fixtures-removed');
 assert.equal(requests.blocked,0,'Unexpected external network attempt');
 const report={release:'luna-intelligence-core-v1',status:failure?'FAIL':'PASS',capturedAt:new Date().toISOString(),stagingProjectId:ref,sourceBaseCommit:'d68968805e4f52f78dd108025c87f55664f03e00',compiledServerSha256:createHash('sha256').update(readFileSync(resolve(root,'backend/dist/server.js'))).digest('hex'),realHttp:true,realSupabaseSdk:true,syntheticOwnersOnly:true,productionWrites:0,providerCalls:0,realFinancialOperations:0,cleanup:'PASS',requests,checks,...(failure?{failure}:{})};
 const out=resolve(root,'qa/intelligence-core-v1/hosted');mkdirSync(out,{recursive:true});writeFileSync(resolve(out,'candidate-http.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,checks:checks.length,requests,cleanup:report.cleanup}));
}
if(failure)process.exitCode=1;
