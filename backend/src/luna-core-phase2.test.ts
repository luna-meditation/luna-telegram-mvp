import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {buildPersonalPortrait} from './personal-portrait-policy.js';
import {portraitDiscussionInput,portraitDiscussionOpening,selectedPortraitDiscovery,discoveryReferenceFromRecent} from './portrait-discussion-policy.js';
import {visibleMemoryInstructions} from './luna/prompts/memory-policy.js';
import {hasInternalDataLeak} from './luna-ai-policy.js';
import {readPersonalPortrait,createPortraitDiscussion} from './personal-portrait.js';
import {advanceMemoryPrivacyBoundary} from './personal-memory.js';
import {emptyPersonalProfile} from './personalization-policy.js';
import {calculateNatalChart,astrologyEngineMetadata} from './luna30-astrology-engine.js';
import type {PersonalMemory} from './personal-memory-policy.js';

const at='2026-10-22T00:00:00.000Z',id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const memory=(extra:Partial<PersonalMemory>={}):PersonalMemory=>({id:id(1),category:'reflections',memory_key:'discovery_small_steps',memory_value:'I make progress when I start with ten minutes of drawing.',confirmation_status:'confirmed',memory_kind:'fact',is_sensitive:false,source_type:'user_entered',source_message_id:null,revision:1,created_at:at,updated_at:at,confirmed_at:at,...extra});
const profile={...emptyPersonalProfile,ai_context_consent:true};
const portrait=(rows:PersonalMemory[],permission=true)=>buildPersonalPortrait({memories:rows,profile:{...profile,ai_context_consent:permission},memoryEnabled:permission,hasBirth:false});

test('portrait discovery projection excludes drafts, malformed provenance and inactive records',()=>{
 const good=memory(),bad=[memory({id:id(2),source_type:'legacy_ai'}),memory({id:id(3),confirmation_status:'pending'}),memory({id:id(4),source_type:'user_message',source_message_id:null}),memory({id:id(5),confirmed_at:null}),memory({id:id(6),is_active:false})];
 const result=portrait([good,...bad]);assert.deepEqual(result.sections.discoveries.map(row=>row.id),[good.id]);assert.equal(result.timeline.length,1);
});
for(const language of ['en','ru'] as const)test(`selected discovery opening retains one exact source without an inferred fact (${language})`,()=>{
 const selected=memory(),other=memory({id:id(2),memory_value:'UNRELATED_OBSERVATION'}),p=portrait([selected,other]);
 const opening=portraitDiscussionOpening(p,'discoveries',language,{id:selected.id,updatedAt:selected.updated_at});
 assert.match(opening.content,/ten minutes of drawing/);assert.doesNotMatch(opening.content,/UNRELATED_OBSERVATION/);assert.deepEqual(opening.sources,[{id:selected.id,updatedAt:at,kind:'user_fact'}]);
 const symbolic=memory({memory_kind:'symbolic',source_type:'user_saved_ai_reflection',source_message_id:id(50)});
 const reflection=portraitDiscussionOpening(portrait([symbolic]),'discoveries',language,{id:symbolic.id,updatedAt:at});
 assert.equal(reflection.sources[0].kind,'symbolic_reflection');assert.match(reflection.content,language==='ru'?/символическое/:/symbolic/);
});
test('deleted, corrected, foreign and private discovery references do not become contextual openings',()=>{
 const ref={id:id(1),updatedAt:at};
 for(const p of [portrait([]),portrait([memory({id:id(2)})]),portrait([memory({updated_at:'2026-10-22T00:01:00.000Z'})]),portrait([memory({is_sensitive:true})]),portrait([memory()],false)]){
  assert.equal(selectedPortraitDiscovery(p,ref),undefined);assert.throws(()=>portraitDiscussionOpening(p,'discoveries','en',ref));
 }
 assert.equal(portraitDiscussionInput.safeParse({operationId:id(9),section:'strengths',language:'en',memory:ref}).success,false);
 assert.equal(portraitDiscussionInput.safeParse({operationId:id(9),section:'discoveries',language:'en',memory:{...ref,owner:7}}).success,false);
});
test('only a server assistant opening with one typed discovery source supplies reflection context',()=>{
 const source={id:id(1),updatedAt:at,kind:'user_fact'},metadata={portraitDiscussion:{section:'discoveries',sources:[source]}};
 assert.deepEqual(discoveryReferenceFromRecent([{role:'assistant',metadata}]),source);
 assert.equal(discoveryReferenceFromRecent([{role:'assistant',metadata},{role:'assistant',metadata:{contextReset:true}}]),null);
 for(const row of [{role:'user',metadata},{role:'assistant',metadata:{portraitDiscussion:{section:'strengths',sources:[source]}}},{role:'assistant',metadata:{portraitDiscussion:{section:'discoveries',sources:[source,source]}}}])assert.equal(discoveryReferenceFromRecent([row]),null);
});
test('memory replies stay human while discovery drafts and deletion acknowledgements keep their evidence limits',()=>{
 assert.equal(visibleMemoryInstructions('Explain Mercury',{personalContext:{}}),'');
 assert.match(visibleMemoryInstructions('Which goal is saved?',{personalContext:{confirmedMemories:[{value:'Draw in the evening'}]}}),/Never print storage categories/);
 for(const message of ['Help me phrase a possible observation.','Помоги сформулировать возможное наблюдение.'])assert.match(visibleMemoryInstructions(message,{}),/Do not add motives, causes/);
 assert.match(visibleMemoryInstructions('Reflect on this',{selectedDiscovery:{id:id(1)}}),/without asking again for its title/);
 for(const message of ['I deleted that observation.','Я удалил это наблюдение.'])assert.match(visibleMemoryInstructions(message,{}),/conversation history has been erased/);
 assert.equal(hasInternalDataLeak('Источник: user_entered. Текст значения хранится как memory_value.'),true);
 assert.equal(hasInternalDataLeak('Твоя подтверждённая цель — рисовать десять минут вечером.'),false);
});

