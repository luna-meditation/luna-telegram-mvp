// Expiring, bearer-protected, existing staging only. Max 3 provider calls / $0.02.
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
 const owner=158467796,runName='luna35-conversational-commerce-tool-20261017',result={status:'running',sourceCommit:options.sourceCommit,checks:[],calls:[],answers:[],maxProviderCalls:3,maxUsd:.02,productionWrites:0,signedQaFixture:true,physicalDevice:false};
 const claim=await supabase.from('luna30_qa_report_runs').insert({run_name:runName,state:'running',result});if(claim.error?.code==='23505')return new Response(null,{status:204});assert.ifError(claim.error);
 const must=async q=>{const r=await q;assert.ifError(r.error);return r.data;},check=(name,ok)=>{assert.ok(ok,name);result.checks.push({name,status:'PASS'});};
 const fingerprint=async()=>protectedStateFingerprint(await must(supabase.from('users').select('lifetime_access,active_until,free_used').eq('telegram_id',owner).single()),await must(supabase.from('moon_gardens').select('*').eq('telegram_id',owner)));
 const signed=(id=owner)=>{const d=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:'Luna QA',language_code:'en'})}),text=[...d].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n'),key=createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest();d.set('hash',createHmac('sha256',key).update(text).digest('hex'));return d.toString();};
 const api=async(path,body,auth=signed())=>{const r=await netlifyStagingHandler(new Request(host+path,{method:body?'POST':'GET',headers:{'x-telegram-init-data':auth,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),ctx);const data=await r.json();if(r.status>=400)(result.apiFailures??=[]).push({path,status:r.status,code:data.code??null});return{status:r.status,data};};
 const originalFetch=globalThis.fetch,savedEnv={AI_CHAT_ENABLED:env.AI_CHAT_ENABLED,AI_MAX_MESSAGES_PER_DAY:env.AI_MAX_MESSAGES_PER_DAY,AI_PREMIUM_MAX_MESSAGES_PER_DAY:env.AI_PREMIUM_MAX_MESSAGES_PER_DAY,AI_MAX_OUTPUT_TOKENS:env.AI_MAX_OUTPUT_TOKENS,AI_STRUCTURED_MAX_OUTPUT_TOKENS:env.AI_STRUCTURED_MAX_OUTPUT_TOKENS};
 let originalSettings,attempts=0,spent=0,held=0,armed=false;
 try{
  result.protectedBefore=await fingerprint();
  const prior=await must(supabase.from('luna30_qa_report_runs').select('result').eq('run_name','luna35-conversational-commerce-20261017').single());
  check('the previous deterministic-only run consumed none of this provider allowance',prior.result.providerCalls===0&&prior.result.actualCostUsd===0&&prior.result.unknownCostUpperBoundUsd===0);
  originalSettings=await must(supabase.from('luna32_runtime_settings').select('*').eq('id',true).single());check('generation is disabled before this finite QA run',!originalSettings.generation_enabled&&!originalSettings.public_beta);
  const {providerCostCeiling}=await import('../dist/luna32-ai-accounting.js'),{stagingAiMeterRecord}=await import('../dist/staging-ai-meter.js');
  globalThis.fetch=async(input,init)=>{
   const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.hostname!=='api.openai.com')return originalFetch(input,init);
   assert.ok(armed&&attempts<3,'Owner-approved provider-call limit');assert.equal(url.pathname,'/v1/responses');const body=JSON.parse(init.body),reserve=providerCostCeiling(body)/1e6;assert.equal(body.store,false);assert.ok(spent+held+reserve<=.02+1e-10,'Worst-case total cost cap');
   attempts++;held+=reserve;const entry={index:attempts,reservedUsd:reserve,toolChoice:body.tool_choice,model:body.model};result.calls.push(entry);
   const response=await originalFetch(input,init),payload=await response.clone().json(),meter=stagingAiMeterRecord(payload);Object.assign(entry,{httpStatus:response.status,providerStatus:payload.status,tools:(payload.output??[]).filter(v=>v.type==='function_call').map(v=>v.name)});
   if(response.ok&&meter&&meter.estimated_cost!==null){assert.ok(meter.estimated_cost<=reserve);held-=reserve;spent+=meter.estimated_cost;Object.assign(entry,meter);}else entry.unknownCost=true;
   await must(supabase.from('luna30_qa_report_runs').update({result}).eq('run_name',runName));return response;
  };
  check('missing, forged and non-allowlisted Telegram sessions cannot read commerce',(await api('/api/luna35/commerce',undefined,'')).status===401&&(await api('/api/luna35/commerce',undefined,'hash=invalid')).status===401&&(await api('/api/luna35/commerce',undefined,signed(880003502))).status===403);
  for(const language of ['en','ru'])for(const view of ['wallet','shop','premium','earn','history','quota']){const r=await api(`/api/luna35/commerce?view=${view}&language=${language}`);check(language+' '+view+' uses actual owner facts without AI',r.status===200&&r.data.balance>=0&&r.data.language===language&&attempts===0&&Object.values(r.data.products).every(v=>v===false));}
  const free={requestId:randomUUID(),language:'ru',message:'Сколько у меня Moon Seeds?'};
  const turn=await api('/api/luna/chat',free),duplicate=await api('/api/luna/chat',free);check('a free commerce turn is persisted exactly once with no AI call',turn.status===200&&duplicate.status===200&&duplicate.data.duplicate===true&&turn.data.message.id===duplicate.data.message.id&&turn.data.message.metadata.commerce.view==='wallet'&&attempts===0);
  const history=await api('/api/luna/conversations/'+turn.data.conversationId);check('saved commerce turn reopens without generation',history.status===200&&history.data.messages.some(m=>m.id===turn.data.message.id)&&attempts===0);
  const pending={id:randomUUID(),conversationId:turn.data.conversationId,language:'ru',action:{type:'tarot',kind:'single',intention:'growth',question:'Как найти время для спокойного вечернего отдыха?'}};
  const saved=await api('/api/luna35/pending-actions',pending),same=await api('/api/luna35/pending-actions',pending),listed=await api('/api/luna35/pending-actions?conversationId='+turn.data.conversationId);check('pending action persists exact language/intention/question and deduplicates',saved.status===200&&same.status===200&&listed.data.actions.some(a=>a.id===pending.id&&a.parameters.question===pending.action.question&&a.language==='ru')&&attempts===0);
  const resumed=await api('/api/luna35/pending-actions/'+pending.id+'/resume',{confirmed:true}),replayed=await api('/api/luna35/pending-actions/'+pending.id+'/resume',{confirmed:true});check('explicit continuation opens one real saved reading; repeat resumes the same message',resumed.status===200&&replayed.status===200&&resumed.data.message.id===replayed.data.message.id&&attempts===0);
  const month=new Date().toISOString().slice(0,7)+'-01',totals=await must(supabase.from('luna32_ai_month_totals').select('spent_cost_microusd,held_cost_microusd').eq('month',month).maybeSingle());check('there is no unresolved previous provider cost',!totals?.held_cost_microusd);
  Object.assign(env,{AI_CHAT_ENABLED:true,AI_MAX_MESSAGES_PER_DAY:100,AI_PREMIUM_MAX_MESSAGES_PER_DAY:100,AI_MAX_OUTPUT_TOKENS:1600,AI_STRUCTURED_MAX_OUTPUT_TOKENS:1600});
  await must(supabase.from('luna32_runtime_settings').update({generation_enabled:true,public_beta:true,beta_starts_at:new Date(Date.now()-60000).toISOString(),beta_expires_at:new Date(Date.now()+10*60000).toISOString(),cost_baseline_verified:true,baseline_month:month,legacy_monthly_cost_microusd:0,monthly_cap_microusd:Number(totals?.spent_cost_microusd??0)+20000,free_daily_limit:100,premium_daily_limit:100}).eq('id',true));
  const body={requestId:randomUUID(),mode:'companion',language:'en',message:'I am curious about personal growth and realistic intentions. Please use get_earning_opportunities first, then reflect on balancing curiosity with a steady routine in two short paragraphs and one thoughtful question. Do not save personal information or make a purchase.'};
  armed=true;let reply;try{reply=await api('/api/luna/chat',body);}finally{armed=false;}
  check('real supported model gives a complete tool-assisted response',reply.status===200&&attempts>0&&attempts<=3&&result.calls.some(c=>c.tools.includes('get_earning_opportunities'))&&Boolean(reply.data.message?.content)&&reply.data.message.metadata.commerce?.view==='earn');
  const before=attempts,retry=await api('/api/luna/chat',body),again=await api('/api/luna/conversations/'+reply.data.conversationId);check('successful AI response survives duplicate request and reopening with no new call',retry.status===200&&retry.data.duplicate===true&&retry.data.message.content===reply.data.message.content&&again.data.messages.some(m=>m.content===reply.data.message.content)&&attempts===before);
  result.answers=[{language:'en',text:reply.data.message.content,metadata:reply.data.message.metadata,conversationId:reply.data.conversationId,requestId:body.requestId}];
  const readings=(await api('/api/tarot/readings?offset=0')).data.readings;for(const kind of ['single','three','five']){const reading=readings.find(r=>(r.reading_kind??'single')===kind&&r.status==='ready');check(kind+' owned result reopens without generation or charge',Boolean(reading)&&(await api('/api/tarot/readings/'+reading.id)).status===200&&attempts===before);}
  const financial=await must(supabase.from('luna34_commercial_settings').select('*').eq('id',true).single());check('all financial and new-quota gates remain OFF',!financial.owner_approved&&!financial.checkout_enabled&&!financial.quotas_enabled&&!financial.rewards_enabled&&!financial.referrals_enabled);
  check('all provider usage is known and within the fresh approval',spent>0&&spent<=.02&&held===0&&result.calls.every(c=>c.httpStatus===200&&c.providerStatus==='completed'));
  result.status='PASS';result.commerceOnlyProviderCalls=0;result.savedResultsProviderCalls=0;
 }catch(error){result.status='FAIL';result.failure={code:error.code??error.name,message:String(error.message).slice(0,240)};}
 finally{
  globalThis.fetch=originalFetch;Object.assign(env,savedEnv);
  if(originalSettings){try{const{id:_id,updated_at:_updated,...restore}=originalSettings;await must(supabase.from('luna32_runtime_settings').update(restore).eq('id',true));}catch{result.status='FAIL';result.restoreFailure=true;}}
  try{result.protectedAfter=await fingerprint();check('paid rights, balance and garden remain exact',result.protectedBefore===result.protectedAfter);const settings=await must(supabase.from('luna32_runtime_settings').select('generation_enabled,public_beta').eq('id',true).single());check('staging generation is closed after the test',!settings.generation_enabled&&!settings.public_beta);}catch{result.status='FAIL';result.protectionFailure=true;}
 }
 result.providerCalls=attempts;result.actualCostUsd=spent;result.unknownCostUpperBoundUsd=held;
 await supabase.from('luna30_qa_report_runs').update({state:result.status==='PASS'?'completed':'failed',result}).eq('run_name',runName);
 console.log(JSON.stringify({luna35Smoke:result.status,providerCalls:attempts,actualCostUsd:spent,unknownCostUpperBoundUsd:held}));return new Response(null,{status:204});
}
