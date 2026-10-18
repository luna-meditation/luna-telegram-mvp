// Expiring operator-authenticated tests on the EXISTING staging only.
// Each named program has its own immutable approved budget. Intelligence 2.0
// reuses this harness beside staging secrets: 36 decisions + full journeys,
// <=60 provider calls / $0.50. No production user data or keys are exported.
import assert from 'node:assert/strict';
import {randomUUID,createHash,createHmac} from 'node:crypto';
import {authorizeLuna32Smoke,luna32StagingSite} from '../dist/luna32-staging-guard.js';
import {intelligenceCases as allIntelligenceCases,evaluateIntelligenceDecision} from './luna-intelligence-cases.mjs';
import {protectedStateFingerprint} from './luna31-financial-guard.mjs';
const qaOwner=158467796;
// Official standard-tier pricing fetched 2026-10-18. Per million tokens.
const models=[{id:'gpt-5-mini',input:.25,cached:.025,output:2,reasoning:'minimal'},{id:'gpt-4.1-mini',input:.4,cached:.1,output:1.6},{id:'gpt-4o-mini',input:.15,cached:.075,output:.6}];
const must=async q=>{const r=await q;assert.ifError(r.error);return r.data;};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function run(request,context,options){
 const v2=options.program==='intelligence2',runName=v2?'luna-intelligence-2-0-20261018-v1':'luna-intelligence-1-0-20261018-v1',owner=v2?510052001:510051001,limit=v2?{calls:60,microusd:500000}:{calls:180,microusd:1000000};
 const intelligenceCases=v2?allIntelligenceCases.filter((_,i)=>[0,6,10,15,20,23,25,32,37,41,45,46].includes(i)):allIntelligenceCases;
 if(!authorizeLuna32Smoke(request,context.site?.id,options)||Netlify.env.get('SUPABASE_URL')!=='https://funvzpmpbgazsisehiru.supabase.co')return new Response(null,{status:403});
 const {netlifyStagingHandler}=await import('../dist/netlify-staging-handler.js');await netlifyStagingHandler(new Request('https://luna-staging-itfl.netlify.app/health'),{site:{id:luna32StagingSite},ip:'127.0.0.1'});
 const {supabase:db}=await import('../dist/db.js'),{env}=await import('../dist/config.js');assert.ok(env.STAGING_MODE&&env.STAGING_SUPABASE_PROJECT_REF==='funvzpmpbgazsisehiru');
 const headers={'Cache-Control':'private, no-store'},stored=await must(db.from('luna30_qa_report_runs').select('state,result').eq('run_name',runName).maybeSingle());
 if(options.readOnly)return Response.json(stored??{state:'not_started',result:null},{headers});
 const command=await request.json();assert.ok(['inventory','batch','smoke','close'].includes(command.action));assert.match(command.batchId,/^[a-f0-9-]{36}$/);
 const datasetHash=hash(intelligenceCases);
 if(!stored){const result={status:'IN_PROGRESS',sourceCommit:options.sourceCommit,datasetHash,approvedCalls:limit.calls,approvedMicrousd:limit.microusd,providerCalls:0,spentMicrousd:0,spentUsdExact:0,heldMicrousd:0,results:[],calls:[],checks:[],ids:{},batches:[],productionTouched:false,realStarsPayments:0,providerWindowOpen:false};const created=await db.from('luna30_qa_report_runs').insert({run_name:runName,state:'paused',result});if(created.error?.code==='23505')return new Response(null,{status:204});assert.ifError(created.error);}
 const claim='running:'+randomUUID(),claimed=await must(db.from('luna30_qa_report_runs').update({state:claim}).eq('run_name',runName).eq('state','paused').select('result').maybeSingle());if(!claimed)return new Response(null,{status:204});
 const result=claimed.result;let finalState='paused',originalSettings,originalEnv,armed=false,breathTimer;
 const persist=()=>must(db.from('luna30_qa_report_runs').update({result}).eq('run_name',runName).eq('state',claim).select('run_name').single());
 const check=(name,ok)=>{assert.ok(ok,name);if(!result.checks.some(c=>c.name===name))result.checks.push({name,status:'PASS'});};
 const id=key=>result.ids[key]??(result.ids[key]=randomUUID());
 const originalFetch=globalThis.fetch;
 async function invoke(body,tag){
  const model=models.find(m=>m.id===body.model);assert.ok(model,'unapproved_model');
  const ceiling=Math.ceil((Buffer.byteLength(JSON.stringify(body),'utf8')+1024)*model.input+(body.max_output_tokens??2200)*model.output);
  assert.ok(!result.activeCall&&result.providerCalls<limit.calls&&result.spentMicrousd+result.heldMicrousd+ceiling<=limit.microusd,'approved_budget_exhausted');
  if(v2)assert.doesNotMatch(JSON.stringify(body),/UNCONFIRMED_QA_PRIVATE_GOAL|DELETED_QA_PRIVATE_GOAL/,'unconfirmed/deleted context leak');
  const call={index:++result.providerCalls,tag,model:model.id,ceiling,inputBytes:Buffer.byteLength(JSON.stringify(body),'utf8'),inputHash:hash(body),startedAt:new Date().toISOString()};result.calls.push(call);result.activeCall={index:call.index,ceiling};result.heldMicrousd+=ceiling;await persist();const started=Date.now();
  const response=await originalFetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${Netlify.env.get('OPENAI_API_KEY')}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)}),text=await response.text();let payload;try{payload=JSON.parse(text);}catch{throw Error('unverified_provider_response');}
  const u=payload.usage,cached=u?.input_tokens_details?.cached_tokens??0;
  if(!response.ok||!u||!Number.isSafeInteger(u.input_tokens)||!Number.isSafeInteger(u.output_tokens)||cached>u.input_tokens||!(payload.model===model.id||payload.model?.startsWith(model.id+'-20'))||!['default','auto'].includes(payload.service_tier??'')){Object.assign(call,{status:'UNKNOWN_COST',httpStatus:response.status,latencyMs:Date.now()-started});await persist();throw Error('provider_usage_requires_reconciliation');}
  const exact=((u.input_tokens-cached)*model.input+cached*model.cached+u.output_tokens*model.output)/1000000,costMicrousd=Math.ceil(exact*1000000);assert.ok(costMicrousd<=ceiling,'provider_cost_overrun');
  result.heldMicrousd-=ceiling;result.spentMicrousd+=costMicrousd;result.spentUsdExact+=exact;delete result.activeCall;
  Object.assign(call,{status:payload.status,inputTokens:u.input_tokens,cachedTokens:cached,outputTokens:u.output_tokens,costMicrousd,costUsdExact:exact,latencyMs:Date.now()-started,tools:(payload.output??[]).filter(v=>v.type==='function_call').map(v=>v.name)});await persist();
  // Private finite QA ledger ONLY: these are synthetic answers, not production
  // logs. Preserve rejected answers for human review without paying to rerun.
  if(v2&&tag.startsWith('smoke:')){call.syntheticOutput=JSON.stringify((payload.output??[]).filter(item=>item.type==='message'||item.type==='function_call')).slice(0,16000);await persist();}
  return{response:new Response(text,{status:response.status,statusText:response.statusText,headers:response.headers}),payload,meter:call};
 }
 try{
  assert.equal(result.datasetHash,datasetHash,'dataset_changed');assert.equal(result.approvedCalls,limit.calls);assert.equal(result.approvedMicrousd,limit.microusd);assert.ok(!result.activeCall&&result.heldMicrousd===0,'unknown_provider_outcome_requires_reconciliation');
  if(result.batches.includes(command.batchId))return new Response(null,{status:204});
  assert.ok(Netlify.env.get('OPENAI_API_KEY'),'server_key_unavailable');
  if(!result.availability){const response=await originalFetch('https://api.openai.com/v1/models',{headers:{Authorization:`Bearer ${Netlify.env.get('OPENAI_API_KEY')}`},signal:AbortSignal.timeout(20000)});assert.equal(response.status,200);const available=(await response.json()).data?.map(v=>v.id)??[];result.availability=models.map(m=>({model:m.id,available:available.includes(m.id)}));await persist();}
  check('all three approved candidate models actually available',result.availability.every(v=>v.available));
  if(command.action==='inventory'){result.batches.push(command.batchId);return new Response(null,{status:204});}
  if(command.action==='batch'){
   const {buildLunaOpenAiRequest}=await import('../dist/luna-ai.js'),{createLunaTools,lunaToolInstructions}=await import('../dist/luna32-tools.js');
   const catalog=[{id:'00000000-0000-4000-8000-000000000051',title:'Synthetic Focus',duration:180,durationSeconds:180,published:true,premium:false,language:'en',audioLanguage:'en',summary:'Synthetic focus practice, not a live catalog track.'}],readingId='00000000-0000-4000-8000-000000000052';
   const readingContext={id:readingId,kind:'three',cards:[{cardId:'the-star',orientation:'reversed',position:'Present'},{cardId:'the-hermit',orientation:'upright',position:'Challenge'},{cardId:'strength',orientation:'upright',position:'Next step'}],question:'How can I approach my small prototype?',intention:'growth'};
   const personal={displayName:'Alex',interests:['meditation'],preferences:'Short practical replies. Use exactly my chosen name.',confirmedMemories:[{category:'goals',key:'prototype_goal',value:'Build a useful small prototype and test with two volunteers.',updatedAt:'2026-10-18T00:00:00Z'}]};
   const done=new Set(result.results.map(v=>v.caseId+':'+v.model)),tasks=intelligenceCases.flatMap(item=>models.map(model=>({item,model}))).filter(({item,model})=>!done.has(item.id+':'+model.id));
   for(const {item,model} of tasks.slice(0,10)){
    const registry=createLunaTools({db:{},owner,operationKey:'synthetic-benchmark',language:item.language,readingId,readingContext,catalog,personalContext:personal,access:{},quota:async()=>({}),astrologyEnabled:true,navigation:{personal_memory:true,tarot_daily:true,tarot_history:true},commerce:{read:async()=>({}),eligibility:async()=>({})},intelligence:{consented:true,prepare:async()=>{throw Error('decision benchmark does not execute tools');}}});
    const context={profile:null,memories:[],personalContext:['memory','journal','history'].includes(item.category)?personal:null,...(item.category==='tarot'||item.category==='context_switch'?{modeContext:{mode:'tarot',personalContext:null,readingContext}}:{})};
    const base=buildLunaOpenAiRequest({language:item.language,catalog,context,recent:item.turns,maxOutputTokens:1600,intelligence:true}),body={...base,model:model.id,instructions:base.instructions+'\n'+lunaToolInstructions,tools:registry.definitions,tool_choice:'auto',parallel_tool_calls:false};if(model.reasoning)body.reasoning={effort:model.reasoning};else delete body.reasoning;
    const inputHash=hash({instructions:body.instructions,input:body.input,text:body.text,tools:body.tools,maxOutput:body.max_output_tokens}),prior=result.results.find(v=>v.caseId===item.id);assert.ok(!prior||prior.inputHash===inputHash,'paired_model_input_changed');
    const {payload,meter}=await invoke(body,'benchmark:'+item.id);result.results.push({caseId:item.id,model:model.id,language:item.language,category:item.category,inputHash,latencyMs:meter.latencyMs,inputTokens:meter.inputTokens,outputTokens:meter.outputTokens,costUsdExact:meter.costUsdExact,...evaluateIntelligenceDecision(item,payload)});await persist();
   }
   result.benchmarkComplete=result.results.length===intelligenceCases.length*models.length;result.batches.push(command.batchId);await persist();return new Response(null,{status:204});
  }
  if(command.action==='smoke'){
   if(result.smokeComplete&&result.runtimeFixVerified&&(!v2||result.numerologyGroundingVerified))return new Response(null,{status:204});
   if(v2&&result.failure){result.priorFailures??=[];result.priorFailures.push({...result.failure,sourceCommit:result.sourceCommit});delete result.failure;result.status='IN_PROGRESS';}
   originalEnv={...env};originalSettings=await must(db.from('luna32_runtime_settings').select('*').eq('id',true).single());check('staging generation closed before finite test',originalSettings.generation_enabled===false);
   const fingerprint=async()=>protectedStateFingerprint(await must(db.from('users').select('lifetime_access,active_until,free_used').eq('telegram_id',qaOwner).single()),await must(db.from('moon_gardens').select('*').eq('telegram_id',qaOwner)));
   result.qaProtectedBefore=await fingerprint();result.providerWindowOpen=true;result.settingsToRestore=originalSettings;await persist();
   const signed=(user=qaOwner)=>{const data=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:user,first_name:'Synthetic QA',language_code:'en'})}),text=[...data].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n'),key=createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest();data.set('hash',createHmac('sha256',key).update(text).digest('hex'));return data.toString();};
   const api=async(auth)=>netlifyStagingHandler(new Request('https://luna-staging-itfl.netlify.app/api/luna/conversations',{headers:{'x-telegram-init-data':auth}}),{site:{id:luna32StagingSite},ip:'127.0.0.1'});
   check('real Telegram auth rejects absent forged and nonallowlisted identities',(await api('')).status===401&&(await api('hash=forged')).status===401&&(await api(signed(owner))).status===403);check('real QA signed Telegram auth opens only own history',(await api(signed())).status===200);
   const month=new Date().toISOString().slice(0,7)+'-01',totals=await must(db.from('luna32_ai_month_totals').select('spent_cost_microusd,held_cost_microusd').eq('month',month).maybeSingle());check('no unknown shared staging accounting hold',!Number(totals?.held_cost_microusd));
   Object.assign(env,{FEATURE_LUNA_INTELLIGENCE:true,AI_PROMPT_VERSION:'intelligence-v1',FEATURE_AI_CENTRAL_EXPERIENCE:true,AI_CHAT_ENABLED:true,AI_MAX_MESSAGES_PER_DAY:100,AI_PREMIUM_MAX_MESSAGES_PER_DAY:100,AI_STRUCTURED_MAX_OUTPUT_TOKENS:2200,AI_MAX_OUTPUT_TOKENS:1800});
   await must(db.from('luna32_runtime_settings').update({generation_enabled:true,public_beta:true,beta_starts_at:new Date(Date.now()-60000).toISOString(),beta_expires_at:new Date(Date.now()+12*60000).toISOString(),cost_baseline_verified:true,baseline_month:month,legacy_monthly_cost_microusd:0,monthly_cap_microusd:Number(totals?.spent_cost_microusd??0)+limit.microusd-result.spentMicrousd,free_daily_limit:100,premium_daily_limit:100}).eq('id',true));
   globalThis.fetch=async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.hostname!=='api.openai.com')return originalFetch(input,init);assert.ok(armed&&url.pathname==='/v1/responses','only finite synthetic Responses tests are approved');return(await invoke(JSON.parse(init.body),'smoke:'+result.currentStep)).response;};
   await must(db.from('users').upsert({telegram_id:owner,first_name:'Synthetic Intelligence QA',language_code:'ru',ai_memory_enabled:true},{onConflict:'telegram_id',ignoreDuplicates:true}));
   await must(db.from('moon_gardens').upsert({telegram_id:owner,moon_seeds_available:1000,moon_seeds_earned_total:1000},{onConflict:'telegram_id',ignoreDuplicates:true}));
   const {savePersonalProfile}=await import('../dist/personalization.js'),{writePersonalMemory,getAiPersonalProfile,listPersonalMemories,removePersonalMemory}=await import('../dist/personal-memory.js');
   const memoryFixtureVerified=result.checks.some(c=>c.name==='confirmed memory is used; pending/deleted facts excluded'&&c.status==='PASS');
   if(!memoryFixtureVerified)await savePersonalProfile(owner,{display_name:'Alex',interests:['meditation'],preferences:'Use my chosen name exactly. Short practical replies, no diminutives.',birth_date:null,birth_time:null,birth_place:null,ai_context_consent:true});
   if(!(await listPersonalMemories(owner)).some(m=>m.memory_key==='prototype_goal'))await writePersonalMemory(owner,{category:'goals',key:'prototype_goal',value:'Build a useful small prototype and test with two volunteers.',confirmed:true,kind:'fact'});
   if(!(await listPersonalMemories(owner)).some(m=>m.memory_key==='unchecked_goal'))await writePersonalMemory(owner,{category:'goals',key:'unchecked_goal',value:'UNCONFIRMED_QA_PRIVATE_GOAL',confirmed:false,kind:'fact'});
   if(!memoryFixtureVerified){const disposable=await writePersonalMemory(owner,{category:'goals',key:'deleted_goal',value:'DELETED_QA_PRIVATE_GOAL',confirmed:true,kind:'fact'});await removePersonalMemory(owner,disposable.id);}
   const permitted=await getAiPersonalProfile(owner,'prototype goal');check('confirmed memory is used; pending/deleted facts excluded',JSON.stringify(permitted.confirmed_memories).includes('prototype')&&!/UNCONFIRMED_QA|DELETED_QA/.test(JSON.stringify(permitted)));
   const {sendLunaMessage,getLunaConversation}=await import('../dist/luna-ai.js'),{openChatTarot,revealChatTarot}=await import('../dist/luna24-chat.js');let conversationId=result.ids.conversation;
   // The first action's original input omitted conversationId. Its idempotent
   // retry must keep that input, even after the run later saved the returned ID.
   if(v2&&result.start_single)conversationId=undefined;
   async function turn(tag,message,language,extra={}){result.currentStep=tag;await persist();armed=true;let reply;const input={requestId:id(tag),message,language,intelligenceVersion:1,...(conversationId?{conversationId}:{}),...extra};try{reply=await sendLunaMessage({telegram_id:owner,first_name:'Synthetic QA',language_code:language},input);}finally{armed=false;}conversationId=reply.conversationId;result.ids.conversation=conversationId;const count=result.providerCalls,again=await sendLunaMessage({telegram_id:owner,first_name:'Synthetic QA',language_code:language},input),reopened=await getLunaConversation(owner,conversationId);check(tag+' saved and reopened without another provider call',again.message.id===reply.message.id&&reopened.messages.some(m=>m.id===reply.message.id)&&count===result.providerCalls);result[tag]={text:reply.message.content,metadata:reply.message.metadata};await persist();return reply;}
   const seedsBefore=Number((await must(db.from('moon_gardens').select('moon_seeds_available').eq('telegram_id',owner).single())).moon_seeds_available);
   if(v2&&result.smokeComplete){
    const answer=await turn('numerology_grounded_v2','Different topic: use my confirmed birth date to calculate my Life Path and personal year. Explain the symbolic limits.','en',{contextReset:true});
    const {assertGroundedNumerologyProse}=await import('../dist/luna-intelligence-grounding.js'),{calculateDateNumerology}=await import('../dist/luna-intelligence-numerology.js');
    assertGroundedNumerologyProse(answer.message.content,calculateDateNumerology('2000-01-01',new Date().toISOString().slice(0,10)),'Explain my Life Path and personal year, with symbolic limits.');
    check('corrected numerology uses exact calculated numbers and concise symbolic limits',result.calls.some(c=>c.tag==='smoke:numerology_grounded_v2'&&c.tools?.includes('get_date_numerology'))&&/symbolic|not.{0,12}scien/i.test(answer.message.content));
    check('corrected numeric discussion preserves Seeds and real QA rights',seedsBefore===Number((await must(db.from('moon_gardens').select('moon_seeds_available').eq('telegram_id',owner).single())).moon_seeds_available)&&await fingerprint()===result.qaProtectedBefore);
    result.numerologyGroundingVerified=true;result.runtimeFixVerified=true;result.validationCommit=options.sourceCommit;result.batches.push(command.batchId);await persist();return new Response(null,{status:204});
   }
   if(result.smokeComplete){
    const answer=await turn('ordinary_fixed','Different topic. Help me choose one small prototype step without mystical systems.','en',{contextReset:true});
    check('prototype request answers the actual goal, not a stale meditation menu',/prototype|volunteer|user.{0,15}test/i.test(answer.message.content)&&!/are you looking for sleep|gentler reset|meditation|mercury|tarot/i.test(answer.message.content)&&!answer.message.metadata.meditationAction);
    const count=result.providerCalls;
    for(const [tag,text,language]of [['typo_meditation','Find a meditaton for focus.','en'],['support','Открой поддержку, пока ничего не отправляй.','ru'],['unsupported_file','Создай Excel-файл и дай ссылку для скачивания.','ru']])await turn(tag,text,language);
    check('corrected explicit actions need no provider and no Seeds debit',result.providerCalls===count&&seedsBefore===Number((await must(db.from('moon_gardens').select('moon_seeds_available').eq('telegram_id',owner).single())).moon_seeds_available));
    result.runtimeFixVerified=true;result.validationCommit=options.sourceCommit;result.batches.push(command.batchId);await persist();return new Response(null,{status:204});
   }
   for(const [kind,count,language] of [['single',1,'en'],['three',3,'ru'],['five',5,'ru']]){
    const command=await turn('start_'+kind,language==='ru'?`Давай расклад на ${count} карт.`:`Draw ${count} Tarot card.`,language),a=command.message.metadata.intelligence.attachments.find(a=>a.type==='tarot_reading');check(kind+' starts exact embedded selector, not history or breathing',a.payload.kind===kind);
    const input={clientReadingId:a.payload.clientReadingId,conversationId,kind,intention:'career',question:'Which small prototype step deserves attention?',language,actionMessageId:command.message.id,choiceSlots:Array.from({length:count},(_,i)=>i)};let r=await openChatTarot(owner,input);
    for(let index=0;index<count&&r.message.metadata.tarot.reading.status!=='ready';index++){result.currentStep='interpret_'+kind;armed=true;try{r=await revealChatTarot(owner,r.message.id,{index});}finally{armed=false;}}
    const before=result.providerCalls,replay=await openChatTarot(owner,input);check(kind+' real cards and saved AI interpretation reopen for free',r.message.metadata.tarot.reading.status==='ready'&&replay.message.metadata.tarot.readingId===r.message.metadata.tarot.readingId&&result.providerCalls===before);result['reading_'+kind]={id:r.message.metadata.tarot.readingId,interpretation:r.message.metadata.tarot.reading.interpretation,cards:r.message.metadata.tarot.reading.cards};await persist();
   }
   await turn('tarot_followup','Свяжи точные карты этого расклада с моей подтверждённой целью по прототипу. Один небольшой шаг.','ru',{mode:'tarot',readingId:result.reading_three.id,attachmentSelected:true});
   const med=await turn('meditation','Подбери медитацию для фокуса.','ru');check('actual published meditation action displayed',Boolean(med.message.metadata.meditationAction?.meditationId)&&med.message.metadata.intelligence.attachments[0]?.type==='meditation');check('meditation is not false playback',!/включила|запустила|playback started/i.test(med.message.content));
   const breath=await turn('breathing','Давай подышим одну минуту.','ru');check('working breathing control prepared, never auto-started or rewarded',breath.message.metadata.intelligence.attachments[0]?.type==='breathing_session'&&breath.message.metadata.intelligence.attachments[0].status==='AUTHORIZED');
   const proof=await must(db.rpc('luna34_start_breath',{p_owner:owner,p_client:id(v2?'breath_proof_grounding_v4':'breath_proof'),p_mode:'calm',p_duration:60})),breathStarted=Date.now();let heartbeats=Promise.resolve();
   const beat=()=>must(db.rpc('luna34_breath_heartbeat',{p_owner:owner,p_session:proof.id,p_active:true}));await beat();breathTimer=setInterval(()=>{heartbeats=heartbeats.then(beat);},5000);
   const {createAstrologyService}=await import('../dist/luna30-astrology-service.js'),{createAstrologyWorkflowService}=await import('../dist/luna33-workflows.js'),{verifiedAstrologyChatContext}=await import('../dist/luna30-astrology-chat-context.js');
   const service=createAstrologyService(db,()=>true),location=(await service.locations('London')).locations[0];let profiles=(await service.list(owner)).profiles;
   for(const [kind,label,date] of [['self','Synthetic A','2000-01-01'],['other','Synthetic B','1992-08-20']])if(!profiles.some(p=>p.display_label===label))await service.save(owner,{subjectKind:kind,label,date,time:kind==='self'?'12:00':null,placeId:location.placeId,consent:true});
   profiles=(await service.list(owner)).profiles;const first=profiles.find(p=>p.subject_kind==='self'),second=profiles.find(p=>p.subject_kind==='other');
   const workflows=createAstrologyWorkflowService(db,()=>true),natal=await workflows.open(owner,{requestId:id('natal'),conversationId,kind:'natal',language:'en'});check('one self profile opens real chart without repeated confirmation',natal.message.metadata.astrologyWorkflow.state==='ready');
   const compared=await workflows.open(owner,{requestId:id('compatibility'),conversationId,kind:'compatibility',language:'ru',firstProfileId:first.id,secondProfileId:second.id,relationship:'business'}),attachment=compared.message.metadata.astrology;
   const exact=await verifiedAstrologyChatContext(db,owner,attachment);check('compatibility has distinct type, actual pair and relationship',exact.reference.type==='compatibility_report'&&exact.reference.relationship==='business');
   const relationship=await turn(v2?'compatibility_grounded_v2':'compatibility_followup','Как нам лучше выстроить деловое общение? Используй именно эти две рассчитанные карты. Коротко.','ru',{mode:'astrology',astrology:attachment,attachmentSelected:true,astrologyConsent:true});check('compatibility answer is not Tarot or romance',!/таро|расклад|tarot|romantic relationship/i.test(relationship.message.content));
   if(v2){const {assertGroundedAstrologyProse}=await import('../dist/luna-intelligence-grounding.js');assertGroundedAstrologyProse(relationship.message.content,exact,'Alex');check('compatibility canonical labels and facts are verified before saving',!/Арт[её]м/i.test(relationship.message.content)&&exact.first.subject.label==='Synthetic A'&&exact.second.subject.label==='Synthetic B');}
   const switched=await turn(v2?'natal_grounded_v2':'natal_after_tarot','Explain Mercury in my calculated chart briefly.','en',{mode:'astrology',astrology:natal.message.metadata.astrology,attachmentSelected:true,astrologyConsent:true});check('natal follow-up uses exact chart, not old Tarot',!/tarot|spread|таро|расклад/i.test(switched.message.content));
   if(v2){
    const beforeCommand=result.providerCalls,command=await turn('reported_natal_command_v2','Посмотри мою натальную карту.','ru');check('reported iPhone command opens actual natal, not Tarot',command.message.metadata.astrologyWorkflow?.state==='ready'&&command.message.metadata.astrology?.chartId===natal.message.metadata.astrology.chartId&&!command.message.metadata.tarot&&result.providerCalls===beforeCommand);
    const strengths=await turn('natal_strengths','Мои сильные стороны — что видно по этой карте? Коротко.','ru',{mode:'astrology',astrology:natal.message.metadata.astrology,astrologyConsent:true,attachmentSelected:true});
    check('Russian strengths uses attached calculation without asking birth data again',/[А-Яа-яЁё]/.test(strengths.message.content)&&!/укажи.{0,25}(дат|время|место)|пришли.{0,25}карт|таро/i.test(strengths.message.content));
    // A previous resumed fixture intentionally deleted memory after the old
    // consent. Re-select the exact chart just as the real UI does; never bypass
    // the privacy boundary or pretend an expired attachment remains permitted.
    const transits=await turn('current_transits_named_v4','А какие сейчас транзиты к этой карте? Используй реальные расчёты и назови их дату.','ru',{mode:'astrology',astrology:natal.message.metadata.astrology,astrologyConsent:true,attachmentSelected:true});check('current transits use the actual calculation tool',result.calls.some(c=>c.tag==='smoke:current_transits_named_v4'&&c.tools?.includes('get_current_transits')));check('current transit answer has no unrelated spread',!/таро|расклад/i.test(transits.message.content));
    const numbers=await turn('numerology','Different topic: use my confirmed birth date to calculate my Life Path and personal year. Explain the symbolic limits.','en',{contextReset:true});check('date numerology really executes, not model arithmetic',result.calls.some(c=>c.tag==='smoke:numerology'&&c.tools?.includes('get_date_numerology'))&&/symbolic|not.{0,12}scien|tradition/i.test(numbers.message.content));
   }
   const ordinary=await turn('ordinary','Different topic. Help me choose one small prototype step without mystical systems.','en');check('new topic detaches old chart',ordinary.message.metadata.contextReset===true&&!/mercury|natal|tarot|synastry/i.test(ordinary.message.content));check('ordinary goal is not replaced with a meditation menu',/prototype|volunteer|user.{0,15}test/i.test(ordinary.message.content)&&!/are you looking for sleep|gentler reset/i.test(ordinary.message.content)&&!ordinary.message.metadata.meditationAction);
   check('all free reading/navigation tests preserve synthetic Seeds',Number((await must(db.from('moon_gardens').select('moon_seeds_available').eq('telegram_id',owner).single())).moon_seeds_available)===seedsBefore);
   await new Promise(resolve=>setTimeout(resolve,Math.max(0,62000-(Date.now()-breathStarted))));clearInterval(breathTimer);breathTimer=undefined;await heartbeats;await beat();
   const {recordBreathSession}=await import('../dist/db.js'),completion=await recordBreathSession(owner,{session_id:proof.id,mode:'calm',duration_seconds:60,breath_count:6,local_date:new Date().toISOString().slice(0,10)}),balanceAfterBreath=Number((await must(db.from('moon_gardens').select('moon_seeds_available').eq('telegram_id',owner).single())).moon_seeds_available),completedAgain=await recordBreathSession(owner,{session_id:proof.id,mode:'calm',duration_seconds:60,breath_count:6});
   check('real elapsed breathing completes once without duplicate reward',completion.completed===true&&completedAgain.newlyCompleted===false&&balanceAfterBreath===Number((await must(db.from('moon_gardens').select('moon_seeds_available').eq('telegram_id',owner).single())).moon_seeds_available));
   if(v2){
    const {createSeedProducts}=await import('../dist/luna43-seed-products.js'),products=createSeedProducts(db,{enabled:()=>true,personalProfile:getAiPersonalProfile}),overview=await products.overview(owner);check('configured approved seed prices retained',overview.products.aiMessages.seeds===50&&overview.products.aiMessages.quantity===20&&overview.products.deepAnalysis.seeds===100);
    const purchase=await products.purchase(owner,{requestId:id('deep_topic'),product:'deep_analysis',expectedSeeds:100,catalogRevision:overview.revision,confirmed:true,language:'en',topic:'career',question:'What is one useful direction for my small prototype?',personalContextConsent:true});
    result.currentStep='deep_topic';await persist();armed=true;let generated;try{generated=await products.generate(owner,purchase.purchase.id);}finally{armed=false;}const calls=result.providerCalls,again=await products.generate(owner,purchase.purchase.id);check('topic-specific paid report saved and reopen never re-generates',generated.purchase.result.topic==='career'&&again.cached&&result.providerCalls===calls);result.deep_topic=generated.purchase.result;
    check('only the explicitly authorized synthetic report spends 100 Seeds once',Number((await must(db.from('moon_gardens').select('moon_seeds_available').eq('telegram_id',owner).single())).moon_seeds_available)===balanceAfterBreath-100);
   }
   await assert.rejects(getLunaConversation(qaOwner,conversationId));check('foreign conversation owner is rejected',true);await assert.rejects(verifiedAstrologyChatContext(db,qaOwner,attachment));check('foreign calculated report owner is rejected',true);
   check('real QA balances and subscriptions unchanged',await fingerprint()===result.qaProtectedBefore);
   result.smokeComplete=true;if(v2){result.runtimeFixVerified=true;result.validationCommit=options.sourceCommit;result.qualityCorrections={canonicalSubjects:true,staleArtifactHistoryExcluded:true,natalCommandWithoutGeneration:true,previousFailuresPreserved:true};}result.batches.push(command.batchId);await persist();return new Response(null,{status:204});
  }
  if(command.action==='close'){check('paired decisions complete',result.benchmarkComplete===true);check('real persistence/actions smoke complete',result.smokeComplete===true);check('no unknown provider spend',!result.activeCall&&result.heldMicrousd===0);result.status='COMPLETE_PENDING_HUMAN_REVIEW';finalState='completed';result.batches.push(command.batchId);await persist();return new Response(null,{status:204});}
 }catch(error){result.failure={code:typeof error?.message==='string'?error.message.slice(0,160):'qa_failure',at:new Date().toISOString()};result.status=result.heldMicrousd?'UNKNOWN_COST':'CHECK_FAILED';await persist();}
 finally{
  globalThis.fetch=originalFetch;
  if(breathTimer)clearInterval(breathTimer);
  if(originalSettings){try{const{id:_id,updated_at:_updated,...restore}=originalSettings;await must(db.from('luna32_runtime_settings').update(restore).eq('id',true));assert.equal((await must(db.from('luna32_runtime_settings').select('generation_enabled').eq('id',true).single())).generation_enabled,false);result.providerWindowOpen=false;delete result.settingsToRestore;await persist();}catch{result.status='RESTORATION_REQUIRED';}}
  if(originalEnv)Object.assign(env,originalEnv);
  await must(db.from('luna30_qa_report_runs').update({state:finalState,result}).eq('run_name',runName).eq('state',claim));
 }
 return new Response(null,{status:204});
}
