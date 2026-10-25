import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import {personalWorkflowFromAnswer,personalWorkflowReply,personalContextQuery,normalizePersonalWorkflow,personalWorkflowIdentity,validPersonalWorkflowChoice} from './personal-conversation-workflow.js';
import {updateConversationState,normalizeConversationState,recoverConversationState} from './luna-ai-state.js';
import {conversationStateAfterMemoryBoundary} from './personal-memory-policy.js';
import {localCalendarDate,solarDailyReflection} from './daily-personal-entry.js';
import {createCompanionEngine} from './companion-engine.js';
import {companionPreference} from './companion-policy.js';
import {emptyPersonalProfile} from './personalization-policy.js';
import {buildPersonalPortrait} from './personal-portrait-policy.js';
import type {readPersonalPortrait} from './personal-portrait.js';
import type {PersonalMemory} from './personal-memory-policy.js';
import {assemblePersonalIntelligence} from './personal-context-engine.js';
import {permittedPersonalContext} from './personalization-policy.js';
import {runTarotReveal,type RevealMetrics} from './tarot-reveal-pipeline.js';
import {chatTarotState,chatTarotStateFromMetadata,storedChatTarotMetadata,type ChatTarotState} from './luna24-policy.js';
import {calculateDateOnlySun} from './luna30-astrology-engine.js';
import {reflectionKey,reflectionValue} from './personal-reflection.js';
const clock=new Date(),question='Would you like to explore your strengths through a short questionnaire?',workflow=()=>personalWorkflowFromAnswer(question,['Yes','Not now'],'strengths',clock)!;
test('yes, Опрос and ordinal replies continue the exact optional workflow, never a financial permission',()=>{
 for(const message of ['Yes','Да','Опрос','Первый вариант','1']){const result=personalWorkflowReply(message,workflow());assert.equal(result?.workflow.question,question);assert.match(result!.instructions,/not a new request or stored fact/);assert.match(result!.instructions,/authorize a financial action/);assert.ok(personalContextQuery(message,result).includes(question));}
 assert.equal(personalWorkflowReply('Not now',workflow())?.reply,'declined');assert.equal(personalContextQuery('Not now',personalWorkflowReply('Not now',workflow())),'Not now');
 for(const content of ['Buy more Stars?','Купить разбор и списать 100 Moon Seeds?'])assert.equal(personalWorkflowFromAnswer(content,['Yes'],'purchase'),null);
});
test('workflow choices bind to the question and exact option; stale or altered labels cannot authorize execution',()=>{
 const one=workflow(),id=personalWorkflowIdentity(one);assert.equal(validPersonalWorkflowChoice(one,{id,option:'option-1'},'Yes'),true);
 assert.equal(validPersonalWorkflowChoice(one,{id,option:'option-1'},'Buy Premium'),false);assert.equal(validPersonalWorkflowChoice(one,{id:'another',option:'option-1'},'Yes'),false);assert.equal(validPersonalWorkflowChoice(undefined,{id,option:'option-1'},'Yes'),false);
});
test('interrupted workflow survives structured state, explicit return resumes it and privacy cutoff removes it',()=>{
 const previous={...normalizeConversationState({}),workflow:workflow()};const next=updateConversationState({previous,intent:'recommend_meditation',goal:'focus',topic:'meditation',meditationId:randomUUID(),assistantMessage:'Your meditation card is available.',userDecision:'Find a focus meditation',language:'en',resetActivityContext:true});
 assert.equal(next.workflow,undefined);assert.equal(personalWorkflowReply('Yes',next.workflow,next.suspended_workflow),null);
 const resumed=personalWorkflowReply('Вернёмся к опросу',next.workflow,next.suspended_workflow);assert.equal(resumed?.reply,'resume');assert.equal(resumed?.workflow.question,question);
 assert.equal(conversationStateAfterMemoryBoundary(next,new Date(Date.now()+1000).toISOString()),null);
});
test('an explicit practice/topic command is not a free-text answer to a former survey',()=>{
 for(const message of ['Подбери медитацию для фокуса','Show my natal chart','Draw five Tarot cards','Давай подышим одну минуту'])assert.equal(personalWorkflowReply(message,workflow()),null);
 const previous={...normalizeConversationState({}),current_topic:'reflection',workflow:workflow()};
 const next=updateConversationState({previous,intent:'recommend_meditation',goal:'focus',topic:'meditation',meditationId:randomUUID(),assistantMessage:'Your focus meditation card is available.',userDecision:'Подбери медитацию',language:'ru'});
 assert.equal(next.workflow,undefined);assert.equal(next.suspended_workflow?.question,question);assert.equal(personalWorkflowReply('Вернёмся к опросу',next.workflow,next.suspended_workflow)?.reply,'resume');
});
test('expired, future or malformed short-term text is excluded, not promoted into memory',()=>{
 assert.equal(normalizePersonalWorkflow({...workflow(),updatedAt:new Date(Date.now()-8*86400000).toISOString()}),null);
 assert.equal(normalizePersonalWorkflow({...workflow(),updatedAt:new Date(Date.now()+86400000).toISOString()}),null);
 assert.equal(normalizePersonalWorkflow({version:1,question:'?',updatedAt:'invalid'}),null);
 const stored=normalizeConversationState({workflow:workflow(),suspended_workflow:{invalid:true}});assert.equal(stored.workflow?.options.length,2);assert.equal(stored.suspended_workflow,undefined);
});
test('a contextual portrait opening recovers its exact question without restarting the old introduction steps',()=>{
 const recovered=recoverConversationState({},[{role:'assistant',content:question,created_at:clock.toISOString(),metadata:{portraitDiscussion:{section:'strengths'},contextReset:true}}]);assert.equal(recovered.workflow?.question,question);assert.equal(personalWorkflowReply('Опрос',recovered.workflow)?.reply,'accepted');assert.equal(recovered.workflow?.context,'','The question is not duplicated in the bounded context');
});
test('daily boundaries use the supplied validated timezone, including DST, not UTC day',()=>{
 const at=new Date('2026-10-19T17:00:00Z');assert.equal(localCalendarDate(at,'Asia/Makassar'),'2026-10-20');assert.equal(localCalendarDate(at,'America/Los_Angeles'),'2026-10-19');assert.equal(localCalendarDate(new Date('2026-03-08T07:30:00Z'),'America/New_York'),'2026-03-08');assert.throws(()=>localCalendarDate(at,'Not/A_Zone'));
});
test('daily solar reflection is stable, localized and explicitly not a full chart or transit forecast',()=>{
 for(const language of ['en','ru'] as const){const value=solarDailyReflection({language,localDate:'2026-10-20',sunSigns:[9],source:'date_only_sun'});assert.deepEqual(value,solarDailyReflection({language,localDate:'2026-10-20',sunSigns:[9],source:'date_only_sun'}));assert.match(value!.basis,language==='ru'?/по сохранённой дате; не полная натальная/:/date only; not a full natal/);assert.equal(solarDailyReflection({language,localDate:'2026-10-20',sunSigns:[0,1],source:'date_only_sun'}),null);}
});
test('fresh entry uses owner/day/source-bound projection without creating a conversation, provider call or wallet access',async()=>{
 const db=new Proxy({},{get(){throw Error('Entry may not write or read conversation/wallet tables');}}) as SupabaseClient;
 let epoch=1,reads=0;const portrait=async(owner:number,day:string)=>{assert.ok(owner>0);assert.match(day,/^\d{4}-\d{2}-\d{2}$/);reads++;return{...buildPersonalPortrait({profile:emptyPersonalProfile,memories:[],memoryEnabled:true,hasBirth:true}),birth:{available:true,selectionRequired:false,hasTime:false,hasPlace:false},dateOnlySun:calculateDateOnlySun('1990-01-15'),numerology:{calculated:false,requiresPersonalProfile:false,requiresSelection:false},chart:null,chartStatus:'not_calculated',persistence:{state:'saved',revision:epoch,sourceEpoch:epoch,createdAt:clock.toISOString(),cached:true,sectionDigests:{astrology:'source-'+epoch}}} satisfies Awaited<ReturnType<typeof readPersonalPortrait>>;};
 const engine=createCompanionEngine(db,async()=>({profile:{display_name:'QA',ai_context_consent:true},memoryEnabled:true,memories:[]}),{portrait}),input={operationId:randomUUID(),entryOnly:true,language:'ru',timeZone:'Asia/Makassar'};
 const one=await engine.open(1,input,clock),two=await engine.open(1,input,clock);assert.ok(one.entry);assert.equal(one.conversationId,null);assert.equal(one.message,null);assert.equal(one.entry?.key,two.entry?.key);assert.equal(one.entry?.hasBirthTime,false);assert.ok(one.entry?.reflection);epoch++;assert.notEqual((await engine.open(1,input,clock)).entry?.key,one.entry?.key);assert.notEqual((await engine.open(2,input,clock)).entry?.key,one.entry?.key);
 assert.equal((await engine.open(1,{...input,conversationId:randomUUID()},clock)).message,null);const prior=reads;await engine.open(1,{...input,conversationId:randomUUID()},clock);assert.equal(reads,prior);
 await assert.rejects(engine.open(0,input));await assert.rejects(engine.open(1,{...input,timeZone:'invalid'}));
 const denied=createCompanionEngine(db,async()=>({profile:{ai_context_consent:false},memoryEnabled:true,memories:[]}),{portrait:async()=>{throw Error('Consent required');}});assert.equal((await denied.open(1,input,clock)).entry?.reflection,null);
});
test('old follow-up preferences remain compatible; invalid preferences fail closed',()=>{
 const row={memory_key:'companion_settings',confirmation_status:'confirmed',memory_value:'{"version":1,"inAppFollowUps":false}'} as PersonalMemory;assert.equal(companionPreference([row]).dailyAstrology,true);assert.equal(companionPreference([{...row,memory_value:'invalid'}]).dailyAstrology,false);
});
test('personal overview joins the canonical date calculations without exposing birth inputs or changing paid-product hashes by default',()=>{
 const birth={available:true,selectionRequired:false,selected:{id:'self',source:'birth_profile' as const,date:'1990-06-12',time:'12:30',place:'PRIVATE_PLACE',updatedAt:clock.toISOString(),revision:2}},profile={...emptyPersonalProfile,ai_context_consent:true};
 const setting={memory_key:'companion_settings',confirmation_status:'confirmed',memory_value:'{"version":1,"inAppFollowUps":true,"symbolicAiContext":true}'} as PersonalMemory;
 const derived=assemblePersonalIntelligence({profile,birth,rows:[setting],query:'What are my strengths and weaknesses?',asOf:'2026-10-20',includeCalculated:true}),context=permittedPersonalContext(derived);assert.equal(context?.calculatedSymbolic?.kind,'calculated_symbolic');assert.equal(context?.knownBirth?.hasTime,true);assert.equal(JSON.stringify(context).includes('1990-06-12'),false);assert.equal(JSON.stringify(context).includes('PRIVATE_PLACE'),false);assert.equal(JSON.stringify(context).includes('12:30'),false);assert.match(context!.calculatedSymbolic!.limitations,/not verified personality/);
 assert.equal(assemblePersonalIntelligence({profile,birth,rows:[],query:'What are my strengths?',includeCalculated:true}).calculated_symbolic,undefined,'Existing generic consent is not silently expanded');
 assert.equal(assemblePersonalIntelligence({profile,birth,rows:[],query:'Why are we compatible?',includeCalculated:true}).calculated_symbolic,undefined);
 assert.equal(assemblePersonalIntelligence({profile,birth,rows:[],query:'Show my portrait'}).calculated_symbolic,undefined,'Existing paid previews/hash inputs remain unchanged');
 assert.equal(assemblePersonalIntelligence({profile:{...profile,ai_context_consent:false},birth,rows:[],query:'Show my portrait',includeCalculated:true}).calculated_symbolic,undefined);
});
test('exact-source confirmed feedback is respected, not copied to another reading or promoted into a fact',()=>{
 const id=randomUUID(),profile={...emptyPersonalProfile,ai_context_consent:true},birth={available:false,selectionRequired:false,selected:null};
 const row={id:randomUUID(),category:'reflections',memory_key:reflectionKey('tarot',id),memory_value:reflectionValue('tarot',id,'not_me','ru'),memory_kind:'symbolic',is_sensitive:false,confirmation_status:'confirmed',source_type:'user_entered',created_at:clock.toISOString(),updated_at:clock.toISOString()} as PersonalMemory;
 const project=(rows:PersonalMemory[],reference=id)=>permittedPersonalContext(assemblePersonalIntelligence({profile,rows,birth,query:'Why did this card not fit me?',artifact:{kind:'tarot',id:reference}}));
 assert.deepEqual(project([row])?.confirmedFeedback?.map(f=>f.choice),['not_me']);
 assert.equal(project([row],randomUUID())?.confirmedFeedback,undefined);assert.equal(project([])?.confirmedFeedback,undefined);
 assert.equal(project([{...row,confirmation_status:'pending'}])?.confirmedFeedback,undefined);assert.equal(project([{...row,is_sensitive:true}])?.confirmedFeedback,undefined);
});
for(const kind of ['single','three','five'] as const)test(`deferred ${kind} final reveal saves first, does not call interpretation and retries reuse the same state`,async()=>{
 const count=kind==='single'?1:kind==='three'?3:5,id=randomUUID();let saved=0,provider=0;let state:ChatTarotState={readingId:id,clientReadingId:id,kind,revealed:count-1,requestHash:'a'.repeat(64)};let metrics:RevealMetrics|undefined;
 const deps={load:async()=>({metadata:{tarot:state}}),persist:async(_message:unknown,prior:ChatTarotState,next:ChatTarotState)=>{assert.equal(prior.revealed,state.revealed);saved++;state=next;return{metadata:{tarot:state}};},reading:async()=>({card_id:'the-star',cards:Array.from({length:count},()=>({cardId:'the-star'}))}),progress:async()=>undefined,render:async(message:{metadata:{tarot:ChatTarotState}})=>message,interpret:async()=>{provider++;throw Error('An AI response must not block the reveal');},measure:(value:RevealMetrics)=>{metrics=value;}};
 const one=await runTarotReveal({index:count-1,deferInterpretation:true},deps),two=await runTarotReveal({index:count-1,deferInterpretation:true},deps);assert.equal(one.metadata.tarot.revealed,count);assert.deepEqual(one,two);assert.equal(state.interpretationRequested,true);assert.equal(saved,1);assert.equal(provider,0);assert.equal(metrics?.interpretationMs,0);assert.equal(metrics?.deferred,true);assert.ok(metrics!.totalMs>=0);
});
test('out-of-sequence reveal cannot persist or generate; legacy client keeps its existing authorized flow',async()=>{
 const id=randomUUID();let writes=0,calls=0;let state:ChatTarotState={readingId:id,clientReadingId:id,kind:'three',revealed:0,requestHash:'b'.repeat(64)};
 const deps={load:async()=>({metadata:{tarot:state}}),persist:async(_message:unknown,_prior:ChatTarotState,next:ChatTarotState)=>{writes++;state=next;return{metadata:{tarot:state}};},reading:async()=>({card_id:'the-star',cards:[{cardId:'the-star'},{cardId:'the-moon'},{cardId:'the-sun'}]}),progress:async()=>undefined,render:async(message:{metadata:{tarot:ChatTarotState}})=>message,interpret:async()=>{calls++;return{metadata:{tarot:state}};}};
 await assert.rejects(runTarotReveal({index:2,deferInterpretation:true},deps),/reveal_order/);assert.equal(writes,0);assert.equal(calls,0);state={...state,revealed:2};await runTarotReveal({index:2},deps);assert.equal(calls,1);
});
test('new Tarot lifecycle is stored outside the strict legacy Tarot object, preserving rollback/history compatibility',()=>{
 const id=randomUUID(),state:ChatTarotState={readingId:id,clientReadingId:id,kind:'five',revealed:5,requestHash:'a'.repeat(64),interpretationRequested:true,interpretationAttempted:true,interpretationFinished:true};
 const metadata=storedChatTarotMetadata({other:'preserved'},state),legacy=chatTarotState.omit({interpretationRequested:true,interpretationAttempted:true,interpretationFinished:true}).strict();assert.doesNotThrow(()=>legacy.parse(metadata.tarot));assert.deepEqual(chatTarotStateFromMetadata(metadata),state);assert.equal(metadata.other,'preserved');
});
