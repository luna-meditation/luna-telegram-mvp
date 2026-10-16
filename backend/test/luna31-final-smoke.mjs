// Final owner-approved continuation: TWO additional neutral calls, <= $0.01.
// Signed platform event, existing private staging only. Never a public QA API.
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {protectedStateFingerprint} from './luna31-financial-guard.mjs';
import {netlifyStagingHandler} from '../dist/netlify-staging-handler.js';
export async function run(event){
 if(event.site?.id!=='a634a7fc-1ecb-47fa-8b43-edd81a7e3694'||Netlify.env.get('SUPABASE_URL')!=='https://funvzpmpbgazsisehiru.supabase.co'||Date.now()>Date.parse('2026-10-16T16:00:00Z'))return;
 const host='https://luna-staging-itfl.netlify.app',context={site:event.site,ip:'127.0.0.1'};
 await netlifyStagingHandler(new Request(host+'/health'),context);
 const {env}=await import('../dist/config.js'),{supabase}=await import('../dist/db.js');
 assert.ok(env.STAGING_MODE&&env.STAGING_TELEGRAM_IDS==='158467796'&&env.STAGING_SUPABASE_PROJECT_REF==='funvzpmpbgazsisehiru');
 const owner=158467796,runName='luna31-consultation-final-20261016';
 const previous=await supabase.from('luna30_qa_report_runs').select('state,result').eq('run_name','luna31-consultation-20261016-v4').single();assert.ifError(previous.error);
 const prior=previous.data.result;assert.equal(prior.providerAttempts,6);assert.equal(prior.calls.length,6);assert.equal(prior.unsettledCostUpperBoundUsd,0);assert.ok(prior.calls.every(c=>c.providerStatus==='completed'));
 const claim=await supabase.from('luna30_qa_report_runs').insert({run_name:runName,state:'running',result:{maxAdditionalCalls:2,maxAdditionalUsd:0.01,priorCostUsd:prior.costUsd}}).select('run_name');if(claim.error?.code==='23505')return;assert.ifError(claim.error);
 const result={status:'running',checks:[],calls:[...prior.calls],answers:[...prior.answers],providerAnswers:[],priorCalls:6,priorCostUsd:prior.costUsd,productionWrites:0,syntheticDataOnly:true,actualTelegramLogin:false,signedQaFixture:true,physicalDevice:false};
 const check=(name,value)=>{assert.ok(value,name);result.checks.push({name,status:'PASS'});};
 const fingerprint=async()=>{const [user,garden]=await Promise.all([supabase.from('users').select('lifetime_access,active_until,free_used').eq('telegram_id',owner).single(),supabase.from('moon_gardens').select('*').eq('telegram_id',owner)]);assert.ifError(user.error);assert.ifError(garden.error);return protectedStateFingerprint(user.data,garden.data);};
 const originalFetch=globalThis.fetch;let calls=0,spent=0,held=0,armed=false,currentCase='';
 try{
  result.protectedBefore=await fingerprint();
  check('exact staging flags, migrations disabled and all new monetization OFF',env.FEATURE_ASTROLOGY&&env.LUNA30_ASTROLOGY_AI_ENABLED&&env.LUNA30_PROGRESSION_ENABLED&&!env.RUN_MIGRATIONS&&!env.FEATURE_MOON_SEEDS_PURCHASES&&!env.FEATURE_TAROT_PAID_READINGS&&!env.FEATURE_PREMIUM_V2&&!env.LUNA30_PREMIUM_ENABLED&&!env.LUNA30_MONTHLY_QUOTAS_ENABLED);
  env.FEATURE_PERSONALIZATION=false;env.AI_MAX_MESSAGES_PER_DAY=100;env.AI_PREMIUM_MAX_MESSAGES_PER_DAY=100;
  const {stagingAiMeterRecord}=await import('../dist/staging-ai-meter.js');
  const availability=await originalFetch('https://api.openai.com/v1/models/gpt-5-mini',{headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`}});check('configured model is accessible using the existing server-only key',availability.ok&&(await availability.json()).id==='gpt-5-mini');
  globalThis.fetch=async(input,init)=>{
   const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.hostname!=='api.openai.com')return originalFetch(input,init);
   assert.ok(armed&&calls<2,'Provider forbidden outside the two approved neutral turns');assert.equal(url.pathname,'/v1/responses');
   const body=JSON.parse(init.body);assert.equal(body.model,'gpt-5-mini');assert.equal(body.store,false);body.service_tier='default';
   const inputBound=Buffer.byteLength(JSON.stringify(body))+512,ceiling=Math.min(0.007,0.01-spent-held);
   body.max_output_tokens=Math.min(body.max_output_tokens,Math.floor((ceiling-inputBound*.00000025)/.000002));assert.ok(body.max_output_tokens>=512,'Budget cannot safely fit another request');
   const reserve=inputBound*.00000025+body.max_output_tokens*.000002;held+=reserve;calls++;check('cost reservation remains within additional $0.01',spent+held<=0.01000000001);
   const response=await originalFetch(input,{...init,body:JSON.stringify(body)}),payload=await response.clone().json(),meter=stagingAiMeterRecord(payload);
   assert.ok(meter&&meter.estimated_cost!==null);assert.ok(meter.estimated_cost<=reserve);held-=reserve;spent+=meter.estimated_cost;
   result.calls.push({attempt:6+calls,name:currentCase,httpStatus:response.status,...meter,providerStatus:payload.status,maxOutputTokens:body.max_output_tokens});
   const text=(payload.output??[]).filter(o=>o.type==='message'&&o.role==='assistant').flatMap(o=>o.content??[]).filter(c=>c.type==='output_text').map(c=>c.text??'').join('');
   let prose;try{prose=JSON.parse(text).message;}catch{prose=null;}result.providerAnswers.push({name:currentCase,message:prose});
   await supabase.from('luna30_qa_report_runs').update({result}).eq('run_name',runName);return response;
  };
  const signed=(id=owner)=>{const data=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:'Luna QA',language_code:'en'})}),checkString=[...data].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n'),key=createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest();data.set('hash',createHmac('sha256',key).update(checkString).digest('hex'));return data.toString();};
  const request=async(path,body,auth=signed())=>{const response=await netlifyStagingHandler(new Request(host+path,{method:body?'POST':'GET',headers:{'x-telegram-init-data':auth,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),context);const data=await response.json();if(response.status>=400)(result.apiFailures??=[]).push({path,status:response.status,code:data.code??null});return{status:response.status,data};};
  check('unsigned and non-QA accounts denied',(await request('/api/luna/conversations',undefined,'invalid')).status===401&&(await request('/api/luna/conversations',undefined,signed(880003199))).status===403);
  for(const [language,message,safety]of [['en','I want to harm myself.','self_harm'],['ru','Я хочу навредить себе.','self_harm'],['en','I have severe chest pain and cannot breathe.','medical_emergency']]){
   const response=await request('/api/luna/chat',{requestId:'qa31_final_'+randomUUID(),mode:'companion',language,message});check('deterministic '+safety+' '+language+' needs no provider',response.status===200&&response.data.message.metadata.safetyState===safety&&calls===0);
  }
  const profile=await request('/api/profile/me');check('real staging profile, progression and achievements work',profile.status===200&&Boolean(profile.data.journeyV3)&&Array.isArray(profile.data.achievements?.items));
  const attached=prior.answers.find(a=>a.name==='compatibility RU')?.metadata.astrology;assert.ok(attached?.secondChartId&&attached.reportId);
  const {hasDanglingConsultationPromise}=await import('../dist/luna-ai-quality.js');
  async function turn(name,input){const requestId='qa31_final_'+randomUUID();currentCase=name;armed=true;let response;try{response=await request('/api/luna/chat',{...input,requestId});}finally{armed=false;}
   check(name+' full authenticated request completes',response.status===200&&Boolean(response.data.message?.content));
   const text=response.data.message.content,metadata=response.data.message.metadata;
   check(name+' complete readable prose, no serialized payload',!hasDanglingConsultationPromise(text)&&!/^\s*[{[]/.test(text)&&!text.includes('\\n')&&!/[\uac00-\ud7af]/u.test(text));
   check(name+' carries both exact charts and saved report',metadata.astrology?.chartId===attached.chartId&&metadata.astrology?.secondChartId===attached.secondChartId&&metadata.astrology?.reportId===attached.reportId);
   check(name+' uses both actual Mercury signs',input.language==='ru'?/Меркур/iu.test(text)&&/Козерог/iu.test(text)&&/Водол/iu.test(text):/Mercury/i.test(text)&&/Capricorn/i.test(text)&&/Aquarius/i.test(text));
   result.answers.push({name,text,metadata,conversationId:response.data.conversationId,requestId});return response.data;
  }
  const first=await turn('final compatibility RU',{mode:'astrology',astrology:attached,language:'ru',message:'Обсудим общение по этим двум картам. В двух коротких пунктах назови знак Меркурия в первой и второй карте и объясни символическую разницу. Затем предложи один конкретный вопрос для разговора. Можно ли по этим данным знать реальные чувства другого человека? Дай сам разбор сейчас, а не вступление к нему.'});
  await turn('final saved-context EN follow-up',{conversationId:first.conversationId,language:'en',message:'Continue in English using these same two charts and report. Name both Mercury signs again, then give one concrete, respectful communication experiment that follows from their symbolic difference. Do not claim to know actual feelings or predict an outcome.'});
  check('two new calls, all eight lifetime QA calls within approvals',calls===2&&spent>0&&spent<=0.01&&result.calls.length===8&&result.calls.every(c=>c.httpStatus===200&&c.providerStatus==='completed'));
  for(const answer of result.answers){const user=await supabase.from('ai_messages').select('content').eq('telegram_id',owner).eq('conversation_id',answer.conversationId).eq('request_id',answer.requestId).eq('role','user').single();assert.ifError(user.error);
   const metadata=answer.metadata,body={requestId:answer.requestId,conversationId:answer.conversationId,language:/RU/.test(answer.name)?'ru':'en',message:user.data.content,...(metadata.astrology?{mode:'astrology',astrology:metadata.astrology}:metadata.readingId?{mode:'tarot',readingId:metadata.readingId}:{})};
   const before=calls,replay=await request('/api/luna/chat',body),history=await request('/api/luna/conversations/'+answer.conversationId);
   check(answer.name+' stored replay and reopening make zero provider calls',replay.status===200&&replay.data.message.content===answer.text&&history.status===200&&history.data.messages.some(m=>m.content===answer.text)&&calls===before);
  }
  const missing=await request('/api/luna/chat',{requestId:'qa31_final_'+randomUUID(),mode:'astrology',chartId:randomUUID(),language:'en',message:'Discuss this chart.'});check('missing or foreign chart denied before provider',missing.status===404&&calls===2);
  const quota=await request('/api/luna/usage');check('remaining allowance and reset come from server',quota.status===200&&quota.data.remaining>=0&&Number.isFinite(Date.parse(quota.data.resetAt)));
  result.status='PASS';
 }catch(error){result.status='FAIL';result.failure={code:error.code??error.name,message:String(error.message).slice(0,220)};}
 finally{
  globalThis.fetch=originalFetch;
  try{result.protectedAfter=await fingerprint();check('Moon Seeds, garden and subscription unchanged',result.protectedBefore===result.protectedAfter);}catch(error){result.status='FAIL';result.protectionFailure=String(error.message).slice(0,160);}
 }
 result.additionalProviderAttempts=calls;result.providerAttempts=6+calls;result.additionalCostUsd=spent;result.costUsd=prior.costUsd+spent;result.unsettledCostUpperBoundUsd=Math.max(0,held);result.qaProcessOnlyLimitOverride=true;
 await supabase.from('luna30_qa_report_runs').update({state:result.status==='PASS'?'completed':'failed',result}).eq('run_name',runName);
 console.log(JSON.stringify({luna31FinalSmoke:result.status,additionalCalls:calls,totalCalls:6+calls,totalCostUsd:result.costUsd}));
}
