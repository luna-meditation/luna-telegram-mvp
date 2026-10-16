// Owner-approved: at most SIX real provider requests / $0.03, staging only.
// Bundle only in the separate staging artifact, never production functions.
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {authorizeLuna32Smoke,luna32StagingSite,qaReadingCards} from '../dist/luna32-staging-guard.js';
import {protectedStateFingerprint} from './luna31-financial-guard.mjs';
export async function run(request,context,options){
 if(!authorizeLuna32Smoke(request,context.site?.id,options)||Netlify.env.get('SUPABASE_URL')!=='https://funvzpmpbgazsisehiru.supabase.co')return new Response(null,{status:403});
 const {netlifyStagingHandler}=await import('../dist/netlify-staging-handler.js');
 const host='https://luna-staging-itfl.netlify.app',qaContext={site:{id:luna32StagingSite},ip:'127.0.0.1'};
 await netlifyStagingHandler(new Request(host+'/health'),qaContext);
 const {env}=await import('../dist/config.js'),{supabase}=await import('../dist/db.js');
 assert.ok(env.STAGING_MODE&&env.LUNA32_ENABLED&&env.STAGING_TELEGRAM_IDS==='158467796'&&env.STAGING_SUPABASE_PROJECT_REF==='funvzpmpbgazsisehiru');
 const owner=158467796,runName='luna32-complete-smoke-20261016-v2';
 const previous=await supabase.from('luna30_qa_report_runs').select('state,result').eq('run_name','luna32-complete-smoke-20261016').single();assert.ifError(previous.error);
 const prior=previous.data.result;assert.equal(previous.data.state,'failed');assert.equal(prior.providerAttempts,1);assert.equal(prior.unsettledCostUpperBoundUsd,0);assert.equal(prior.calls.length,1);assert.ok(prior.calls.every(call=>call.httpStatus===200&&call.providerStatus==='completed'&&Number.isFinite(call.estimated_cost)));
 const claim=await supabase.from('luna30_qa_report_runs').insert({run_name:runName,state:'running',result:{sourceCommit:options.sourceCommit,maxCalls:6,maxUsd:0.03}}).select('run_name');
 if(claim.error?.code==='23505')return new Response(null,{status:204});assert.ifError(claim.error);
 const result={status:'running',sourceCommit:options.sourceCommit,checks:[],calls:[...prior.calls],answers:[],readings:[],priorCalls:prior.providerAttempts,priorCostUsd:prior.costUsd,productionWrites:0,syntheticDataOnly:true,actualTelegramLogin:false,signedQaFixture:true,physicalDevice:false};
 const check=(name,value)=>{assert.ok(value,name);result.checks.push({name,status:'PASS'});};
 const must=async query=>{const response=await query;assert.ifError(response.error);return response.data;};
 const fingerprint=async()=>protectedStateFingerprint(await must(supabase.from('users').select('lifetime_access,active_until,free_used').eq('telegram_id',owner).single()),await must(supabase.from('moon_gardens').select('*').eq('telegram_id',owner)));
 const signed=(id=owner)=>{const data=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:'Luna QA',language_code:'en'})}),text=[...data].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n'),key=createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest();data.set('hash',createHmac('sha256',key).update(text).digest('hex'));return data.toString();};
 const toolTimes=[];
 const api=async(path,body,method=body?'POST':'GET',auth=signed())=>{
  // Respect the existing 10/minute tool route limiter; do not bypass it with
  // changing IP addresses or a production configuration override.
  if(path.startsWith('/api/luna/tools/')){while(toolTimes.length&&toolTimes[0]<=Date.now()-61000)toolTimes.shift();while(toolTimes.length>=9){await new Promise(resolve=>setTimeout(resolve,Math.min(50000,Math.max(1,61000-(Date.now()-toolTimes[0])))));while(toolTimes.length&&toolTimes[0]<=Date.now()-61000)toolTimes.shift();}toolTimes.push(Date.now());}
  const response=await netlifyStagingHandler(new Request(host+path,{method,headers:{'x-telegram-init-data':auth,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),qaContext);const data=await response.json();if(response.status>=400)(result.apiFailures??=[]).push({path,status:response.status,code:data.code??null});return{status:response.status,data};};
 const originalFetch=globalThis.fetch;let attempts=prior.providerAttempts,spent=prior.costUsd,held=0,armed=false,currentCase='',originalSettings;const savedEnv={personal:env.FEATURE_PERSONALIZATION,free:env.AI_MAX_MESSAGES_PER_DAY,premium:env.AI_PREMIUM_MAX_MESSAGES_PER_DAY};
 try{
  result.protectedBefore=await fingerprint();
  check('all new financial mechanics remain disabled',!env.RUN_MIGRATIONS&&!env.FEATURE_MOON_SEEDS_PURCHASES&&!env.FEATURE_TAROT_PAID_READINGS&&!env.FEATURE_PREMIUM_V2&&!env.LUNA30_PREMIUM_ENABLED&&!env.LUNA30_MONTHLY_QUOTAS_ENABLED);
  originalSettings=await must(supabase.from('luna32_runtime_settings').select('*').eq('id',true).single());
  check('staging generation was disabled before this finite test',!originalSettings.generation_enabled&&!originalSettings.public_beta);
  const month=new Date().toISOString().slice(0,7)+'-01';
  const priorTotal=await must(supabase.from('luna32_ai_month_totals').select('spent_cost_microusd,held_cost_microusd').eq('month',month).maybeSingle());
  check('prior approved spend retained and no unknown hold exists',priorTotal?.spent_cost_microusd===prior.calls.reduce((sum,call)=>sum+Math.ceil(call.estimated_cost*1000000),0)&&priorTotal.held_cost_microusd===0);
  const priorAttempt=await must(supabase.from('luna32_ai_attempts').select('operation_key,state').eq('telegram_id',owner).order('created_at').limit(1).single());assert.equal(priorAttempt.state,'settled');assert.match(priorAttempt.operation_key,/^tarot:[a-f0-9-]{36}$/);
  const priorClientId=priorAttempt.operation_key.slice(6),priorMessage=await must(supabase.from('ai_messages').select('id,conversation_id,metadata').eq('telegram_id',owner).eq('request_id','tarot:'+priorClientId).single());
  await must(supabase.from('luna32_runtime_settings').update({public_beta:true,beta_starts_at:new Date(Date.now()-60000).toISOString(),beta_expires_at:new Date(Date.now()+45*60000).toISOString(),generation_enabled:true,cost_baseline_verified:true,baseline_month:month,legacy_monthly_cost_microusd:0,monthly_cap_microusd:30000,free_daily_limit:100,premium_daily_limit:100}).eq('id',true));
  env.FEATURE_PERSONALIZATION=false;env.AI_MAX_MESSAGES_PER_DAY=100;env.AI_PREMIUM_MAX_MESSAGES_PER_DAY=100;
  const availability=await originalFetch('https://api.openai.com/v1/models/gpt-5-mini',{headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`}});
  check('existing server-only key can access the configured supported model',availability.ok&&(await availability.json()).id==='gpt-5-mini');
  const {providerCostCeiling}=await import('../dist/luna32-ai-accounting.js'),{stagingAiMeterRecord}=await import('../dist/staging-ai-meter.js');
  globalThis.fetch=async(input,init)=>{
   const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.hostname!=='api.openai.com')return originalFetch(input,init);
   assert.ok(armed&&attempts<6,'No unapproved provider request');assert.equal(url.pathname,'/v1/responses');
   const body=JSON.parse(init.body);assert.equal(body.model,'gpt-5-mini');assert.equal(body.store,false);assert.equal(body.service_tier,'default');
   const reserve=providerCostCeiling(body)/1000000;assert.ok(spent+held+reserve<=0.0300000001,'The approved total budget cannot safely fit this request');
   held+=reserve;attempts++;const record={attempt:attempts,name:currentCase,maxOutputTokens:body.max_output_tokens,reservedUsd:reserve};result.calls.push(record);
   try{const response=await originalFetch(input,init),payload=await response.clone().json(),meter=stagingAiMeterRecord(payload);record.httpStatus=response.status;record.providerStatus=payload.status;record.toolNames=(payload.output??[]).filter(item=>item.type==='function_call').map(item=>item.name);
    if(response.ok&&meter?.estimated_cost!==null&&meter){assert.ok(meter.estimated_cost<=reserve);held-=reserve;spent+=meter.estimated_cost;Object.assign(record,meter);}
    else record.unknownCost=true;
    await must(supabase.from('luna30_qa_report_runs').update({result}).eq('run_name',runName));return response;
   }catch(error){record.unknownCost=true;throw error;}
  };
  check('unsigned and signed non-QA Telegram accounts denied',(await api('/api/luna/conversations',undefined,'GET','invalid')).status===401&&(await api('/api/luna/conversations',undefined,'GET',signed(880003299))).status===403);
  const access=await api('/api/access/me');check('server promotional access loads separately from paid rights',access.status===200&&access.data.beta?.active===true);
  let conversationId=priorMessage.conversation_id;
  for(const [kind,language,count]of [['single','ru',1],['three','en',3],['five','ru',5]]){
   const opened=kind==='single'?{status:200,data:{conversationId,message:priorMessage}}:await api('/api/luna/tools/tarot',{clientReadingId:randomUUID(),conversationId,kind,intention:'growth',question:language==='ru'?'Как внимательнее организовать спокойную неделю?':'How can I plan a calmer, more attentive week?',language});
   check(kind+' interactive reading saved before any generation',opened.status===200&&Boolean(opened.data.message?.metadata?.tarot?.readingId));conversationId=opened.data.conversationId;
   const messageId=opened.data.message.id;let revealed;
   const beforeReveal=attempts;
   for(let index=0;index<count;index++){currentCase=kind+' '+language;armed=kind!=='single'&&index===count-1;try{revealed=await api('/api/luna/tools/tarot/'+messageId+'/reveal',{index});}finally{armed=false;}check(kind+' reveal '+index+' persisted',revealed.status===200);}
   if(kind==='single')check('first approved single-card interpretation reused without paying again',attempts===beforeReveal);
   const reading=revealed.data.message.metadata.tarot.reading;
   check(kind+' real interpretation complete, localized and saved',reading.status==='ready'&&reading.language===language&&Boolean(reading.interpretation?.summary));
   const selections=qaReadingCards(kind,reading);check(kind+' all requested cards retained',selections.length===count);
   result.readings.push({kind,language,id:reading.id,messageId,conversationId,cardIds:selections.map(c=>c.cardId),orientations:selections.map(c=>c.orientation)});
   const before=attempts,reopened=await api('/api/luna/conversations/'+conversationId),replay=await api('/api/luna/tools/tarot/'+messageId+'/reveal',{index:count-1});
   check(kind+' reopening and duplicate reveal never regenerate',reopened.status===200&&replay.status===200&&attempts===before&&JSON.stringify(replay.data.message.metadata.tarot.reading.interpretation)===JSON.stringify(reading.interpretation));
  }
  const profiles=await api('/api/astrology/profiles');check('space exists for two synthetic non-self charts',profiles.status===200&&profiles.data.profiles.length<=18);
  const charts=[];
  for(const [label,date]of [['Luna 3.2 QA A','1990-01-01'],['Luna 3.2 QA B','1990-02-01']]){
   const saved=await api('/api/astrology/profiles',{subjectKind:'other',label,date,time:'12:00',placeId:'geonames:2643743',consent:true});check('synthetic profile saved privately',saved.status===201);
   const calculated=await api('/api/astrology/profiles/'+saved.data.profile.id+'/chart',{});check('actual astronomy engine chart persisted',calculated.status===200&&Boolean(calculated.data.chart?.calculation));charts.push(calculated.data.chart);
  }
  const astro={chartId:charts[0].id,secondChartId:charts[1].id,planet:'mercury'};
  currentCase='compatibility RU tools';armed=true;let answer;const chatRequest={requestId:'qa32_'+randomUUID(),conversationId,mode:'astrology',astrology:astro,language:'ru',message:'По двум прикреплённым картам объясни различие знаков Меркурия. Проверь данные через calculate_compatibility, затем дай два коротких практических пункта и один вопрос. Не делай выводов о реальных чувствах и не предсказывай будущее.'};
  try{answer=await api('/api/luna/chat',chatRequest);}finally{armed=false;}
  check('authenticated chart conversation returns complete Russian prose',answer.status===200&&Boolean(answer.data.message?.content)&&/Меркур/iu.test(answer.data.message.content)&&!/^[\s]*[{[]/.test(answer.data.message.content));
  check('both exact chart attachments survive into the answer',answer.data.message.metadata?.astrology?.chartId===astro.chartId&&answer.data.message.metadata?.astrology?.secondChartId===astro.secondChartId);
  check('real server tool round completed within the same conversation',result.calls.some(call=>call.name===currentCase&&call.toolNames.includes('calculate_compatibility')));
  result.answers.push({name:currentCase,text:answer.data.message.content,metadata:answer.data.message.metadata,conversationId});
  const callsBefore=attempts,replay=await api('/api/luna/chat',chatRequest),history=await api('/api/luna/conversations/'+conversationId);
  check('stored AI replay and reopening use zero provider requests',replay.status===200&&history.status===200&&replay.data.message.content===answer.data.message.content&&attempts===callsBefore);
  const reset=await api('/api/luna/tools/conversations/'+conversationId+'/context-reset',{requestId:randomUUID(),language:'en'});check('context reset persists without a generation',reset.status===200&&reset.data.message.metadata?.contextReset===true&&attempts===callsBefore);
  const dream={clientId:randomUUID(),title:'Luna 3.2 QA dream',description:'A quiet garden and a blue lantern.',language:'en',date:new Date().toISOString().slice(0,10),saveConsent:true};
  check('dream save without explicit consent is denied',(await api('/api/luna32/dreams',{...dream,saveConsent:false})).status>=400);
  const saved=await api('/api/luna32/dreams',dream);check('consented dream is really saved',saved.status===201&&Boolean(saved.data.id));
  const reopened=await api('/api/luna32/dreams/'+saved.data.id),edited=await api('/api/luna32/dreams/'+saved.data.id,{...dream,description:'Тихий сад и голубой фонарь.',language:'ru'},'PATCH');check('separate requests reopen and edit RU/EN dream',reopened.status===200&&reopened.data.description===dream.description&&edited.status===200&&edited.data.language==='ru');
  check('dream deletion is permanent for this owner',(await api('/api/luna32/dreams/'+saved.data.id,undefined,'DELETE')).status===200&&(await api('/api/luna32/dreams/'+saved.data.id)).status===404);
  const ledger=await must(supabase.from('luna32_ai_attempts').select('actual_cost_microusd,state,provider_status').eq('telegram_id',owner));
  check('every actual provider attempt is independently settled',ledger.length===attempts&&ledger.every(a=>a.state==='settled'&&a.actual_cost_microusd!==null));
  result.ledgerCostUsd=ledger.reduce((sum,a)=>sum+a.actual_cost_microusd,0)/1000000;
  check('approved call count and actual spend respected',attempts>0&&attempts<=6&&spent>0&&spent<=0.03&&held===0);
  result.status='PASS';
 }catch(error){result.status='FAIL';result.failure={code:error.code??error.name,message:String(error.message).slice(0,240)};}
 finally{
  globalThis.fetch=originalFetch;env.FEATURE_PERSONALIZATION=savedEnv.personal;env.AI_MAX_MESSAGES_PER_DAY=savedEnv.free;env.AI_PREMIUM_MAX_MESSAGES_PER_DAY=savedEnv.premium;
  if(originalSettings){const {id:_id,updated_at:_updated,...settings}=originalSettings;try{await must(supabase.from('luna32_runtime_settings').update({...settings,generation_enabled:false,public_beta:false}).eq('id',true));result.stagingGenerationRestoredOff=true;}catch{result.status='FAIL';result.configurationRestoreFailed=true;}}
  try{result.protectedAfter=await fingerprint();check('Moon Seeds, garden and paid/Lifetime access unchanged',result.protectedBefore===result.protectedAfter);}catch{result.status='FAIL';result.protectedStateCheckFailed=true;}
 }
 result.providerAttempts=attempts;result.costUsd=spent;result.unsettledCostUpperBoundUsd=Math.max(0,held);result.qaProcessOnlyLimitOverride=true;
 await must(supabase.from('luna30_qa_report_runs').update({state:result.status==='PASS'?'completed':'failed',result}).eq('run_name',runName));
 console.log(JSON.stringify({luna32Smoke:result.status,providerAttempts:attempts,costUsd:spent}));return new Response(null,{status:204});
}