function chartFixture(){
 const calculation=calculateNatalChart({date:'2000-01-01',time:'12:00',location:{label:'Synthetic London',latitude:51.5,longitude:0,timezone:'Etc/UTC',placeId:'geonames:2643743',provider:'geonames',confirmed:true}});
 const tables:Record<string,Array<Record<string,unknown>>>={luna30_birth_profiles:[{id:id(10),telegram_id:42,subject_kind:'self',display_label:'Synthetic',birth_date:'2000-01-01',birth_time:'12:00',revision:1,location:{label:'Synthetic London'},updated_at:at}],luna30_chart_cache:[{id:id(11),telegram_id:42,profile_id:id(10),profile_revision:1,engine:astrologyEngineMetadata.id,engine_version:astrologyEngineMetadata.version,calculation,created_at:at}]};
 const calls:string[]=[],db=createClient('https://synthetic.invalid','synthetic-only',{auth:{persistSession:false},global:{fetch:async(input,init)=>{
  const url=new URL(String(input));calls.push(url.toString());assert.equal(init?.method??'GET','GET');
  const selected=(tables[url.pathname.split('/').at(-1)!]??[]).filter(row=>[...url.searchParams].every(([key,value])=>['select','order','limit'].includes(key)||value.startsWith('eq.')&&String(row[key])===value.slice(3)));
  return Response.json(new Headers(init?.headers).get('accept')?.includes('vnd.pgrst.object')?selected[0]??null:selected);
 }}});return{tables,db,calls,calculation};
}
test('Cosmos uses a real current calculated chart and independently preserves confirmed observations',async()=>{
 const f=chartFixture(),p=await readPersonalPortrait(f.db,42,{profile,memories:[memory()],memoryEnabled:true},'2026-10-22');
 assert.deepEqual(p.chart?.calculation,f.calculation);assert.equal(JSON.stringify(p.chart).includes('birth_date'),false);assert.equal(JSON.stringify(p.chart).includes('location'),false);assert.equal(p.chartStatus,'current');assert.equal(p.chart?.facts.planets.length,10);assert.equal(p.numerology.calculated,true);assert.equal(p.sections.discoveries.length,1);assert.ok(f.calls.every(url=>url.includes('telegram_id=eq.42')));
});
for(const fault of ['unsupported_version','malformed_calculation','profile_changed'])test(`Cosmos omits an unverified chart without inventing placements (${fault})`,async()=>{
 const f=chartFixture(),row=f.tables.luna30_chart_cache[0];
 if(fault==='unsupported_version')row.engine_version='unsupported';
 else if(fault==='malformed_calculation')row.calculation={planets:[{id:'sun',sign:1}]};
 else f.tables.luna30_birth_profiles[0].revision=2;
 const p=await readPersonalPortrait(f.db,42,{profile,memories:[memory()],memoryEnabled:true},'2026-10-22');
 assert.equal(p.chart,null);assert.equal(p.chartStatus,fault==='profile_changed'?'not_calculated':'unavailable');assert.equal(p.sections.discoveries[0].id,id(1));assert.equal(p.numerology.calculated,true);
});
test('selected discovery uses the existing atomic portrait RPC with owner and source epoch',async()=>{
 const p={...portrait([memory()]),chart:null,birth:{available:false,selectionRequired:false},numerology:{calculated:false},sectionDigests:{discoveries:'synthetic'}};
 const calls:Array<{url:string;body:Record<string,unknown>|null}>=[];
 const db=createClient('https://synthetic.invalid','synthetic-only',{auth:{persistSession:false},global:{fetch:async(input,init)=>{
  const url=String(input),body=init?.body?JSON.parse(String(init.body)):null;calls.push({url,body});
  if(url.includes('/rpc/luna4_portrait_epoch'))return Response.json(7);
  if(url.includes('/luna4_portrait_snapshots?'))return Response.json({document:p,revision:1,source_epoch:7,created_at:at});
  if(url.includes('/rpc/luna4_open_portrait_discussion'))return Response.json({status:'opened',conversationId:body.p_conversation,message:{id:body.p_message,role:'assistant',content:body.p_content,metadata:{portraitDiscussion:{sourceEpoch:7,sources:body.p_sources}}},cached:false});
  throw Error('Unexpected persistence or provider access');
 }}});
 const service=createPortraitDiscussion(db,async()=>{throw Error('The owner-scoped current snapshot is already loaded');});
 const result=await service.open(42,{operationId:id(20),section:'discoveries',language:'en',memory:{id:id(1),updatedAt:at}});
 assert.match(result.message.content,/ten minutes of drawing/);const write=calls.find(call=>call.url.includes('/rpc/luna4_open_portrait_discussion'))!;
 assert.equal(write.body?.p_owner,42);assert.equal(write.body?.p_epoch,7);assert.deepEqual(write.body?.p_sources,[{id:id(1),updatedAt:at,kind:'user_fact'}]);
 const before=calls.length;await assert.rejects(service.open(42,{operationId:id(21),section:'discoveries',language:'en',memory:{id:id(99),updatedAt:at}}),{code:'discovery_changed'});assert.equal(calls.slice(before).some(call=>call.url.includes('open_portrait_discussion')),false);
});
test('competing memory privacy cutoffs are monotonic and conditional on the previous value',async()=>{
 let current=at;const writes:string[]=[];
 const db=createClient('https://synthetic.invalid','synthetic-only',{auth:{persistSession:false},global:{fetch:async(input,init)=>{
  const url=new URL(String(input));assert.equal(url.searchParams.get('telegram_id'),'eq.42');
  if(init?.method==='PATCH'){
   const next=JSON.parse(String(init.body)).updated_at,expected=url.searchParams.get('updated_at');
   if(expected!=='eq.'+current)return Response.json([]);assert.ok(Date.parse(next)>Date.parse(current));current=next;writes.push(next);return Response.json([{telegram_id:42}]);
  }
  const value=current;await Promise.resolve();return Response.json({updated_at:value});
 }}});
 await Promise.all(Array.from({length:4},()=>advanceMemoryPrivacyBoundary(db,42,()=>Date.parse(at))));
 assert.equal(writes.length,4);assert.equal(new Set(writes).size,4);assert.equal(Date.parse(current),Date.parse(at)+4);
 await assert.rejects(advanceMemoryPrivacyBoundary(db,0),{code:'owner_required'});
});

