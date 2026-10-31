import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {createCompanionEngine} from './companion-engine.js';
import {buildIntelligenceInstructions,intelligenceQuickReplies} from './luna-intelligence-prompt.js';
import {calculateNatalChart,calculateCurrentTransits} from './luna30-astrology-engine.js';
import {transitDailyReflection} from './daily-personal-entry.js';
import {companionEntryQuestion,conversationOpening,conversationEntryQuestion,conversationEntryRows} from './product-experience.js';
import {buildPersonalPortrait} from './personal-portrait-policy.js';
import {emptyPersonalProfile} from './personalization-policy.js';
import {symbolicChartFacts} from './luna30-astrology-report-policy.js';
import {companionSettingsKey,type companionPreference} from './companion-policy.js';
import type {PersonalMemory} from './personal-memory-policy.js';
import {conciseCompanionRequest} from './luna-numerology-response.js';

test('the actual composed companion prompt contains its role module, not just the shared identity placeholder',()=>{
 const prompt=buildIntelligenceInstructions({language:'ru',version:4,catalog:[],context:{},address:''});
 assert.match(prompt,/producing business, marketing, coding or investment deliverables is not/);
 assert.match(prompt,/plausible USER answers to your exact last question/);
 assert.match(prompt,/Without an actual calculation/);
 assert.match(prompt,/get_current_transits/);assert.match(prompt,/memoryCandidates must stay empty/);
 assert.ok(prompt.length<12600,'Consolidation keeps the existing prompt budget');
 const legacy=buildIntelligenceInstructions({language:'en',version:3,catalog:[],context:{},address:''});assert.ok(legacy.length<7500);
});

test('ordinary companion prose is bounded by provider schema while token budget and tool response fields are preserved',()=>{
 const body={model:'gpt-5-mini',instructions:'Existing policy',max_output_tokens:2600,reasoning:{effort:'minimal'},input:[{role:'user',content:'An actual situation'}],text:{format:{schema:{properties:{message:{type:'string'},quickReplies:{type:'array'}},required:['message','quickReplies']}}}};
 const request=conciseCompanionRequest(body);assert.equal(request.model,body.model);assert.equal(request.max_output_tokens,2600);assert.equal(request.reasoning,body.reasoning);assert.equal(request.input,body.input);assert.deepEqual(request.text.format.schema.required,body.text.format.schema.required);
 const pattern=new RegExp(String((request.text.format.schema.properties.message as Record<string,unknown>).pattern));assert.ok(pattern.test('A specific reflection. One useful question?'));assert.equal(pattern.test('x'.repeat(1101)),false);assert.equal('pattern'in body.text.format.schema.properties.message,false);assert.match(request.instructions,/plausible answers the USER could choose/);
});
test('quick replies stay in the user voice; a generated Luna offer cannot become a misleading user message',()=>{
 assert.deepEqual(intelligenceQuickReplies(['Хочешь ещё одно наблюдение?','Хочу понять эту реакцию','Мне важнее точность'],[],'general'),['Хочу понять эту реакцию','Мне важнее точность']);
 assert.deepEqual(intelligenceQuickReplies(['Would you like me to explain?','I want to understand the feeling','Shall I create a plan?'],[],'general'),['I want to understand the feeling']);
});

