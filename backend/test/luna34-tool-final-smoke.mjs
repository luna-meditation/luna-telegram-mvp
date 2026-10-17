// Staging-only final tool continuation, requiring its own explicit allowance.
// This run permits at most two additional provider calls and $0.01.
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
 const owner=158467796,runName='luna34-tools-final-20261017',result={status:'running',sourceCommit:options.sourceCommit,checks:[],calls:[],answers:[],maxAdditionalCalls:2,maxAdditionalUsd:.01,productionWrites:0,signedQaFixture:true};
 const claim=await supabase.from('luna30_qa_report_runs').insert({run_name:runName,state:'running',result});if(claim.error?.code==='23505')return new Response(null,{status:204});assert.ifError(claim.error);
 const must=async q=>{const r=await q;assert.ifError(r.error);return r.data;},check=(name,ok)=>{assert.ok(ok,name);result.checks.push({name,status:'PASS'});};
 const fingerprint=async()=>protectedStateFingerprint(await must(supabase.from('users').select('lifetime_access,active_until,free_used').eq('telegram_id',owner).single()),await must(supabase.from('moon_gardens').select('*').eq('telegram_id',owner)));
 const signed=()=>{const d=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:owner,first_name:'Luna QA',language_code:'en'})}),text=[...d].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n'),key=createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest();d.set('hash',createHmac('sha256',key).update(text).digest('hex'));return d.toString();};
 const api=async(path,body)=>{const r=await netlifyStagingHandler(new Request(host+path,{method:body?'POST':'GET',headers:{'x-telegram-init-data':signed(),'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),ctx);const data=await r.json();if(r.status>=400)(result.apiFailures??=[]).push({path,status:r.status,code:data.code??null});return{status:r.status,data};};
 const originalFetch=globalThis.fetch,savedEnv={AI_CHAT_ENABLED:env.AI_CHAT_ENABLED,FEATURE_PERSONALIZATION:env.FEATURE_PERSONALIZATION,AI_MAX_MESSAGES_PER_DAY:env.AI_MAX_MESSAGES_PER_DAY,AI_PREMIUM_MAX_MESSAGES_PER_DAY:env.AI_PREMIUM_MAX_MESSAGES_PER_DAY,AI_MAX_OUTPUT_TOKENS:env.AI_MAX_OUTPUT_TOKENS,AI_STRUCTURED_MAX_OUTPUT_TOKENS:env.AI_STRUCTURED_MAX_OUTPUT_TOKENS};
 let originalSettings,attempts=0,spent=0,held=0,armed=false;
 try{
  result.protectedBefore=await fingerprint();
  const previous=await must(supabase.from('luna30_qa_report_runs').select('state,result').eq('run_name','luna34-final-followup-20261017').single());
  assert.equal(previous.state,'failed');assert.equal(previous.result.failure.message,'independent dream response detaches the prior chart and stays readable');assert.equal(previous.result.providerCalls,4);assert.equal(previous.result.unknownCostUpperBoundUsd,0);assert.equal(previous.result.protectedBefore,previous.result.protectedAfter);
  result.previousRun='luna34-final-followup-20261017';result.previousCalls=4;result.previousCostUsd=previous.result.actualCostUsd;
  const failed=await must(supabase.from('ai_chat_requests').select('status,quota_charged').eq('telegram_id',owner).like('client_request_id','qa34_final_dream_%').single());
  check('previous test cap stopped dispatch without charging a successful user quota',failed.status==='failed_retryable'&&failed.quota_charged===false);
  originalSettings=await must(supabase.from('luna32_runtime_settings').select('*').eq('id',true).single());check('new generation is disabled before this finite test',!originalSettings.generation_enabled&&!originalSettings.public_beta);
  const {providerCostCeiling}=await import('../dist/luna32-ai-accounting.js'),{stagingAiMeterRecord}=await import('../dist/staging-ai-meter.js');
  globalThis.fetch=async(input,init)=>{
   const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.hostname!=='api.openai.com')return originalFetch(input,init);
   assert.ok(armed&&attempts<2,'Additional two-call limit');assert.equal(url.pathname,'/v1/responses');const body=JSON.parse(init.body),reserve=providerCostCeiling(body)/1e6;assert.equal(body.store,false);assert.ok(spent+held+reserve<=.01+1e-10,'Additional worst-case cost cap');
   attempts++;held+=reserve;const entry={index:attempts,reservedUsd:reserve,toolChoice:body.tool_choice};result.calls.push(entry);
   const response=await originalFetch(input,init),payload=await response.clone().json(),meter=stagingAiMeterRecord(payload);Object.assign(entry,{httpStatus:response.status,providerStatus:payload.status,tools:(payload.output??[]).filter(v=>v.type==='function_call').map(v=>v.name)});
   if(response.ok&&meter&&meter.estimated_cost!==null){assert.ok(meter.estimated_cost<=reserve);held-=reserve;spent+=meter.estimated_cost;Object.assign(entry,meter);}else entry.unknownCost=true;
   await must(supabase.from('luna30_qa_report_runs').update({result}).eq('run_name',runName));return response;
  };
  Object.assign(env,{AI_CHAT_ENABLED:true,FEATURE_PERSONALIZATION:false,AI_MAX_MESSAGES_PER_DAY:100,AI_PREMIUM_MAX_MESSAGES_PER_DAY:100,AI_MAX_OUTPUT_TOKENS:1600,AI_STRUCTURED_MAX_OUTPUT_TOKENS:1600});
  const ru=previous.result.answers.find(a=>a.requestId?.startsWith('qa34_final_ru_')),en=previous.result.answers.find(a=>a.language==='en');assert.ok(ru&&en);
  for(const answer of [ru,en]){const history=await api('/api/luna/conversations/'+answer.conversationId);check(answer.language+' final real answer reopens while generation is OFF',history.status===200&&history.data.messages.some(m=>m.content===answer.text));}
  const readings=(await api('/api/tarot/readings?offset=0')).data.readings;for(const kind of ['single','three','five']){const reading=readings.find(r=>(r.reading_kind??'single')===kind&&r.status==='ready');check(kind+' saved reading reopens for its owner without generation',Boolean(reading)&&(await api('/api/tarot/readings/'+reading.id)).status===200&&attempts===0);}
  const progress=await api('/api/luna34/progress');check('verified provider-backed A01 is saved',progress.status===200&&progress.data.metrics.aiInteractions>=2&&Boolean(progress.data.items.find(i=>i.id==='A01').unlockedAt));
  const ack=await api('/api/luna34/progress/acknowledge',{ids:['A01']}),after=await api('/api/luna34/progress');check('acknowledgement prevents a repeat celebration',ack.status===200&&ack.data.acknowledged&&!after.data.items.find(i=>i.id==='A01').celebrationPending);
  const sleep=await api('/api/luna/chat',{requestId:'qa34_final_sleep_'+randomUUID(),conversationId:en.conversationId,mode:'astrology',astrology:en.metadata.astrology,language:'ru',message:'Подбери медитацию для сна'});check('a real sleep recommendation detaches the chart without any provider call',sleep.status===200&&sleep.data.message.metadata.contextReset===true&&Boolean(sleep.data.message.metadata.recommendedMeditationId)&&attempts===0);
  const month=new Date().toISOString().slice(0,7)+'-01',totals=await must(supabase.from('luna32_ai_month_totals').select('spent_cost_microusd,held_cost_microusd').eq('month',month).maybeSingle());check('previous provider usage has no unresolved cost',!totals?.held_cost_microusd);
  await must(supabase.from('luna32_runtime_settings').update({generation_enabled:true,public_beta:true,beta_starts_at:new Date(Date.now()-60000).toISOString(),beta_expires_at:new Date(Date.now()+10*60000).toISOString(),cost_baseline_verified:true,baseline_month:month,legacy_monthly_cost_microusd:0,monthly_cap_microusd:Number(totals?.spent_cost_microusd??0)+10000,free_daily_limit:100,premium_daily_limit:100}).eq('id',true));
  const body={requestId:'qa34_tool_success_'+randomUUID(),conversationId:en.conversationId,mode:'astrology',astrology:en.metadata.astrology,language:'en',message:'Help me understand my dream. I dreamed about a quiet unfamiliar library and felt curious. First check my remaining Luna AI quota using the server tool, then give two short paragraphs for reflection. This is a new topic: do not connect it to astrology, predict events or save personal information. Offer two useful follow-up questions.'};
  armed=true;let reply;try{reply=await api('/api/luna/chat',body);}finally{armed=false;}
  check('actual read-only tool continuation yields a completed human-readable answer',reply.status===200&&attempts===2&&result.calls[0].tools.length>0&&result.calls[1].toolChoice==='none'&&Boolean(reply.data.message?.content));
  const message=reply.data.message;check('dream context detaches old chart and preserves meaningful prose',message.metadata.contextReset===true&&!message.metadata.astrology&&/library|curious|dream/i.test(message.content)&&!/^\s*[{[]/.test(message.content));
  check('new English follow-ups stay bounded and useful',message.metadata.consultation?.quickReplies?.length>=2&&message.metadata.consultation.quickReplies.length<=3);
  const before=attempts,replay=await api('/api/luna/chat',body),history=await api('/api/luna/conversations/'+body.conversationId);check('tool-assisted answer persists; duplicate and history cause zero new requests',replay.status===200&&replay.data.duplicate===true&&replay.data.message.content===message.content&&history.data.messages.some(m=>m.content===message.content)&&attempts===before);
  result.answers=[{language:'en',text:message.content,metadata:message.metadata,conversationId:body.conversationId,requestId:body.requestId}];
  const financial=await must(supabase.from('luna34_commercial_settings').select('*').eq('id',true).single());check('all new commercial flags remain disabled',!financial.owner_approved&&!financial.checkout_enabled&&!financial.quotas_enabled&&!financial.rewards_enabled&&!financial.referrals_enabled);
  check('additional provider cost is known and within the explicit allowance',attempts===2&&spent>0&&spent<=.01&&held===0&&result.calls.every(c=>c.httpStatus===200&&c.providerStatus==='completed'));
  result.status='PASS';
 }catch(error){result.status='FAIL';result.failure={code:error.code??error.name,message:String(error.message).slice(0,240)};}
 finally{
  globalThis.fetch=originalFetch;Object.assign(env,savedEnv);
  if(originalSettings){try{const{id:_id,updated_at:_updated,...restore}=originalSettings;await must(supabase.from('luna32_runtime_settings').update(restore).eq('id',true));}catch{result.status='FAIL';result.restoreFailure=true;}}
  try{result.protectedAfter=await fingerprint();check('paid rights, balance and garden remain exact',result.protectedBefore===result.protectedAfter);const settings=await must(supabase.from('luna32_runtime_settings').select('generation_enabled,public_beta').eq('id',true).single());check('staging generation is closed after the test',!settings.generation_enabled&&!settings.public_beta);}catch{result.status='FAIL';result.protectionFailure=true;}
 }
 result.providerCalls=attempts;result.actualCostUsd=spent;result.unknownCostUpperBoundUsd=held;
 await supabase.from('luna30_qa_report_runs').update({state:result.status==='PASS'?'completed':'failed',result}).eq('run_name',runName);
 console.log(JSON.stringify({luna34ToolSmoke:result.status,providerCalls:attempts,actualCostUsd:spent,unknownCostUpperBoundUsd:held}));return new Response(null,{status:204});
}