test('Cosmos geometry is owner scoped and unknown birth time never gains precise aspects',async()=>{
 const foreign=chartFixture();foreign.tables.luna30_chart_cache[0].telegram_id=43;
 const omitted=await readPersonalPortrait(foreign.db,42,{profile,memories:[],memoryEnabled:true},'2026-10-22');assert.equal(omitted.chart,null);
 const f=chartFixture(),row=f.tables.luna30_birth_profiles[0];row.birth_time=null;
 const calculation=calculateNatalChart({date:'2000-01-01',time:null,location:{label:'Synthetic London',latitude:51.5,longitude:0,timezone:'Etc/UTC',placeId:'geonames:2643743',provider:'geonames',confirmed:true}});
 f.tables.luna30_chart_cache[0].calculation=calculation;
 const p=await readPersonalPortrait(f.db,42,{profile,memories:[],memoryEnabled:true},'2026-10-22');
 assert.equal(p.chart?.calculation.timePrecision,'unknown');assert.equal(p.chart?.calculation.ascendant,null);assert.deepEqual(p.chart?.calculation.aspects,[]);assert.deepEqual(p.chart?.calculation.houses,[]);
});

test('actual Telegram middleware binds signed owners before a Cosmos projection is read',async()=>{
 const {default:express}=await import('express'),{createHmac}=await import('node:crypto'),{requireTelegramWebApp}=await import('./auth.js'),{env}=await import('./config.js');
 const f=chartFixture(),app=express();
 app.get('/api/universe/portrait',requireTelegramWebApp,async(req,res)=>{const owner=(req as import('./auth.js').AuthenticatedRequest).telegramUser.telegram_id;res.setHeader('Cache-Control','private, no-store');res.json(await readPersonalPortrait(f.db,owner,{profile,memories:[],memoryEnabled:true},'2026-10-22'));});
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const port=(server.address() as import('node:net').AddressInfo).port,url=`http://127.0.0.1:${port}/api/universe/portrait?telegram_id=43`;
 const signed=(owner:number)=>{const value=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:owner,first_name:'Synthetic'})});const secret=createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest();value.set('hash',createHmac('sha256',secret).update([...value.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n')).digest('hex'));return value.toString();};
 try{
  assert.equal((await fetch(url)).status,401);assert.equal(f.calls.length,0);
  assert.equal((await fetch(url,{headers:{'x-telegram-init-data':signed(42).replace(/hash=./,'hash=x')}})).status,401);assert.equal(f.calls.length,0);
  const own=await fetch(url,{headers:{'x-telegram-init-data':signed(42)}});assert.equal(own.status,200);assert.match(own.headers.get('cache-control')!,/private, no-store/);assert.equal((await own.json()).chart.id,id(11));assert.ok(f.calls.every(url=>url.includes('telegram_id=eq.42')));
  f.calls.length=0;const foreign=await fetch(url,{headers:{'x-telegram-init-data':signed(43)}});assert.equal(foreign.status,200);assert.equal((await foreign.json()).chart,null);assert.ok(f.calls.every(url=>url.includes('telegram_id=eq.43')));
 }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
