// Existing QA infrastructure only. This is never included in production.
// Synthetic questions/charts, at most 4 provider calls and $0.03 in total.
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {authorizeLuna32Smoke,luna32StagingSite} from '../dist/luna32-staging-guard.js';
import {protectedStateFingerprint} from './luna31-financial-guard.mjs';

export async function run(request,context,options){
 if(!authorizeLuna32Smoke(request,context.site?.id,options)||Netlify.env.get('SUPABASE_URL')!=='https://funvzpmpbgazsisehiru.supabase.co')return new Response(null,{status:403});
 const {netlifyStagingHandler}=await import('../dist/netlify-staging-handler.js');
 const host='https://luna-staging-itfl.netlify.app',qaContext={site:{id:luna32StagingSite},ip:'127.0.0.1'};
 await netlifyStagingHandler(new Request(host+'/health'),qaContext);
 const {env}=await import('../dist/config.js'),{supabase}=await import('../dist/db.js');
 assert.ok(env.STAGING_MODE&&env.LUNA32_ENABLED&&env.STAGING_TELEGRAM_IDS==='158467796'&&env.STAGING_SUPABASE_PROJECT_REF==='funvzpmpbgazsisehiru');
 const owner=158467796,runName='luna34-final-qa-20261017',maxCalls=4,maxUsd=.03;
 const result={status:'running',sourceCommit:options.sourceCommit,checks:[],calls:[],answers:[],productionWrites:0,physicalDevice:false,actualTelegramLogin:false,signedQaFixture:true,syntheticContext:true,maxCalls,maxUsd};
 const claim=await supabase.from('luna30_qa_report_runs').insert({run_name:runName,state:'running',result});
 if(claim.error?.code==='23505')return new Response(null,{status:204});assert.ifError(claim.error);
 const must=async query=>{const r=await query;assert.ifError(r.error);return r.data;};
 const check=(name,ok)=>{assert.ok(ok,name);result.checks.push({name,status:'PASS'});};
 const fingerprint=async()=>protectedStateFingerprint(await must(supabase.from('users').select('lifetime_access,active_until,free_used').eq('telegram_id',owner).single()),await must(supabase.from('moon_gardens').select('*').eq('telegram_id',owner)));
 const signed=(id=owner)=>{const d=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:'Luna QA',language_code:'en'})}),text=[...d].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n'),key=createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest();d.set('hash',createHmac('sha256',key).update(text).digest('hex'));return d.toString();};
 const toolTimes=[];
 const api=async(path,body,method=body?'POST':'GET',auth=signed())=>{
  if(path.startsWith('/api/luna/tools/')){
   while(toolTimes.length&&toolTimes[0]<=Date.now()-61000)toolTimes.shift();
   while(toolTimes.length>=8){await new Promise(resolve=>setTimeout(resolve,Math.min(50000,Math.max(1,61000-(Date.now()-toolTimes[0])))));while(toolTimes.length&&toolTimes[0]<=Date.now()-61000)toolTimes.shift();}
   toolTimes.push(Date.now());
  }
  const response=await netlifyStagingHandler(new Request(host+path,{method,headers:{'x-telegram-init-data':auth,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),qaContext);
  const data=await response.json();if(response.status>=400)(result.apiFailures??=[]).push({path,status:response.status,code:data.code??null});return {status:response.status,data};
 };
 const originalFetch=globalThis.fetch,savedEnv={AI_CHAT_ENABLED:env.AI_CHAT_ENABLED,FEATURE_PERSONALIZATION:env.FEATURE_PERSONALIZATION,AI_MAX_MESSAGES_PER_DAY:env.AI_MAX_MESSAGES_PER_DAY,AI_PREMIUM_MAX_MESSAGES_PER_DAY:env.AI_PREMIUM_MAX_MESSAGES_PER_DAY,AI_MAX_OUTPUT_TOKENS:env.AI_MAX_OUTPUT_TOKENS,AI_STRUCTURED_MAX_OUTPUT_TOKENS:env.AI_STRUCTURED_MAX_OUTPUT_TOKENS};
 let originalSettings,attempts=0,spent=0,held=0,armed=false,currentCase='';
 try{
  result.protectedBefore=await fingerprint();originalSettings=await must(supabase.from('luna32_runtime_settings').select('*').eq('id',true).single());
  check('staging AI is disabled outside the bounded smoke test',!originalSettings.generation_enabled&&!originalSettings.public_beta);
  check('automatic migrations and all new financial behavior remain disabled',!env.RUN_MIGRATIONS&&!env.LUNA34_COMMERCIAL_ENABLED&&!env.LUNA34_COMMERCIAL_QUOTAS_ENABLED&&!env.LUNA34_REFERRALS_ENABLED&&!env.FEATURE_MOON_SEEDS_PURCHASES&&!env.FEATURE_TAROT_PAID_READINGS&&!env.FEATURE_PREMIUM_V2);
  const commercial=await must(supabase.from('luna34_commercial_settings').select('*').eq('id',true).single());
  check('database commercial flags are off',!commercial.checkout_enabled&&!commercial.quotas_enabled&&!commercial.rewards_enabled&&!commercial.referrals_enabled&&!commercial.owner_approved);
  const month=new Date().toISOString().slice(0,7)+'-01',totals=await must(supabase.from('luna32_ai_month_totals').select('spent_cost_microusd,held_cost_microusd').eq('month',month).maybeSingle());
  check('no unresolved prior provider spend',!totals?.held_cost_microusd);
  await must(supabase.from('luna32_runtime_settings').update({generation_enabled:true,public_beta:true,beta_starts_at:new Date(Date.now()-60000).toISOString(),beta_expires_at:new Date(Date.now()+20*60000).toISOString(),cost_baseline_verified:true,baseline_month:month,legacy_monthly_cost_microusd:0,monthly_cap_microusd:Number(totals?.spent_cost_microusd??0)+Math.floor(maxUsd*1e6),free_daily_limit:100,premium_daily_limit:100}).eq('id',true));
  Object.assign(env,{AI_CHAT_ENABLED:true,FEATURE_PERSONALIZATION:false,AI_MAX_MESSAGES_PER_DAY:100,AI_PREMIUM_MAX_MESSAGES_PER_DAY:100,AI_MAX_OUTPUT_TOKENS:2600,AI_STRUCTURED_MAX_OUTPUT_TOKENS:2600});
  const model=await originalFetch('https://api.openai.com/v1/models/gpt-5-mini',{headers:{Authorization:'Bearer '+env.OPENAI_API_KEY},signal:AbortSignal.timeout(15000)});
  check('existing server-only OpenAI key can access the configured model',model.ok&&(await model.json()).id==='gpt-5-mini');
  const {providerCostCeiling}=await import('../dist/luna32-ai-accounting.js'),{stagingAiMeterRecord}=await import('../dist/staging-ai-meter.js');
  globalThis.fetch=async(input,init)=>{
   const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.hostname!=='api.openai.com')return originalFetch(input,init);
   assert.ok(armed&&attempts<maxCalls,'Finite provider call limit');assert.equal(url.pathname,'/v1/responses');
   const body=JSON.parse(init.body),reserve=providerCostCeiling(body)/1e6;assert.ok(spent+held+reserve<=maxUsd+1e-10,'Finite worst-case budget');assert.equal(body.store,false);
   attempts++;held+=reserve;const entry={index:attempts,name:currentCase,reservedUsd:reserve};result.calls.push(entry);
   const response=await originalFetch(input,init),payload=await response.clone().json(),meter=stagingAiMeterRecord(payload);
   Object.assign(entry,{httpStatus:response.status,providerStatus:payload.status,tools:(payload.output??[]).filter(v=>v.type==='function_call').map(v=>v.name)});
   if(response.ok&&meter&&meter.estimated_cost!==null){assert.ok(meter.estimated_cost<=reserve);held-=reserve;spent+=meter.estimated_cost;Object.assign(entry,meter);}else entry.unknownCost=true;
   await must(supabase.from('luna30_qa_report_runs').update({result}).eq('run_name',runName));return response;
  };
  check('unsigned and non-QA identities are rejected',(await api('/api/luna34/membership',undefined,'GET','invalid')).status===401&&(await api('/api/luna34/progress',undefined,'GET',signed(880003499))).status===403);
  check('admin metrics respect the actual server-configured role',(await api('/api/luna34/admin/metrics')).status===(env.ADMIN_TELEGRAM_ID===owner?200:403));
  const membership=await api('/api/luna34/membership');check('membership uses actual saved rights and financial features remain closed',membership.status===200&&!membership.data.commercialEnabled&&!membership.data.quotasEnabled);
  const beforeProgress=await api('/api/luna34/progress');check('exactly 50 server-backed achievement definitions',beforeProgress.status===200&&beforeProgress.data.version===34&&beforeProgress.data.items.length===50);
  const readings=(await api('/api/tarot/readings?offset=0')).data.readings;
  for(const kind of ['single','three','five']){
   const reading=readings.find(r=>(r.reading_kind??'single')===kind&&r.status==='ready');check(kind+' real saved reading is available',Boolean(reading));
   const opened=await api('/api/tarot/readings/'+reading.id);check(kind+' saved result reopens without generation',opened.status===200&&Boolean(opened.data.interpretation)&&attempts===0);
  }
  const reading=readings.find(r=>(r.reading_kind??'single')==='three'&&r.status==='ready'),attach=await api('/api/luna/tools/tarot/attach',{readingId:reading.id});
  check('real saved spread attaches to a conversation',attach.status===200&&attach.data.message.metadata.tarot.readingId===reading.id);
  const conversationId=attach.data.conversationId,tarotBody={requestId:'qa34_tarot_'+randomUUID(),conversationId,readingId:reading.id,mode:'tarot',language:'ru',message:'Назови карты именно этого сохранённого расклада и их положения. В двух коротких абзацах свяжи разные позиции с одним небольшим практическим шагом. Не предсказывай будущее и не приписывай другому человеку чувства. Предложи два уместных вопроса для продолжения.'};
  currentCase='saved Tarot context RU';armed=true;let tarotReply;try{tarotReply=await api('/api/luna/chat',tarotBody);}finally{armed=false;}
  check('real Russian contextual Tarot answer completes',tarotReply.status===200&&/[а-яё]/i.test(tarotReply.data.message?.content??''));
  const tarotText=tarotReply.data.message.content,tarotMeta=tarotReply.data.message.metadata;
  check('exact reading context persists',tarotMeta.readingId===reading.id);
  check('dynamic quick replies are present, bounded and non-executable',Array.isArray(tarotMeta.consultation?.quickReplies)&&tarotMeta.consultation.quickReplies.length>=2&&tarotMeta.consultation.quickReplies.length<=3&&tarotMeta.consultation.quickReplies.every(t=>typeof t==='string'&&t.length<=110&&!/https?:|[<>]/.test(t)));
  const callsBefore=attempts,replay=await api('/api/luna/chat',tarotBody),reopened=await api('/api/luna/conversations/'+conversationId);
  check('duplicate and conversation reopen reuse the exact saved AI result',replay.status===200&&replay.data.message.content===tarotText&&reopened.data.messages.some(m=>m.content===tarotText)&&attempts===callsBefore);
  result.answers.push({language:'ru',text:tarotText,metadata:tarotMeta,readingId:reading.id,requestId:tarotBody.requestId,conversationId});
  const profiles=(await api('/api/astrology/profiles')).data.profiles,qaProfile=profiles.find(p=>p.display_label==='Luna 3.3 QA Star');check('existing synthetic birth profile is available',Boolean(qaProfile));
  const setup=await api('/api/luna/chat',{requestId:'qa34_chart_setup_'+randomUUID(),language:'en',message:'Open my natal chart.'});
  check('natal setup opens a real selector without another paid call',setup.status===200&&setup.data.message.metadata.astrologyWorkflow?.state==='selecting'&&attempts===callsBefore);
  const selected=await api('/api/luna/tools/astrology',{requestId:setup.data.message.id,conversationId:setup.data.conversationId,kind:'natal',language:'en',firstProfileId:qaProfile.id});
  check('saved synthetic birth data calculates a real natal chart',selected.status===200&&selected.data.message.metadata.astrologyWorkflow?.state==='ready');
  const chartId=selected.data.message.metadata.astrology.chartId,chart=(await api('/api/astrology/charts/'+chartId)).data.chart,aspect=chart.calculation.aspects[0];check('chart contains an actual calculated aspect',Boolean(aspect));
  const attachment={chartId,aspect:{from:aspect.from,to:aspect.to,type:aspect.type}},astroBody={requestId:'qa34_aspect_'+randomUUID(),conversationId:setup.data.conversationId,mode:'astrology',language:'en',astrology:attachment,astrologyConsent:true,message:'Explain only this selected calculated aspect, naming both planets and its aspect type. Keep it to two short paragraphs and one useful reflection question. Treat astrology as symbolic reflection, not a fact about my future. Offer two relevant follow-up questions.'};
  currentCase='exact calculated aspect EN';armed=true;let astroReply;try{astroReply=await api('/api/luna/chat',astroBody);}finally{armed=false;}
  check('real English answer about the selected aspect completes',astroReply.status===200&&Boolean(astroReply.data.message?.content));
  const astroText=astroReply.data.message.content,astroMeta=astroReply.data.message.metadata;
  check('selected aspect identity and explicit scoped consent persist',astroMeta.astrology?.chartId===chartId&&['from','to','type'].every(key=>astroMeta.astrology?.aspect?.[key]===attachment.aspect[key])&&astroMeta.astrologyConsent?.version===1);
  check('answer names the actual two planets and selected aspect',astroText.toLowerCase().includes(aspect.from)&&astroText.toLowerCase().includes(aspect.to)&&astroText.toLowerCase().includes(aspect.type));
  const n=attempts,astroReplay=await api('/api/luna/chat',astroBody);check('aspect reply retry does not regenerate',astroReplay.status===200&&astroReplay.data.message.content===astroText&&attempts===n);
  result.answers.push({language:'en',text:astroText,metadata:astroMeta,aspect:attachment,requestId:astroBody.requestId,conversationId:setup.data.conversationId});
  const practice=await api('/api/luna/chat',{requestId:'qa34_sleep_'+randomUUID(),conversationId:setup.data.conversationId,mode:'astrology',astrology:attachment,language:'ru',message:'Подбери медитацию для сна'});
  check('real sleep action detaches old chart without spending another call',practice.status===200&&practice.data.message.metadata.contextReset===true&&Boolean(practice.data.message.metadata.recommendedMeditationId)&&attempts===n);
  const afterProgress=await api('/api/luna34/progress');check('successful AI interaction yields persisted verified progress',afterProgress.status===200&&afterProgress.data.metrics.aiInteractions>beforeProgress.data.metrics.aiInteractions&&afterProgress.data.items.find(i=>i.id==='A01').unlockedAt);
  const acknowledged=await api('/api/luna34/progress/acknowledge',{ids:['A01']}),acknowledgedProgress=await api('/api/luna34/progress');check('acknowledged discoveries do not reappear as pending celebrations',acknowledged.status===200&&acknowledged.data.acknowledged&&!acknowledgedProgress.data.items.find(i=>i.id==='A01').celebrationPending);
  check('bounded authorized provider spend is fully known',attempts>0&&attempts<=maxCalls&&spent>0&&spent<=maxUsd&&held===0&&result.calls.every(c=>c.httpStatus===200&&c.providerStatus==='completed'));
  result.status='PASS';
 }catch(error){result.status='FAIL';result.failure={code:error.code??error.name,message:String(error.message).slice(0,240)};}
 finally{
  globalThis.fetch=originalFetch;Object.assign(env,savedEnv);
  if(originalSettings){try{const {id:_id,updated_at:_updated,...restore}=originalSettings;await must(supabase.from('luna32_runtime_settings').update(restore).eq('id',true));check('original staging AI settings restored',!(await must(supabase.from('luna32_runtime_settings').select('generation_enabled').eq('id',true).single())).generation_enabled);}catch{result.status='FAIL';result.restoreFailure=true;}}
  try{result.protectedAfter=await fingerprint();check('Moon Seeds, garden and existing subscription rights are unchanged',result.protectedBefore===result.protectedAfter);}catch{result.status='FAIL';result.protectionFailure=true;}
 }
 result.providerCalls=attempts;result.actualCostUsd=spent;result.unknownCostUpperBoundUsd=held;
 await supabase.from('luna30_qa_report_runs').update({state:result.status==='PASS'?'completed':'failed',result}).eq('run_name',runName);
 console.log(JSON.stringify({luna34Smoke:result.status,providerCalls:attempts,costUsd:spent,unknownCostUpperBoundUsd:held}));return new Response(null,{status:204});
}
