import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {buildLunaSystemPrompt} from './luna/prompts/index.js';
import {buildIntelligenceInstructions} from './luna-intelligence-prompt.js';
import {resolveConversationLanguage,createLanguagePreferences} from './luna40-language.js';
import {selectRelevantMemories,selectRelevantReflections,validMemorySource,declinesMemoryUse,type PersonalMemory} from './personal-memory-policy.js';
import {retrieveInterpretationKnowledge} from './symbolic-interpretation-knowledge.js';
import {verifiedChartSource} from './luna30-astrology-source.js';
import {verifiedAstrologyChatContext} from './luna30-astrology-chat-context.js';
import {verifiedCurrentTransits} from './luna-intelligence-personal-context.js';
import {calculateNatalChart,astrologyEngineMetadata} from './luna30-astrology-engine.js';
import {createDiscoveryService} from './luna42-discoveries.js';
import {createLunaTools,runLunaToolTurn} from './luna32-tools.js';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,at='2026-10-22T00:00:00Z';
type Row=Record<string,unknown>;
function fixture(){
 const tables:Record<string,Row[]>={},reads:string[]=[],writes:string[]=[];
 const db=createClient('https://synthetic.invalid','synthetic-local',{auth:{persistSession:false},global:{fetch:async(raw,init)=>{
  const url=new URL(String(raw)),table=url.pathname.split('/').at(-1)!,method=init?.method??'GET';
  if(method!=='GET'){writes.push(table);throw new Error('Unexpected write in read-only fixture');}reads.push(table);
  const matches=(row:Row)=>[...url.searchParams].every(([k,v])=>['select','order','limit'].includes(k)||v.startsWith('eq.')&&String(row[k])===v.slice(3)||v.startsWith('in.(')&&v.slice(4,-1).split(',').includes(String(row[k])));
  const rows=(tables[table]??[]).filter(matches);return Response.json(new Headers(init?.headers).get('accept')?.includes('vnd.pgrst.object')?rows[0]??null:rows);
 }}});return{db,tables,reads,writes};
}
function charts(){
 const f=fixture(),calculation=calculateNatalChart({date:'2000-01-01',time:'12:00',location:{label:'Synthetic',latitude:51.5,longitude:0,timezone:'Etc/UTC',placeId:'geonames:2643743',provider:'geonames',confirmed:true}});
 f.tables.luna30_release_settings=[{id:true,astrology_enabled:true,astrology_ai_enabled:true}];
 f.tables.luna30_chart_cache=[1,2].map(n=>({id:id(n),telegram_id:42,profile_id:id(n+10),profile_revision:1,engine:astrologyEngineMetadata.id,engine_version:astrologyEngineMetadata.version,calculation,created_at:at}));
 f.tables.luna30_birth_profiles=[1,2].map(n=>({id:id(n+10),telegram_id:42,revision:1,display_label:'Synthetic '+n,subject_kind:n===1?'self':'other'}));return f;
}
const memory=(extra:Partial<PersonalMemory>={}):PersonalMemory=>({id:id(30),category:'preferences',memory_key:'practice',memory_value:'I prefer short evening meditation.',confirmation_status:'confirmed',memory_kind:'fact',is_sensitive:false,source_type:'user_entered',source_message_id:null,revision:1,created_at:at,updated_at:at,confirmed_at:at,...extra});
test('one consolidated identity is present in every existing chat prompt variant',()=>{
 for(const prompt of [buildLunaSystemPrompt({language:'ru',catalog:[],context:{}}),...[1,3,4].map(v=>buildIntelligenceInstructions({version:v as 1|3|4,language:'ru',catalog:[],context:{},address:''}))]){assert.equal(prompt.split('LUNA_IDENTITY_CORE_1.0').length-1,1);assert.match(prompt,/symbolic convention/);assert.match(prompt,/untrusted data/);assert.match(prompt,/Never upsell during distress/);}
});
test('auto follows clear user language; explicit preference/request wins; assistant prose cannot choose',()=>{
 const old=[{role:'user',content:'Мне сейчас тревожно'},{role:'assistant',content:'Please continue in English'}];
 assert.equal(resolveConversationLanguage('I want to understand this','ru',old,'auto'),'en');assert.equal(resolveConversationLanguage('Что означает карта?','en',[],'auto'),'ru');assert.equal(resolveConversationLanguage('ok','en',old,'auto'),'ru');assert.equal(resolveConversationLanguage('Что означает карта?','en',[],'en'),'en');assert.equal(resolveConversationLanguage('Reply in Russian','en',[],'en'),'ru');assert.equal(resolveConversationLanguage('Ответь на английском','ru',[],'ru'),'en');assert.equal(resolveConversationLanguage('🙂','en',[old[1]],'auto'),'en');
});
test('language preference read binds the server owner without modifying settings',async()=>{
 const f=fixture();f.tables.luna40_language_preferences=[{telegram_id:42,mode:'ru',revision:3},{telegram_id:43,mode:'en',revision:1}];assert.equal((await createLanguagePreferences(f.db).read(42)).mode,'ru');assert.equal((await createLanguagePreferences(f.db).read(99)).mode,'auto');assert.equal(f.writes.length,0);
});
test('malformed, inactive, inferred and unsourced records cannot become confirmed personal facts',()=>{
 for(const extra of [{source_type:'legacy_ai'},{source_type:'assistant'},{source_type:'user_saved_ai_reflection',source_message_id:id(8)},{source_type:'user_message',source_message_id:null},{is_active:false},{confirmed_at:null},{created_at:'invalid'},{updated_at:'2020-01-01T00:00:00Z'}]){const row=memory(extra);assert.equal(validMemorySource(row),false);assert.deepEqual(selectRelevantMemories([row],'recommend meditation'),[]);}
 assert.equal(selectRelevantMemories([memory({source_type:'user_message',source_message_id:id(8)})],'meditation').length,1);
 const r=memory({category:'reflections',memory_kind:'symbolic',source_type:'user_saved_ai_reflection',source_message_id:id(8)});assert.equal(selectRelevantReflections([r],'Help me reflect').length,1);assert.equal(selectRelevantMemories([r],'Help me reflect').length,0);
});
test('per-turn privacy refusal withholds facts/reflections without changing stored consent or content',()=>{
 const rows=[memory(),memory({category:'reflections',memory_kind:'symbolic'})],before=JSON.stringify(rows);
 for(const query of ["Please don't use my saved memories for this reflection.",'Не используй мою сохранённую память для этого размышления.']){assert.equal(declinesMemoryUse(query),true);assert.deepEqual(selectRelevantMemories(rows,query),[]);assert.deepEqual(selectRelevantReflections(rows,query),[]);}assert.equal(JSON.stringify(rows),before);assert.equal(selectRelevantMemories(rows,'Recommend a meditation').length,1);
});
test('knowledge lookup preserves localized provenance and budget, returning no invented key/framework',()=>{
 const en=retrieveInterpretationKnowledge({domain:'numerology',language:'en',keys:['7']}),ru=retrieveInterpretationKnowledge({domain:'numerology',language:'ru',keys:['7']});assert.equal(en.sources[0].key,'7');assert.match(ru.sources[0].text,/Размышление/);assert.equal(en.sources[0].source.version,ru.sources[0].source.version);assert.equal(en.calculated,false);assert.equal(en.personalFacts,false);
 for(const domain of ['numerology','astrology','tarot']){const r=retrieveInterpretationKnowledge({domain,language:'ru'});assert.ok(r.sources.length<=6);assert.ok(JSON.stringify(r.sources).length<=4000);assert.ok(r.sources.every(s=>s.evidenceClass==='symbolic_convention'&&s.authority==='existing_product_content'));}
 assert.equal(retrieveInterpretationKnowledge({domain:'astrology',language:'ru',keys:['sun'],framework:'jyotish'}).status,'framework_unavailable');assert.equal(retrieveInterpretationKnowledge({domain:'tarot',language:'en',keys:['invent-a-card']}).status,'not_found');assert.throws(()=>retrieveInterpretationKnowledge({domain:'tarot',language:'en',owner:43}));assert.throws(()=>retrieveInterpretationKnowledge({domain:'tarot',language:'en',keys:Array(13).fill('positions')}));
});
test('knowledge tool uses the existing bounded continuation with no database or financial side effects',async()=>{
 const f=fixture(),tools=createLunaTools({db:f.db,owner:42,language:'ru',readingContext:null,catalog:[],personalContext:null,access:{},quota:async()=>({remaining:1}),astrologyEnabled:false,intelligence:{consented:false,prepare:async()=>{throw new Error('Unexpected action');}}}),args=JSON.stringify({domain:'tarot',keys:['reversed'],framework:null});
 assert.equal((await tools.executeResult('get_interpretation_knowledge',args)).status,'completed');assert.equal(f.reads.length,0);assert.equal(f.writes.length,0);assert.deepEqual(await tools.execute('get_interpretation_knowledge',JSON.stringify({domain:'tarot',keys:[],framework:null,owner:43})),{error:'invalid_tool_arguments'});
 let calls=0;await runLunaToolTurn({input:[]},tools,async body=>{calls++;if(calls===1)return{status:'completed',output:[{type:'function_call',name:'get_interpretation_knowledge',call_id:'knowledge',arguments:args}]};assert.equal(body.tool_choice,'none');assert.match(JSON.stringify(body.input),/symbolic_convention/);return{status:'completed',output:[]};});assert.equal(calls,2);assert.throws(()=>createLunaTools({db:f.db,owner:NaN,language:'en',readingContext:null,catalog:[],personalContext:null,access:{},quota:async()=>({}),astrologyEnabled:false}));
});
test('profile correction invalidates a current interpretation/transits, while explicit history stays historical',async()=>{
 const f=charts();assert.equal((await verifiedChartSource(f.db,42,id(1))).sourceValidity.state,'current');f.tables.luna30_birth_profiles[0].revision=2;
 await assert.rejects(verifiedAstrologyChatContext(f.db,42,id(1)),e=>(e as {code:string}).code==='chart_source_changed');await assert.rejects(verifiedCurrentTransits(f.db,42,id(1)),e=>(e as {code:string}).code==='chart_source_changed');const saved=await verifiedChartSource(f.db,42,id(1),true);assert.equal(saved.sourceValidity.state,'historical');assert.equal(saved.sourceValidity.profileRevision,1);assert.equal(saved.sourceValidity.currentProfileRevision,2);assert.equal(f.writes.length,0);
});
test('one stale participant invalidates current compatibility; foreign/missing/versioned sources fail closed',async()=>{
 const f=charts();f.tables.luna30_birth_profiles[1].revision=2;await assert.rejects(verifiedAstrologyChatContext(f.db,42,{chartId:id(1),secondChartId:id(2)}),e=>(e as {code:string}).code==='chart_source_changed');await assert.rejects(verifiedChartSource(f.db,43,id(1)),e=>(e as {status:number}).status===404);
 f.tables.luna30_birth_profiles[1].revision=1;f.tables.luna30_chart_cache[0].profile_revision=undefined;await assert.rejects(verifiedChartSource(f.db,42,id(1)),e=>(e as {code:string}).code==='chart_source_unverified');f.tables.luna30_chart_cache[0].profile_revision=1;f.tables.luna30_chart_cache[0].engine_version='unknown';await assert.rejects(verifiedChartSource(f.db,42,id(1)),e=>(e as {code:string}).code==='unsupported_chart_version');assert.equal(f.writes.length,0);
});
test('age alone does not invalidate supported unchanged sources, and context omits raw birth data',async()=>{
 const f=charts();f.tables.luna30_chart_cache[0].created_at='2020-01-01T00:00:00Z';assert.equal((await verifiedChartSource(f.db,42,id(1))).sourceValidity.state,'current');assert.doesNotMatch(JSON.stringify(await verifiedAstrologyChatContext(f.db,42,id(1))),/2000-01-01|latitude|telegram_id/);
});
test('Cosmos hides removed source titles and cross-owner bookmarks without deleting reading history',async()=>{
 const f=fixture();f.tables.luna42_discoveries=[{id:id(50),telegram_id:42,kind:'reflection',reference_id:id(60),title:'Private removed reflection',revision:1,created_at:at,updated_at:at},{id:id(51),telegram_id:42,kind:'tarot',reference_id:id(61),title:'Saved reading',revision:1,created_at:at,updated_at:at},{id:id(52),telegram_id:43,kind:'tarot',reference_id:id(61),title:'Other owner',revision:1,created_at:at,updated_at:at}];f.tables.luna_tarot_readings=[{id:id(61),telegram_id:42}];f.tables.user_memories=[{id:id(60),telegram_id:42,is_active:true,memory_kind:'symbolic',category:'reflections'}];
 const service=createDiscoveryService(f.db);assert.equal((await service.list(42)).discoveries.length,2);f.tables.user_memories=[];const r=await service.list(42);assert.deepEqual(r.discoveries.map(d=>d.id),[id(51)]);assert.doesNotMatch(JSON.stringify(r),/Private removed|Other owner/);await assert.rejects(service.open(42,id(50)),e=>(e as {status:number}).status===404);assert.equal(f.tables.luna_tarot_readings.length,1);assert.equal(f.writes.length,0);await assert.rejects(service.list(0));
});

 test('Core generation cannot dispatch a provider or database call when authoritative accounting is disabled',async()=>{
 const {env}=await import('./config.js'),{sendLunaMessage}=await import('./luna-ai.js');
 const before={FEATURE_LUNA_INTELLIGENCE:env.FEATURE_LUNA_INTELLIGENCE,AI_CHAT_ENABLED:env.AI_CHAT_ENABLED,OPENAI_API_KEY:env.OPENAI_API_KEY,LUNA32_ENABLED:env.LUNA32_ENABLED},fetch=globalThis.fetch;let calls=0;
 Object.assign(env,{FEATURE_LUNA_INTELLIGENCE:true,AI_CHAT_ENABLED:true,OPENAI_API_KEY:'synthetic-disabled',LUNA32_ENABLED:false});
 globalThis.fetch=async()=>{calls++;throw Error('Unexpected external request');};
 try{for(const extra of [{intelligenceVersion:1},{}])await assert.rejects(sendLunaMessage({telegram_id:42,first_name:'Synthetic'}, {message:'Explain my current goal',language:'en',requestId:id(90),...extra}),e=>(e as {code:string}).code==='ai_budget_unconfigured');assert.equal(calls,0);}finally{Object.assign(env,before);globalThis.fetch=fetch;}
 });

test('an explicitly saved historical report retains its source label without regeneration',async()=>{
 const f=charts();f.tables.luna30_birth_profiles[0].revision=2;
 f.tables.luna30_astrology_reports=[{id:id(70),telegram_id:42,first_chart_id:id(1),second_chart_id:null,report:{summary:'A neutral symbolic report for a synthetic fixture.',sections:['connection','communication','emotions','differences','reflection'].map(id=>({id,title:'Reflection',text:'A neutral symbolic reflection to compare two synthetic perspectives.'})),question:'What feels relevant to your own experience?',disclaimer:'Symbolic reflection, not a scientific assessment.'}}];
 const result=await verifiedAstrologyChatContext(f.db,42,{chartId:id(1),reportId:id(70)});assert.equal(result.sourceValidity.first.state,'historical');assert.ok(result.savedReport);assert.equal(f.writes.length,0);
});