test('a visible local daily transit reflection cannot silently become provider context under date-only consent',async()=>{
 const db=createClient('https://synthetic.invalid','synthetic-only',{auth:{persistSession:false},global:{fetch:async input=>{const url=new URL(String(input));assert.equal(url.pathname,'/rest/v1/ai_messages');assert.equal(url.searchParams.get('telegram_id'),'eq.42');return Response.json([]);}}});
 const profile={...emptyPersonalProfile,ai_context_consent:true},calculation=calculateNatalChart({date:'2000-01-01',time:'12:00',location:{label:'Synthetic London',latitude:51.5,longitude:0,timezone:'Etc/UTC',placeId:'geonames:2643743',provider:'geonames',confirmed:true}});
 const settings:ReturnType<typeof companionPreference>={version:1,inAppFollowUps:false,dailyAstrology:true,symbolicAiContext:true};
 const memories=[{id:randomUUID(),category:'preferences',memory_key:companionSettingsKey,memory_value:JSON.stringify(settings),confirmation_status:'confirmed',memory_kind:'fact',is_sensitive:false}] as PersonalMemory[];
 const data={profile,memoryEnabled:true,memories};
 const portrait={...buildPersonalPortrait({...data,hasBirth:true}),birth:{available:true,selectionRequired:false,source:'birth_profile' as const,sourceId:randomUUID(),hasDate:true,hasTime:true,hasPlace:true,updatedAt:'2026-10-31T00:00:00Z'},numerology:{calculated:false as const,requiresPersonalProfile:false,requiresSelection:false},dateOnlySun:null,chart:{id:randomUUID(),calculation,facts:symbolicChartFacts(calculation)},chartStatus:'current' as const,persistence:{state:'unavailable' as const}};
 const engine=createCompanionEngine(db,async()=>data,{portrait:async()=>portrait});
 const result=await engine.open(42,{operationId:randomUUID(),entryOnly:true,language:'ru',timeZone:'UTC'},new Date('2026-10-31T08:00:00Z'));
 assert.equal(result.entry?.reflection?.source,'saved_chart');assert.match(result.entry?.reflection?.calculationVersion??'',/2026-10-31T12:00:00/);assert.match(result.entry?.reflection?.basis??'',/12:00 UTC/);assert.equal(result.entry?.contextReflectionAllowed,false);assert.equal(conversationOpening(result.entry!,'ru').length,3);
 const rows=conversationEntryRows(result.entry!,'ru');assert.equal(rows[1].excludeFromAi,true);assert.equal(rows[2].excludeFromAi,false);assert.equal(conversationEntryQuestion(result.entry!,'ru'),rows[2].content,'Withholding the private reflection never substitutes a different visible question');
});
test('a saved birth profile prevents re-asking the date without loading a non-consented portrait or exposing raw birth values',async()=>{
 let revision=1;const profileId=randomUUID();
 const db=createClient('https://synthetic.invalid','synthetic-only',{auth:{persistSession:false},global:{fetch:async(input,init)=>{
  const url=new URL(String(input));assert.equal(init?.method??'GET','GET');assert.equal(url.searchParams.get('telegram_id'),'eq.42');
  if(url.pathname.endsWith('/ai_messages'))return Response.json([]);
  assert.equal(url.pathname,'/rest/v1/luna30_birth_profiles');assert.equal(url.searchParams.get('subject_kind'),'eq.self');
  return Response.json([{id:profileId,birth_date:'1992-06-24',birth_time:'10:00',location:{label:'PRIVATE_BIRTHPLACE'},revision,updated_at:'2026-10-31T00:00:00Z'}]);
 }}});
 const engine=createCompanionEngine(db,async()=>({profile:{ai_context_consent:false},memoryEnabled:false,memories:[]}),{birthAvailability:true,portrait:async()=>{throw Error('Must not load portrait without permission');}});
 const input={operationId:randomUUID(),entryOnly:true,language:'en',timeZone:'UTC'},result=await engine.open(42,input);
 assert.equal(result.entry?.birthAvailable,true);assert.equal(result.entry?.hasBirthTime,true);assert.equal(result.entry?.reflection,null);assert.equal(result.entry?.contextReflectionAllowed,false);
 assert.doesNotMatch(JSON.stringify(result),/1992-06-24|PRIVATE_BIRTHPLACE/);
 assert.doesNotMatch(result.entry!.question,/When were you born/);
 revision++;assert.notEqual((await engine.open(42,input)).entry?.key,result.entry?.key);
});
test('optional birth invitation is a stable chat message, with a real skip route and no fabricated portrait',()=>{
 for(const language of ['ru','en'] as const){const question=companionEntryQuestion(language,false);assert.match(question,/1992|1992/);assert.match(question,language==='ru'?/Можно и без даты/:/skip/);
 const entry={key:'known',greeting:'Hello',question,reflection:null};assert.deepEqual(conversationOpening(entry,language),conversationOpening(entry,language));}
});
test('daily transit reflection cites an actual supported aspect and exact snapshot; unknown-time Moon is excluded',()=>{
 const location={label:'Synthetic London',latitude:51.5,longitude:0,timezone:'Etc/UTC',placeId:'geonames:2643743',provider:'geonames' as const,confirmed:true as const};
 for(const time of ['12:00',null]){
  const chart=calculateNatalChart({date:'2000-01-01',time,location});
  const snapshot=calculateCurrentTransits(chart,'2026-10-31T12:00:00.000Z');
  for(const language of ['ru','en'] as const){const reflection=transitDailyReflection(snapshot,language);assert.ok(reflection);assert.match(reflection.basis,/2026-10-31, 12:00 UTC/);assert.ok(reflection.calculationVersion.includes(snapshot.at));assert.match(reflection.basis,language==='ru'?/не прогноз/:/not an event prediction/);}
  if(time===null){assert.ok(snapshot.excludedNatalPlanets.includes('moon'));assert.ok(snapshot.aspects.every(aspect=>aspect.natal!=='moon'));}
 }
 const chart=calculateNatalChart({date:'2000-01-01',time:'12:00',location});
 assert.equal(transitDailyReflection({...calculateCurrentTransits(chart,'2026-10-31T12:00:00.000Z'),aspects:[]},'en'),null);
});
