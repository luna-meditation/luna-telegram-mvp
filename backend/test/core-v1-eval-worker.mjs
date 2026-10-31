// Request construction only. Parent uses an external-network-denied environment.
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {memoryRows} from './core-v1-eval-cases.mjs';
const input=JSON.parse(await readFile(process.argv[2],'utf8')),root=resolve(input.sourceRoot),module=name=>import(pathToFileURL(resolve(root,'backend/src',name+'.ts')).href);
const [{buildLunaOpenAiRequest},memoryPolicy,personalPolicy,languagePolicy,{calculateNatalChart,astrologyEngineMetadata},{symbolicChartFacts},{tarotCatalog},{spreadPositions}]=await Promise.all([module('luna-ai'),module('personal-memory-policy'),module('personalization-policy'),module('luna-ai-policy'),module('luna30-astrology-engine'),module('luna30-astrology-report-policy'),module('tarot-policy'),module('tarot-spread-policy')]);
const languageModule=await module('luna40-language');
const {item,turn,history}=input,message=item.turns[turn],recent=[...history,{role:'user',content:message}];
// Reproduce the actual pre-Core central-chat call site, including its explicit
// interface-language flag; do not accidentally evaluate the policy's default.
const language=languageModule.resolveConversationLanguage?languageModule.resolveConversationLanguage(message,item.interfaceLanguage,recent,'auto'):languagePolicy.resolveResponseLanguage(message,item.interfaceLanguage,recent,true);
const rows=input.memoryRows??memoryRows(item,turn),personal=personalPolicy.permittedPersonalContext({...personalPolicy.emptyPersonalProfile,ai_context_consent:true,...(item.knownBirth?{known_birth:item.knownBirth}:{}),confirmed_memories:memoryPolicy.selectRelevantMemories(rows,message),saved_reflections:memoryPolicy.selectRelevantReflections(rows,message)});
const context={personalContext:personal,runtimeDecision:{intent:'general_chat',action:'none',confidence:1},previousQuickReplies:[]};
if(input.guidedEntry)context.guidedEntry=input.guidedEntry;
if(input.freshEntry)context.freshEntry=input.freshEntry;
let groundTruth={family:item.family,confirmedMemoryIds:personal?.confirmedMemories?.map(row=>row.id)??[],forbidden:['PRIVATE_MEMORY_CANARY_47','UNSOURCED_MEMORY_CANARY_48']};
if(input.selectedOpening&&item.family==='discovery'&&turn===1){
 const [{buildPersonalPortrait},{portraitDiscussionOpening}]=await Promise.all([module('personal-portrait-policy'),module('portrait-discussion-policy')]);
 const p=buildPersonalPortrait({memories:rows,profile:{...personalPolicy.emptyPersonalProfile,ai_context_consent:true},memoryEnabled:true,hasBirth:false});
 const opening=portraitDiscussionOpening(p,'discoveries',item.language,{id:rows[0].id,updatedAt:rows[0].updated_at});
 recent.unshift({role:'assistant',content:opening.content});context.selectedDiscovery=opening.sources[0];groundTruth.selectedOpening=opening;
}
if(item.family.startsWith('tarot')||item.family==='cross_domain'){
 const kind=item.family==='tarot_spread'?'three':'single',chosen=tarotCatalog.slice(0,kind==='three'?3:1),cards=chosen.map((card,index)=>({cardId:card.id,orientation:index===0?'reversed':'upright',name:card.name[language],meaning:card.meaning[language][index===0?'reversed':'upright'],position:kind==='three'?spreadPositions[language].three[index]:(language==='ru'?'Основной взгляд':'Main perspective')}));
 const reading={id:'00000000-0000-4000-8000-000000000030',kind,cards,intention:'growth',question:language==='ru'?'Как начать творческую практику без давления?':'How can I begin a creative practice without pressure?',savedInterpretation:null};
 context.modeContext={mode:'tarot',personalContext:personal,readingContext:reading};groundTruth={...groundTruth,reading};
}
if(item.family==='astrology'){
 const calculation=calculateNatalChart({date:'2000-01-01',time:'12:00',location:{label:'Synthetic London',latitude:51.5,longitude:0,timezone:'Etc/UTC',placeId:'geonames:2643743',provider:'geonames',confirmed:true}}),facts=symbolicChartFacts(calculation);
 const chart={sourceValidity:{first:{state:'current',profileRevision:1,currentProfileRevision:1,calculatedAt:'2026-10-22T00:00:00.000Z',engineVersion:astrologyEngineMetadata.version}},first:{subject:{label:'Synthetic self',kind:'self'},precision:facts.precision,placements:Object.fromEntries(facts.planets.map(planet=>[planet.planet,planet.signs.join('/')])),ascendant:facts.ascendant,houseSigns:facts.houseSigns.join(','),aspects:calculation.aspects.filter(aspect=>aspect.from==='mercury'||aspect.to==='mercury').sort((a,b)=>a.orb-b.orb).slice(0,10),warnings:facts.warnings.join(',')},selectedPlanet:'mercury',relationship:null,selectedAspect:null,savedReport:null};
 context.modeContext={mode:'astrology',personalContext:personal,chartContext:chart};groundTruth={...groundTruth,chart,calculation};
}
const body=buildLunaOpenAiRequest({language,catalog:[],context,recent,intelligence:true,answerFromSelectedEvidence:Boolean(context.modeContext),maxOutputTokens:2600});
let directReply=null;
if(input.verifyDirectAction){
 const [{resolveIntelligenceCommand},{createIntelligenceActionService},{createClient}]=await Promise.all([module('luna-intelligence-command'),module('luna-intelligence-actions'),import('@supabase/supabase-js')]);
 const command=resolveIntelligenceCommand(message);
 if(command&&(command.action==='capability.unavailable'&&['personal_companion','date_only_chart'].includes(command.input.capability)||command.action==='navigation.open'&&command.input.destination==='memory')){
  const db=createClient('https://synthetic.invalid','synthetic-only',{auth:{persistSession:false},global:{fetch:async()=>{throw Error('evaluation_direct_action_must_not_read_database');}}});
  const service=createIntelligenceActionService(db,{features:{central:true,spreads:true,tarot_history:true,tarot_daily:true,astrology:true,personal_memory:true},usage:async()=>{throw Error('quota_read_not_expected');},eligibility:async()=>{throw Error('financial_read_not_expected');}});
  directReply={command,...await service.prepare(880000002,'00000000-0000-4000-8000-000000000099',language,command),scope:'Actual free action preparation; no DB reads, persistence, provider call or financial operation'};
 }
}
await writeFile(input.output,JSON.stringify({language,body,groundTruth,...(input.verifyDirectAction?{directReply}:{}),scope:'actual request builder with synthetic source projections; not full chat persistence or tool execution'},null,2)+'\n');
