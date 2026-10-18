// Expiring operator-authenticated tests on the EXISTING staging only.
// All 150 benchmark decisions + real conversations share one durable $1/180
// reservation ledger. No secret or production user data leaves the server.
import assert from 'node:assert/strict';
import {randomUUID,createHash,createHmac} from 'node:crypto';
import {authorizeLuna32Smoke,luna32StagingSite} from '../dist/luna32-staging-guard.js';
import {intelligenceCases,evaluateIntelligenceDecision} from './luna-intelligence-cases.mjs';
import {protectedStateFingerprint} from './luna31-financial-guard.mjs';
const runName='luna-intelligence-1-0-20261018-v1',owner=510051001,qaOwner=158467796,limit={calls:180,microusd:1000000};
// Official standard-tier pricing fetched 2026-10-18. Per million tokens.
const models=[{id:'gpt-5-mini',input:.25,cached:.025,output:2,reasoning:'minimal'},{id:'gpt-4.1-mini',input:.4,cached:.1,output:1.6},{id:'gpt-4o-mini',input:.15,cached:.075,output:.6}];
const must=async q=>{const r=await q;assert.ifError(r.error);return r.data;};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function run(request,context,options){
 if(!authorizeLuna32Smoke(request,context.site?.id,options)||Netlify.env.get('SUPABASE_URL')!=='https://funvzpmpbgazsisehiru.supabase.co')return new Response(null,{status:403});
 const {netlifyStagingHandler}=await import('../dist/netlify-staging-handler.js');await netlifyStagingHandler(new Request('https://luna-staging-itfl.netlify.app/health'),{site:{id:luna32StagingSite},ip:'127.0.0.1'});
 const {supabase:db}=await import('../dist/db.js'),{env}=await import('../dist/config.js');assert.ok(env.STAGING_MODE&&env.STAGING_SUPABASE_PROJECT_REF==='funvzpmpbgazsisehiru');
 const headers={'Cache-Control':'private, no-store'},stored=await must(db.from('luna30_qa_report_runs').select('state,result').eq('run_name',runName).maybeSingle());
 if(options.readOnly)return Response.json(stored??{state:'not_started',result:null},{headers});
 const command=await request.json();assert.ok(['inventory','batch','smoke','close'].includes(command.action));assert.match(command.batchId,/^[a-f0-9-]{36}$/);
 const datasetHash=hash(intelligenceCases);
 if(!stored){const result={status:'IN_PROGRESS',sourceCommit:options.sourceCommit,datasetHash,approvedCalls:180,approvedMicrousd:1000000,providerCalls:0,spentMicrousd:0,spentUsdExact:0,heldMicrousd:0,results:[],calls:[],checks:[],ids:{},batches:[],productionTouched:false,realStarsPayments:0,providerWindowOpen:false};const created=await db.from('luna30_qa_report_runs').insert({run_name:runName,state:'paused',result});if(created.error?.code==='23505')return new Response(null,{status:204});assert.ifError(created.error);}
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
  const call={index:++result.providerCalls,tag,model:model.id,ceiling,startedAt:new Date().toISOString()};result.calls.push(call);result.activeCall={index:call.index,ceiling};result.heldMicrousd+=ceiling;await persist();const started=Date.now();
  const response=await originalFetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${Netlify.env.get('OPENAI_API_KEY')}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)}),text=await response.text();let payload;try{payload=JSON.parse(text);}catch{throw Error('unverified_provider_response');}
  const u=payload.usage,cached=u?.input_tokens_details?.cached_tokens??0;
  if(!response.ok||!u||!Number.isSafeInteger(u.input_tokens)||!Number.isSafeInteger(u.output_tokens)||cached>u.input_tokens||!(payload.model===model.id||payload.model?.startsWith(model.id+'-20'))||!['default','auto'].includes(payload.service_tier??'')){Object.assign(call,{status:'UNKNOWN_COST',httpStatus:response.status,latencyMs:Date.now()-started});await persist();throw Error('provider_usage_requires_reconciliation');}
  const exact=((u.input_tokens-cached)*model.input+cached*model.cached+u.output_tokens*model.output)/1000000,costMicrousd=Math.ceil(exact*1000000);assert.ok(costMicrousd<=ceiling,'provider_cost_overrun');
  result.heldMicrousd-=ceiling;result.spentMicrousd+=costMicrousd;result.spentUsdExact+=exact;delete result.activeCall;
  Object.assign(call,{status:payload.status,inputTokens:u.input_tokens,cachedTokens:cached,outputTokens:u.output_tokens,costMicrousd,costUsdExact:exact,latencyMs:Date.now()-started,tools:(payload.output??[]).filter(v=>v.type==='function_call').map(v=>v.name)});await persist();
  return{response:new Response(text,{status:response.status,statusText:response.statusText,headers:response.headers}),payload,meter:call};
 }
 try{
  assert.equal(result.datasetHash,datasetHash,'dataset_changed');assert.equal(result.approvedCalls,180);assert.equal(result.approvedMicrousd,1000000);assert.ok(!result.activeCall&&result.heldMicrousd===0,'unknown_provider_outcome_requires_reconciliation');
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
   result.benchmarkComplete=result.results.length===150;result.batches.push(command.batchId);await persist();return new Response(null,{status:204});
  }
  if(command.action==='smoke'){
   if(result.smokeComplete&&result.runtimeFixVerified)return new Response(null,{status:204});
   originalEnv={...env};originalSettings=await must(db.from('luna32_runtime_settings').select('*').eq('id',true).single());check('staging generation closed before finite test',originalSettings.generation_enabled===false);
   const fingerprint=async()=>protectedStateFingerprint(await must(db.from('users').select('lifetime_access,active_until,free_used').eq('telegram_id',qaOwner).single()),await must(db.from('moon_gardens').select('*').eq('telegram_id',qaOwner)));
   result.qaProtectedBefore=await fingerprint();result.providerWindowOpen=true;result.settingsToRestore=originalSettings;await persist();
   const signed=(user=qaOwner)=>{const data=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:user,first_name:'Synthetic QA',language_code:'en'})}),text=[...data].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n'),key=createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest();data.set('hash',createHmac('sha256',key).update(text).digest('hex'));return data.toString();};
   const api=async(auth)=>netlifyStagingHandler(new Request('https://luna-staging-itfl.netlify.app/api/luna/conversations',{headers:{'x-telegram-init-data':auth}}),{site:{id:luna32StagingSite},ip:'127.0.0.1'});
   check('real Telegram auth rejects absent forged and nonallowlisted identities',(await api('')).status===401&&(await api('hash=forged')).status===401&&(await api(signed(owner))).status===403);check('real QA signed Telegram auth opens only own history',(await api(signed())).status===200);
   const month=new Date().toISOString().slice(0,7)+'-01',totals=await must(db.from('luna32_ai_month_totals').select('spent_cost_microusd,held_cost_microusd').eq('month',month).maybeSingle());check('no unknown shared staging accounting hold',!Number(totals?.held_cost_microusd));
   Object.assign(env,{FEATURE_LUNA_INTELLIGENCE:true,AI_PROMPT_VERSION:'intelligence-v1',FEATURE_AI_CENTRAL_EXPERIENCE:true,AI_CHAT_ENABLED:true,AI_MAX_MESSAGES_PER_DAY:100,AI_PREMIUM_MAX_MESSAGES_PER_DAY:100,AI_STRUCTURED_MAX_OUTPUT_TOKENS:2200,AI_MAX_OUTPUT_TOKENS:1800});
   await must(db.from('luna32_runtime_settings').update({generation_enabled:true,public_beta:true,beta_starts_at:new Date(Date.now()-60000).toISOString(),beta_expires_at:new Date(Date.now()+12*60000).toISOString(),cost_baseline_verified:true,baseline_month:month,legacy_monthly_cost_microusd:0,monthly_cap_microusd:Number(totals?.spent_cost_microusd??0)+1000000-result.spentMicrousd,free_daily_limit:100,premium_daily_limit:100}).eq('id',true));
   globalThis.fetch=async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.hostname!=='api.openai.com')return originalFetch(input,init);assert.ok(armed&&url.pathname==='/v1/responses','only finite synthetic Responses tests are approved');return(await invoke(JSON.parse(init.body),'smoke:'+result.currentStep)).response;};
   await must(db.from('users').upsert({telegram_id:owner,first_name:'Synthetic Intelligence QA',language_code:'ru',ai_memory_enabled:true},{onConflict:'telegram_id',ignoreDuplicates:true}));
   await must(db.from('moon_gardens').upsert({telegram_id:owner,moon_seeds_available:1000,moon_seeds_earned_total:1000},{onConflict:'telegram_id',ignoreDuplicates:true}));
   const {savePersonalProfile}=await import('../dist/personalization.js'),{writePersonalMemory,getAiPersonalProfile,listPersonalMemories,removePersonalMemory}=await import('../dist/personal-memory.js');
   await savePersonalProfile(owner,{display_name:'Alex',interests:['meditation'],preferences:'Use my chosen name exactly. Short practical replies, no diminutives.',birth_date:null,birth_time:null,birth_place:null,ai_context_consent:true});
   if(!(await listPersonalMemories(owner)).some(m=>m.memory_key==='prototype_goal'))await writePersonalMemory(owner,{category:'goals',key:'prototype_goal',value:'Build a useful small prototype and test with two volunteers.',confirmed:true,kind:'fact'});
   if(!(await listPersonalMemories(owner)).some(m=>m.memory_key==='unchecked_goal'))await writePersonalMemory(owner,{category:'goals',key:'unchecked_goal',value:'UNCONFIRMED_QA_PRIVATE_GOAL',confirmed:false,kind:'fact'});
   const disposable=await writePersonalMemory(owner,{category:'goals',key:'deleted_goal',value:'DELETED_QA_PRIVATE_GOAL',confirmed:true,kind:'fact'});await removePersonalMemory(owner,disposable.id);
   const permitted=await getAiPersonalProfile(owner,'prototype goal');check('confirmed memory is used; pending/deleted facts excluded',JSON.stringify(permitted.confirmed_memories).includes('prototype')&&!/UNCONFIRMED_QA|DELETED_QA/.test(JSON.stringify(permitted)));
   const {sendLunaMessage,getLunaConversation}=await import('../dist/luna-ai.js'),{openChatTarot,revealChatTarot}=await import('../dist/luna24-chat.js');let conversationId=result.ids.conversation;
   async function turn(tag,message,language,extra={}){result.currentStep=tag;await persist();armed=true;let reply;const input={requestId:id(tag),message,language,intelligenceVersion:1,...(conversationId?{conversationId}:{}),...extra};try{reply=await sendLunaMessage({telegram_id:owner,first_name:'Synthetic QA',language_code:language},input);}finally{armed=false;}conversationId=reply.conversationId;result.ids.conversation=conversationId;const count=result.providerCalls,again=await sendLunaMessage({telegram_id:owner,first_name:'Synthetic QA',language_code:language},input),reopened=await getLunaConversation(owner,conversationId);check(tag+' saved and reopened without another provider call',again.message.id===reply.message.id&&reopened.messages.some(m=>m.id===reply.message.id)&&count===result.providerCalls);result[tag]={text:reply.message.content,metadata:reply.message.metadata};await persist();return reply;}
   const seedsBefore=Number((await must(db.from('moon_gardens').select('moon_seeds_available').eq('telegram_id',owner).single())).moon_seeds_available);
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
    for(let index=0;index<count;index++){result.currentStep='interpret_'+kind;armed=true;try{r=await revealChatTarot(owner,r.message.id,{index});}finally{armed=false;}}
    const before=result.providerCalls,replay=await openChatTarot(owner,input);check(kind+' real cards and saved AI interpretation reopen for free',r.message.metadata.tarot.reading.status==='ready'&&replay.message.metadata.tarot.readingId===r.message.metadata.tarot.readingId&&result.providerCalls===before);result['reading_'+kind]={id:r.message.metadata.tarot.readingId,interpretation:r.message.metadata.tarot.reading.interpretation,cards:r.message.metadata.tarot.reading.cards};await persist();
   }
   await turn('tarot_followup','Свяжи точные карты этого расклада с моей подтверждённой целью по прототипу. Один небольшой шаг.','ru',{mode:'tarot',readingId:result.reading_three.id,attachmentSelected:true});
   const med=await turn('meditation','Подбери медитацию для фокуса.','ru');check('actual published meditation action displayed',Boolean(med.message.metadata.meditationAction?.meditationId)&&med.message.metadata.intelligence.attachments[0]?.type==='meditation');check('meditation is not false playback',!/включила|запустила|playback started/i.test(med.message.content));
   const breath=await turn('breathing','Давай подышим одну минуту.','ru');check('working breathing control prepared, never auto-started or rewarded',breath.message.metadata.intelligence.attachments[0]?.type==='breathing_session'&&breath.message.metadata.intelligence.attachments[0].status==='AUTHORIZED');
   const proof=await must(db.rpc('luna34_start_breath',{p_owner:owner,p_client:id('breath_proof'),p_mode:'calm',p_duration:60})),breathStarted=Date.now();let heartbeats=Promise.resolve();
   const beat=()=>must(db.rpc('luna34_breath_heartbeat',{p_owner:owner,p_session:proof.id,p_active:true}));await beat();breathTimer=setInterval(()=>{heartbeats=heartbeats.then(beat);},5000);
   const {createAstrologyService}=await import('../dist/luna30-astrology-service.js'),{createAstrologyWorkflowService}=await import('../dist/luna33-workflows.js'),{verifiedAstrologyChatContext}=await import('../dist/luna30-astrology-chat-context.js');
   const service=createAstrologyService(db,()=>true),location=(await service.locations('London')).locations[0];let profiles=(await service.list(owner)).profiles;
   for(const [kind,label,date] of [['self','Synthetic A','2000-01-01'],['other','Synthetic B','1992-08-20']])if(!profiles.some(p=>p.display_label===label))await service.save(owner,{subjectKind:kind,label,date,time:kind==='self'?'12:00':null,placeId:location.placeId,consent:true});
   profiles=(await service.list(owner)).profiles;const first=profiles.find(p=>p.subject_kind==='self'),second=profiles.find(p=>p.subject_kind==='other');
   const workflows=createAstrologyWorkflowService(db,()=>true),natal=await workflows.open(owner,{requestId:id('natal'),conversationId,kind:'natal',language:'en'});check('one self profile opens real chart without repeated confirmation',natal.message.metadata.astrologyWorkflow.state==='ready');
   const compared=await workflows.open(owner,{requestId:id('compatibility'),conversationId,kind:'compatibility',language:'ru',firstProfileId:first.id,secondProfileId:second.id,relationship:'business'}),attachment=compared.message.metadata.astrology;
   const exact=await verifiedAstrologyChatContext(db,owner,attachment);check('compatibility has distinct type, actual pair and relationship',exact.reference.type==='compatibility_report'&&exact.reference.relationship==='business');
   const relationship=await turn('compatibility_followup','Как нам лучше выстроить деловое общение? Используй именно эти две рассчитанные карты. Коротко.','ru',{mode:'astrology',astrology:attachment,attachmentSelected:true,astrologyConsent:true});check('compatibility answer is not Tarot or romance',!/таро|расклад|tarot|romantic relationship/i.test(relationship.message.content));
   const switched=await turn('natal_after_tarot','Explain Mercury in my calculated chart briefly.','en',{mode:'astrology',astrology:natal.message.metadata.astrology,attachmentSelected:true,astrologyConsent:true});check('natal follow-up uses exact chart, not old Tarot',!/tarot|spread|таро|расклад/i.test(switched.message.content));
   const ordinary=await turn('ordinary','Different topic. Help me choose one small prototype step without mystical systems.','en');check('new topic detaches old chart',ordinary.message.metadata.contextReset===true&&!/mercury|natal|tarot|synastry/i.test(ordinary.message.content));
   check('all free reading/navigation tests preserve synthetic Seeds',Number((await must(db.from('moon_gardens').select('moon_seeds_available').eq('telegram_id',owner).single())).moon_seeds_available)===seedsBefore);
   await new Promise(resolve=>setTimeout(resolve,Math.max(0,62000-(Date.now()-breathStarted))));clearInterval(breathTimer);breathTimer=undefined;await heartbeats;await beat();
   const {recordBreathSession}=await import('../dist/db.js'),completion=await recordBreathSession(owner,{session_id:proof.id,mode:'calm',duration_seconds:60,breath_count:6,local_date:new Date().toISOString().slice(0,10)}),balanceAfterBreath=Number((await must(db.from('moon_gardens').select('moon_seeds_available').eq('telegram_id',owner).single())).moon_seeds_available),completedAgain=await recordBreathSession(owner,{session_id:proof.id,mode:'calm',duration_seconds:60,breath_count:6});
   check('real elapsed breathing completes once without duplicate reward',completion.completed===true&&completedAgain.newlyCompleted===false&&balanceAfterBreath===Number((await must(db.from('moon_gardens').select('moon_seeds_available').eq('telegram_id',owner).single())).moon_seeds_available));
   await assert.rejects(getLunaConversation(qaOwner,conversationId));check('foreign conversation owner is rejected',true);await assert.rejects(verifiedAstrologyChatContext(db,qaOwner,attachment));check('foreign calculated report owner is rejected',true);
   check('real QA balances and subscriptions unchanged',await fingerprint()===result.qaProtectedBefore);
   result.smokeComplete=true;result.batches.push(command.batchId);await persist();return new Response(null,{status:204});
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
