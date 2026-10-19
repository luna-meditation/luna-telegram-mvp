import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {luna4ConversationCases,luna4InterpretationCases,evaluateLuna4Conversation} from './luna4-quality-cases.mjs';
import {buildLunaOpenAiRequest} from '../dist/luna-ai.js';
import {createLunaTools,lunaToolInstructions} from '../dist/luna32-tools.js';
import {calculateNatalChart,calculateDateOnlySun} from '../dist/luna30-astrology-engine.js';
import {buildAstrologyReportRequest,validateFreshAstrologyReport,symbolicChartFacts} from '../dist/luna30-astrology-report-policy.js';
import {calculateDateNumerology} from '../dist/luna-intelligence-numerology.js';
import {assertGroundedNumerologyProse,assertGroundedAstrologyProse,assertSubstantiveAstrologyAnswer} from '../dist/luna-intelligence-grounding.js';
import {buildTarotAiRequest,tarotCatalog,interpretationSchema} from '../dist/tarot-policy.js';
import {buildSpreadAiRequest,spreadInterpretationSchema,spreadPositions} from '../dist/tarot-spread-policy.js';
import {validateTarotV2} from '../dist/tarot-interpretation-v2.js';
import {buildDeepAnalysisRequest,validateDeepAnalysis,validateComprehensivePortrait} from '../dist/luna43-seed-products.js';
import {permittedPersonalContext} from '../dist/personalization-policy.js';
import {responseOutputText} from '../dist/luna/ai-provider.js';
import {meetLuna4Modules} from '../dist/luna/prompts/meet-luna4.js';
import {beforeMeetLuna4Modules,beforePolicySourceCommit} from './fixtures/luna4-before-policy.mjs';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const profile={display_name:'Alex',interests:['meditation'],preferences:'Use Alex, not diminutives. Prefer short practical choices.',birth_date:null,birth_time:null,birth_place:null,ai_context_consent:true,known_birth:{available:true,selectionRequired:false,source:'synthetic_confirmed_profile',hasDate:true,hasTime:false,hasPlace:true},confirmed_memories:[{id:'synthetic-drawing',category:'goals',key:'drawing_goal',value:'Practise drawing for ten minutes in the evening.',source:'user_entered',updatedAt:'2026-10-18T00:00:00Z'},{id:'synthetic-preference',category:'preferences',key:'quiet_practice',value:'Prefer quiet individual practice and small experiments.',source:'user_entered',updatedAt:'2026-10-18T00:00:00Z'}]};
const personal=permittedPersonalContext(profile),reading={id:'00000000-0000-4000-8000-000000000052',kind:'three',cards:[{cardId:'the-star',orientation:'reversed',position:'Situation'},{cardId:'the-hermit',orientation:'upright',position:'Attention'},{cardId:'strength',orientation:'upright',position:'Direction'}],question:'How can I build a small drawing habit?',intention:'growth',revealed:[0,1,2]};
// Normal chat enriches owner-verified selections from the same manifest. A QA
// attachment must carry that localized evidence too, not just English ids.
const localizedReading=language=>({...reading,cards:reading.cards.map((card,index)=>({...card,name:tarotCatalog.find(v=>v.id===card.cardId).name[language],position:spreadPositions[language].three[index]}))});
const places={london:{placeId:'synthetic:london',label:'Synthetic London',latitude:51.5074,longitude:-.1278,timezone:'Europe/London',provider:'fixed_qa_fixture',confirmed:true},polar:{placeId:'synthetic:tromso',label:'Synthetic Tromso',latitude:69.6492,longitude:18.9553,timezone:'Europe/Oslo',provider:'fixed_qa_fixture',confirmed:true},southern:{placeId:'synthetic:sydney',label:'Synthetic Sydney',latitude:-33.8688,longitude:151.2093,timezone:'Australia/Sydney',provider:'fixed_qa_fixture',confirmed:true}};
const charts=new Map();
function chart(variant='exact'){
 if(!charts.has(variant)){const input={date:'2000-01-01',time:'12:00',location:places.london};if(variant==='unknown_time')input.time=null;if(variant==='polar')input.location=places.polar;if(variant==='southern')input.location=places.southern;if(variant==='midnight'){input.time='00:01';input.date='1992-08-20';}if(variant==='dst_date_only'){input.date='2000-10-29';input.time=null;assert.throws(()=>calculateNatalChart({...input,time:'01:30'}),'Ambiguous time must be rejected, not guessed');}charts.set(variant,calculateNatalChart(input));}return charts.get(variant);
}
function compact(calculation){const f=symbolicChartFacts(calculation);return{subject:{label:'Synthetic Alex',kind:'self'},precision:f.precision,placements:Object.fromEntries(f.planets.map(p=>[p.planet,p.signs.join('/')])),ascendant:f.ascendant,houseSigns:f.houseSigns.join(','),aspects:calculation.aspects,warnings:f.warnings.join(',')};}
const catalog=[{id:'00000000-0000-4000-8000-000000000051',title:'Synthetic Focus',duration:180,durationSeconds:180,published:true,premium:false,language:'en',audioLanguage:'en',summary:'A synthetic focus practice; not production content.'}];
export function buildConversationCase(item,env,{model='gpt-5-mini',before=false}={}){
 env.AI_PROMPT_VERSION='meet-luna4';
 const attached=localizedReading(item.language),tools=createLunaTools({db:{},owner:510064401,operationKey:item.id,requestFocus:item.message,language:item.language,readingId:reading.id,readingContext:attached,catalog,personalContext:personal,access:{hasPaidPremium:false},quota:async()=>({}),astrologyEnabled:true,navigation:{personal_memory:true,tarot_daily:true,tarot_history:true},commerce:{read:async()=>({}),eligibility:async()=>({})},intelligence:{consented:true,prepare:async()=>{throw Error('Decision evaluation cannot execute actions');}}});
 const context={personalContext:personal,...(item.category==='tarot'||item.category==='conversation'?{modeContext:{mode:'tarot',readingContext:attached}}:{})};
 const base=buildLunaOpenAiRequest({language:item.language,catalog,context,recent:item.turns,maxOutputTokens:1000,intelligence:true}),body={...base,model,instructions:base.instructions+'\n'+lunaToolInstructions,tools:tools.definitions,tool_choice:'auto',parallel_tool_calls:false};
 if(before){const current=Object.values(meetLuna4Modules).join('\n\n');assert.ok(body.instructions.includes(current));body.instructions=body.instructions.replace(current,Object.values(beforeMeetLuna4Modules).join('\n\n'));}
 if(model==='gpt-5-mini')body.reasoning={effort:'minimal'};else delete body.reasoning;
 return{body,inputHash:hash({instructions:body.instructions,input:body.input,text:body.text,tools:body.tools}),policySource:before?beforePolicySourceCommit:'candidate',evaluate:payload=>evaluateLuna4Conversation(item,payload)};
}
export function buildInterpretationCase(item,env){
 env.AI_PROMPT_VERSION='meet-luna4';const ru=item.language==='ru',language=item.language;
 const question=ru?'Как начать небольшую практику рисования и понять, что мне подходит?':'How could I start a small drawing practice and see what suits me?';
 let body,validate,sources=null;
 if(item.kind==='natal'||item.kind==='compatibility'){
  const first=chart(item.variant??'exact'),second=item.kind==='compatibility'?chart('midnight'):undefined;
  body=buildAstrologyReportRequest({kind:item.kind==='natal'?'portrait':'compatibility',language,first,second,relationship:item.relationship,profile});validate=value=>validateFreshAstrologyReport(value,item.kind==='natal'?'portrait':'compatibility');sources={calculated:first.engineVersion,precision:first.timePrecision,hasAngles:first.ascendant!==null,relationship:item.relationship??null};
 }else if(['single','three','five'].includes(item.kind)){
  const cards=item.kind==='single'?[{cardId:item.cardId,orientation:item.orientation}]:['the-star','the-hermit','strength','two-of-cups','eight-of-pentacles'].slice(0,item.kind==='three'?3:5).map((cardId,index)=>({cardId,orientation:index%2?'upright':'reversed'}));for(const c of cards)assert.ok(tarotCatalog.some(v=>v.id===c.cardId));
  const input={clientReadingId:'00000000-0000-4000-8000-000000000060',kind:item.kind,cards,intention:item.intention,question,language,generate:true};
  body=item.kind==='single'?buildTarotAiRequest({...input,...cards[0]},profile,'gpt-5-mini',1800):buildSpreadAiRequest(input,profile,'gpt-5-mini');
  validate=value=>{const parsed=(item.kind==='single'?interpretationSchema:spreadInterpretationSchema).parse(value);assert.equal(parsed.version,2);validateTarotV2(parsed,cards.map((c,i)=>({...c,position:item.kind==='single'?(ru?'Основной взгляд':'Main perspective'):spreadPositions[language][item.kind][i]})));return parsed;};sources={cards};
 }else if(item.kind==='numerology'){
  const date=item.variant==='leap_day'?'2000-02-29':item.variant==='master_path'?'1993-07-29':'1988-12-31',asOf=item.variant==='calendar_boundary'?'2027-01-01':'2026-10-19',facts=calculateDateNumerology(date,asOf),request=ru?'Объясни число жизненного пути и личный год из этих рассчитанных данных. Один практический пример, без прогнозов.':'Explain Life Path and personal year from these calculated facts. One practical example, no prediction.';
  body=buildLunaOpenAiRequest({language,catalog:[],context:{personalContext:personal,numerology:facts},recent:[{role:'user',content:request}],intelligence:true,maxOutputTokens:1200});validate=value=>{assert.ok(typeof value.message==='string');assertGroundedNumerologyProse(value.message,facts,request);return value;};sources=facts;
 }else if(item.kind==='cross_system'||item.kind==='deep'){
  const permitted=personal.confirmedMemories.map((memory,index)=>({id:'confirmed_'+index,kind:'confirmed',label:memory.key,data:{category:memory.category,key:memory.key,value:memory.value}}));
  const numbered=calculateDateNumerology('2000-01-01','2026-10-19');if(item.kind==='cross_system')permitted.push({id:'numerology',kind:'calculated_symbolic',label:'Date numerology, symbolic',data:numbered},{id:'astrology',kind:'calculated_symbolic',label:'Calculated astrology, symbolic',data:item.variant==='date_only_cross_system'?calculateDateOnlySun('2000-01-01'):symbolicChartFacts(chart('exact'))});
  const comprehensive=item.variant==='comprehensive';body=buildDeepAnalysisRequest({language,question,personal,sources:permitted,...(comprehensive?{scope:'comprehensive',asOf:'2026-10-19'}:{topic:item.variant==='relationships'?'relationships':'growth'})});validate=value=>comprehensive?validateComprehensivePortrait(value,permitted,language):validateDeepAnalysis(value,permitted);sources=permitted;
 }else{
  const natal=item.variant==='saved_natal',grounding=compact(chart('exact')),request=ru?'Что это значит для моего следующего маленького шага? Не создавай новый разбор.':'What does this mean for my next small step? Do not create another report.';
  const attached=localizedReading(language);body=buildLunaOpenAiRequest({language,catalog:[],context:{personalContext:personal,modeContext:natal?{mode:'astrology',chartContext:{first:grounding}}:{mode:'tarot',readingContext:attached}},recent:[{role:'user',content:natal?(ru?'Обсуждаем уже рассчитанную натальную карту.':'We are discussing my already calculated chart.'):(ru?'Расклад уже раскрыт и сохранён.':'The reading is already revealed and saved.')},{role:'assistant',content:ru?'Можно обсудить только подтверждённый прикреплённый результат.':'We can discuss the exact attached result.'},{role:'user',content:request}],intelligence:true,answerFromSelectedEvidence:true,maxOutputTokens:1300});
  validate=value=>{assert.ok(typeof value.message==='string');assert.ok(value.message.trim().split(/\s+/u).length<=200,'Concise saved-result follow-up');assert.doesNotMatch(value.message,/(?:Quick replies:|Быстрые ответы:)/iu);if(natal){assertGroundedAstrologyProse(value.message,{first:grounding},'Alex',null,request);assertSubstantiveAstrologyAnswer(value.message,{first:grounding},request);}return value;};sources=natal?grounding:attached;
 }
 return{body,requestHash:hash(body),sourceHash:hash(sources),sourceSummary:sources,evaluate:payload=>{
  const raw=responseOutputText(payload);let parsed,error=null;try{assert.equal(payload.status,'completed');parsed=validate(JSON.parse(raw));}catch(e){error=String(e.message).slice(0,500);}
  const prose=raw??'',cyr=(prose.match(/[а-яё]/gi)??[]).length;
  return{complete:payload.status==='completed',schemaAndSourceContract:!error,validationError:error,languageMatch:language==='ru'?cyr>20:cyr<10,answer:parsed??raw,humanReviewRequired:true};
 }};
}
export async function runLuna4Quality({action,env,result,persist,invoke,arm}){
 const set=action==='quality'?luna4ConversationCases:luna4InterpretationCases,key=action==='quality'?'conversations':'interpretations';result[key]??=[];
 if(action==='interpretations'){
  // Retain paid-call and before-answer evidence. Only changed fixed request
  // bodies need another provider test; byte-identical cases are reused with
  // their original call hash rather than spending again or resetting budgets.
  const retained=[];for(const prior of result.interpretations){const item=set.find(c=>c.id===prior.caseId);assert.ok(item);const requestHash=buildInterpretationCase(item,env).requestHash,oldHash=prior.requestHash??result.calls.findLast(c=>c.tag==='smoke:interpretations:'+prior.caseId)?.inputHash;assert.ok(oldHash,'Original request provenance is required');if(oldHash===requestHash)retained.push({...prior,requestHash});else{result.supersededInterpretations??=[];result.supersededInterpretations.push({...prior,requestHash:oldHash,supersededAt:new Date().toISOString(),replacementRequestHash:requestHash,reason:'Reviewed request/prompt correction; original provider usage retained.'});}}
  result.interpretations=retained;result.interpretationsComplete=retained.length===set.length;await persist();
 }
 const done=new Set(result[key].map(c=>c.caseId));
 for(const item of set.filter(c=>!done.has(c.id)).slice(0,6)){
  const built=action==='quality'?buildConversationCase(item,env):buildInterpretationCase(item,env);result.currentStep=action+':'+item.id;await persist();arm(true);let payload;try{payload=await(await invoke(built.body)).json();}finally{arm(false);}
  result[key].push({caseId:item.id,category:item.category??item.kind,language:item.language,...(built.inputHash?{inputHash:built.inputHash}:{}),...(built.requestHash?{requestHash:built.requestHash}:{}),...(built.sourceHash?{sourceHash:built.sourceHash,sourceSummary:built.sourceSummary}:{}),...built.evaluate(payload)});await persist();
 }
 result[action==='quality'?'qualityComplete':'interpretationsComplete']=result[key].length===set.length;
}
export async function runLuna4Comparisons({env,result,persist,invoke,arm}){
 // Paired prompts, histories, schemas and tool definitions are byte-identical.
 // Only model/reasoning transport differs. No production routing is changed.
 // Reserve the existing finite allowance for real delivery and corrected
 // journeys. Explicit meditation commands already bypass the provider; compare
 // the two provider-dependent tasks (Tarot and memory follow-up) in RU and EN.
 const selection=[34,35,82].map(index=>luna4ConversationCases[index]),beforeSelection=selection,tasks=selection.flatMap(item=>['gpt-5-mini','gpt-4.1-mini','gpt-4o-mini'].map(model=>({item,model,before:false}))).concat(beforeSelection.map(item=>({item,model:'gpt-5-mini',before:true})));result.comparisons??=[];
 for(const task of tasks.filter(t=>!result.comparisons.some(r=>r.caseId===t.item.id&&r.model===t.model&&r.before===t.before)).slice(0,3)){
  const built=buildConversationCase(task.item,env,task);result.currentStep='comparison:'+task.item.id+':'+task.model+':'+task.before;await persist();arm(true);let payload;try{payload=await(await invoke(built.body)).json();}finally{arm(false);}
  result.comparisons.push({caseId:task.item.id,model:task.model,before:task.before,inputHash:built.inputHash,policySource:built.policySource,comparisonBasis:'Same fixed tool/context harness; frozen production policy versus candidate policy, not a full old-backend replay.',...built.evaluate(payload)});await persist();
 }
 result.comparisonsComplete=result.comparisons.length===tasks.length;
}
