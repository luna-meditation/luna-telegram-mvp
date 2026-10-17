// Reuses the original provider results and validates the final localized follow-up.
// Original + follow-up together: at most four provider calls and $0.03, staging only.
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {authorizeLuna32Smoke,luna32StagingSite} from '../dist/luna32-staging-guard.js';
import {protectedStateFingerprint} from './luna31-financial-guard.mjs';
export async function run(request,context,options){
 if(!authorizeLuna32Smoke(request,context.site?.id,options)||Netlify.env.get('SUPABASE_URL')!=='https://funvzpmpbgazsisehiru.supabase.co')return new Response(null,{status:403});
 const {netlifyStagingHandler}=await import('../dist/netlify-staging-handler.js'),host='https://luna-staging-itfl.netlify.app',ctx={site:{id:luna32StagingSite},ip:'127.0.0.1'};
 await netlifyStagingHandler(new Request(host+'/health'),ctx);
 const {env}=await import('../dist/config.js'),{supabase}=await import('../dist/db.js');
 assert.ok(env.STAGING_MODE&&env.LUNA32_ENABLED&&env.STAGING_TELEGRAM_IDS==='158467796'&&env.STAGING_SUPABASE_PROJECT_REF==='funvzpmpbgazsisehiru');
 const owner=158467796,runName='luna34-final-followup-20261017',result={status:'running',sourceCommit:options.sourceCommit,checks:[],answers:[],newProviderCalls:0,productionWrites:0,physicalDevice:false,actualTelegramLogin:false,signedQaFixture:true};
 const claim=await supabase.from('luna30_qa_report_runs').insert({run_name:runName,state:'running',result});if(claim.error?.code==='23505')return new Response(null,{status:204});assert.ifError(claim.error);
 const must=async query=>{const r=await query;assert.ifError(r.error);return r.data;},check=(name,ok)=>{assert.ok(ok,name);result.checks.push({name,status:'PASS'});};
 const fingerprint=async()=>protectedStateFingerprint(await must(supabase.from('users').select('lifetime_access,active_until,free_used').eq('telegram_id',owner).single()),await must(supabase.from('moon_gardens').select('*').eq('telegram_id',owner)));
 const signed=()=>{const d=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:owner,first_name:'Luna QA',language_code:'en'})}),text=[...d].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n'),key=createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest();d.set('hash',createHmac('sha256',key).update(text).digest('hex'));return d.toString();};
 const api=async(path,body)=>{const r=await netlifyStagingHandler(new Request(host+path,{method:body?'POST':'GET',headers:{'x-telegram-init-data':signed(),'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),ctx);const data=await r.json();if(r.status>=400)(result.apiFailures??=[]).push({path,status:r.status,code:data.code??null});return {status:r.status,data};};
 const originalFetch=globalThis.fetch,savedEnv={AI_CHAT_ENABLED:env.AI_CHAT_ENABLED,FEATURE_PERSONALIZATION:env.FEATURE_PERSONALIZATION,AI_MAX_MESSAGES_PER_DAY:env.AI_MAX_MESSAGES_PER_DAY,AI_PREMIUM_MAX_MESSAGES_PER_DAY:env.AI_PREMIUM_MAX_MESSAGES_PER_DAY,AI_MAX_OUTPUT_TOKENS:env.AI_MAX_OUTPUT_TOKENS,AI_STRUCTURED_MAX_OUTPUT_TOKENS:env.AI_STRUCTURED_MAX_OUTPUT_TOKENS};
 let originalSettings,attempts=0,spent=0,held=0,armed=false,currentCase='';
 try{
  result.protectedBefore=await fingerprint();
  const prior=await must(supabase.from('luna30_qa_report_runs').select('state,result').eq('run_name','luna34-final-qa-20261017').single());
  assert.equal(prior.state,'failed');assert.equal(prior.result.failure.message,'selected aspect identity and explicit scoped consent persist');assert.equal(prior.result.providerCalls,2);assert.equal(prior.result.unknownCostUpperBoundUsd,0);assert.equal(prior.result.protectedBefore,prior.result.protectedAfter);
  result.reusedRun='luna34-final-qa-20261017';result.providerCalls=prior.result.providerCalls;result.actualCostUsd=prior.result.actualCostUsd;result.unknownCostUpperBoundUsd=0;result.calls=prior.result.calls;result.originalChecks=prior.result.checks;
  originalSettings=await must(supabase.from('luna32_runtime_settings').select('*').eq('id',true).single());check('AI generation is disabled before the bounded follow-up',!originalSettings.generation_enabled&&!originalSettings.public_beta);
  const {providerCostCeiling}=await import('../dist/luna32-ai-accounting.js'),{stagingAiMeterRecord}=await import('../dist/staging-ai-meter.js');
  globalThis.fetch=async(input,init)=>{
   const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.hostname!=='api.openai.com')return originalFetch(input,init);
   assert.ok(armed&&attempts+prior.result.providerCalls<4,'Combined finite provider call limit');assert.equal(url.pathname,'/v1/responses');
   const body=JSON.parse(init.body),reserve=providerCostCeiling(body)/1e6;assert.ok(prior.result.actualCostUsd+spent+held+reserve<=.03+1e-10,'Combined finite worst-case budget');assert.equal(body.store,false);
   attempts++;held+=reserve;const entry={index:attempts+prior.result.providerCalls,name:currentCase,reservedUsd:reserve};result.calls.push(entry);
   const response=await originalFetch(input,init),payload=await response.clone().json(),meter=stagingAiMeterRecord(payload);Object.assign(entry,{httpStatus:response.status,providerStatus:payload.status,tools:(payload.output??[]).filter(v=>v.type==='function_call').map(v=>v.name)});
   if(response.ok&&meter&&meter.estimated_cost!==null){assert.ok(meter.estimated_cost<=reserve);held-=reserve;spent+=meter.estimated_cost;Object.assign(entry,meter);}else entry.unknownCost=true;
   await must(supabase.from('luna30_qa_report_runs').update({result}).eq('run_name',runName));return response;
  };
  Object.assign(env,{AI_CHAT_ENABLED:true,FEATURE_PERSONALIZATION:false,AI_MAX_MESSAGES_PER_DAY:100,AI_PREMIUM_MAX_MESSAGES_PER_DAY:100,AI_MAX_OUTPUT_TOKENS:2600,AI_STRUCTURED_MAX_OUTPUT_TOKENS:2600});
  const tarot=prior.result.answers[0],tarotHistory=await api('/api/luna/conversations/'+tarot.conversationId);check('real saved Russian Tarot answer reopens intact',tarotHistory.status===200&&tarotHistory.data.messages.some(m=>m.content===tarot.text));
  const astro=await must(supabase.from('ai_messages').select('content,metadata,conversation_id,request_id').eq('telegram_id',owner).eq('role','assistant').like('request_id','qa34_aspect_%').order('created_at',{ascending:false}).limit(1).single()),attachment=astro.metadata.astrology;
  const chart=(await api('/api/astrology/charts/'+attachment.chartId)).data.chart,aspect=chart.calculation.aspects.find(a=>['from','to','type'].every(k=>a[k]===attachment.aspect[k]));
  check('actual persisted aspect matches all three calculated identity fields independent of JSON property order',Boolean(aspect)&&astro.metadata.astrologyConsent?.version===1&&astro.metadata.astrologyConsent.chartId===attachment.chartId);
  const text=astro.content.toLowerCase();check('English interpretation names the actual planets and aspect',text.includes(aspect.from)&&text.includes(aspect.to)&&text.includes(aspect.type));
  check('English response is prose with useful dynamic follow-ups',!/^\s*[{[]/.test(astro.content)&&astro.metadata.consultation.quickReplies.length>=2&&astro.metadata.consultation.quickReplies.length<=3);
  const replay=await api('/api/luna/chat',{requestId:astro.request_id,conversationId:astro.conversation_id,mode:'astrology',language:'en',astrology:attachment,astrologyConsent:true,message:'Explain only this selected calculated aspect, naming both planets and its aspect type. Keep it to two short paragraphs and one useful reflection question. Treat astrology as symbolic reflection, not a fact about my future. Offer two relevant follow-up questions.'});
  check('exact cached aspect request succeeds while new generation is disabled',replay.status===200&&replay.data.message.content===astro.content&&replay.data.duplicate===true);
  const reopened=await api('/api/luna/conversations/'+astro.conversation_id);check('reopened English history retains the same selected aspect',reopened.status===200&&reopened.data.messages.some(m=>m.content===astro.content&&m.metadata?.astrology?.chartId===attachment.chartId));
  result.answers=[tarot,{language:'en',text:astro.content,metadata:astro.metadata,aspect,requestId:astro.request_id,conversationId:astro.conversation_id}];
  const month=new Date().toISOString().slice(0,7)+'-01',totals=await must(supabase.from('luna32_ai_month_totals').select('spent_cost_microusd,held_cost_microusd').eq('month',month).maybeSingle());check('no unresolved prior provider spend',!totals?.held_cost_microusd);
  await must(supabase.from('luna32_runtime_settings').update({generation_enabled:true,public_beta:true,beta_starts_at:new Date(Date.now()-60000).toISOString(),beta_expires_at:new Date(Date.now()+15*60000).toISOString(),cost_baseline_verified:true,baseline_month:month,legacy_monthly_cost_microusd:0,monthly_cap_microusd:Number(totals?.spent_cost_microusd??0)+Math.floor((.03-prior.result.actualCostUsd)*1e6),free_daily_limit:100,premium_daily_limit:100}).eq('id',true));
  const tarotBody={requestId:'qa34_final_ru_'+randomUUID(),conversationId:tarot.conversationId,readingId:tarot.readingId,mode:'tarot',language:'ru',message:'Уточни положения трёх карт в моём сохранённом раскладе по-русски. Затем предложи один конкретный небольшой шаг без предсказаний. Коротко, не более двух абзацев. Предложи два новых вопроса для продолжения, отличающихся от прошлых.'};
  currentCase='localized Tarot follow-up RU';armed=true;let ru;try{ru=await api('/api/luna/chat',tarotBody);}finally{armed=false;}
  check('final Russian interpretation uses localized orientation and the owned reading',ru.status===200&&ru.data.message.metadata.readingId===tarot.readingId&&/прям|перев[её]рнут/i.test(ru.data.message.content)&&!/(upright|reversed)/i.test(ru.data.message.content));
  const choices=ru.data.message.metadata.consultation?.quickReplies??[],oldChoices=tarot.metadata.consultation?.quickReplies??[];check('follow-up choices are relevant and not recycled',choices.length>=2&&choices.length<=3&&choices.every(t=>!oldChoices.some(v=>v.toLowerCase()===t.toLowerCase())));
  result.answers.push({language:'ru',text:ru.data.message.content,metadata:ru.data.message.metadata,conversationId:tarot.conversationId,requestId:tarotBody.requestId});
  const n=attempts,repeated=await api('/api/luna/chat',tarotBody);check('new final answer also reuses its saved response',repeated.status===200&&repeated.data.duplicate===true&&repeated.data.message.content===ru.data.message.content&&attempts===n);
  const dreamBody={requestId:'qa34_final_dream_'+randomUUID(),conversationId:astro.conversation_id,mode:'astrology',astrology:attachment,language:'en',message:'Help me understand my dream. I dreamed I was walking through an unfamiliar library and felt curious. A different topic now: reflect on that dream in two short paragraphs. Do not connect it to astrology or predict anything. Offer two useful new follow-up questions.'};
  currentCase='independent dream topic EN';armed=true;let dream;try{dream=await api('/api/luna/chat',dreamBody);}finally{armed=false;}
  check('independent dream response detaches the prior chart and stays readable',dream.status===200&&dream.data.message.metadata.contextReset===true&&!dream.data.message.metadata.astrology&&/library|curious|dream/i.test(dream.data.message.content));
  result.answers.push({language:'en',text:dream.data.message.content,metadata:dream.data.message.metadata,conversationId:astro.conversation_id,requestId:dreamBody.requestId});
  const practice=await api('/api/luna/chat',{requestId:'qa34_sleep_'+randomUUID(),conversationId:astro.conversation_id,mode:'astrology',astrology:attachment,language:'ru',message:'Подбери медитацию для сна'});
  check('sleep request detaches the chart and opens a real meditation without provider generation',practice.status===200&&practice.data.message.metadata.contextReset===true&&Boolean(practice.data.message.metadata.recommendedMeditationId));
  const p=await api('/api/luna34/progress');check('verified successful AI interactions and A01 are persisted',p.status===200&&p.data.version===34&&p.data.metrics.aiInteractions>=2&&Boolean(p.data.items.find(i=>i.id==='A01').unlockedAt));
  const ack=await api('/api/luna34/progress/acknowledge',{ids:['A01']}),after=await api('/api/luna34/progress');check('real acknowledgement endpoint stops repeated celebrations',ack.status===200&&ack.data.acknowledged&&!after.data.items.find(i=>i.id==='A01').celebrationPending);
  const readings=(await api('/api/tarot/readings?offset=0')).data.readings;for(const kind of ['single','three','five']){const r=readings.find(v=>(v.reading_kind??'single')===kind&&v.status==='ready');check(kind+' history remains saved and reopens without generating',(await api('/api/tarot/readings/'+r.id)).status===200);}
  const financial=await must(supabase.from('luna34_commercial_settings').select('*').eq('id',true).single());check('all new financial gates remain closed',!financial.checkout_enabled&&!financial.rewards_enabled&&!financial.quotas_enabled&&!financial.referrals_enabled&&!financial.owner_approved);
  check('combined authorized provider spend is fully known',attempts>0&&attempts+prior.result.providerCalls<=4&&prior.result.actualCostUsd+spent<=.03&&held===0&&result.calls.every(c=>c.httpStatus===200&&c.providerStatus==='completed'));
  result.status='PASS';
 }catch(error){result.status='FAIL';result.failure={code:error.code??error.name,message:String(error.message).slice(0,240)};}
 finally{
  globalThis.fetch=originalFetch;Object.assign(env,savedEnv);
  if(originalSettings){try{const {id:_id,updated_at:_updated,...restore}=originalSettings;await must(supabase.from('luna32_runtime_settings').update(restore).eq('id',true));}catch{result.status='FAIL';result.restoreFailure=true;}}
  try{result.protectedAfter=await fingerprint();check('subscriber rights, Seeds and garden are unchanged',result.protectedBefore===result.protectedAfter);const state=await must(supabase.from('luna32_runtime_settings').select('generation_enabled,public_beta').eq('id',true).single());check('staging remains closed to new generation',!state.generation_enabled&&!state.public_beta);}catch{result.status='FAIL';result.protectionFailure=true;}
 }
 result.newProviderCalls=attempts;result.providerCalls+=attempts;result.actualCostUsd+=spent;result.unknownCostUpperBoundUsd=held;
 await supabase.from('luna30_qa_report_runs').update({state:result.status==='PASS'?'completed':'failed',result}).eq('run_name',runName);
 console.log(JSON.stringify({luna34Followup:result.status,newProviderCalls:attempts,totalProviderCalls:result.providerCalls,actualCostUsd:result.actualCostUsd}));return new Response(null,{status:204});
}
